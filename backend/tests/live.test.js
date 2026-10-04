const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const corePath = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'liveCore.js')).href;
const flush = () => new Promise((r) => setImmediate(r));

/** Reloj falso + servidor falso, para probar el sondeo sin esperar de verdad. */
async function harness({ hidden = false } = {}) {
  const { createLive } = await import(corePath);
  let now = 0;
  let nextId = 1;
  const queue = new Map();
  const timers = {
    set(fn, ms) { const id = nextId++; queue.set(id, { fn, at: now + ms }); return id; },
    clear(id) { queue.delete(id); },
  };
  const server = { orders: 0, tables: 0, waitlist: 0, fail: false, calls: [] };
  const statuses = [];
  const env = { hidden };
  const live = createLive({
    fetchVersions: async () => {
      server.calls.push(now);
      if (server.fail) throw new Error('sin red');
      return { orders: server.orders, tables: server.tables, waitlist: server.waitlist };
    },
    isHidden: () => env.hidden,
    timers,
    onStatus: (s) => statuses.push(s),
  });
  async function advance(ms) {
    const end = now + ms;
    for (;;) {
      const due = [...queue.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      queue.delete(due[0]);
      now = due[1].at;
      await due[1].fn();
      await flush();
    }
    now = end;
  }
  return { live, server, statuses, env, advance, pending: () => queue.size, now: () => now };
}

test('un cambio se ve en ≤ 2 s y solo avisa a quien vigila ese canal', async () => {
  const h = await harness();
  const cocina = []; const mesas = [];
  await h.live.subscribe(['orders'], (c) => cocina.push(c));
  await h.live.subscribe(['tables'], (c) => mesas.push(c));
  assert.deepEqual([cocina, mesas], [[], []], 'la lectura inicial no dispara recargas');

  h.server.orders += 1;
  await h.advance(2000);
  assert.deepEqual(cocina, [['orders']]);
  assert.deepEqual(mesas, [], 'mesas no vigila pedidos');

  await h.advance(10000);
  assert.equal(cocina.length, 1, 'sin cambios nuevos no vuelve a avisar');
});

test('un cambio justo después de suscribirse no se pierde', async () => {
  const h = await harness();
  const got = [];
  await h.live.subscribe(['orders', 'tables'], (c) => got.push(c));
  h.server.tables += 1; // ocurre antes del primer ciclo
  await h.advance(2000);
  assert.deepEqual(got, [['tables']]);
});

test('varios canales a la vez llegan juntos en un solo aviso', async () => {
  const h = await harness();
  const got = [];
  await h.live.subscribe(['orders', 'tables'], (c) => got.push(c.sort()));
  h.server.orders += 1; h.server.tables += 3;
  await h.advance(2000);
  assert.deepEqual(got, [['orders', 'tables']]);
});

test('quien se suscribe tarde parte del estado actual y no recibe avisos viejos', async () => {
  const h = await harness();
  await h.live.subscribe(['tables'], () => {});
  h.server.orders = 5; // cambios antes de que llegue la segunda pantalla
  await h.advance(2000);
  const got = [];
  await h.live.subscribe(['orders'], (c) => got.push(c));
  await h.advance(6000);
  assert.deepEqual(got, [], 'su baseline incluye lo que ya había');
  h.server.orders = 6;
  await h.advance(2000);
  assert.deepEqual(got, [['orders']]);
});

test('sin red: reintenta con espera creciente, avisa "reconectando" y al volver se pone al día', async () => {
  const h = await harness();
  const got = [];
  await h.live.subscribe(['orders'], (c) => got.push(c));
  assert.equal(h.live.getStatus(), 'live');

  h.server.fail = true;
  h.server.orders += 1; // cambia mientras no hay red
  const before = h.server.calls.length;
  await h.advance(2000);                       // 1.er fallo
  assert.equal(h.live.getStatus(), 'live', 'un solo fallo aún no alarma');
  await h.advance(2000);                       // 2.º fallo
  assert.equal(h.live.getStatus(), 'reconnecting');
  const gaps = h.server.calls.slice(before).map((t, i, a) => (i ? t - a[i - 1] : null)).filter(Boolean);
  assert.ok(gaps.every((g, i) => i === 0 || g >= gaps[i - 1]), `las esperas no deben acortarse: ${gaps}`);

  await h.advance(30000);
  const allGaps = h.server.calls.slice(before).map((t, i, a) => (i ? t - a[i - 1] : 0)).slice(1);
  assert.ok(Math.max(...allGaps) > 2000, `la espera debe crecer tras fallos seguidos: ${allGaps}`);
  assert.ok(Math.max(...allGaps) <= 10000, 'tope de 10 s entre reintentos');

  h.server.fail = false;
  await h.advance(10000);
  assert.equal(h.live.getStatus(), 'live');
  assert.deepEqual(got, [['orders']], 'recarga lo que cambió durante la caída');
});

test('suscribirse sin conexión: al volver pide recargar todo una vez', async () => {
  const h = await harness();
  h.server.fail = true;
  const got = [];
  await h.live.subscribe(['orders', 'waitlist'], (c) => got.push(c.sort()));
  await h.advance(8000);
  assert.deepEqual(got, []);
  h.server.fail = false;
  await h.advance(10000);
  assert.deepEqual(got, [['orders', 'waitlist']]);
  await h.advance(10000);
  assert.equal(got.length, 1);
});

test('con la pestaña oculta se pausa; wake() reanuda; los avisos del mesero siguen', async () => {
  const h = await harness({ hidden: true });
  const cocina = []; const avisos = [];
  await h.live.subscribe(['orders'], (c) => cocina.push(c));
  const afterSubscribe = h.server.calls.length;
  h.server.orders += 1;
  await h.advance(30000);
  assert.equal(h.server.calls.length, afterSubscribe, 'oculta y sin "background": no consulta');
  assert.equal(h.pending(), 0);

  h.env.hidden = false;
  await h.live.wake();
  assert.deepEqual(cocina, [['orders']], 'al volver se pone al día de inmediato');
  assert.equal(h.pending(), 1, 'y reanuda el calendario');

  // Con una suscripción "background" sigue consultando, más despacio, aunque esté oculta.
  h.env.hidden = true;
  await h.live.subscribe(['tables'], (c) => avisos.push(c), { background: true });
  const n = h.server.calls.length;
  h.server.tables += 1;
  await h.advance(6000);
  assert.ok(h.server.calls.length > n);
  assert.deepEqual(avisos, [['tables']]);
});

test('al cancelar la última suscripción se detiene todo y no queda estado viejo', async () => {
  const h = await harness();
  const stop = await h.live.subscribe(['orders'], () => {});
  assert.equal(h.live.getStatus(), 'live');
  stop();
  assert.equal(h.live.getStatus(), 'idle');
  assert.equal(h.pending(), 0);
  const n = h.server.calls.length;
  await h.advance(20000);
  assert.equal(h.server.calls.length, n, 'no hay sondeos huérfanos');

  h.server.orders = 9; // cambió mientras nadie escuchaba
  const got = [];
  await h.live.subscribe(['orders'], (c) => got.push(c));
  await h.advance(4000);
  assert.deepEqual(got, [], 'la nueva pantalla parte del estado actual, no del anterior');
});

test('peticiones simultáneas comparten un solo sondeo', async () => {
  const h = await harness();
  await h.live.subscribe(['orders'], () => {});
  const n = h.server.calls.length;
  await Promise.all([h.live.wake(), h.live.wake(), h.live.wake()]);
  assert.equal(h.server.calls.length - n, 1);
});

test('si una pantalla falla al recargar, las demás igual se enteran', async () => {
  const h = await harness();
  const ok = [];
  await h.live.subscribe(['orders'], () => { throw new Error('boom'); });
  await h.live.subscribe(['orders'], () => Promise.reject(new Error('async boom')));
  await h.live.subscribe(['orders'], (c) => ok.push(c));
  h.server.orders += 1;
  await h.advance(2000);
  assert.deepEqual(ok, [['orders']]);
});

test('con la pestaña oculta, una pantalla sin segundo plano no pierde los cambios: los recibe al volver', async () => {
  const h = await harness();
  const mesas = []; const avisos = [];
  await h.live.subscribe(['tables'], (c) => mesas.push(c));
  await h.live.subscribe(['tables'], (c) => avisos.push(c), { background: true });
  h.env.hidden = true;
  h.server.tables += 1;
  await h.advance(6000);
  assert.deepEqual(avisos, [['tables']], 'segundo plano: se entera aunque esté oculta');
  assert.deepEqual(mesas, [], 'la pantalla en pausa no recarga estando oculta…');
  h.env.hidden = false;
  await h.live.wake();
  assert.deepEqual(mesas, [['tables']], '…pero no se pierde el cambio: lo recibe al volver');
  assert.deepEqual(avisos, [['tables']], 'y quien ya lo recibió no lo recibe dos veces');
});

test('"background" puede ser una función que se evalúa en cada ciclo (p. ej. un permiso)', async () => {
  const h = await harness();
  let permitido = false;
  const got = [];
  await h.live.subscribe(['orders'], (c) => got.push(c), { background: () => permitido });
  h.env.hidden = true;
  await h.advance(1);            // deja correr un ciclo con la pestaña ya oculta
  await h.advance(20000);
  const sinPermiso = h.server.calls.length;
  await h.advance(20000);
  assert.equal(h.server.calls.length, sinPermiso, 'sin permiso y oculta: no consulta');
  permitido = true;
  await h.live.wake();           // el siguiente ciclo ya cuenta con el permiso
  const n = h.server.calls.length;
  h.server.orders += 1;
  await h.advance(6000);
  assert.ok(h.server.calls.length > n);
  assert.deepEqual(got, [['orders']]);
});

test('si la pestaña se oculta con un ciclo ya programado, ese ciclo no consulta', async () => {
  const h = await harness();
  await h.live.subscribe(['orders'], () => {});
  const n = h.server.calls.length;
  h.env.hidden = true;          // había un sondeo en cola cuando se ocultó
  await h.advance(30000);
  assert.equal(h.server.calls.length, n, 'ni siquiera un último sondeo');
  assert.equal(h.pending(), 0);
});

test('el peor caso de un cambio es ≤ 1.5 s con la pestaña a la vista', async () => {
  const h = await harness();
  const got = [];
  await h.live.subscribe(['orders'], () => got.push(h.now()));
  await h.advance(100);          // justo después de un ciclo: la peor fase posible
  h.server.orders += 1;
  const t0 = h.now();
  await h.advance(1500);
  assert.equal(got.length, 1);
  assert.ok(got[0] - t0 <= 1500, `tardó ${got[0] - t0} ms`);
});
