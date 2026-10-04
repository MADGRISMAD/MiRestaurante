/**
 * Avisos para el mesero: mesas que le asignó la hostess y pedidos listos de sus mesas.
 * Un solo sondeo para toda la app (AppShell se monta en cada pantalla).
 * Se entera de los cambios por el sondeo compartido (live.js, ≤ 2 s), incluso con la app en segundo
 * plano si el mesero dio permiso a las notificaciones.
 */
import { reactive, computed } from "vue";
import { apiService } from "./apiService";
import { hasRole } from "./authStore";
import { bindLive } from "./live";
import { beep, resumeAudio } from "./sound";

const SEEN_KEY = "mirestaurante_ready_seen";

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export const alertsState = reactive({
  me: null,
  tables: [],
  orders: [],
  seenReady: loadSeen(),
  permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
});

const announced = new Set();
let liveBinding = null;
let starting = false;

export const myPhone = computed(() => String(alertsState.me?.cellphone || ""));

export const waiterAlerts = computed(() => {
  const phone = myPhone.value;
  if (!phone) return [];
  const mine = alertsState.tables.filter((t) => String(t.mesero || "") === phone);
  const byId = new Map(mine.map((t) => [t.id, t]));
  const out = [];
  for (const t of mine) {
    if (!t.disponible && t.avisoVisto === false) {
      out.push({ key: `a-${t.id}-${t.asignadaEn}`, kind: "assigned", table: t, at: t.asignadaEn });
    }
  }
  for (const o of alertsState.orders) {
    const t = byId.get(o.tableId);
    if (t && o.status === "ready" && o.paymentStatus !== "paid" && !alertsState.seenReady.has(o.id)) {
      out.push({ key: `r-${o.id}`, kind: "ready", table: t, order: o, at: o.updatedAt || o.createdAt });
    }
  }
  return out.sort((a, b) => new Date(b.at) - new Date(a.at));
});

export function alertText(a) {
  const t = a.table;
  if (a.kind === "ready") return { title: `${t.nombre}: pedido listo`, body: "Pasa a cocina por el pedido y sírvelo." };
  const who = t.personaTitular ? `${t.personaTitular} · ` : "";
  const people = t.personas ? `${t.personas} personas` : `${t.capacidad} lugares`;
  return { title: `Nueva mesa: ${t.nombre}`, body: `${who}${people}. Pasa a recibirlos.` };
}

function announce(list) {
  const fresh = list.filter((a) => !announced.has(a.key));
  fresh.forEach((a) => announced.add(a.key));
  if (!fresh.length) return;
  navigator.vibrate?.([180, 80, 180]);
  beep();
  if (alertsState.permission === "granted" && document.hidden) {
    for (const a of fresh) {
      const { title, body } = alertText(a);
      try {
        const n = new Notification(title, { body, tag: a.key, icon: "/logo.svg" });
        n.onclick = () => window.focus();
      } catch {
        // Algunos navegadores solo permiten avisos desde un service worker
      }
    }
  }
}

async function poll(silent = false) {
  if (document.hidden && alertsState.permission !== "granted") return;
  try {
    const [tables, orders] = await Promise.all([apiService.getTables(), apiService.getOrders()]);
    alertsState.tables = tables || [];
    alertsState.orders = orders || [];
    if (silent) waiterAlerts.value.forEach((a) => announced.add(a.key));
    else announce(waiterAlerts.value);
  } catch {
    // Reintenta en el siguiente ciclo
  }
}

function onVisible() {
  if (liveBinding && !document.hidden) poll();
}

/** Se suscribe a los cambios una sola vez, solo para meseros. */
export async function startWaiterAlerts() {
  if (liveBinding || starting || !hasRole("waiter")) return;
  starting = true;
  try {
    // El audio solo puede arrancar tras un toque del usuario
    window.addEventListener("pointerdown", resumeAudio, { once: true });
    document.addEventListener("visibilitychange", onVisible);
    try {
      alertsState.me = await apiService.me();
    } catch {
      alertsState.me = null;
    }
    // Con la pestaña oculta solo se sigue consultando si hay permiso para avisar
    liveBinding = bindLive(["tables", "orders"], () => poll(), {
      background: () => alertsState.permission === "granted",
    });
    await liveBinding.ready;
    // Lo que ya estaba pendiente al abrir la app no suena, solo se muestra
    await poll(true);
  } finally {
    starting = false;
  }
}

export function stopWaiterAlerts() {
  liveBinding?.stop();
  liveBinding = null;
  document.removeEventListener("visibilitychange", onVisible);
  alertsState.me = null;
  announced.clear();
}

export async function ackAlert(a) {
  if (a.kind === "ready") {
    alertsState.seenReady.add(a.order.id);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...alertsState.seenReady].slice(-200)));
    } catch {
      // Solo se pierde el recuerdo entre sesiones
    }
    return;
  }
  await ackTable(a.table.id);
}

export async function ackTable(id) {
  const t = alertsState.tables.find((x) => x.id === id);
  if (t) t.avisoVisto = true;
  try {
    await apiService.editTable(id, { avisoVisto: true });
  } catch {
    if (t) t.avisoVisto = false;
  }
}

export async function enableSystemAlerts() {
  if (typeof Notification === "undefined") return;
  alertsState.permission = await Notification.requestPermission();
}
