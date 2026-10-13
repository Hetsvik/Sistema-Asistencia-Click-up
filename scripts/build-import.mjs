#!/usr/bin/env node
// Genera el archivo de importación de DATOS a partir de tu schema.sql original.
//   - Lee las tablas con sus filas (ejecutando el schema en una SQLite en memoria).
//   - Convierte los PIN en texto plano a hash PBKDF2 (mismo formato que usa el Worker).
//   - Usa INSERT OR IGNORE: se puede ejecutar varias veces y NO pisa datos que ya existan en D1.
//   - Omite columnas generadas (Fecha_Calculada, Estado_Asistencia): SQLite las recalcula.
//
// Uso:  node scripts/build-import.mjs [schema.sql] [salida.sql]
// Requiere Node 22.5 o superior (usa node:sqlite).

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const [input = 'database/private/schema.original.sql', output = 'database/private/datos_iniciales.sql'] = process.argv.slice(2);
const pinsOutput = output.replace(/[^/\\]*$/, 'actualizar_pins.sql');

// Orden que respeta las claves foráneas (D1 siempre las valida).
const TABLES = ['Empleados', 'Administrador', 'Trabajadores', 'Proyectos', 'Tareas', 'Actividades', 'Archivos',
  'Asistencia', 'Comentarios_Tarea', 'Evaluaciones_Rendimiento'];
const PIN_COLUMN = { Administrador: 'PIN_Acceso', Trabajadores: 'PIN_Acceso' };
const ITERATIONS = 100_000;

const hashPin = (pin) => {
  if (String(pin).startsWith('pbkdf2$')) return pin; // ya está hasheado
  const salt = randomBytes(16);
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${pbkdf2Sync(String(pin), salt, ITERATIONS, 32, 'sha256').toString('base64')}`;
};

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(input, 'utf8'));
const quote = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

const lines = [
  '-- Generado por scripts/build-import.mjs · CONTIENE DATOS REALES (PIN ya hasheados). No subir a git.',
  '-- Seguro de re-ejecutar: INSERT OR IGNORE.', '',
];
const counts = {};
const pinUpdates = [
  '-- Hashea los PIN en texto plano que ya existan en la BD. Solo toca filas que aún no estén hasheadas.',
  '-- Seguro de re-ejecutar. CONTIENE HASHES DE PINES REALES: no subir a git.', '',
];
const CODE_COLUMN = { Administrador: 'Codigo_Administrador', Trabajadores: 'Codigo_Trabajador' };
for (const table of TABLES) {
  const cols = db.prepare(`PRAGMA table_xinfo(${table})`).all().filter((c) => c.hidden === 0).map((c) => c.name);
  const rows = db.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM ${table} ORDER BY 1`).all();
  counts[table] = rows.length;
  if (!rows.length) continue;
  lines.push(`-- ${table} (${rows.length})`);
  for (let row of rows) {
    if (PIN_COLUMN[table]) {
      const hashed = hashPin(row[PIN_COLUMN[table]]);
      row = { ...row, [PIN_COLUMN[table]]: hashed };
      pinUpdates.push(`UPDATE ${table} SET ${PIN_COLUMN[table]} = ${quote(hashed)} WHERE ${CODE_COLUMN[table]} = ${quote(row[CODE_COLUMN[table]])} AND ${PIN_COLUMN[table]} NOT LIKE 'pbkdf2$%';`);
    }
    const values = cols.map((c) => quote(row[c]));
    lines.push(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')});`);
  }
  lines.push('');
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, lines.join('\n'));
writeFileSync(pinsOutput, pinUpdates.join('\n') + '\n');
console.log(`Archivos generados: ${output} y ${pinsOutput}`);
console.table(counts);
