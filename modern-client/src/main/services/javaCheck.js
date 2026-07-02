const { dialog } = require('electron');
const { spawn } = require('child_process');

async function browseJava(win) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Java 실행 파일 선택',
    properties: ['openFile'],
    filters: process.platform === 'win32'
      ? [{ name: 'Java', extensions: ['exe'] }]
      : [{ name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true, path: '' };
  return { canceled: false, path: result.filePaths[0] };
}

function validateJava(javaPath) {
  const bin = javaPath && javaPath.trim() ? javaPath.trim() : 'java';
  return new Promise((resolve) => {
    let output = '';
    let child;
    try {
      child = spawn(bin, ['-version']);
    } catch (err) {
      resolve({ ok: false, version: null, error: err.message });
      return;
    }
    child.on('error', (err) => {
      resolve({ ok: false, version: null, error: err.message });
    });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.on('close', (code) => {
      const match = output.match(/version "([^"]+)"/);
      if (code === 0 && match) {
        resolve({ ok: true, version: match[1], error: null });
      } else if (match) {
        resolve({ ok: true, version: match[1], error: null });
      } else {
        resolve({ ok: false, version: null, error: '자바 버전을 확인할 수 없습니다.' });
      }
    });
  });
}

module.exports = { browseJava, validateJava };
