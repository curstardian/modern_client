const fs = require('fs');
const { spawn } = require('child_process');
const paths = require('./paths');
const downloader = require('./downloader');
const zipReader = require('./zipReader');
const versionsLibrary = require('./versionsLibrary');
const { writeJson } = require('./jsonStore');

const PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';

async function listForgeVersions(mcVersion) {
  const res = await fetch(PROMOTIONS_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Forge 버전 목록을 불러오지 못했습니다 (HTTP ${res.status})`);
  const data = await res.json();
  const promos = data.promos || {};
  const result = [];
  if (promos[`${mcVersion}-recommended`]) {
    result.push({ forgeVersion: promos[`${mcVersion}-recommended`], label: 'recommended' });
  }
  if (promos[`${mcVersion}-latest`]) {
    result.push({ forgeVersion: promos[`${mcVersion}-latest`], label: 'latest' });
  }
  return result;
}

function ensureLauncherProfilesPlaceholder() {
  const file = paths.launcherProfilesFile();
  if (!fs.existsSync(file)) {
    writeJson(file, { profiles: {} });
  }
}

function runInstaller(javaPath, installerPath, targetDir, onLog) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(javaPath, ['-jar', installerPath, '--installClient', targetDir], { cwd: targetDir });
    } catch (err) {
      reject(err);
      return;
    }
    child.stdout.on('data', (chunk) => onLog && onLog({ stream: 'stdout', line: chunk.toString() }));
    child.stderr.on('data', (chunk) => onLog && onLog({ stream: 'stderr', line: chunk.toString() }));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Forge 설치 프로그램이 오류 코드 ${code}로 종료되었습니다.`));
    });
  });
}

async function installForge(mcVersion, forgeVersion, { javaPath, onProgress, onLog } = {}) {
  const id = `${mcVersion}-${forgeVersion}`;
  const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${id}/forge-${id}-installer.jar`;
  const installerPath = paths.installerFile(`forge-${id}-installer.jar`);

  if (onProgress) onProgress({ phase: 'download-installer', current: 0, total: 1 });
  fs.rmSync(installerPath, { force: true });
  await downloader.downloadOne({
    dest: installerPath, url: installerUrl, sha1: null, size: null, name: `forge-${id}-installer.jar`,
  });

  const versionJsonBuf = zipReader.readZipEntry(installerPath, 'version.json');
  if (!versionJsonBuf) throw new Error('Forge 설치 프로그램에서 version.json을 찾을 수 없습니다.');
  const versionMeta = JSON.parse(versionJsonBuf.toString('utf8'));
  const versionId = versionMeta.id;

  ensureLauncherProfilesPlaceholder();

  if (onProgress) onProgress({ phase: 'install', current: 0, total: 1 });
  await runInstaller(javaPath || 'java', installerPath, paths.userDataRoot(), onLog);

  if (!fs.existsSync(paths.versionJsonFile(versionId))) {
    throw new Error('Forge 설치가 완료되었지만 버전 정보 파일을 찾을 수 없습니다.');
  }

  versionsLibrary.recordMeta(versionId, { loader: 'forge', mcVersion, loaderVersion: forgeVersion });
  return { versionId };
}

module.exports = { listForgeVersions, installForge };
