function splitSegments(version) {
  return String(version || '')
    .replace(/[+-].*$/, '')
    .split('.')
    .map((seg) => {
      const n = Number(seg);
      return Number.isNaN(n) ? seg : n;
    });
}

function compareVersions(a, b) {
  const segA = splitSegments(a);
  const segB = splitSegments(b);
  const len = Math.max(segA.length, segB.length);
  for (let i = 0; i < len; i += 1) {
    const x = segA[i] ?? 0;
    const y = segB[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

function satisfiesClause(version, clause) {
  const trimmed = clause.trim();
  if (!trimmed || trimmed === '*') return true;
  const match = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(trimmed);
  if (!match) return true;
  const [, op, ref] = match;
  const cmp = compareVersions(version, ref);
  switch (op) {
    case '>=': return cmp >= 0;
    case '<=': return cmp <= 0;
    case '>': return cmp > 0;
    case '<': return cmp < 0;
    case '=': return cmp === 0;
    case '^': {
      const refSeg = splitSegments(ref);
      const verSeg = splitSegments(version);
      return verSeg[0] === refSeg[0] && cmp >= 0;
    }
    case '~': {
      const refSeg = splitSegments(ref);
      const verSeg = splitSegments(version);
      return verSeg[0] === refSeg[0] && verSeg[1] === refSeg[1] && cmp >= 0;
    }
    default: return cmp === 0;
  }
}

function satisfiesRange(version, range) {
  if (!range || !version) return true;
  return String(range).split(',').every((clause) => satisfiesClause(version, clause));
}

module.exports = { compareVersions, satisfiesRange };
