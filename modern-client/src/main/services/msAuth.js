const { BrowserWindow } = require('electron');
const config = require('./config');

const AUTHORIZE_URL = 'https://login.live.com/oauth20_authorize.srf';
const LIVE_TOKEN_URL = 'https://login.live.com/oauth20_token.srf';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const XBL_AUTH_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_AUTH_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_LOGIN_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';
const SCOPE = 'XboxLive.signin offline_access';

const XERR_MESSAGES = {
  2148916233: '이 Microsoft 계정에는 Xbox 계정이 없습니다. xbox.com에서 먼저 Xbox 계정을 만들어주세요.',
  2148916235: '이 계정은 지원되지 않는 국가/지역에서 사용 중입니다.',
  2148916236: '성인 인증이 필요한 계정입니다. Xbox 설정에서 성인 인증을 완료해주세요.',
  2148916237: '성인 인증이 필요한 계정입니다. Xbox 설정에서 성인 인증을 완료해주세요.',
  2148916238: '만 18세 미만 계정은 가족 그룹에 추가되어야 로그인할 수 있습니다.',
};

let currentAuthWindow = null;

function buildAuthorizeUrl(clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    prompt: 'select_account',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function loginViaBrowserWindow(clientId, parentWindow) {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 480,
      height: 640,
      title: 'Microsoft 로그인',
      autoHideMenuBar: true,
      parent: parentWindow || undefined,
      modal: !!parentWindow,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    currentAuthWindow = authWindow;
    let settled = false;

    function finish(fn, value) {
      if (settled) return;
      settled = true;
      currentAuthWindow = null;
      authWindow.removeAllListeners('closed');
      if (!authWindow.isDestroyed()) authWindow.close();
      fn(value);
    }

    function handleUrl(url) {
      if (!url.startsWith(REDIRECT_URI)) return;
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');
      const error = parsed.searchParams.get('error');
      if (code) {
        finish(resolve, code);
      } else if (error) {
        finish(reject, new Error(parsed.searchParams.get('error_description') || error));
      }
    }

    authWindow.webContents.on('will-redirect', (event, url) => handleUrl(url));
    authWindow.webContents.on('did-navigate', (event, url) => handleUrl(url));

    authWindow.on('closed', () => {
      currentAuthWindow = null;
      if (!settled) {
        settled = true;
        reject(new Error('로그인이 취소되었습니다.'));
      }
    });

    authWindow.loadURL(buildAuthorizeUrl(clientId));
  });
}

async function exchangeCodeForTokens(clientId, code) {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  });
  const res = await fetch(LIVE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`토큰 교환 실패: ${data.error_description || data.error || res.status}`);
  return data;
}

async function refreshMsTokens(clientId, refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    scope: SCOPE,
  });
  const res = await fetch(LIVE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Microsoft 로그인 갱신 실패: ${data.error_description || data.error || res.status}`);
  return data;
}

async function xboxLiveAuth(msAccessToken) {
  const res = await fetch(XBL_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  });
  if (!res.ok) throw new Error(`Xbox Live 인증 실패 (HTTP ${res.status})`);
  const data = await res.json();
  return { token: data.Token, uhs: data.DisplayClaims.xui[0].uhs };
}

async function xstsAuth(xblToken) {
  const res = await fetch(XSTS_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const message = XERR_MESSAGES[data.XErr] || `Xbox 인증 실패 (XErr ${data.XErr || '알 수 없음'})`;
    throw new Error(message);
  }
  return { token: data.Token, uhs: data.DisplayClaims.xui[0].uhs, xuid: data.DisplayClaims.xui[0].xid || '' };
}

async function minecraftLogin(uhs, xstsToken) {
  const res = await fetch(MC_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xstsToken}` }),
  });
  if (!res.ok) throw new Error(`Minecraft 서비스 로그인 실패 (HTTP ${res.status})`);
  return res.json();
}

async function fetchProfile(mcAccessToken) {
  const res = await fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });
  if (res.status === 404) {
    throw new Error('이 Microsoft 계정은 Minecraft: Java Edition을 소유하고 있지 않습니다.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('Minecraft 계정 조회 권한이 없습니다. Azure 앱이 아직 Microsoft의 승인을 받지 못했을 수 있습니다.');
  }
  if (!res.ok) throw new Error(`프로필 조회 실패 (HTTP ${res.status})`);
  return res.json();
}

function insertDashes(hex32) {
  const h = hex32.replace(/-/g, '');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function buildMinecraftSession(msTokens) {
  const xbl = await xboxLiveAuth(msTokens.access_token);
  const xsts = await xstsAuth(xbl.token);
  const mc = await minecraftLogin(xsts.uhs, xsts.token);
  const profile = await fetchProfile(mc.access_token);
  return {
    username: profile.name,
    uuid: insertDashes(profile.id),
    accessToken: mc.access_token,
    xuid: xsts.xuid,
    expiresAt: Date.now() + (mc.expires_in || 86400) * 1000,
    refreshToken: msTokens.refresh_token,
  };
}

async function loginWithMicrosoft(parentWindow) {
  const clientId = config.getMicrosoftClientId();
  const code = await loginViaBrowserWindow(clientId, parentWindow);
  const msTokens = await exchangeCodeForTokens(clientId, code);
  return buildMinecraftSession(msTokens);
}

function cancelLogin() {
  if (currentAuthWindow && !currentAuthWindow.isDestroyed()) {
    currentAuthWindow.close();
  }
  return { ok: true };
}

async function refreshMicrosoftSession(refreshTokenPlain) {
  const clientId = config.getMicrosoftClientId();
  const msTokens = await refreshMsTokens(clientId, refreshTokenPlain);
  return buildMinecraftSession(msTokens);
}

module.exports = { loginWithMicrosoft, cancelLogin, refreshMicrosoftSession };
