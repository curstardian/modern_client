const crypto = require('crypto');
const { randomUUID } = require('crypto');
const { readJson, writeJson } = require('./jsonStore');
const { accountsFile } = require('./paths');
const secureStore = require('./secureStore');

function offlineUuid(username) {
  const md5 = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  md5[6] = (md5[6] & 0x0f) | 0x30;
  md5[8] = (md5[8] & 0x3f) | 0x80;
  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function load() {
  return readJson(accountsFile(), { accounts: [], activeId: null });
}

function save(data) {
  writeJson(accountsFile(), data);
}

function normalize(account) {
  return { ...account, type: account.type || 'offline' };
}

function sanitize(account) {
  if (!account) return null;
  const { msRefreshTokenEnc, ...rest } = normalize(account);
  return rest;
}

function list() {
  return load().accounts.map(sanitize);
}

function getActive() {
  const data = load();
  return sanitize(data.accounts.find((a) => a.id === data.activeId));
}

function getRaw(id) {
  const data = load();
  const account = data.accounts.find((a) => a.id === id);
  return account ? normalize(account) : null;
}

function create(username) {
  const name = String(username || '').trim();
  if (!name) throw new Error('사용자 이름을 입력해주세요.');
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
    throw new Error('사용자 이름은 3~16자의 영문/숫자/밑줄만 가능합니다.');
  }
  const data = load();
  if (data.accounts.some((a) => a.username.toLowerCase() === name.toLowerCase())) {
    throw new Error('이미 존재하는 계정입니다.');
  }
  const account = {
    id: randomUUID(),
    type: 'offline',
    username: name,
    uuid: offlineUuid(name),
    createdAt: Date.now(),
  };
  data.accounts.push(account);
  if (!data.activeId) data.activeId = account.id;
  save(data);
  return sanitize(account);
}

function createMicrosoft(session) {
  const data = load();
  let account = data.accounts.find((a) => a.type === 'microsoft' && a.uuid === session.uuid);
  const msRefreshTokenEnc = secureStore.encrypt(session.refreshToken);
  if (account) {
    account.username = session.username;
    account.msRefreshTokenEnc = msRefreshTokenEnc;
  } else {
    account = {
      id: randomUUID(),
      type: 'microsoft',
      username: session.username,
      uuid: session.uuid,
      msRefreshTokenEnc,
      createdAt: Date.now(),
    };
    data.accounts.push(account);
  }
  if (!data.activeId) data.activeId = account.id;
  save(data);
  return sanitize(account);
}

function updateMicrosoftToken(id, refreshTokenPlain) {
  const data = load();
  const account = data.accounts.find((a) => a.id === id);
  if (!account) throw new Error('존재하지 않는 계정입니다.');
  account.msRefreshTokenEnc = secureStore.encrypt(refreshTokenPlain);
  save(data);
  return sanitize(account);
}

function getMicrosoftRefreshToken(id) {
  const account = getRaw(id);
  if (!account || account.type !== 'microsoft' || !account.msRefreshTokenEnc) {
    throw new Error('Microsoft 로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
  }
  return secureStore.decrypt(account.msRefreshTokenEnc);
}

function remove(id) {
  const data = load();
  data.accounts = data.accounts.filter((a) => a.id !== id);
  if (data.activeId === id) {
    data.activeId = data.accounts.length ? data.accounts[0].id : null;
  }
  save(data);
  return { ok: true };
}

function setActive(id) {
  const data = load();
  if (!data.accounts.some((a) => a.id === id)) throw new Error('존재하지 않는 계정입니다.');
  data.activeId = id;
  save(data);
  return { ok: true };
}

module.exports = {
  list,
  create,
  createMicrosoft,
  updateMicrosoftToken,
  getMicrosoftRefreshToken,
  remove,
  setActive,
  getActive,
  getRaw,
  offlineUuid,
};
