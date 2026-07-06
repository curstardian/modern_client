const { safeStorage } = require('electron');

function encrypt(plainText) {
  if (!safeStorage.isEncryptionAvailable()) return `plain:${plainText}`;
  return safeStorage.encryptString(plainText).toString('base64');
}

function decrypt(stored) {
  if (!stored) return '';
  if (stored.startsWith('plain:')) return stored.slice('plain:'.length);
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('저장된 자격 증명을 복호화할 수 없습니다 (암호화 기능을 사용할 수 없음).');
  }
  return safeStorage.decryptString(Buffer.from(stored, 'base64'));
}

module.exports = { encrypt, decrypt };
