<template>
  <div class="ticket-panel">
    <h2>Cuenta</h2>
    <p v-if="tableName" class="mesa">Mesa: {{ tableName }}</p>

    <ul class="lines">
      <li v-for="(producto, index) in store.platillosSeleccionados" :key="index">
        <div class="line-main">
          <div>
            <p class="name">{{ producto.name }}</p>
            <p class="unit">{{ formatearMoneda(producto.price) }} c/u</p>
          </div>
          <div class="qty">
            <button type="button" @click="disminuirCantidad(index)">−</button>
            <span>{{ producto.quantity }}</span>
            <button type="button" @click="incrementarCantidad(index)">+</button>
          </div>
          <p class="line-total">{{ formatearMoneda(producto.price * producto.quantity) }}</p>
          <button type="button" class="x" @click="eliminarProducto(index)">×</button>
        </div>
      </li>
    </ul>

    <p v-if="!store.platillosSeleccionados.length" class="empty">Agrega platillos del menú.</p>

    <div class="totals">
      <div><span>Subtotal</span><span>{{ formatearMoneda(subtotal) }}</span></div>
      <div v-if="deliveryMethod === 'takeaway'"><span>Reparto</span><span>{{ formatearMoneda(deliveryTax) }}</span></div>
      <div><span>IVA (8%)</span><span>{{ formatearMoneda(subtotal * taxRate) }}</span></div>
      <div class="grand"><span>Total</span><span>{{ formatearMoneda(total) }}</span></div>
    </div>

    <div class="modality">
      <button type="button" :class="{ on: deliveryMethod === 'dine-in' }" @click="setDeliveryMethod('dine-in')">En salón</button>
      <button type="button" :class="{ on: deliveryMethod === 'takeaway' }" @click="setDeliveryMethod('takeaway')">Para llevar</button>
    </div>

    <button type="button" class="send" :disabled="!store.platillosSeleccionados.length || sending" @click="finalizeOrder">
      {{ sending ? 'Enviando…' : 'Enviar a cocina' }}
    </button>
    <p v-if="msg" class="msg">{{ msg }}</p>
  </div>
</template>

<script>
import { store } from "../store";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { apiService } from "../apiService";

export default {
  props: {
    tableId: { type: String, default: "" },
    tableName: { type: String, default: "" },
  },
  setup(props) {
    const router = useRouter();
    const deliveryMethod = ref("dine-in");
    const deliveryTaxRate = 50;
    const taxRate = 0.08;
    const sending = ref(false);
    const msg = ref("");

    const subtotal = computed(() =>
      store.platillosSeleccionados.reduce((sum, p) => sum + p.price * p.quantity, 0)
    );
    const deliveryTax = computed(() =>
      deliveryMethod.value === "takeaway" ? deliveryTaxRate : 0
    );
    const total = computed(() => subtotal.value + subtotal.value * taxRate + deliveryTax.value);

    const incrementarCantidad = (index) => {
      store.platillosSeleccionados[index].quantity += 1;
    };
    const disminuirCantidad = (index) => {
      if (store.platillosSeleccionados[index].quantity > 1) {
        store.platillosSeleccionados[index].quantity -= 1;
      }
    };
    const eliminarProducto = (index) => {
      store.platillosSeleccionados.splice(index, 1);
    };
    const setDeliveryMethod = (method) => {
      deliveryMethod.value = method;
    };

    const finalizeOrder = async () => {
      sending.value = true;
      msg.value = "";
      try {
        const response = await apiService.createOrder({
          tableId: props.tableId || null,
          tableName: props.tableName || (deliveryMethod.value === "dine-in" ? "Salón" : "Para llevar"),
          modality: deliveryMethod.value,
          items: store.platillosSeleccionados.map((p) => ({
            foodId: p.id,
            name: p.name,
            price: p.price,
            quantity: p.quantity,
          })),
        });
        store.platillosSeleccionados.splice(0, store.platillosSeleccionados.length);
        msg.value = `Pedido ${response.id?.slice(-6) || ""} enviado.`;
        setTimeout(() => router.push("/kitchen"), 700);
      } catch (error) {
        msg.value = error.response?.data || "Error al enviar el pedido.";
      } finally {
        sending.value = false;
      }
    };

    const formatearMoneda = (cantidad) =>
      Number(cantidad || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

    return {
      store,
      deliveryMethod,
      subtotal,
      taxRate,
      deliveryTax,
      total,
      incrementarCantidad,
      disminuirCantidad,
      eliminarProducto,
      setDeliveryMethod,
      finalizeOrder,
      formatearMoneda,
      sending,
      msg,
    };
  },
};
</script>

<style scoped>
.ticket-panel {
  width: 21rem;
  flex-shrink: 0;
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  border: 1px solid var(--mirestaurante-line);
  border-radius: 1.15rem;
  padding: 1.15rem;
  box-shadow: var(--mirestaurante-shadow);
}
h2 { margin: 0 0 .35rem; font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; letter-spacing: -0.01em; }
.mesa { margin: 0 0 .75rem; font-size: .85rem; color: var(--mirestaurante-muted); }
.lines { list-style: none; margin: 0; padding: 0; max-height: 40vh; overflow: auto; }
.line-main { display: grid; grid-template-columns: 1fr auto auto auto; gap: .4rem; align-items: center; padding: .5rem 0; border-bottom: 1px solid var(--mirestaurante-line); }
.name { margin: 0; font-size: .85rem; font-weight: 600; }
.unit { margin: 0; font-size: .72rem; color: var(--mirestaurante-muted); }
.qty { display: flex; align-items: center; gap: .25rem; }
.qty button { width: 1.55rem; height: 1.55rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); border-radius: .4rem; cursor: pointer; }
.line-total { font-size: .8rem; font-weight: 700; margin: 0; }
.x { border: none; background: transparent; color: var(--mirestaurante-danger); cursor: pointer; font-size: 1.1rem; }
.empty { color: var(--mirestaurante-muted); font-size: .85rem; }
.totals { margin-top: .85rem; display: grid; gap: .35rem; font-size: .88rem; }
.totals > div { display: flex; justify-content: space-between; }
.grand { font-weight: 700; font-size: 1.05rem; margin-top: .3rem; }
.modality { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem; margin: .95rem 0; }
.modality button { border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); border-radius: .7rem; padding: .7rem; cursor: pointer; font-size: .9rem; font-weight: 700; min-height: 3rem; }
.modality button.on { background: var(--mirestaurante-ink); color: var(--mirestaurante-panel); border-color: transparent; }
.send { width: 100%; border: none; border-radius: .85rem; padding: .9rem; background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); font-weight: 700; font-size: 1.05rem; cursor: pointer; min-height: 3.25rem; box-shadow: var(--mirestaurante-shadow); }
.send:disabled { opacity: .55; cursor: not-allowed; }
.msg { margin: .55rem 0 0; font-size: .82rem; color: var(--mirestaurante-success); }
@media (max-width: 900px) { .ticket-panel { width: 100%; } }
</style>
