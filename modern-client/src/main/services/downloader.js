const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

function sha1File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function isValid(dest, sha1, size) {
  try {
    const stat = fs.statSync(dest);
    if (size != null && stat.size !== size) return false;
    if (sha1) {
      const actual = await sha1File(dest);
      if (actual !== sha1) return false;
    }
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

async function downloadOne(task, attempt = 1) {
  if (await isValid(task.dest, task.sha1, task.size)) return { skipped: true };
  const tmp = `${task.dest}.tmp-${process.pid}`;
  try {
    fs.mkdirSync(require('path').dirname(task.dest), { recursive: true });
    const res = await fetch(task.url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${task.url}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    if (task.sha1) {
      const actual = await sha1File(tmp);
      if (actual !== task.sha1) throw new Error(`sha1 불일치: ${task.dest}`);
    }
    fs.renameSync(tmp, task.dest);
    return { skipped: false };
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    if (attempt < 3) return downloadOne(task, attempt + 1);
    throw err;
  }
}

async function downloadAll(tasks, { concurrency = 8, onProgress } = {}) {
  let idx = 0;
  let done = 0;
  const total = tasks.length;
  async function worker() {
    while (idx < tasks.length) {
      const task = tasks[idx++];
      await downloadOne(task);
      done += 1;
      if (onProgress) onProgress({ current: done, total, fileName: task.name || task.dest });
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length || 1) }, worker);
  await Promise.all(workers);
}

module.exports = { sha1File, isValid, downloadOne, downloadAll };
