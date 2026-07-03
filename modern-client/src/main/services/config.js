const path = require('path');
const { readJson } = require('./jsonStore');

const MSAUTH_FILE = path.join(__dirname, '..', '..', '..', 'config', 'msauth.json');
const CURSEFORGE_FILE = path.join(__dirname, '..', '..', '..', 'config', 'curseforge.json');

function getMicrosoftClientId() {
  const data = readJson(MSAUTH_FILE, { microsoftClientId: '' });
  const clientId = (data.microsoftClientId || '').trim();
  if (!clientId) {
    throw new Error('Microsoft 로그인을 사용하려면 config/msauth.json 에 microsoftClientId 값을 설정해주세요.');
  }
  return clientId;
}

function getCurseForgeApiKey() {
  const data = readJson(CURSEFORGE_FILE, { curseforgeApiKey: '' });
  return (data.curseforgeApiKey || '').trim();
}

module.exports = { getMicrosoftClientId, getCurseForgeApiKey };
