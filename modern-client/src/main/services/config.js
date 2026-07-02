const path = require('path');
const { readJson } = require('./jsonStore');

const CONFIG_FILE = path.join(__dirname, '..', '..', '..', 'config', 'msauth.json');

function getMicrosoftClientId() {
  const data = readJson(CONFIG_FILE, { microsoftClientId: '' });
  const clientId = (data.microsoftClientId || '').trim();
  if (!clientId) {
    throw new Error('Microsoft 로그인을 사용하려면 config/msauth.json 에 microsoftClientId 값을 설정해주세요.');
  }
  return clientId;
}

module.exports = { getMicrosoftClientId };
