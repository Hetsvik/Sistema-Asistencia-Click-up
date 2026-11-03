import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../frontend/', import.meta.url));
function walk(dir, skipStatic = false) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return skipStatic && entry.name === 'static' ? [] : walk(path, skipStatic);
    return [path];
  });
}
function imports(path) {
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)]
    .map(m => resolve(dirname(path), m[1]));
}
function verifyModules(entries) {
  const seen = new Set();
  const visit = (path, from = 'HTML') => {
    assert.ok(existsSync(path), `Falta ${relative(root, path)} (referenciado desde ${from})`);
    if (!path.endsWith('.js') || seen.has(path)) return;
    seen.add(path);
    for (const dep of imports(path)) visit(dep, relative(root, path));
  };
  for (const p of entries) visit(p);
}
test('todos los módulos fuente tienen sus dependencias', () => {
  verifyModules(walk(join(root, 'js')).filter(p => p.endsWith('.js')));
});
test('los recursos versionados referenciados por cada página incluyen sus módulos', () => {
  const entries = [];
  for (const path of walk(root, true).filter(p => p.endsWith('.html'))) {
    const html = readFileSync(path, 'utf8');
    for (const match of html.matchAll(/(?:src|href)=["'](\/static\/[^"']+)["']/g)) {
      entries.push(join(root, match[1].slice(1)));
    }
  }
  assert.ok(entries.length > 0, 'No se encontraron recursos versionados');
  verifyModules(entries);
});
