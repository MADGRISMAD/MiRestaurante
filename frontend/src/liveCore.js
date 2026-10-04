/**
 * Núcleo del "tiempo real" de la app (sin Vue ni DOM, para poder probarlo).
 *
 * Cómo funciona: el backend lleva un contador de cambios por canal (orders, tables,
 * waitlist) y GET /sync lo devuelve. Aquí se consulta ese contador cada pocos segundos
 * —un solo sondeo para toda la app— y cada pantalla suscrita se entera solo cuando
 * cambió uno de SUS canales; entonces recarga sus datos. Vercel no sostiene WebSockets,
 * y esto da cambios visibles en ≤ 2 s sin descargar listas completas en cada ciclo.
 *
 * Para cambiar de transporte (SSE, Ably, Pusher…) basta con reemplazar fetchVersions
 * y el calendario de sondeos: las pantallas solo usan subscribe().
 */

const DEFAULTS = {
  visibleMs: 1500, // pestaña a la vista (peor caso de un cambio: ~1.5 s + lo que tarde la red)
  hiddenMs: 6000, // pestaña oculta, solo si alguien pidió seguir (avisos al mesero)
  maxBackoffMs: 10000, // tope entre reintentos tras un fallo
  failuresBeforeOffline: 2, // fallos seguidos antes de mostrar "Reconectando…"
};

export function createLive({
  fetchVersions,
  isHidden = () => false,
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  onStatus = () => {},
  ...options
}) {
  const cfg = { ...DEFAULTS, ...options };
  const subs = new Set();
  let versions = null;
  let timer = null;
  let inflight = null;
  let failures = 0;
  let status = "idle"; // idle | live | reconnecting

  function setStatus(next) {
    if (next === status) return;
    status = next;
    onStatus(next);
  }

  function clearTimer() {
    if (timer !== null) {
      timers.clear(timer);
      timer = null;
    }
  }

  // "background" puede ser un booleano o una función (p. ej. depende de un permiso que cambia).
  const wantsBackground = (sub) =>
    typeof sub.background === "function" ? Boolean(sub.background()) : Boolean(sub.background);

  function dispatch(v) {
    versions = v;
    for (const sub of [...subs]) {
      // Con la pestaña oculta, quien no pidió segundo plano no recibe avisos: su "visto"
      // se queda atrás y, al volver la pestaña, recibe de golpe lo que se acumuló.
      if (isHidden() && !wantsBackground(sub)) continue;
      if (sub.seen === null) {
        // Primera lectura de quien se suscribió sin conexión: no sabemos qué se perdió,
        // así que se le pide recargar todo una vez.
        sub.seen = { ...v };
        if (sub.settled) notify(sub, [...sub.channels]);
        continue;
      }
      const changed = [...sub.channels].filter((c) => sub.seen[c] !== v[c]);
      if (!changed.length) continue;
      for (const c of changed) sub.seen[c] = v[c];
      notify(sub, changed);
    }
  }

  function notify(sub, channels) {
    try {
      const result = sub.onChange(channels);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch {
      // Un error de una pantalla no debe frenar al resto
    }
  }

  function poll() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const v = await fetchVersions();
        failures = 0;
        setStatus("live");
        dispatch(v);
        return v;
      } catch (err) {
        failures += 1;
        if (failures >= cfg.failuresBeforeOffline) setStatus("reconnecting");
        throw err;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  function delay() {
    if (failures > 0) return Math.min(cfg.visibleMs * 2 ** (failures - 1), cfg.maxBackoffMs);
    return isHidden() ? cfg.hiddenMs : cfg.visibleMs;
  }

  function schedule() {
    clearTimer();
    if (!subs.size) return;
    const active = !isHidden() || [...subs].some(wantsBackground);
    if (!active) return; // en pausa hasta que wake() la reanude
    timer = timers.set(async () => {
      timer = null;
      // La pestaña pudo ocultarse mientras esperaba este ciclo: no se consulta; wake() reanuda.
      if (isHidden() && ![...subs].some(wantsBackground)) return;
      try {
        await poll();
      } catch {
        // Se reintenta con espera creciente
      }
      schedule();
    }, delay());
  }

  /**
   * Suscribe una pantalla a uno o más canales. Devuelve (como promesa) la función para
   * cancelar. Esperar la promesa ANTES de la primera carga de datos garantiza que no se
   * pierda ningún cambio entre esa carga y el sondeo.
   */
  async function subscribe(channels, onChange, { background = false } = {}) {
    const sub = {
      channels: new Set(channels),
      onChange,
      background,
      seen: versions ? { ...versions } : null,
      settled: false,
    };
    subs.add(sub);
    if (!versions) {
      try {
        await poll();
      } catch {
        // Sin conexión: el sondeo reintenta y esta pantalla recargará al volver
      }
    }
    sub.settled = true;
    schedule();
    return function unsubscribe() {
      if (!subs.delete(sub)) return;
      if (!subs.size) {
        clearTimer();
        versions = null;
        failures = 0;
        setStatus("idle");
      } else {
        schedule();
      }
    };
  }

  /** Sondea ya (volvió la pestaña, volvió la red, o la pantalla lo pide). */
  function wake() {
    if (!subs.size) return Promise.resolve();
    clearTimer();
    return poll()
      .catch(() => {})
      .finally(schedule);
  }

  function markOffline() {
    if (subs.size) setStatus("reconnecting");
  }

  return { subscribe, wake, markOffline, getStatus: () => status };
}
