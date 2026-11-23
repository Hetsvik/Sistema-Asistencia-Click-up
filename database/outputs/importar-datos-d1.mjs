#!/usr/bin/env node
// Prepara datos de una BD SQLite o dump .sql para importarlos a Cloudflare D1.
// No consulta Cloudflare ni ejecuta cambios remotos: solo genera un SQL local.
// Requiere Node.js 22.5+ (node:sqlite).
// Uso: node importar-datos-d1.mjs <origen.sqlite|origen.sql> <esquema_web_cloudflare.sql> [salida.sql]

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const [sourceArg, schemaArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !schemaArg) {
  console.error('Uso: node importar-datos-d1.mjs <origen.sqlite|origen.sql> <esquema_web_cloudflare.sql> [salida.sql]');
  process.exit(2);
}
const sourcePath = resolve(sourceArg);
const schemaPath = resolve(schemaArg);
const outputPath = resolve(outputArg || 'datos_para_d1.sql');
const excluded = new Set(['Actividades', 'Archivos', 'Evaluaciones_Rendimiento']);
const ITERATIONS = 100_000;
const quoteId = (name) => `"${String(name).replaceAll('"', '""')}"`;
const quote = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
};
const pinHash = (pin) => {
  const value = String(pin ?? '');
  if (value.startsWith('pbkdf2$')) return value;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(value, salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
};
const openSource = (path) => {
  if (!path.toLowerCase().endsWith('.sql')) return new DatabaseSync(path, { readOnly: true });
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(path, 'utf8'));
  return db;
};
const source = openSource(sourcePath);
const target = new DatabaseSync(':memory:');
target.exec(readFileSync(schemaPath, 'utf8'));
const targetTables = target.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x => x.name).filter(n => !excluded.has(n));
const targetSet = new Set(targetTables);
const sourceTables = new Set(source.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x => x.name));
const quoteRows = [];
const hasColumn = (db, table, col) => db.prepare(`PRAGMA table_xinfo(${quoteId(table)})`).all().some(c => c.name === col && c.hidden === 0);
const columns = (db, table) => db.prepare(`PRAGMA table_xinfo(${quoteId(table)})`).all().filter(c => c.hidden === 0);

// Orden topológico por claves foráneas, para conservar las restricciones de D1.
const ordered = [];
const visited = new Set();
const visiting = new Set();
function visit(table) {
  if (visited.has(table) || visiting.has(table)) return;
  visiting.add(table);
  for (const fk of target.prepare(`PRAGMA foreign_key_list(${quoteId(table)})`).all()) if (targetSet.has(fk.table)) visit(fk.table);
  visiting.delete(table);
  visited.add(table);
  ordered.push(table);
}
for (const table of targetTables) visit(table);

// Las tablas se importan con INSERT OR IGNORE para que reintentar no sobrescriba filas.
// Los triggers se suspenden durante este único archivo para no crear notificaciones
// automáticas duplicadas al restaurar tareas históricas; se recrean al final.
const triggers = target.prepare("SELECT sql FROM sqlite_schema WHERE type='trigger' ORDER BY name").all().map(x => x.sql);
const triggerNames = target.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' ORDER BY name").all().map(x => x.name);
const lines = [
  `-- Datos exportados desde ${basename(sourcePath)}. Contiene información privada y hashes de PIN.`,
  '-- No publiques ni subas este archivo a Git. Requiere esquema ya aplicado hasta 0019.',
  '-- Ejecutar una sola vez sobre la base destino; INSERT OR IGNORE evita sobrescribir filas.',
  '-- Los triggers se retiran y recrean dentro del archivo para evitar efectos duplicados.',
  ...triggerNames.map(n => `DROP TRIGGER IF EXISTS ${quoteId(n)};`),
  '',
];
let importedTables = 0;
let importedRows = 0;
for (const table of ordered) {
  if (!sourceTables.has(table) || table === 'Roles_Sistema') continue;
  let rows = source.prepare(`SELECT * FROM ${quoteId(table)} ORDER BY 1`).all();
  if (!rows.length) continue;
  const targetCols = columns(target, table);
  const targetColNames = targetCols.map(c => c.name);
  const sourceColNames = new Set(columns(source, table).map(c => c.name));
  const legacyProject = (table === 'Tareas' || table === 'Tareas_Express') && sourceColNames.has('ID_Proyecto') && sourceTables.has('Proyectos');
  const projects = legacyProject
    ? new Map(source.prepare('SELECT ID_Proyecto, Nombre_Proyecto FROM Proyectos').all().map(p => [p.ID_Proyecto, p.Nombre_Proyecto]))
    : null;
  rows = rows.map(original => {
    const row = { ...original };
    if (legacyProject) {
      row.Nombre_Tarea = projects.get(row.ID_Proyecto) || (table === 'Tareas' ? 'Tarea' : 'Tarea express');
      delete row.ID_Proyecto;
    }
    if ((table === 'Administrador' || table === 'Trabajadores') && row.PIN_Acceso !== undefined) row.PIN_Acceso = pinHash(row.PIN_Acceso);
    return row;
  });
  const outputCols = targetColNames.filter(c => rows.some(row => Object.hasOwn(row, c)));
  for (const col of targetCols) {
    if (col.notnull && col.dflt_value === null && !col.pk && !outputCols.includes(col.name)) {
      throw new Error(`La tabla ${table} requiere la columna ${col.name}, ausente en el origen. Usa un respaldo compatible o completa esa columna antes de importar.`);
    }
  }
  if (!outputCols.length) continue;
  lines.push(`-- ${table}: ${rows.length} filas`);
  for (const row of rows) {
    lines.push(`INSERT OR IGNORE INTO ${quoteId(table)} (${outputCols.map(quoteId).join(', ')}) VALUES (${outputCols.map(c => quote(row[c])).join(', ')});`);
  }
  lines.push('');
  importedTables++;
  importedRows += rows.length;
}

// Repone las cuentas e identidades que la migración 0009 genera al migrar registros.
// Si el respaldo ya contiene estas tablas, sus filas se importaron arriba.
if (!sourceTables.has('Cuentas_Usuario')) {
  lines.push('-- Cuentas de acceso derivadas de Administrador y Trabajadores');
  lines.push("INSERT OR IGNORE INTO Cuentas_Usuario (ID_Empleado, Rol) SELECT ID_Empleado, 'admin' FROM Administrador;");
  lines.push("INSERT OR IGNORE INTO Cuentas_Usuario (ID_Empleado, Rol) SELECT ID_Empleado, 'trabajador' FROM Trabajadores;");
  importedTables++;
}
if (!sourceTables.has('Identidad_Usuario')) {
  const employees = sourceTables.has('Empleados') ? source.prepare('SELECT ID_Empleado, Nombre_Completo, Correo FROM Empleados ORDER BY ID_Empleado').all() : [];
  const admins = new Set(sourceTables.has('Administrador') ? source.prepare('SELECT ID_Empleado FROM Administrador').all().map(x => x.ID_Empleado) : []);
  const workers = new Set(sourceTables.has('Trabajadores') ? source.prepare('SELECT ID_Empleado FROM Trabajadores').all().map(x => x.ID_Empleado) : []);
  const used = new Set();
  const slug = (s) => [...String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['-]/g, '')].filter(c => /[a-z]/.test(c)).join('').slice(0, 40) || 'persona';
  lines.push('-- Identidades corporativas generadas con la misma convención de la migración 0009');
  for (const e of employees) {
    if (!admins.has(e.ID_Empleado) && !workers.has(e.ID_Empleado)) continue;
    const first = String(e.Nombre_Completo || '').trim().split(/\s+/)[0] || 'persona';
    const prefix = admins.has(e.ID_Empleado) ? 'admin.' : 'user.';
    const base = prefix + slug(first);
    let email = `${base}@arqyservgen.com`, suffix = 2;
    while (used.has(email.toLowerCase())) email = `${base}${suffix++}@arqyservgen.com`;
    used.add(email.toLowerCase());
    lines.push(`INSERT OR IGNORE INTO Identidad_Usuario (ID_Empleado, Nombres, Apellido_Paterno, Apellido_Materno, Correo_Personal, Correo_Corporativo, Revisar_Nombre, Requiere_Clave) VALUES (${quote(e.ID_Empleado)}, ${quote(e.Nombre_Completo)}, '', '', ${quote(e.Correo)}, ${quote(email)}, 1, 0);`);
    importedRows++;
  }
  importedTables++;
  lines.push('');
}
lines.push(...triggers.map(sql => `${sql};`));
lines.push('');
writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`SQL generado: ${outputPath}`);
console.log(`Tablas con datos: ${importedTables}; filas fuente: ${importedRows}`);
console.log('El SQL incluye datos privados y hashes de PIN. Protege y elimina el archivo después de importarlo.');
source.close();
target.close();
