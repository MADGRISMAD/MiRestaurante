<template>
  <AppShell>
    <div class="dash t-page">
      <div class="hero-strip">
        <div>
          <h2>Resumen del día</h2>
          <p v-if="counter">Ventas y tickets del mostrador en un vistazo.</p>
          <p v-else>Operación, personal y ventas en un vistazo.</p>
        </div>
        <div v-if="counter" class="hero-actions">
          <router-link to="/counter" class="t-btn t-btn-primary">Abrir mostrador</router-link>
          <router-link to="/orders" class="t-btn t-btn-ghost">Caja</router-link>
        </div>
        <div v-else class="hero-actions">
          <router-link to="/main" class="t-btn t-btn-primary">Abrir mesas</router-link>
          <router-link to="/menu" class="t-btn t-btn-ghost">Tomar pedido</router-link>
        </div>
      </div>

      <!-- Café: sin mesas ni personal en turno; lo que importa es lo vendido -->
      <div v-if="counter" class="kpi-grid">
        <div class="kpi accent">
          <p class="kpi-label">Ventas del día</p>
          <p class="kpi-value">{{ formatMoney(todaySales) }}</p>
        </div>
        <div class="kpi">
          <p class="kpi-label">Tickets</p>
          <p class="kpi-value">{{ todayPaid.length }}</p>
        </div>
        <div class="kpi">
          <p class="kpi-label">Ticket promedio</p>
          <p class="kpi-value">{{ formatMoney(todayPaid.length ? todaySales / todayPaid.length : 0) }}</p>
        </div>
      </div>

      <div v-else class="kpi-grid">
        <div class="kpi">
          <p class="kpi-label">Mesas libres</p>
          <p class="kpi-value">{{ freeTables }}</p>
          <p class="kpi-sub">de {{ tables.length }} totales</p>
        </div>
        <div class="kpi">
          <p class="kpi-label">Ocupadas</p>
          <p class="kpi-value">{{ occupiedTables }}</p>
        </div>
        <div class="kpi">
          <p class="kpi-label">Pedidos activos</p>
          <p class="kpi-value">{{ activeOrders }}</p>
        </div>
        <div class="kpi">
          <p class="kpi-label">Personal en turno</p>
          <p class="kpi-value">{{ activeStaff }}</p>
        </div>
        <div class="kpi">
          <p class="kpi-label">En espera</p>
          <p class="kpi-value">{{ waitlistCount }}</p>
        </div>
        <div class="kpi accent">
          <p class="kpi-label">Ventas del día</p>
          <p class="kpi-value">{{ formatMoney(todaySales) }}</p>
        </div>
      </div>

      <div class="lower">
        <section class="t-card panel">
          <div class="panel-head">
            <h3>Pedidos recientes</h3>
            <router-link to="/orders">Ver todos</router-link>
          </div>
          <p v-if="!recentOrders.length" class="t-empty">Aún no hay pedidos hoy.</p>
          <ul v-else class="recent-list">
            <li v-for="o in recentOrders" :key="o.id">
              <div>
                <strong>{{ o.turno ? `#${o.turno} · ` : "" }}{{ o.tableName || "Sin mesa" }}</strong>
                <span class="meta">{{ formatTime(o.createdAt) }}</span>
              </div>
              <span class="t-badge" :class="`st-${o.status}`">{{ statusText(o.status) }}</span>
              <span class="amount">{{ formatMoney(o.total) }}</span>
            </li>
          </ul>
        </section>

        <section v-if="counter" class="t-card panel top-products">
          <h3>Lo más vendido hoy</h3>
          <p v-if="!topProducts.length" class="t-empty">Aún no hay ventas hoy.</p>
          <ol v-else class="top-list">
            <li v-for="p in topProducts" :key="p.name">
              <span class="top-name">{{ p.name }}</span>
              <span class="top-qty">{{ p.quantity }} {{ p.quantity === 1 ? "vendido" : "vendidos" }}</span>
            </li>
          </ol>
          <router-link to="/menu" class="top-link">Editar menú y productos</router-link>
          <router-link to="/team">Equipo</router-link>
        </section>

        <section v-else class="t-card panel shortcuts">
          <h3>Atajos</h3>
          <router-link to="/staff">Gestionar personal</router-link>
          <router-link to="/kitchen">Pantalla de cocina</router-link>
          <router-link to="/waitlist">Lista de espera</router-link>
          <router-link to="/settings">Configuración e invitaciones</router-link>
        </section>
      </div>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { bindLive } from "../live";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";
import { labelOf, orderStatusLabel } from "../labels";
import { isCounterMode } from "../roles";

const counter = computed(() => isCounterMode());
const tables = ref([]);
const orders = ref([]);
const waiters = ref([]);
const waitlistCount = ref(0);

const freeTables = computed(() => tables.value.filter((t) => t.disponible).length);
const occupiedTables = computed(() => tables.value.filter((t) => !t.disponible).length);
const activeOrders = computed(() =>
  orders.value.filter((o) => !["served", "cancelled"].includes(o.status) && o.paymentStatus !== "paid").length
);
const activeStaff = computed(() => waiters.value.filter((w) => w.status === "active").length);
const todayPaid = computed(() => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return orders.value.filter(
    (o) => o.paymentStatus === "paid" && new Date(o.paidAt || o.updatedAt || o.createdAt) >= start
  );
});
const todaySales = computed(() => todayPaid.value.reduce((sum, o) => sum + Number(o.total || 0), 0));
const topProducts = computed(() => {
  const byName = new Map();
  for (const o of todayPaid.value) {
    for (const it of o.items || []) {
      byName.set(it.name, (byName.get(it.name) || 0) + Number(it.quantity || 0));
    }
  }
  return [...byName].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
});
const recentOrders = computed(() => [...orders.value].slice(0, 8));

function formatMoney(n) {
  return Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
function statusText(s) {
  return labelOf(orderStatusLabel, s);
}

// silent: recarga automática; si algo falla, se deja lo que ya había en pantalla
async function load(silent = false) {
  const keep = (fallback) => (silent ? undefined : fallback);
  const [t, o, w, wl] = await Promise.allSettled([
    apiService.getTables(),
    apiService.getOrders(),
    apiService.getWaiters(),
    apiService.getWaitlist(),
  ]);
  const val = (r, fallback) => (r.status === "fulfilled" ? r.value : keep(fallback));
  const tv = val(t, []); if (tv !== undefined) tables.value = tv || [];
  const ov = val(o, []); if (ov !== undefined) orders.value = ov || [];
  const wv = val(w, []); if (wv !== undefined) waiters.value = wv || [];
  const lv = val(wl, []); if (lv !== undefined) waitlistCount.value = Array.isArray(lv) ? lv.length : 0;
}

const live = bindLive(["orders", "tables", "waitlist"], () => load(true));
onMounted(async () => {
  await live.ready;
  await load();
});
onUnmounted(() => live.stop());
</script>

<style scoped>
.top-list { list-style: none; margin: 0 0 0.8rem; padding: 0; display: grid; gap: 0.5rem; counter-reset: top; }
.top-list li { display: flex; justify-content: space-between; gap: 0.8rem; align-items: baseline; counter-increment: top; }
.top-list li::before { content: counter(top); width: 1.5rem; height: 1.5rem; border-radius: 50%; display: inline-grid; place-items: center; background: var(--mirestaurante-primary-soft); color: var(--mirestaurante-primary); font-size: 0.78rem; font-weight: 800; flex-shrink: 0; margin-right: 0.6rem; }
.top-name { flex: 1; font-weight: 600; overflow-wrap: anywhere; }
.top-qty { color: var(--mirestaurante-muted); font-size: 0.85rem; white-space: nowrap; }
.top-link { display: block; margin-top: 0.2rem; }
.hero-strip {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}
.hero-strip h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.hero-strip p {
  margin: 0.25rem 0 0;
  color: var(--mirestaurante-muted);
}
.hero-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: 0.85rem;
  margin-bottom: 1.15rem;
}
.kpi {
  background: var(--mirestaurante-panel);
  border: 1px solid var(--mirestaurante-line);
  border-radius: 1rem;
  padding: 1.05rem 1rem;
  box-shadow: var(--mirestaurante-shadow);
  transition: transform 0.2s ease;
}
.kpi:hover {
  transform: translateY(-2px);
}
.kpi.accent {
  background: linear-gradient(145deg, var(--mirestaurante-topbar), color-mix(in srgb, var(--mirestaurante-primary) 70%, var(--mirestaurante-accent)));
  color: var(--mirestaurante-topbar-text);
  border: none;
}
.kpi-label {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.65;
  font-weight: 600;
}
.kpi-value {
  margin: 0.4rem 0 0;
  font-family: var(--font-display);
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
}
.kpi-sub {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  opacity: 0.65;
}
.lower {
  display: grid;
  grid-template-columns: 1.6fr 0.9fr;
  gap: 0.9rem;
}
.panel {
  padding: 1.1rem 1.2rem;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.85rem;
}
.panel h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.panel-head a,
.shortcuts a {
  color: var(--mirestaurante-primary);
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 600;
}
.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.recent-list li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--mirestaurante-line);
}
.recent-list li:last-child {
  border-bottom: none;
}
.meta {
  display: block;
  font-size: 0.78rem;
  color: var(--mirestaurante-muted);
  font-weight: 400;
}
.amount {
  font-weight: 700;
  font-size: 0.92rem;
}
.shortcuts {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.shortcuts h3 {
  margin-bottom: 0.35rem;
}
.shortcuts a {
  padding: 0.75rem 0.85rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--mirestaurante-primary) 5%, transparent);
  transition: background 0.15s ease;
}
.shortcuts a:hover {
  background: color-mix(in srgb, var(--mirestaurante-primary) 10%, transparent);
}
@media (max-width: 900px) {
  .lower {
    grid-template-columns: 1fr;
  }
}
</style>
