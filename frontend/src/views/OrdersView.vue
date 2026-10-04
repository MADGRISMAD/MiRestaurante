<template>
  <AppShell>
    <div class="orders-page">
      <div class="cash-banner" :class="{ open: cashOpen }">
        <div v-if="!cashOpen">
          <strong>Caja cerrada</strong>
          <p>Ábrela para poder cobrar pedidos.</p>
          <div class="cash-actions">
            <label>Fondo inicial
              <input v-model.number="openingFloat" type="number" min="0" step="1" />
            </label>
            <button type="button" class="btn-primary" :disabled="cashBusy" @click="openCash">
              Abrir caja
            </button>
          </div>
        </div>
        <div v-else>
          <strong>Caja abierta</strong>
          <p>
            Fondo {{ money(session.openingFloat) }} ·
            Ventas {{ money(cashTotals.total) }} ·
            Efectivo esperado {{ money((session.openingFloat || 0) + cashTotals.cash) }}
          </p>
          <div class="cash-actions">
            <label>Efectivo contado
              <input v-model.number="countedCash" type="number" min="0" step="1" @input="countedDirty = true" />
            </label>
            <button type="button" class="btn-danger" :disabled="cashBusy" @click="closeCash">
              Cerrar caja
            </button>
          </div>
        </div>
        <p v-if="cashMsg" class="ok">{{ cashMsg }}</p>
        <p v-if="cashErr" class="err">{{ cashErr }}</p>
      </div>

      <div class="toolbar">
        <p>Cobro y seguimiento de pedidos del salón.</p>
        <router-link to="/menu" class="btn-primary">Nuevo pedido</router-link>
      </div>

      <div class="filters">
        <button
          v-for="f in filters"
          :key="f.id"
          type="button"
          :class="{ active: filter === f.id }"
          @click="filter = f.id"
        >{{ f.label }}</button>
      </div>

      <div class="list">
        <article v-for="o in filtered" :key="o.id" class="card">
          <div class="head">
            <div>
              <h3>{{ o.tableName || 'Sin mesa' }}</h3>
              <p class="meta">{{ formatDate(o.createdAt) }} · {{ modalityText(o.modality) }}</p>
            </div>
            <div class="tags">
              <span class="badge" :class="`st-${o.status}`">{{ statusText(o.status) }}</span>
              <span class="badge" :class="o.paymentStatus">{{ paymentText(o.paymentStatus) }}</span>
            </div>
          </div>
          <ul class="items">
            <li v-for="(item, i) in o.items || []" :key="i">
              {{ item.quantity }}× {{ item.name }} — {{ money(item.price * item.quantity) }}
            </li>
          </ul>
          <div class="foot">
            <strong>{{ money(o.total) }}</strong>
            <div class="actions">
              <router-link
                class="link-btn"
                :to="`/print/order/${o.id}?mode=receipt`"
                target="_blank"
              >Imprimir</router-link>
              <button
                v-if="o.paymentStatus !== 'paid'"
                type="button"
                class="btn-primary"
                :disabled="!cashOpen"
                :title="cashOpen ? '' : 'Abre la caja primero'"
                @click="openPay(o)"
              >Cobrar</button>
              <button v-if="o.status === 'pending'" type="button" @click="setStatus(o, 'preparing')">A cocina</button>
            </div>
          </div>
        </article>
        <p v-if="!filtered.length" class="empty">No hay pedidos en este filtro.</p>
      </div>

      <Teleport to="body">
        <div v-if="payOrder" class="modal-bg" @click.self="payOrder = null">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pay-title">
            <h3 id="pay-title">Cobrar {{ money(payOrder.total) }}</h3>
            <label>Método de pago
              <select v-model="payMethod">
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <div class="modal-actions">
              <button type="button" @click="payOrder = null">Cancelar</button>
              <button type="button" class="btn-primary" @click="confirmPay">Confirmar cobro</button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { bindLive } from "../live";
import { useRouter } from "vue-router";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";
import {
  labelOf,
  modalityLabel,
  orderStatusLabel,
  paymentStatusLabel,
} from "../labels";

const router = useRouter();
const orders = ref([]);
const filter = ref("open");
const payOrder = ref(null);
const payMethod = ref("cash");

const cashOpen = ref(false);
const session = ref(null);
const cashTotals = ref({ cash: 0, card: 0, transfer: 0, other: 0, total: 0 });
const openingFloat = ref(0);
const countedCash = ref(0);
// Si el cajero ya tecleó el efectivo contado, una recarga automática no debe pisarlo
const countedDirty = ref(false);
const live = bindLive(["orders"], () => load(true));
const cashBusy = ref(false);
const cashMsg = ref("");
const cashErr = ref("");

const filters = [
  { id: "open", label: "Abiertos" },
  { id: "unpaid", label: "Por cobrar" },
  { id: "paid", label: "Pagados" },
  { id: "all", label: "Todos" },
];

const filtered = computed(() => {
  if (filter.value === "all") return orders.value;
  if (filter.value === "paid") return orders.value.filter((o) => o.paymentStatus === "paid");
  if (filter.value === "unpaid") return orders.value.filter((o) => o.paymentStatus !== "paid");
  return orders.value.filter((o) => o.paymentStatus !== "paid" && o.status !== "cancelled");
});

function money(n) {
  return Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}
function statusText(s) {
  return labelOf(orderStatusLabel, s);
}
function paymentText(s) {
  return labelOf(paymentStatusLabel, s, "Sin pagar");
}
function modalityText(m) {
  return labelOf(modalityLabel, m);
}

// silent: recarga automática; si falla, deja en pantalla lo que ya había
async function loadCash(silent = false) {
  try {
    const data = await apiService.getCashSession();
    cashOpen.value = Boolean(data.open);
    session.value = data.session;
    cashTotals.value = data.totals || { cash: 0, card: 0, transfer: 0, other: 0, total: 0 };
    if (data.session && !countedDirty.value) {
      countedCash.value = Number(
        (data.session.openingFloat || 0) + (data.totals?.cash || 0)
      );
    }
    if (!data.session) countedDirty.value = false;
  } catch {
    if (silent) return;
    cashOpen.value = false;
    session.value = null;
  }
}

async function openCash() {
  cashBusy.value = true;
  cashErr.value = "";
  cashMsg.value = "";
  try {
    await apiService.openCashSession(Number(openingFloat.value || 0));
    cashMsg.value = "Caja abierta.";
    await loadCash();
  } catch (e) {
    cashErr.value = e.response?.data || "No se pudo abrir la caja";
  } finally {
    cashBusy.value = false;
  }
}

async function closeCash() {
  if (!confirm("¿Cerrar la caja con el efectivo contado?")) return;
  cashBusy.value = true;
  cashErr.value = "";
  cashMsg.value = "";
  try {
    const res = await apiService.closeCashSession(Number(countedCash.value || 0));
    cashMsg.value = `Caja cerrada. Diferencia: ${money(res.session?.difference)}`;
    if (res.session?.id) {
      router.push(`/print/cash/${res.session.id}?autoprint=1`);
    }
    await loadCash();
  } catch (e) {
    cashErr.value = e.response?.data || "No se pudo cerrar la caja";
  } finally {
    cashBusy.value = false;
  }
}

async function load(silent = false) {
  try {
    orders.value = (await apiService.getOrders()) || [];
  } catch {
    if (!silent) orders.value = [];
  }
  await loadCash(silent);
}

function openPay(o) {
  if (!cashOpen.value) {
    cashErr.value = "Abre la caja antes de cobrar.";
    return;
  }
  payOrder.value = o;
  payMethod.value = "cash";
}

async function confirmPay() {
  if (!payOrder.value) return;
  try {
    const updated = await apiService.payOrder(payOrder.value.id, payMethod.value);
    const idx = orders.value.findIndex((x) => x.id === updated.id);
    if (idx >= 0) orders.value[idx] = updated;
    const id = payOrder.value.id;
    payOrder.value = null;
    await loadCash();
    if (confirm("¿Imprimir cuenta?")) {
      window.open(`/print/order/${id}?mode=receipt&autoprint=1`, "_blank");
    }
  } catch (e) {
    cashErr.value = e.response?.data || "No se pudo cobrar";
  }
}

async function setStatus(o, status) {
  const updated = await apiService.updateOrderStatus(o.id, status);
  const idx = orders.value.findIndex((x) => x.id === updated.id);
  if (idx >= 0) orders.value[idx] = updated;
}

onMounted(async () => {
  await live.ready;
  await load();
});
onUnmounted(() => live.stop());
</script>

<style scoped>
.orders-page { animation: t-fade-up .45s ease both; }
.cash-banner {
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 1rem;
  border: 1px solid var(--mirestaurante-line);
  background: var(--mirestaurante-warning-soft);
  color: var(--mirestaurante-ink);
}
.cash-banner.open { background: var(--mirestaurante-success-soft); }
.cash-banner p { margin: .25rem 0 .55rem; font-size: .9rem; color: var(--mirestaurante-muted); }
.cash-actions { display: flex; flex-wrap: wrap; gap: .55rem; align-items: end; }
.cash-actions label { display: grid; gap: .25rem; font-size: .8rem; font-weight: 700; }
.cash-actions input {
  min-height: 2.75rem;
  border: 1px solid var(--mirestaurante-line);
  border-radius: .65rem;
  padding: .5rem .7rem;
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
}
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; gap:1rem; flex-wrap:wrap; }
.toolbar p { margin:0; color:var(--mirestaurante-muted); }
.btn-primary { background:var(--mirestaurante-primary); color:var(--mirestaurante-on-primary); border:none; border-radius:.8rem; padding:.75rem 1.1rem; font-weight:700; text-decoration:none; cursor:pointer; display:inline-block; min-height:3rem; box-shadow:var(--mirestaurante-shadow); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-danger { background:var(--mirestaurante-danger); color:#fff; border:none; border-radius:.8rem; padding:.75rem 1.1rem; font-weight:700; cursor:pointer; min-height:3rem; }
.filters { display:flex; gap:.45rem; flex-wrap:wrap; margin-bottom:1rem; }
.filters button { border:1px solid var(--mirestaurante-line); background:var(--mirestaurante-panel-elevated); color:var(--mirestaurante-ink); border-radius:999px; padding:.55rem 1rem; cursor:pointer; font-size:.9rem; font-weight:700; min-height:2.85rem; }
.filters button.active { background:var(--mirestaurante-primary); color:var(--mirestaurante-on-primary); border-color:transparent; }
.list { display:grid; gap:.85rem; }
.card { background:var(--mirestaurante-panel); border:1px solid var(--mirestaurante-line); border-radius:1.1rem; padding:1.15rem; box-shadow:var(--mirestaurante-shadow); color:var(--mirestaurante-ink); }
.head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; }
.head h3 { margin:0; font-family:var(--font-display); font-size:1.2rem; font-weight:700; letter-spacing:-0.01em; }
.meta { margin:.25rem 0 0; color:var(--mirestaurante-muted); font-size:.82rem; }
.tags { display:flex; gap:.4rem; flex-wrap:wrap; justify-content:flex-end; }
.badge {
  display: inline-flex; align-items: center; justify-content: center;
  height: 1.7rem; padding: 0 0.75rem; border-radius: 999px;
  font-size: 0.75rem; font-weight: 700; line-height: 1; white-space: nowrap;
  background: var(--mirestaurante-primary-soft); color: var(--mirestaurante-primary);
}
.badge.st-pending { background: var(--mirestaurante-warning-soft); color: var(--mirestaurante-warning); }
.badge.st-preparing { background: color-mix(in srgb, var(--mirestaurante-accent) 22%, transparent); color: var(--mirestaurante-accent); }
.badge.st-ready { background: var(--mirestaurante-primary-soft); color: var(--mirestaurante-primary); }
.badge.st-served { background: var(--mirestaurante-success-soft); color: var(--mirestaurante-success); }
.badge.st-cancelled { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }
.badge.paid { background: var(--mirestaurante-success-soft); color: var(--mirestaurante-success); }
.badge.unpaid { background: var(--mirestaurante-warning-soft); color: var(--mirestaurante-warning); }
.items { margin:.85rem 0; padding-left:1.1rem; color:var(--mirestaurante-muted); font-size:.9rem; }
.foot { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
.actions { display:flex; gap:.45rem; flex-wrap:wrap; }
.actions button:not(.btn-primary) { border:1px solid var(--mirestaurante-line); background:var(--mirestaurante-panel-elevated); color:var(--mirestaurante-ink); border-radius:.7rem; padding:.65rem .85rem; cursor:pointer; font-weight:700; min-height:2.85rem; }
.link-btn { display:inline-flex; align-items:center; border:1px solid var(--mirestaurante-line); background:var(--mirestaurante-panel-elevated); color:var(--mirestaurante-ink); border-radius:.7rem; padding:.65rem .85rem; font-weight:700; text-decoration:none; min-height:2.85rem; }
.empty { color:var(--mirestaurante-muted); }
.ok { color: var(--mirestaurante-success); font-size: .88rem; margin: .5rem 0 0; }
.err { color: var(--mirestaurante-danger); font-size: .88rem; margin: .5rem 0 0; }
.modal-bg {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(10, 16, 14, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 1rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}
.modal {
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  border-radius: 1.15rem 1.15rem 0.85rem 0.85rem;
  padding: 1.35rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
  width: min(24rem, 100%);
  max-height: min(85vh, 32rem);
  overflow: auto;
  display: grid;
  gap: 0.85rem;
  border: 1px solid var(--mirestaurante-line);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.2);
}
.modal h3 {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.01em;
  font-size: 1.35rem;
}
.modal label { display: grid; gap: 0.35rem; font-size: 0.9rem; font-weight: 600; }
.modal select {
  min-height: 3rem;
  padding: 0.65rem 0.8rem;
  border-radius: 0.75rem;
  border: 1px solid var(--mirestaurante-line);
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  font: inherit;
}
.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 0.55rem;
  margin-top: 0.25rem;
}
.modal-actions button {
  min-height: 3.15rem;
  border-radius: 0.85rem;
  border: 1px solid var(--mirestaurante-line);
  background: var(--mirestaurante-surface);
  color: var(--mirestaurante-ink);
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}
.modal-actions .btn-primary {
  border: none;
  background: var(--mirestaurante-primary);
  color: var(--mirestaurante-on-primary);
}

@media (min-width: 720px) {
  .modal-bg {
    align-items: center;
    padding: 1.5rem;
  }
  .modal {
    border-radius: 1.15rem;
    padding: 1.4rem;
  }
}
</style>
