'use strict';
// Versões do Cypher: oficiais "X.Y.Z" e Preview "X.Y.Z-beta.N".

const PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/;

function parseVersion(value) {
  const match = typeof value === 'string' ? PATTERN.exec(value) : null;
  if (!match) return null;
  return { major: +match[1], minor: +match[2], patch: +match[3], pre: match[4] ? +match[4] : null };
}

function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right);
  if (!a || !b) throw new Error(`Versão inválida: ${!a ? left : right}`);
  for (const key of ['major', 'minor', 'patch']) if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1; // a oficial vem depois de qualquer beta da mesma versão
  if (b.pre === null) return -1;
  return a.pre > b.pre ? 1 : -1;
}

function baseVersion(value) {
  const parsed = parseVersion(value);
  return parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : '';
}

function isPreview(value) { return parseVersion(value)?.pre != null; }

/** Bloqueia só com um mínimo válido e quando a versão-base atual fica abaixo dele. */
function isBlocked(current, minimum) {
  if (!parseVersion(minimum) || !parseVersion(current)) return false;
  return compareVersions(baseVersion(current), baseVersion(minimum)) < 0;
}

module.exports = { parseVersion, compareVersions, baseVersion, isPreview, isBlocked };
