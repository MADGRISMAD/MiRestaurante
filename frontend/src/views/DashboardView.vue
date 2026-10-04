<template>
  <AppShell>
    <div class="dash t-page">
      <div class="hero-strip">
        <div>
          <h2>Resumen del día</h2>
          <p>Operación, personal y ventas en un vistazo.</p>
        </div>
        <div class="hero-actions">
          <router-link to="/main" class="t-btn t-btn-primary">Abrir mesas</router-link>
          <router-link to="/menu" class="t-btn t-btn-ghost">Tomar pedido</router-link>
        </div>
      </div>

      <div class="kpi-grid">
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
                <strong>{{ o.tableName || "Sin mesa" }}</strong>
                <span class="meta">{{ formatTime(o.createdAt) }}</span>
              </div>
              <span class="t-badge" :class="`st-${o.status}`">{{ statusText(o.status) }}</span>
              <span class="amount">{{ formatMoney(o.total) }}</span>
            </li>
          </ul>
        </section>

        <section class="t-card panel shortcuts">
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
import { computed, onMounted, ref } from "vue";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";
import { labelOf, orderStatusLabel } from "../labels";

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
const todaySales = computed(() => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return orders.value
    .filter((o) => o.paymentStatus === "paid" && new Date(o.paidAt || o.updatedAt || o.createdAt) >= start)
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
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

onMounted(async () => {
  try { tables.value = (await apiService.getTables()) || []; } catch { tables.value = []; }
  try { orders.value = (await apiService.getOrders()) || []; } catch { orders.value = []; }
  try { waiters.value = (await apiService.getWaiters()) || []; } catch { waiters.value = []; }
  try {
    const wl = await apiService.getWaitlist();
    waitlistCount.value = Array.isArray(wl) ? wl.length : 0;
  } catch { waitlistCount.value = 0; }
});
</script>

<style scoped>
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
