const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, startServer } = require('./helpers');

const { app, state, tokenFor } = loadApp();
let api;
test.before(async () => { api = await startServer(app); });
test.after(async () => { await api.close(); });

// Dos negocios: t1 (el que probamos) y t2 (no debe verse ni tocarse desde t1).
state.users.push(
  { _id: new (require('mongodb').ObjectId)(), name: 'Ana', lastName: 'Admin', username: 'ana', email: 'ana@t1.com', password: 'x', role: 'admin', tenantId: 't1' },
  { _id: new (require('mongodb').ObjectId)(), name: 'Otro', lastName: 'Negocio', username: 'otro', email: 'otro@t2.com', password: 'x', role: 'admin', tenantId: 't2' },
);
const admin = () => tokenFor('ana', 'admin');
const idOf = (username) => String(state.users.find((u) => u.username === username)._id);

const newMember = (over = {}) => ({ name: 'Luis', lastName: 'Perez', username: 'luis', password: 'secreta123', role: 'kitchen', ...over });

test('sin sesión o sin ser admin no se puede gestionar el equipo', async () => {
  assert.equal((await api.call('GET', '/team')).status, 401);
  for (const role of ['waiter', 'kitchen', 'cashier', 'host']) {
    const r = await api.call('GET', '/team', { token: tokenFor('x', role) });
    assert.equal(r.status, 403, `${role} no debería poder listar el equipo`);
    const c = await api.call('POST', '/team', { token: tokenFor('x', role), body: newMember() });
    assert.equal(c.status, 403, `${role} no debería poder crear usuarios`);
  }
});

test('el token viejo con rol "hosstess" se trata como "host"', async () => {
  // /team es solo admin, así que debe dar 403 (no 401) y no confundirse con un rol desconocido.
  assert.equal((await api.call('GET', '/team', { token: tokenFor('x', 'hosstess') })).status, 403);
  // /waiters admite al rol host: con el token viejo también debe pasar la verificación de rol.
  const waiters = await api.call('GET', '/waiters', { token: tokenFor('x', 'hosstess') });
  assert.notEqual(waiters.status, 403);
});

test('el admin crea miembros con cada rol y la contraseña se guarda cifrada', async () => {
  for (const role of ['kitchen', 'cashier', 'host']) {
    const r = await api.call('POST', '/team', { token: admin(), body: newMember({ username: `u_${role}`, role }) });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.role, role);
    assert.equal(r.json.password, undefined, 'la respuesta no debe incluir la contraseña');
  }
  const stored = state.users.find((u) => u.username === 'u_kitchen');
  assert.equal(stored.tenantId, 't1');
  assert.notEqual(stored.password, 'secreta123');
  assert.match(stored.password, /^\$2[aby]\$/);
});

test('un mesero requiere celular y crea su ficha de personal', async () => {
  const sinCel = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'mesero1', role: 'waiter' }) });
  assert.equal(sinCel.status, 400);
  assert.match(sinCel.text, /celular/i);

  const ok = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'mesero1', role: 'waiter', cellphone: '6641234567' }) });
  assert.equal(ok.status, 201, ok.text);
  assert.equal(state.waiters.filter((w) => w.cellphone === '6641234567' && w.tenantId === 't1').length, 1);

  const dup = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'mesero2', role: 'waiter', cellphone: '6641234567' }) });
  assert.equal(dup.status, 400);
});

test('validaciones: contraseña corta, usuario repetido, rol inválido y correo repetido', async () => {
  const corta = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'nuevo', password: '123' }) });
  assert.equal(corta.status, 400);
  assert.match(corta.text, /8 caracteres/);

  const repetido = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'ana' }) });
  assert.equal(repetido.status, 400);
  // El usuario es único aunque exista en OTRO negocio (el login es por usuario).
  const deOtroNegocio = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'otro' }) });
  assert.equal(deOtroNegocio.status, 400);

  const rol = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'nuevo2', role: 'platform_admin' }) });
  assert.equal(rol.status, 400, 'no se puede crear un platform_admin desde un negocio');
  const viejo = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'nuevo3', role: 'hosstess' }) });
  assert.equal(viejo.status, 400, 'el nombre viejo ya no es un rol válido al crear');

  const correo = await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'nuevo4', email: 'ana@t1.com' }) });
  assert.equal(correo.status, 400);
});

test('el listado solo incluye a su negocio, sin contraseñas, y trae el catálogo de roles', async () => {
  const r = await api.call('GET', '/team', { token: admin() });
  assert.equal(r.status, 200);
  assert.ok(r.json.members.length >= 5);
  assert.ok(r.json.members.every((m) => m.password === undefined));
  assert.ok(!r.json.members.some((m) => m.username === 'otro'), 'no debe ver usuarios de otro negocio');
  assert.deepEqual(r.json.roles.map((x) => x.id).sort(), ['admin', 'cashier', 'host', 'kitchen', 'waiter']);
});

test('cambiar de rol: funciona, y no a uno mismo ni a usuarios de otro negocio', async () => {
  const ok = await api.call('PUT', `/team/${idOf('u_cashier')}/role`, { token: admin(), body: { role: 'waiter' } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.role, 'waiter');

  const propio = await api.call('PUT', `/team/${idOf('ana')}/role`, { token: admin(), body: { role: 'cashier' } });
  assert.equal(propio.status, 400);

  const ajeno = await api.call('PUT', `/team/${idOf('otro')}/role`, { token: admin(), body: { role: 'cashier' } });
  assert.equal(ajeno.status, 404);

  const invalido = await api.call('PUT', `/team/${idOf('u_host')}/role`, { token: admin(), body: { role: 'jefe' } });
  assert.equal(invalido.status, 400);
});

test('siempre debe quedar al menos un administrador y un admin degradado pierde acceso al instante', async () => {
  // Segundo admin; él intenta degradar a Ana (la única otra admin) y luego Ana a él.
  await api.call('POST', '/team', { token: admin(), body: newMember({ username: 'bruno', role: 'admin' }) });
  const bruno = tokenFor('bruno', 'admin');
  const a = await api.call('PUT', `/team/${idOf('ana')}/role`, { token: bruno, body: { role: 'waiter' } });
  assert.equal(a.status, 200, 'con dos admins sí se puede degradar a uno');
  // Ana conserva un token de 24 h que aún dice "admin", pero ya no lo es: no debe poder gestionar el equipo.
  const tokenViejoDeAna = admin();
  assert.equal((await api.call('GET', '/team', { token: tokenViejoDeAna })).status, 403);
  assert.equal((await api.call('DELETE', `/team/${idOf('bruno')}`, { token: tokenViejoDeAna })).status, 403);
  assert.equal((await api.call('POST', '/team', { token: tokenViejoDeAna, body: newMember({ username: 'intruso', role: 'admin' }) })).status, 403);
  assert.ok(!state.users.some((u) => u.username === 'intruso'));
  // Ahora solo queda Bruno: nadie puede degradarlo ni eliminarlo (ni él mismo).
  const quitar = await api.call('DELETE', `/team/${idOf('bruno')}`, { token: bruno });
  assert.equal(quitar.status, 400);
  // Restablecer para los siguientes tests.
  await api.call('PUT', `/team/${idOf('ana')}/role`, { token: bruno, body: { role: 'admin' } });
  assert.equal((await api.call('GET', '/team', { token: admin() })).status, 200, 'Ana vuelve a ser admin');
});

test('restablecer contraseña cambia el hash y valida el largo', async () => {
  const antes = state.users.find((u) => u.username === 'u_kitchen').password;
  const corta = await api.call('PUT', `/team/${idOf('u_kitchen')}/password`, { token: admin(), body: { password: 'corta' } });
  assert.equal(corta.status, 400);
  const ok = await api.call('PUT', `/team/${idOf('u_kitchen')}/password`, { token: admin(), body: { password: 'otraclave99' } });
  assert.equal(ok.status, 200);
  assert.notEqual(state.users.find((u) => u.username === 'u_kitchen').password, antes);
  const ajeno = await api.call('PUT', `/team/${idOf('otro')}/password`, { token: admin(), body: { password: 'otraclave99' } });
  assert.equal(ajeno.status, 404);
});

test('eliminar: no a uno mismo, no a otro negocio; al borrar un mesero se quita su ficha', async () => {
  assert.equal((await api.call('DELETE', `/team/${idOf('ana')}`, { token: admin() })).status, 400);
  assert.equal((await api.call('DELETE', `/team/${idOf('otro')}`, { token: admin() })).status, 404);
  assert.equal((await api.call('DELETE', '/team/no-es-un-id', { token: admin() })).status, 404);

  const ok = await api.call('DELETE', `/team/${idOf('mesero1')}`, { token: admin() });
  assert.equal(ok.status, 200);
  assert.ok(!state.users.some((u) => u.username === 'mesero1'));
  assert.equal(state.waiters.filter((w) => w.cellphone === '6641234567').length, 0);
});

test('una suscripción vencida bloquea la gestión del equipo', async () => {
  state.tenants.find((t) => t.id === 't1').billingStatus = 'suspended';
  assert.equal((await api.call('GET', '/team', { token: admin() })).status, 403);
  state.tenants.find((t) => t.id === 't1').billingStatus = 'active';
});
