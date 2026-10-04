<template>
  <AppShell>
    <div class="kds">
      <header class="kds-bar">
        <div>
          <h1>Cocina</h1>
          <p>{{ activeCount }} activos · actualización automática</p>
        </div>
        <div class="bar-actions">
          <button
            type="button"
            class="refresh"
            :aria-pressed="soundOn"
            :title="soundOn ? 'Suena al llegar una comanda nueva' : 'Sin sonido'"
            @click="toggleSound"
          >
            Sonido: {{ soundOn ? 'sí' : 'no' }}
          </button>
          <button type="button" class="refresh" :disabled="loading" @click="load()">
            {{ loading ? '…' : 'Actualizar' }}
          </button>
        </div>
      </header>

      <div class="board">
        <section
          v-for="col in columns"
          :key="col.status"
          class="col"
          :class="col.tone"
        >
          <header class="col-head">
            <h2>{{ col.label }}</h2>
            <span class="count">{{ byStatus(col.status).length }}</span>
          </header>

          <div class="col-body">
            <article
              v-for="o in byStatus(col.status)"
              :key="o.id"
              class="ticket"
              :class="[urgencyClass(o), { 'is-new': freshIds.has(o.id) }]"
            >
              <div class="ticket-top">
                <p class="table">{{ o.tableName || 'Sin mesa' }}</p>
                <span class="timer" :class="urgencyClass(o)">{{ ago(o.createdAt) }}</span>
              </div>
              <p class="meta">{{ modalityText(o.modality) }}</p>

            <ul class="items">
              <li v-for="(item, i) in o.items || []" :key="i">
                <span class="qty">{{ item.quantity }}</span>
                <span class="name">{{ item.name }}</span>
              </li>
            </ul>

            <div class="ticket-actions">
              <a
                class="print-link"
                :href="`/print/order/${o.id}?mode=kitchen`"
                target="_blank"
                rel="noopener"
              >Imprimir</a>
              <button
                type="button"
                class="bump"
                :class="col.btnClass"
                :disabled="busyId === o.id"
                @click="advance(o, col.next)"
              >
                {{ busyId === o.id ? '…' : col.action }}
              </button>
            </div>
            </article>

            <p v-if="!byStatus(col.status).length" class="empty">Vacío</p>
          </div>
        </section>
      </div>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { bindLive } from "../live";
import { beep, resumeAudio } from "../sound";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";
import { labelOf, modalityLabel } from "../labels";

const orders = ref([]);
const loading = ref(false);
const busyId = ref(null);
const now = ref(Date.now());
const live = bindLive(["orders"], () => load(true));
const SOUND_KEY = "mirestaurante_kitchen_sound";
const soundOn = ref(readSound());
const freshIds = ref(new Set());
const knownPending = new Set();
let primed = false;
const freshTimers = new Set();
let clockTimer;

const columns = [
  { status: "pending", label: "Nuevos", next: "preparing", action: "EMPEZAR", tone: "tone-new", btnClass: "primary" },
  { status: "preparing", label: "Preparando", next: "ready", action: "LISTO", tone: "tone-cook", btnClass: "primary" },
  { status: "ready", label: "Listos", next: "served", action: "ENTREGADO", tone: "tone-ready", btnClass: "success" },
];

function byStatus(status) {
  return orders.value
    .filter((o) => o.status === status && o.paymentStatus !== "paid")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

const activeCount = computed(() =>
  orders.value.filter(
    (o) => ["pending", "preparing", "ready"].includes(o.status) && o.paymentStatus !== "paid"
  ).length
);

function modalityText(m) {
  return labelOf(modalityLabel, m);
}

function minsWaiting(d) {
  if (!d) return 0;
  return Math.floor((now.value - new Date(d).getTime()) / 60000);
}

function ago(d) {
  const mins = minsWaiting(d);
  if (mins < 1) return "ahora";
  return `${mins} min`;
}

function urgencyClass(o) {
  const m = minsWaiting(o.createdAt);
  if (m >= 15) return "hot";
  if (m >= 8) return "warm";
  return "fresh";
}

function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function toggleSound() {
  soundOn.value = !soundOn.value;
  try {
    localStorage.setItem(SOUND_KEY, soundOn.value ? "on" : "off");
  } catch {
    // Solo se pierde el recuerdo entre sesiones
  }
  if (soundOn.value) beep(); // además destraba el audio del navegador
}

/** Comandas nuevas desde la última carga: se resaltan y, si hay sonido, suena. */
function announceNew(list) {
  const pending = list
    .filter((o) => o.status === "pending" && o.paymentStatus !== "paid")
    .map((o) => o.id);
  if (primed) {
    const fresh = pending.filter((id) => !knownPending.has(id));
    if (fresh.length) {
      freshIds.value = new Set([...freshIds.value, ...fresh]);
      const t = setTimeout(() => {
        freshTimers.delete(t);
        const next = new Set(freshIds.value);
        fresh.forEach((id) => next.delete(id));
        freshIds.value = next;
      }, 8000);
      freshTimers.add(t);
      if (soundOn.value) {
        beep();
        navigator.vibrate?.(150);
      }
    }
  }
  knownPending.clear();
  pending.forEach((id) => knownPending.add(id));
  primed = true;
}

// silent: recarga automática. No parpadea el botón y, si falla, deja en pantalla lo que ya había
// (una falla de red de un segundo no debe vaciar la cocina).
async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    const list = (await apiService.getOrders()) || [];
    announceNew(list);
    orders.value = list;
  } catch {
    if (!silent) orders.value = [];
  } finally {
    loading.value = false;
  }
}

async function advance(o, next) {
  if (!next || busyId.value) return;
  busyId.value = o.id;
  try {
    const updated = await apiService.updateOrderStatus(o.id, next);
    const idx = orders.value.findIndex((x) => x.id === updated.id);
    if (idx >= 0) orders.value[idx] = updated;
    else await load();
  } catch {
    await load();
  } finally {
    busyId.value = null;
  }
}

onMounted(async () => {
  window.addEventListener("pointerdown", resumeAudio, { once: true });
  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, 30000);
  // Primero suscribirse y luego cargar: así no se pierde ningún cambio entre una cosa y la otra
  await live.ready;
  await load();
});
onUnmounted(() => {
  live.stop();
  clearInterval(clockTimer);
  freshTimers.forEach(clearTimeout);
  window.removeEventListener("pointerdown", resumeAudio);
});
</script>

<style scoped>
.kds {
  display: grid;
  gap: 0.85rem;
  animation: t-fade-up 0.35s ease both;
  min-height: calc(100dvh - 9.5rem);
}

.kds-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}
.kds-bar h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.kds-bar p {
  margin: 0.1rem 0 0;
  color: var(--mirestaurante-muted);
  font-size: 0.85rem;
  font-weight: 600;
}
.refresh {
  min-height: 2.85rem;
  padding: 0 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--mirestaurante-line);
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  font-weight: 700;
  cursor: pointer;
}

.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
}

.col {
  display: flex;
  flex-direction: column;
  min-height: 22rem;
  border-radius: 1.1rem;
  padding: 0.75rem;
  border: 1px solid var(--mirestaurante-line);
  background: var(--mirestaurante-panel);
  box-shadow: var(--mirestaurante-shadow);
}
.col.tone-new {
  background: linear-gradient(180deg, color-mix(in srgb, var(--mirestaurante-warning) 10%, var(--mirestaurante-panel)), var(--mirestaurante-panel));
}
.col.tone-cook {
  background: linear-gradient(180deg, color-mix(in srgb, var(--mirestaurante-accent) 12%, var(--mirestaurante-panel)), var(--mirestaurante-panel));
}
.col.tone-ready {
  background: linear-gradient(180deg, color-mix(in srgb, var(--mirestaurante-success) 12%, var(--mirestaurante-panel)), var(--mirestaurante-panel));
}

.col-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.65rem;
  gap: 0.5rem;
}
.col-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--mirestaurante-ink);
  color: var(--mirestaurante-panel);
  font-weight: 800;
  font-size: 0.85rem;
}

.col-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  overflow: auto;
  flex: 1;
  min-height: 0;
  padding-bottom: 0.25rem;
}

.ticket {
  display: grid;
  gap: 0.55rem;
  padding: 0.8rem;
  border-radius: 0.95rem;
  background: var(--mirestaurante-panel-elevated);
  border: 2px solid var(--mirestaurante-line);
}
.bar-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.ticket.is-new { animation: kds-new 1.1s ease-in-out 3; box-shadow: 0 0 0 3px var(--mirestaurante-primary); }
@keyframes kds-new {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.025); }
}
@media (prefers-reduced-motion: reduce) { .ticket.is-new { animation: none; } }
.ticket.fresh { border-color: color-mix(in srgb, var(--mirestaurante-success) 40%, var(--mirestaurante-line)); }
.ticket.warm { border-color: color-mix(in srgb, var(--mirestaurante-warning) 65%, var(--mirestaurante-line)); }
.ticket.hot { border-color: var(--mirestaurante-danger); background: color-mix(in srgb, var(--mirestaurante-danger) 8%, var(--mirestaurante-panel-elevated)); }

.ticket-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.4rem;
}
.table {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.meta {
  margin: 0;
  color: var(--mirestaurante-muted);
  font-size: 0.78rem;
  font-weight: 600;
}
.timer {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 1.6rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
  background: var(--mirestaurante-surface);
  color: var(--mirestaurante-ink);
}
.timer.warm { background: var(--mirestaurante-warning-soft); color: var(--mirestaurante-warning); }
.timer.hot { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }

.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.3rem;
}
.items li {
  display: grid;
  grid-template-columns: 2.1rem 1fr;
  gap: 0.4rem;
  align-items: center;
}
.qty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2rem;
  border-radius: 0.45rem;
  background: var(--mirestaurante-ink);
  color: var(--mirestaurante-panel);
  font-size: 1.05rem;
  font-weight: 800;
}
.name {
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.2;
}

.ticket-actions { display: grid; gap: 0.4rem; }
.print-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  border-radius: 0.7rem;
  border: 1px solid var(--mirestaurante-line);
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  font-weight: 700;
  text-decoration: none;
  font-size: 0.9rem;
}
.bump {
  width: 100%;
  min-height: 3.15rem;
  border: none;
  border-radius: 0.8rem;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  touch-action: manipulation;
}
.bump:disabled { opacity: 0.55; cursor: wait; }
.bump.primary {
  background: var(--mirestaurante-primary);
  color: var(--mirestaurante-on-primary);
}
.bump.success {
  background: var(--mirestaurante-success);
  color: #062812;
}
.bump:active:not(:disabled) { transform: scale(0.98); }

.empty {
  margin: 1.5rem 0;
  text-align: center;
  color: var(--mirestaurante-muted);
  font-weight: 600;
  font-size: 0.9rem;
}

@media (max-width: 900px) {
  .board {
    grid-template-columns: 1fr;
  }
  .col {
    min-height: auto;
  }
  .col-body {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    overflow: visible;
  }
  .empty {
    grid-column: 1 / -1;
  }
}
</style>
