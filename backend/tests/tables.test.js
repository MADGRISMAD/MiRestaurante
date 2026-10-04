const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers'); // variables de entorno de prueba
const { assignmentPatch } = require('../controllers/tables.controller');

const now = new Date('2026-10-04T20:00:00Z');
const host = { username: 'hostess', cellphone: '' };
const lucia = { username: 'lucia', cellphone: '5512345678' };
const free = { disponible: true, mesero: null };

test('la hostess sienta clientes con mesero: se avisa al mesero', () => {
  const out = assignmentPatch(free, { disponible: false, mesero: '5512345678' }, host, now);
  assert.deepEqual(out, { asignadaEn: now, asignadaPor: 'hostess', avisoVisto: false });
});

test('sentar sin mesero no genera aviso', () => {
  assert.deepEqual(assignmentPatch(free, { disponible: false }, host, now), {});
});

test('si el mesero se sienta su propia mesa no se avisa a sí mismo', () => {
  const out = assignmentPatch(free, { disponible: false, mesero: '5512345678' }, lucia, now);
  assert.equal(out.avisoVisto, true);
});

test('cambiar de mesero en una mesa ocupada avisa al nuevo', () => {
  const busy = { disponible: false, mesero: '5511111111', avisoVisto: true };
  const out = assignmentPatch(busy, { mesero: '5512345678' }, host, now);
  assert.equal(out.avisoVisto, false);
  assert.equal(out.asignadaEn, now);
});

test('guardar el mismo mesero o asignar mesero a mesa libre no avisa', () => {
  const busy = { disponible: false, mesero: '5512345678', avisoVisto: true };
  assert.deepEqual(assignmentPatch(busy, { mesero: '5512345678' }, host, now), {});
  assert.deepEqual(assignmentPatch(free, { mesero: '5512345678' }, host, now), {});
});

test('el mesero confirma el aviso', () => {
  const busy = { disponible: false, mesero: '5512345678', avisoVisto: false };
  assert.deepEqual(assignmentPatch(busy, { avisoVisto: true }, lucia, now), { avisoVisto: true });
});

test('liberar la mesa limpia la asignación', () => {
  const busy = { disponible: false, mesero: '5512345678', avisoVisto: false };
  assert.deepEqual(assignmentPatch(busy, { disponible: true }, host, now), {
    asignadaEn: null, asignadaPor: null, avisoVisto: null, personas: null,
  });
});
