// Modo Café (mostrador): equipo de hasta 2 personas, solo Administrador y Caja.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { loadApp, startServer } = require('./helpers');

const { app, state, tokenFor } = loadApp();
let api;
test.before(async () => { api = await startServer(app); });
test.after(async () => { await api.close(); });

const user = (username, role, tenantId = 't1') => ({ _id: new ObjectId(), name: username, lastName: 'T', username, email: `${username}@x.com`, password: 'x', role, tenantId });
const idOf = (username) => String(state.users.find((u) => u.username === username)._id);
const admin = () => tokenFor('ana', 'admin');
const member = (over = {}) => ({ name: 'Paco', lastName: 'Perez', username: 'paco', password: 'secreta123', role: 'cashier', ...over });
const reset = (type) => {
  state.users = [user('ana', 'admin'), user('jefe', 'admin', 't2')];
  state.invites = [];
  state.settings.t1 = { businessType: type, businessName: 'La Casa' };
  state.settings.t2 = { businessType: 'restaurant', businessName: 'Otro' };
};

test('café: el listado informa el modo, el tope y solo ofrece Administrador y Caja', async () => {
  reset('cafe');
  const r = await api.call('GET', '/team', { token: admin() });
  assert.deepEqual(r.json.limits, { mode: 'counter', maxUsers: 2, allowedRoles: ['admin', 'cashier'] });
  assert.deepEqual(r.json.roles.map((x) => x.id).sort(), ['admin', 'cashier']);
});

test('restaurante: sin tope y con los cinco roles (nada cambia para el flujo de salón)', async () => {
  reset('restaurant');
  const r = await api.call('GET', '/team', { token: admin() });
  assert.deepEqual(r.json.limits.mode, 'table');
  assert.equal(r.json.limits.maxUsers, null);
  assert.equal(r.json.roles.length, 5);
  for (const [i, role] of ['waiter', 'kitchen', 'host', 'cashier', 'admin'].entries()) {
    const c = await api.call('POST', '/team', { token: admin(), body: member({ username: `usuario${i}`, role, cellphone: `66400000${i}0` }) });
    assert.equal(c.status, 201, `${role}: ${c.text}`);
  }
});

test('un negocio sin ajustes guardados todavía se trata como restaurante', async () => {
  reset('restaurant');
  delete state.settings.t1;
  const r = await api.call('POST', '/team', { token: admin(), body: member({ role: 'waiter', cellphone: '6641111111' }) });
  assert.equal(r.status, 201, r.text);
});

test('café: cabe una persona más y a la tercera dice que son hasta 2', async () => {
  reset('cafe');
  const ok = await api.call('POST', '/team', { token: admin(), body: member() });
  assert.equal(ok.status, 201, ok.text);
  const tercera = await api.call('POST', '/team', { token: admin(), body: member({ username: 'otra', role: 'cashier' }) });
  assert.equal(tercera.status, 400);
  assert.match(tercera.text, /hasta 2 personas/);
  assert.equal(state.users.filter((u) => u.tenantId === 't1').length, 2);
});

test('el tope es por negocio: otro negocio con sus propios usuarios no cuenta', async () => {
  reset('cafe');
  state.users.push(user('x1', 'cashier', 't2'), user('x2', 'cashier', 't2'), user('x3', 'cashier', 't2'));
  const r = await api.call('POST', '/team', { token: admin(), body: member() });
  assert.equal(r.status, 201, 'los 4 usuarios del otro negocio no cuentan');
});

test('café: no se pueden crear Mesero, Cocina ni Anfitrión', async () => {
  reset('cafe');
  for (const role of ['waiter', 'kitchen', 'host']) {
    const r = await api.call('POST', '/team', { token: admin(), body: member({ username: `n_${role}`, role, cellphone: '6641234567' }) });
    assert.equal(r.status, 400, role);
    assert.match(r.text, /solo hay Administrador y Caja/);
  }
});

test('café: al eliminar a alguien vuelve a caber otra persona', async () => {
  reset('cafe');
  await api.call('POST', '/team', { token: admin(), body: member() });
  assert.equal((await api.call('POST', '/team', { token: admin(), body: member({ username: 'otra' }) })).status, 400);
  assert.equal((await api.call('DELETE', `/team/${idOf('paco')}`, { token: admin() })).status, 200);
  assert.equal((await api.call('POST', '/team', { token: admin(), body: member({ username: 'otra' }) })).status, 201);
});

test('café: cambiar el rol solo entre Administrador y Caja', async () => {
  reset('cafe');
  await api.call('POST', '/team', { token: admin(), body: member() });
  assert.equal((await api.call('PUT', `/team/${idOf('paco')}/role`, { token: admin(), body: { role: 'waiter' } })).status, 400);
  assert.equal((await api.call('PUT', `/team/${idOf('paco')}/role`, { token: admin(), body: { role: 'admin' } })).status, 200);
});

test('invitaciones en café: cuentan las pendientes, no los roles de salón, y revocadas o vencidas no cuentan', async () => {
  reset('cafe');
  const invite = (email, role = 'cashier') => api.call('POST', '/invites', { token: admin(), body: { email, role } });

  assert.equal((await invite('a@x.com', 'waiter')).status, 400, 'mesero no existe en café');
  const primera = await invite('a@x.com');
  assert.equal(primera.status, 201, primera.text);
  const segunda = await invite('b@x.com');
  assert.equal(segunda.status, 400, '1 cuenta + 1 invitación pendiente ya llenan los 2 lugares');
  assert.match(segunda.text, /hasta 2 personas/);

  await api.call('PUT', `/invites/${primera.json.id}/revoke`, { token: admin() });
  assert.equal((await invite('b@x.com')).status, 201, 'una invitación revocada libera el lugar');

  state.invites.forEach((i) => { i.expiresAt = new Date(Date.now() - 1000); });
  assert.equal((await invite('c@x.com')).status, 201, 'una invitación vencida tampoco cuenta');
});

test('aceptar una invitación vuelve a comprobar el tope (el negocio pudo llenarse o cambiar de modo)', async () => {
  reset('restaurant');
  const inv = await api.call('POST', '/invites', { token: admin(), body: { email: 'nuevo@x.com', role: 'waiter' } });
  assert.equal(inv.status, 201);
  const token = state.invites[0].token;
  state.settings.t1.businessType = 'cafe'; // pasó a café después de invitar
  const r = await api.call('POST', '/invites/accept', { body: { token, name: 'N', lastName: 'M', username: 'nuevo', password: 'secreta123' } });
  assert.equal(r.status, 400);
  assert.match(r.text, /solo hay Administrador y Caja/);
  assert.ok(!state.users.some((u) => u.username === 'nuevo'));
});

test('cambiar a café: se rechaza si hay cuentas de salón o más de 2 personas, y se acepta si cabe', async () => {
  reset('restaurant');
  state.users.push(user('marta', 'waiter'));
  const save = (businessType) => api.call('POST', '/settings', { token: admin(), body: { businessName: 'La Casa', businessType } });

  const conMesero = await save('cafe');
  assert.equal(conMesero.status, 400);
  assert.match(conMesero.text, /Mesero/);
  assert.equal(state.settings.t1.businessType, 'restaurant', 'no se guardó');

  state.users = state.users.filter((u) => u.username !== 'marta');
  state.users.push(user('p1', 'cashier'), user('p2', 'cashier'));
  const tres = await save('cafe');
  assert.equal(tres.status, 400);
  assert.match(tres.text, /hasta 2 personas/);

  state.users = state.users.filter((u) => u.username !== 'p2');
  const ok = await save('cafe');
  assert.ok([200, 201].includes(ok.status), ok.text);
  assert.equal(state.settings.t1.businessType, 'cafe');

  // Y volver a restaurante siempre se puede.
  const vuelta = await save('restaurant');
  assert.ok([200, 201].includes(vuelta.status));
});
