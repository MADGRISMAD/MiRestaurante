<template>
  <div class="wrap">
    <button type="button" class="no-print" @click="print">Imprimir ticket</button>

    <div class="ticket">
      <p v-if="loading" class="center">Cargando…</p>
      <p v-else-if="err" class="center err">{{ err }}</p>

      <template v-else-if="session">
        <div class="center head">
          <p class="shop">{{ businessName }}</p>
          <p class="subtype">{{ typeLabel }}</p>
          <p v-if="address" class="muted">{{ address }}</p>
          <p v-if="phone" class="muted">TEL: {{ phone }}</p>
        </div>

        <p class="sep">================================</p>
        <p class="center banner">CORTE DE CAJA</p>
        <p class="sep">================================</p>

        <p>SESION......: {{ shortId(session.id) }}</p>
        <p>ABRIO.......: {{ (session.openedBy || '—').toUpperCase() }}</p>
        <p>HORA APERT..: {{ formatDate(session.openedAt) }}</p>
        <template v-if="session.closedAt">
          <p>CERRO.......: {{ (session.closedBy || '—').toUpperCase() }}</p>
          <p>HORA CIERRE.: {{ formatDate(session.closedAt) }}</p>
        </template>
        <p>TICKETS.....: {{ orders.length }}</p>

        <p class="sep">--------------------------------</p>
        <p class="center section">*** RESUMEN DE VENTAS ***</p>

        <div class="row"><span>FONDO INICIAL</span><span>$ {{ moneyPlain(session.openingFloat) }}</span></div>
        <div class="row">
          <span>VENTAS EFECTIVO</span>
          <span>$ {{ moneyPlain((session.expectedCash || 0) - (session.openingFloat || 0)) }}</span>
        </div>
        <div class="row"><span>VENTAS TARJETA</span><span>$ {{ moneyPlain(session.expectedCard) }}</span></div>
        <div class="row"><span>TRANSFERENCIA</span><span>$ {{ moneyPlain(session.expectedTransfer) }}</span></div>
        <div class="row"><span>OTROS</span><span>$ {{ moneyPlain(session.expectedOther) }}</span></div>

        <p class="sep">--------------------------------</p>
        <div class="row"><span>TOTAL VENTAS</span><span>$ {{ moneyPlain(session.expectedTotal) }}</span></div>
        <div class="row"><span>EF. ESPERADO</span><span>$ {{ moneyPlain(session.expectedCash) }}</span></div>
        <div class="row"><span>EF. CONTADO</span><span>$ {{ moneyPlain(session.countedCash) }}</span></div>

        <p class="sep">================================</p>
        <div class="row total">
          <span>DIFERENCIA</span>
          <span>$ {{ moneyPlain(session.difference) }}</span>
        </div>
        <p class="sep">================================</p>

        <template v-if="orders.length">
          <p class="center section">*** DETALLE DE TICKETS ***</p>
          <div class="cols hdr">
            <span>MESA</span>
            <span>PAGO</span>
            <span class="r">TOTAL</span>
          </div>
          <p class="sep thin">--------------------------------</p>
          <div v-for="o in orders" :key="o.id" class="cols line">
            <span>{{ truncate(o.tableName || 'S/M', 8) }}</span>
            <span>{{ payShort(o.paymentMethod) }}</span>
            <span class="r">{{ moneyPlain(o.total) }}</span>
          </div>
          <p class="sep">--------------------------------</p>
        </template>

        <template v-if="session.notes">
          <p class="note">OBS: {{ session.notes }}</p>
          <p class="sep">--------------------------------</p>
        </template>

        <p class="center thanks">FIN DE CORTE DE CAJA</p>
        <p class="center muted">Conserve este comprobante</p>
        <p class="center tiny">{{ businessName }}</p>
        <p class="center tiny">Powered by MiRestaurante POS</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { apiService } from "../apiService";
import { venueStore, fetchVenueSettings } from "../venueStore";

const route = useRoute();
const session = ref(null);
const orders = ref([]);
const loading = ref(true);
const err = ref("");

const businessName = computed(() =>
  (venueStore.businessName || "RESTAURANTE").toUpperCase()
);
const address = computed(() => venueStore.address || "");
const phone = computed(() => venueStore.phone || "");
const typeLabel = computed(() => {
  const map = {
    restaurant: "RESTAURANTE",
    cafe: "CAFÉ",
    bar: "BAR",
    hotel: "HOTEL / RESTAURANTE",
    other: "ESTABLECIMIENTO",
  };
  return map[venueStore.businessType] || "RESTAURANTE";
});

const payMap = { cash: "EFEC", card: "TARJ", transfer: "TRANS", other: "OTRO" };

function moneyPlain(n) {
  return Number(n || 0).toFixed(2);
}
function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  const p = (x) => String(x).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
function truncate(s, n) {
  const t = String(s || "");
  return t.length > n ? `${t.slice(0, n - 1)}.` : t;
}
function shortId(id) {
  return String(id || "").slice(-8).toUpperCase();
}
function payShort(m) {
  return payMap[m] || "—";
}
function print() {
  window.print();
}

onMounted(async () => {
  try {
    await fetchVenueSettings().catch(() => {});
    const id = String(route.params.id);
    session.value = await apiService.getCashSessionById(id);
    const all = await apiService.getOrders();
    orders.value = (all || []).filter((o) => o.cashSessionId === id);
    if (route.query.autoprint === "1") {
      setTimeout(() => window.print(), 400);
    }
  } catch (e) {
    err.value = e.response?.data || "No se pudo cargar el corte";
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  background: #e8e8e8;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.ticket {
  width: 80mm;
  max-width: 100%;
  background: #fff;
  color: #000;
  padding: 4mm 3.5mm 8mm;
  font-family: "Courier New", Courier, monospace;
  font-size: 11px;
  line-height: 1.32;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.15);
}
.center { text-align: center; }
.shop {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.subtype {
  margin: 2px 0 4px;
  font-size: 10px;
  letter-spacing: 0.12em;
}
.banner {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.section {
  margin: 4px 0;
  font-weight: 700;
}
.sep {
  margin: 5px 0;
  white-space: nowrap;
  overflow: hidden;
}
.sep.thin { margin: 2px 0; }
.muted { font-size: 10px; }
.row {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
}
.total {
  font-size: 13px;
  font-weight: 700;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 0.7fr 1fr;
  gap: 0.2rem;
  font-variant-numeric: tabular-nums;
}
.cols.hdr { font-weight: 700; font-size: 10px; }
.cols.line { margin-bottom: 2px; }
.r { text-align: right; }
.note { margin: 0; font-size: 10px; }
.thanks {
  margin: 6px 0 2px;
  font-size: 12px;
  font-weight: 700;
}
.tiny { margin: 2px 0 0; font-size: 9px; }
.err { color: #b42318; }
p { margin: 0; }

.no-print {
  border: none;
  background: #1a4a38;
  color: #fff;
  border-radius: 0.55rem;
  padding: 0.65rem 1rem;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-sans);
}

@media print {
  @page { size: 80mm auto; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
  .wrap {
    min-height: auto;
    background: #fff;
    padding: 0;
    display: block;
  }
  .no-print { display: none !important; }
  .ticket {
    width: 72mm;
    max-width: 72mm;
    box-shadow: none;
    padding: 2mm 2mm 10mm;
    margin: 0 auto;
  }
}
</style>
