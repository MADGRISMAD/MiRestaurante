<template>
  <div class="wrap">
    <button type="button" class="no-print" @click="print">Imprimir ticket</button>

    <div class="ticket" :class="mode">
      <p v-if="loading" class="center">Cargando…</p>
      <p v-else-if="err" class="center err">{{ err }}</p>

      <template v-else-if="order">
        <!-- ENCABEZADO NEGOCIO -->
        <div class="center head">
          <p class="shop">{{ businessName }}</p>
          <p class="subtype">{{ typeLabel }}</p>
          <p v-if="address" class="muted">{{ address }}</p>
          <p v-if="phone" class="muted">TEL: {{ phone }}</p>
        </div>

        <p class="sep">================================</p>
        <p class="center banner">
          {{ mode === 'kitchen' ? 'COMANDA DE COCINA' : 'CUENTA / RECIBO' }}
        </p>
        <p class="sep">================================</p>

        <!-- DATOS DEL SERVICIO -->
        <p>FOLIO.......: {{ shortId(order.id) }}</p>
        <p v-if="order.turno" class="turno">TURNO.......: #{{ order.turno }}</p>
        <p v-if="order.source === 'counter'">ATENCION....: MOSTRADOR{{ order.customerName ? ' · ' + order.customerName.toUpperCase() : '' }}</p>
        <p v-else>MESA........: {{ (order.tableName || 'SIN MESA').toUpperCase() }}</p>
        <p>SERVICIO....: {{ modalityText(order.modality).toUpperCase() }}</p>
        <p>APERTURA....: {{ formatDate(order.createdAt) }}</p>
        <p v-if="mode !== 'kitchen' && order.paidAt">
          COBRO.......: {{ formatDate(order.paidAt) }}
        </p>
        <p v-if="cashier">ATENDIO.....: {{ cashier.toUpperCase() }}</p>
        <p>ARTICULOS...: {{ itemCount }}</p>

        <p class="sep">--------------------------------</p>

        <!-- COCINA -->
        <template v-if="mode === 'kitchen'">
          <p class="center section">*** PLATILLOS ***</p>
          <div v-for="(item, i) in order.items || []" :key="i" class="k-item">
            <p class="k-qty">{{ padQty(item.quantity) }}  {{ (item.name || '').toUpperCase() }}</p>
            <p v-if="item.notes" class="note">    NOTA: {{ item.notes }}</p>
          </div>
          <template v-if="order.notes">
            <p class="sep">--------------------------------</p>
            <p class="note">ORDEN: {{ order.notes }}</p>
          </template>
          <p class="sep">================================</p>
          <p class="center big">ENVIAR A COCINA</p>
          <p class="center muted">{{ formatDate(new Date()) }}</p>
        </template>

        <!-- CUENTA CLIENTE -->
        <template v-else>
          <div class="cols hdr">
            <span class="c-qty">CNT</span>
            <span class="c-name">DESCRIPCION</span>
            <span class="c-pu">P.U.</span>
            <span class="c-imp">IMP.</span>
          </div>
          <p class="sep thin">--------------------------------</p>

          <div v-for="(item, i) in order.items || []" :key="i" class="item">
            <div class="cols">
              <span class="c-qty">{{ item.quantity }}</span>
              <span class="c-name">{{ truncate(item.name, 14) }}</span>
              <span class="c-pu">{{ moneyPlain(item.price) }}</span>
              <span class="c-imp">{{ moneyPlain(item.price * item.quantity) }}</span>
            </div>
            <p v-if="item.notes" class="note">  * {{ item.notes }}</p>
          </div>

          <p class="sep">--------------------------------</p>

          <div class="row"><span>SUBTOTAL</span><span>$ {{ moneyPlain(order.subtotal) }}</span></div>
          <div class="row"><span>I.V.A. (8%)</span><span>$ {{ moneyPlain(order.tax) }}</span></div>
          <div v-if="order.deliveryFee" class="row">
            <span>ENVIO / REPARTO</span>
            <span>$ {{ moneyPlain(order.deliveryFee) }}</span>
          </div>

          <p class="sep">================================</p>
          <div class="row total">
            <span>TOTAL A PAGAR</span>
            <span>$ {{ moneyPlain(order.total) }}</span>
          </div>
          <p class="sep">================================</p>

          <!-- PROPINA SUGERIDA (no en ventas de mostrador: ya se pagaron en el momento) -->
          <template v-if="order.source !== 'counter'">
            <p class="center section">PROPINA SUGERIDA</p>
            <div class="row"><span>10%</span><span>$ {{ moneyPlain(order.total * 0.1) }}</span></div>
            <div class="row"><span>15%</span><span>$ {{ moneyPlain(order.total * 0.15) }}</span></div>
            <div class="row"><span>20%</span><span>$ {{ moneyPlain(order.total * 0.2) }}</span></div>
            <p class="muted center tip-line">Propina: $ ______</p>

            <p class="sep">--------------------------------</p>
          </template>

          <!-- PAGO -->
          <template v-if="order.paymentStatus === 'paid'">
            <p class="center section">FORMA DE PAGO</p>
            <div class="row">
              <span>{{ payMethodLabel(order.paymentMethod) }}</span>
              <span>$ {{ moneyPlain(order.total) }}</span>
            </div>
            <template v-if="order.paymentMethod === 'cash' && order.amountReceived != null">
              <div class="row"><span>RECIBIDO</span><span>$ {{ moneyPlain(order.amountReceived) }}</span></div>
              <div class="row"><span>CAMBIO</span><span>$ {{ moneyPlain(order.change) }}</span></div>
            </template>
            <p class="center paid">** PAGADO **</p>
          </template>
          <template v-else>
            <p class="center section">PENDIENTE DE PAGO</p>
            <div class="row"><span>EFECTIVO</span><span>$ ______</span></div>
            <div class="row"><span>TARJETA</span><span>$ ______</span></div>
            <div class="row"><span>CAMBIO</span><span>$ ______</span></div>
          </template>

          <template v-if="order.notes">
            <p class="sep">--------------------------------</p>
            <p class="note">OBS: {{ order.notes }}</p>
          </template>

          <p class="sep">================================</p>
          <p class="center thanks">¡GRACIAS POR SU VISITA!</p>
          <p class="center muted">Le esperamos pronto</p>
          <p class="sep">--------------------------------</p>
          <p class="center legal">
            Este comprobante no es
            factura fiscal. Solicite
            factura en caja si aplica.
          </p>
          <p class="center tiny">{{ businessName }}</p>
          <p class="center tiny">Powered by MiRestaurante POS</p>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import { apiService } from "../apiService";
import { venueStore, fetchVenueSettings } from "../venueStore";
import { authStore } from "../authStore";
import { labelOf, modalityLabel } from "../labels";

const route = useRoute();
const order = ref(null);
const loading = ref(true);
const err = ref("");
const mode = computed(() => (route.query.mode === "kitchen" ? "kitchen" : "receipt"));

const businessName = computed(() =>
  (venueStore.businessName || "RESTAURANTE").toUpperCase()
);
const address = computed(() => venueStore.address || "");
const phone = computed(() => venueStore.phone || "");
const cashier = computed(() => authStore.username || "");
const itemCount = computed(() =>
  (order.value?.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0)
);

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

const payLabels = {
  cash: "EFECTIVO",
  card: "TARJETA",
  transfer: "TRANSFERENCIA",
  other: "OTRO",
};

function moneyPlain(n) {
  return Number(n || 0).toFixed(2);
}
function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  const p = (x) => String(x).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
function modalityText(m) {
  return labelOf(modalityLabel, m);
}
function payMethodLabel(m) {
  return payLabels[m] || String(m || "—").toUpperCase();
}
function shortId(id) {
  return String(id || "").slice(-8).toUpperCase();
}
function truncate(s, n) {
  const t = String(s || "");
  return t.length > n ? `${t.slice(0, n - 1)}.` : t;
}
function padQty(q) {
  return String(q).padStart(2, " ");
}
function print() {
  window.print();
}

onMounted(async () => {
  try {
    await fetchVenueSettings().catch(() => {});
    order.value = await apiService.getOrdersById(String(route.params.id));
    if (route.query.autoprint === "1") {
      setTimeout(() => window.print(), 400);
    }
  } catch (e) {
    err.value = e.response?.data || "No se pudo cargar el pedido";
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
.head { margin-bottom: 2px; }
.shop {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
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
  letter-spacing: 0.04em;
}
.sep {
  margin: 5px 0;
  white-space: nowrap;
  overflow: hidden;
}
.sep.thin { margin: 2px 0; }
.muted { color: #222; font-size: 10px; }
.row {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
}
.total {
  font-size: 13px;
  font-weight: 700;
  margin: 2px 0;
}
.cols {
  display: grid;
  grid-template-columns: 2.2rem 1fr 2.8rem 2.8rem;
  gap: 0.15rem;
  font-variant-numeric: tabular-nums;
}
.cols.hdr { font-weight: 700; font-size: 10px; }
.c-pu, .c-imp { text-align: right; }
.c-qty { text-align: left; }
.item { margin-bottom: 3px; }
.k-item { margin-bottom: 6px; }
.k-qty {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}
.note { margin: 0; font-size: 10px; }
.tip-line { margin: 6px 0 2px; }
.paid {
  margin: 6px 0 0;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.thanks {
  margin: 4px 0 2px;
  font-size: 12px;
  font-weight: 700;
}
.legal {
  margin: 0;
  font-size: 9px;
  line-height: 1.35;
  white-space: pre-line;
}
.big {
  margin: 6px 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.tiny { margin: 2px 0 0; font-size: 9px; }
.err { color: #b42318; }
p { margin: 0; }

.no-print {
  border: none;
  background: #1b1814;
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
