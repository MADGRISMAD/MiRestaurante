<template>
  <div class="ticket-panel">
    <header class="tp-head">
      <h2>Cuenta</h2>
      <span v-if="count" class="tp-count">{{ count }} {{ count === 1 ? 'platillo' : 'platillos' }}</span>
      <slot name="close" />
    </header>

    <ul v-if="store.platillosSeleccionados.length" class="lines">
      <li v-for="(producto, index) in store.platillosSeleccionados" :key="index" class="line">
        <div class="line-main">
          <div class="line-copy">
            <p class="name">{{ producto.name }}</p>
            <p class="unit">{{ money(producto.price) }} c/u</p>
          </div>
          <div class="qty">
            <button
              type="button"
              :aria-label="producto.quantity > 1 ? `Quitar uno de ${producto.name}` : `Quitar ${producto.name}`"
              @click="disminuirCantidad(index)"
            >{{ producto.quantity > 1 ? '−' : '×' }}</button>
            <span>{{ producto.quantity }}</span>
            <button type="button" :aria-label="`Agregar uno de ${producto.name}`" @click="incrementarCantidad(index)">+</button>
          </div>
          <p class="line-total">{{ money(producto.price * producto.quantity) }}</p>
        </div>
        <input
          v-if="noteOpen[index] || producto.notes"
          v-model="producto.notes"
          class="note"
          type="text"
          maxlength="80"
          enterkeyhint="done"
          placeholder="Ej. sin cebolla, término medio"
          :aria-label="`Nota para ${producto.name}`"
        />
        <button v-else type="button" class="add-note" @click="noteOpen[index] = true">+ Nota para cocina</button>
      </li>
    </ul>

    <p v-else class="empty">Toca los platillos del menú para agregarlos.</p>

    <div class="totals">
      <div><span>Subtotal</span><span>{{ money(subtotal) }}</span></div>
      <div v-if="deliveryMethod === 'takeaway'"><span>Reparto</span><span>{{ money(deliveryTax) }}</span></div>
      <div><span>IVA (8%)</span><span>{{ money(subtotal * taxRate) }}</span></div>
      <div class="grand"><span>Total</span><span>{{ money(total) }}</span></div>
    </div>

    <div v-if="!tableId" class="modality" role="group" aria-label="Modalidad">
      <button type="button" :aria-pressed="deliveryMethod === 'dine-in'" @click="setDeliveryMethod('dine-in')">En salón</button>
      <button type="button" :aria-pressed="deliveryMethod === 'takeaway'" @click="setDeliveryMethod('takeaway')">Para llevar</button>
    </div>

    <button type="button" class="send" :disabled="!store.platillosSeleccionados.length || sending" @click="finalizeOrder">
      {{ sending ? 'Enviando…' : tableName ? `Enviar a cocina · ${tableName}` : 'Enviar a cocina' }}
    </button>
    <p v-if="msg" class="msg" :class="{ error: msgError }" role="status">{{ msg }}</p>
  </div>
</template>

<script>
import { store } from "../store";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { apiService } from "../apiService";

export default {
  props: {
    tableId: { type: String, default: "" },
    tableName: { type: String, default: "" },
  },
  emits: ["sent"],
  setup(props, { emit }) {
    const router = useRouter();
    const deliveryMethod = ref("dine-in");
    const deliveryTaxRate = 50;
    const taxRate = 0.08;
    const sending = ref(false);
    const msg = ref("");
    const msgError = ref(false);
    const noteOpen = reactive({});

    const count = computed(() => store.platillosSeleccionados.reduce((n, p) => n + p.quantity, 0));
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
      } else {
        store.platillosSeleccionados.splice(index, 1);
      }
    };
    const setDeliveryMethod = (method) => {
      deliveryMethod.value = method;
    };

    const finalizeOrder = async () => {
      sending.value = true;
      msg.value = "";
      msgError.value = false;
      try {
        await apiService.createOrder({
          tableId: props.tableId || null,
          tableName: props.tableName || (deliveryMethod.value === "dine-in" ? "Salón" : "Para llevar"),
          modality: props.tableId ? "dine-in" : deliveryMethod.value,
          items: store.platillosSeleccionados.map((p) => ({
            foodId: p.id,
            name: p.name,
            price: p.price,
            quantity: p.quantity,
            notes: (p.notes || "").trim(),
          })),
        });
        store.platillosSeleccionados.splice(0, store.platillosSeleccionados.length);
        Object.keys(noteOpen).forEach((k) => delete noteOpen[k]);
        emit("sent");
        // Con mesa, el mesero vuelve al salón; sin mesa se queda para el siguiente pedido
        if (props.tableId) router.push("/main");
        else msg.value = "Pedido enviado a cocina.";
      } catch (error) {
        msgError.value = true;
        msg.value = error.response?.data || "No se pudo enviar el pedido. Intenta de nuevo.";
      } finally {
        sending.value = false;
      }
    };

    const money = (cantidad) =>
      Number(cantidad || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

    return {
      store,
      count,
      deliveryMethod,
      subtotal,
      taxRate,
      deliveryTax,
      total,
      incrementarCantidad,
      disminuirCantidad,
      setDeliveryMethod,
      finalizeOrder,
      money,
      sending,
      msg,
      msgError,
      noteOpen,
    };
  },
};
</script>

<style scoped>
.ticket-panel {
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --tomato: #d0371f;
  display: grid;
  gap: 0.85rem;
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 1.2rem;
  padding: 1.1rem;
}
.tp-head { display: flex; align-items: center; gap: 0.6rem; }
h2 {
  margin: 0;
  font-family: "Bricolage Grotesque", var(--font-display);
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}
.tp-count { flex: 1; font-family: var(--mono); font-size: 0.75rem; color: var(--mirestaurante-muted); }

.lines { list-style: none; margin: 0; padding: 0; max-height: 46vh; overflow: auto; overscroll-behavior: contain; }
.line { padding: 0.6rem 0; border-bottom: 1px dashed var(--mirestaurante-line); }
.line:first-child { padding-top: 0; }
.line-main { display: grid; grid-template-columns: 1fr auto auto; gap: 0.6rem; align-items: center; }
.line-copy { min-width: 0; }
.name { margin: 0; font-size: 0.92rem; font-weight: 600; line-height: 1.25; }
.unit { margin: 0.1rem 0 0; font-family: var(--mono); font-size: 0.7rem; color: var(--mirestaurante-muted); }
.qty {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.15rem;
  border-radius: 0.7rem;
  border: 1.5px solid var(--mirestaurante-line);
}
.qty span { min-width: 1.6rem; text-align: center; font-family: var(--mono); font-weight: 700; font-size: 0.9rem; }
.qty button {
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--mirestaurante-ink) 6%, transparent);
  color: var(--mirestaurante-ink);
  font-size: 1.1rem;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
}
.qty button:active { transform: scale(0.9); }
.line-total { margin: 0; min-width: 4.8rem; text-align: right; font-family: var(--mono); font-size: 0.85rem; font-weight: 700; }
.add-note {
  margin-top: 0.25rem;
  padding: 0.3rem 0;
  min-height: 2rem;
  border: none;
  background: none;
  color: var(--mirestaurante-muted);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}
.note {
  width: 100%;
  margin-top: 0.4rem;
  min-height: 2.6rem;
  padding: 0.45rem 0.7rem;
  border: 1.5px dashed color-mix(in srgb, #e8a020 70%, transparent);
  border-radius: 0.6rem;
  background: color-mix(in srgb, #e8a020 8%, transparent);
  color: var(--mirestaurante-ink);
  font: inherit;
  font-size: 16px; /* evita zoom en iOS */
}
.note:focus-visible { outline: 2px solid #e8a020; outline-offset: 1px; }
.empty { margin: 0; padding: 1.25rem 0.5rem; text-align: center; color: var(--mirestaurante-muted); font-size: 0.9rem; border: 1.5px dashed var(--mirestaurante-line); border-radius: 0.9rem; }

.totals { display: grid; gap: 0.3rem; font-family: var(--mono); font-size: 0.82rem; color: var(--mirestaurante-muted); }
.totals > div { display: flex; justify-content: space-between; }
.grand { margin-top: 0.3rem; padding-top: 0.55rem; border-top: 1.5px solid var(--mirestaurante-ink); color: var(--mirestaurante-ink); font-weight: 700; font-size: 1.05rem; }

.modality { display: grid; grid-template-columns: 1fr 1fr; gap: 0.2rem; padding: 0.2rem; border-radius: 0.8rem; background: color-mix(in srgb, var(--mirestaurante-ink) 7%, transparent); }
.modality button {
  min-height: 2.6rem;
  border: none;
  border-radius: 0.6rem;
  background: transparent;
  color: var(--mirestaurante-muted);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}
.modality button[aria-pressed="true"] { background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); box-shadow: 0 1px 2px rgba(27, 24, 20, 0.1); }

.send {
  width: 100%;
  min-height: 3.35rem;
  border: none;
  border-radius: 0.85rem;
  background: var(--tomato);
  color: #fff;
  font-weight: 700;
  font-size: 1.02rem;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 6px 18px -6px rgba(208, 55, 31, 0.6);
  touch-action: manipulation;
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease;
}
.send:active:not(:disabled) { transform: scale(0.98); }
.send:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
@media (hover: hover) and (pointer: fine) {
  .send:hover:not(:disabled) { background: #bb2f19; }
}
.msg { margin: 0; font-size: 0.85rem; font-weight: 600; color: var(--mirestaurante-success); text-align: center; }
.msg.error { color: var(--mirestaurante-danger); }
button:focus-visible, .note:focus-visible { outline: 2.5px solid var(--tomato); outline-offset: 2px; }
</style>
