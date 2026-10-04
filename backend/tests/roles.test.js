const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { ROLE_DEFS, TENANT_ROLES, ROLES, normalizeRole, isTenantRole } = require('../models/roles');

test('normalizeRole convierte el typo viejo y respeta el resto', () => {
  assert.equal(normalizeRole('hosstess'), 'host');
  assert.equal(normalizeRole('waiter'), 'waiter');
  assert.equal(normalizeRole(undefined), undefined);
  assert.ok(isTenantRole('hosstess'));
  assert.ok(!isTenantRole('platform_admin'));
});

test('cada rol del negocio tiene etiqueta, descripción y pantallas', () => {
  for (const r of ROLE_DEFS) {
    assert.ok(r.label && r.description && r.sees.length, `rol ${r.id} incompleto`);
  }
  assert.deepEqual(ROLES, [...TENANT_ROLES, 'platform_admin']);
});

test('el frontend y el backend definen exactamente los mismos roles', async () => {
  const front = await import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'roles.js')).href);
  assert.deepEqual(front.ROLE_DEFS.map((r) => r.id), TENANT_ROLES);
  for (const r of ROLE_DEFS) {
    const f = front.ROLE_DEFS.find((x) => x.id === r.id);
    assert.equal(f.label, r.label, `etiqueta distinta para ${r.id}`);
  }
});

test('todo rol cae en una pantalla a la que sí puede entrar, y esa pantalla existe', async () => {
  const front = await import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'roles.js')).href);
  for (const role of [...TENANT_ROLES, 'platform_admin']) {
    const home = front.homeForRole(role);
    const screen = front.SCREENS.find((s) => s.name === home);
    assert.ok(screen, `la pantalla de inicio "${home}" de ${role} no existe`);
    assert.ok(screen.roles.includes(role), `${role} no puede entrar a su propia pantalla de inicio (${home})`);
  }
  // Ninguna pantalla puede mencionar un rol que no existe.
  for (const s of front.SCREENS) {
    for (const r of s.roles) assert.ok(ROLES.includes(r), `pantalla ${s.name} usa el rol desconocido ${r}`);
  }
});
