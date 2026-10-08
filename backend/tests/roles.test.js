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

// ——— Modo Café (mostrador) ———
const { COUNTER_BUSINESS_TYPES, COUNTER_MAX_USERS, COUNTER_ROLES, modeOf, limitsFor } = require('../models/venueMode');
const frontRoles = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'roles.js')).href);

test('café: el frontend y el backend coinciden en tipo de negocio, tope de personas y roles', async () => {
  const front = await frontRoles();
  assert.deepEqual(front.COUNTER_BUSINESS_TYPES, COUNTER_BUSINESS_TYPES);
  assert.equal(front.COUNTER_MAX_USERS, COUNTER_MAX_USERS);
  assert.deepEqual(front.COUNTER_ROLES, COUNTER_ROLES);
  for (const type of ['cafe', 'restaurant', 'bar', 'hotel', 'other', undefined]) {
    assert.equal(front.modeForBusinessType(type), modeOf({ businessType: type }), `modo de "${type}"`);
  }
  assert.equal(limitsFor({ businessType: 'cafe' }).maxUsers, 2);
  assert.equal(limitsFor({ businessType: 'restaurant' }).maxUsers, null);
});

test('café: cada rol permitido entra directo al mostrador y esa pantalla existe y le sirve', async () => {
  const front = await frontRoles();
  for (const role of COUNTER_ROLES) {
    const home = front.homeForRole(role, 'counter');
    assert.equal(home, 'counter', role);
    assert.ok(front.canAccessScreen(home, role, 'counter'), `${role} no puede entrar a su inicio`);
  }
  assert.ok(front.COUNTER_ROLES.every((r) => front.COUNTER_ROLE_COPY[r]?.sees?.length), 'falta el texto de algún rol del café');
});

test('café: no existe ninguna pantalla del flujo de salón, ni para el admin', async () => {
  const front = await frontRoles();
  for (const name of ['main', 'kitchen', 'waitlist', 'staff']) {
    for (const role of ['admin', 'cashier', 'waiter', 'kitchen', 'host']) {
      assert.equal(front.canAccessScreen(name, role, 'counter'), false, `${role} no debería ver "${name}" en un café`);
    }
  }
  // El menú solo lo edita el admin; el cajero vende desde el mostrador.
  assert.equal(front.canAccessScreen('menu', 'admin', 'counter'), true);
  assert.equal(front.canAccessScreen('menu', 'cashier', 'counter'), false);
  // Lo común sigue disponible.
  for (const name of ['dashboard', 'orders', 'billing', 'printOrder', 'printCash']) {
    assert.equal(front.canAccessScreen(name, 'cashier', 'counter') || front.canAccessScreen(name, 'admin', 'counter'), true, name);
  }
  for (const name of ['team', 'settings']) assert.equal(front.canAccessScreen(name, 'admin', 'counter'), true, name);
});

test('salón: el mostrador no existe y todo lo de siempre sigue igual', async () => {
  const front = await frontRoles();
  for (const role of [...TENANT_ROLES, 'platform_admin']) {
    assert.equal(front.canAccessScreen('counter', role, 'table'), false, `${role} no debería ver el mostrador en un restaurante`);
  }
  assert.equal(front.canAccessScreen('main', 'waiter', 'table'), true);
  assert.equal(front.canAccessScreen('kitchen', 'kitchen', 'table'), true);
  assert.equal(front.homeForRole('host', 'table'), 'waitlist');
  assert.equal(front.homeForRole('kitchen', 'table'), 'kitchen');
  assert.equal(front.homeForRole('platform_admin', 'counter'), 'platform', 'la plataforma no depende del modo');
});

test('cada pantalla declara modos válidos y el mostrador solo existe en modo mostrador', async () => {
  const front = await frontRoles();
  for (const s of front.SCREENS) {
    assert.ok(Array.isArray(s.modes) && s.modes.length, `${s.name} sin modos`);
    for (const m of s.modes) assert.ok(['table', 'counter'].includes(m), `${s.name}: modo "${m}" desconocido`);
    for (const r of s.counterRoles || []) assert.ok(s.roles.includes(r), `${s.name}: counterRoles debe ser un subconjunto de roles`);
  }
  assert.deepEqual(front.SCREENS.find((s) => s.name === 'counter').modes, ['counter']);
});
