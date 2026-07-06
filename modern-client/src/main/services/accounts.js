const { randomUUID } = require('crypto');
const { readJson, writeJson } = require('./jsonStore');
const { accountsFile } = require('./paths');
const secureStore = require('./secureStore');

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
  createMicrosoft,
  updateMicrosoftToken,
  getMicrosoftRefreshToken,
  remove,
  setActive,
  getActive,
  getRaw,
};
