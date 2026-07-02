const fs = require('fs');
const { randomUUID } = require('crypto');
const { readJson, writeJson } = require('./jsonStore');
const paths = require('./paths');

let activeId = null;

function list() {
  const root = paths.instancesRoot();
  const ids = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  return ids
    .map((id) => readJson(paths.instanceFile(id), null))
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function get(id) {
  return readJson(paths.instanceFile(id), null);
}

function create({ name, versionId, overrides }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('인스턴스 이름을 입력해주세요.');
  if (!versionId) throw new Error('버전을 선택해주세요.');
  const id = randomUUID();
  paths.instanceGameDir(id);
  const instance = {
    id,
    name: trimmed,
    versionId,
    overrides: overrides || {},
    createdAt: Date.now(),
  };
  writeJson(paths.instanceFile(id), instance);
  if (!activeId) activeId = id;
  return instance;
}

function update(id, patch) {
  const current = get(id);
  if (!current) throw new Error('존재하지 않는 인스턴스입니다.');
  const next = { ...current, ...patch, id: current.id, createdAt: current.createdAt };
  writeJson(paths.instanceFile(id), next);
  return next;
}

function remove(id) {
  const dir = paths.instanceDir(id);
  fs.rmSync(dir, { recursive: true, force: true });
  if (activeId === id) activeId = null;
  return { ok: true };
}

function setActive(id) {
  if (!get(id)) throw new Error('존재하지 않는 인스턴스입니다.');
  activeId = id;
  return { ok: true };
}

function getActive() {
  if (!activeId) return null;
  return get(activeId);
}

module.exports = { list, get, create, update, remove, setActive, getActive };
