<template>
  <AppShell>
    <div class="counter">
      <!-- Caja cerrada: sin caja abierta no se puede vender -->
      <section v-if="cash.loaded && !cash.open" class="open-cash" aria-labelledby="open-cash-title">
        <div>
          <h2 id="open-cash-title">La caja está cerrada</h2>
          <p>Abre la caja con el efectivo con el que empiezas para poder vender. Cada venta queda en el cierre del día.</p>
        </div>
        <form class="open-form" @submit.prevent="openCash">
          <label>
            Fondo inicial
            <input v-model.number="openingFloat" type="number" inputmode="decimal" min="0" step="1" />
          </label>
          <button type="submit" class="btn primary" :disabled="cash.busy">{{ cash.busy ? 'Abriendo…' : 'Abrir caja' }}</button>
        </form>
        <p v-if="cash.error" class="msg err" role="alert">{{ cash.error }}</p>
      </section>

      <p v-else-if="cash.open" class="cash-line" role="status">
        <span class="dot" aria-hidden="true"></span>
        Caja abierta · {{ cash.count }} {{ cash.count === 1 ? 'venta' : 'ventas' }} · {{ money(cash.total) }} en este turno
      </p>

      <p v-if="stockAlert" class="stock-note" role="status">
        {{ stockAlert }}
        <router-link v-if="isAdmin" to="/inventory">Ver inventario</router-link>
      </p>

      <div class="grid" :class="{ locked: cash.loaded && !cash.open }">
        <!-- Productos -->
        <section class="products-col" aria-label="Productos">
          <nav v-if="menus.length > 1" class="cats" aria-label="Categorías">
            <button
              v-for="m in menus"
              :key="m.id"
              type="button"
              class="cat"
              :aria-pressed="selectedMenuId === m.id"
              @click="selectedMenuId = m.id"
            >{{ m.name }}</button>
          </nav>

          <div v-if="loading" class="tiles" aria-busy="true" aria-label="Cargando productos">
            <span v-for="i in 8" :key="i" class="tile sk"></span>
          </div>

          <div v-else-if="!products.length" class="empty">
            <h2>Aún no hay productos</h2>
            <p v-if="isAdmin">Agrega tu menú para empezar a vender.</p>
            <p v-else>Pide al administrador que agregue los productos del menú.</p>
            <router-link v-if="isAdmin" to="/menu" class="btn primary">Agregar productos</router-link>
          </div>

          <div v-else class="tiles">
            <button
              v-for="p in products"
              :key="p.id"
              type="button"
              class="tile"
              :class="{ picked: qtyOf(p.id) }"
              :aria-label="extrasOf(p).length ? `Personalizar ${p.name}, desde ${money(p.price)}` : `Agregar ${p.name}, ${money(p.price)}`"
              @click="onTile(p)"
            >
              <span v-if="p.imgUrl" class="thumb"><img :src="p.imgUrl" alt="" loading="lazy" /></span>
              <span class="tile-name">{{ p.name }}</span>
              <span class="tile-price">{{ money(p.price) }}<em v-if="extrasOf(p).length" class="tile-extras"> · personaliza</em></span>
              <span v-if="missing(p).length" class="tile-missing" :title="`Sin existencia: ${missing(p).join(', ')}`">Sin {{ missing(p)[0] }}</span>
              <span v-if="qtyOf(p.id)" class="qty-badge" aria-hidden="true">{{ qtyOf(p.id) }}</span>
            </button>
          </div>
        </section>

        <!-- Cuenta -->
        <aside class="ticket-col" :class="{ open: sheetOpen }" aria-label="Cuenta" @click.self="sheetOpen = false">
          <div class="ticket">
            <header class="t-head">
              <h2>Venta</h2>
              <button v-if="lines.length" type="button" class="link" @click="clearCart">Vaciar</button>
              <button type="button" class="sheet-close" aria-label="Cerrar cuenta" @click="sheetOpen = false">×</button>
            </header>

            <ul v-if="lines.length" class="lines">
              <li v-for="(l, i) in lines" :key="l.foodId + '-' + i" class="line">
                <div class="line-main">
                  <div class="line-copy">
                    <p class="name">{{ l.name }}</p>
                    <p class="unit">{{ money(l.price) }} c/u</p>
                    <p v-if="l.options.length" class="opts">{{ optionsText(l) }}</p>
                  </div>
                  <div class="qty">
                    <button type="button" :aria-label="l.quantity > 1 ? `Quitar uno de ${l.name}` : `Quitar ${l.name}`" @click="dec(i)">{{ l.quantity > 1 ? '−' : '×' }}</button>
                    <span>{{ l.quantity }}</span>
                    <button type="button" :aria-label="`Agregar uno de ${l.name}`" @click="inc(i)">+</button>
                  </div>
                  <p class="line-total">{{ money(l.price * l.quantity) }}</p>
                </div>
                <input
                  v-if="noteOpen[i] || l.notes"
                  v-model="l.notes"
                  class="note"
                  type="text"
                  maxlength="80"
                  enterkeyhint="done"
                  placeholder="Ej. leche de avena, sin azúcar"
                  :aria-label="`Nota para ${l.name}`"
                />
                <div v-if="!(noteOpen[i] || l.notes) || extrasOf(l.food).length" class="line-tools">
                  <button v-if="!(noteOpen[i] || l.notes)" type="button" class="add-note" @click="noteOpen[i] = true">+ Nota</button>
                  <button v-if="extrasOf(l.food).length" type="button" class="add-note" @click="openBuilder(l.food, i)">Editar extras</button>
                </div>
              </li>
            </ul>
            <p v-else class="empty-ticket">Toca un producto para agregarlo.</p>

            <div class="options">
              <label class="field">
                <span>Nombre <em>(opcional)</em></span>
                <input v-model="customerName" type="text" maxlength="40" autocomplete="off" placeholder="Para llamarlo al entregar" />
              </label>
              <div class="where" role="group" aria-label="Dónde lo consume">
                <button type="button" :aria-pressed="!takeaway" @click="takeaway = false">Aquí</button>
                <button type="button" :aria-pressed="takeaway" @click="takeaway = true">Para llevar</button>
              </div>
            </div>

            <div class="totals">
              <div><span>Subtotal</span><span>{{ money(totals.subtotal) }}</span></div>
              <div><span>IVA (8%)</span><span>{{ money(totals.tax) }}</span></div>
              <div class="grand"><span>Total</span><span>{{ money(totals.total) }}</span></div>
            </div>

            <button type="button" class="btn charge" :disabled="!lines.length || !cash.open" @click="openPay">
              {{ cash.open ? `Cobrar ${money(totals.total)}` : 'Abre la caja para cobrar' }}
            </button>
          </div>
        </aside>
      </div>

      <!-- Barra de cuenta en celular -->
      <button v-if="lines.length && !sheetOpen" type="button" class="cart-bar" @click="sheetOpen = true">
        <span>{{ itemCount }} {{ itemCount === 1 ? 'producto' : 'productos' }}</span>
        <strong>Ver cuenta · {{ money(totals.total) }}</strong>
      </button>

      <!-- Constructor de bebida: extras, nota y cantidad -->
      <Teleport to="body">
        <div v-if="builder.open" class="modal-bg" @click.self="closeBuilder">
          <form class="modal builder" role="dialog" aria-modal="true" aria-labelledby="b-title" @submit.prevent="confirmBuilder" @keydown.esc="closeBuilder">
            <header>
              <h3 id="b-title">{{ builder.food.name }}</h3>
              <p class="b-base">Precio base {{ money(builder.food.price) }}</p>
            </header>

            <div class="b-section">
              <h4>Extras</h4>
              <div v-for="e in extrasOf(builder.food)" :key="e.ingredientId" class="b-extra" :class="{ on: pickOf(e) > 0 }">
                <div class="b-copy">
                  <p class="b-label">{{ e.label }}</p>
                  <p class="b-price">{{ e.price > 0 ? `+${money(e.price)} c/u` : 'Sin costo' }}<template v-if="pickOf(e) > 0 && e.price > 0"> · {{ money(e.price * pickOf(e)) }}</template></p>
                </div>
                <div class="qty">
                  <button type="button" :disabled="pickOf(e) === 0" :aria-label="`Quitar uno de ${e.label}`" @click="setPick(e, pickOf(e) - 1)">−</button>
                  <span :aria-label="`${pickOf(e)} de ${e.label}`">{{ pickOf(e) }}</span>
                  <button type="button" :disabled="pickOf(e) >= e.max" :aria-label="`Agregar uno de ${e.label}`" @click="setPick(e, pickOf(e) + 1)">+</button>
                </div>
              </div>
            </div>

            <div class="b-section">
              <h4>Nota</h4>
              <div class="chips" role="group" aria-label="Notas rápidas">
                <button v-for="n in QUICK_NOTES" :key="n" type="button" :aria-pressed="builder.chips.includes(n)" @click="toggleChip(n)">{{ n }}</button>
              </div>
              <input v-model="builder.note" class="b-note" type="text" maxlength="40" autocomplete="off" placeholder="Otra nota (opcional)" aria-label="Otra nota" />
            </div>

            <div class="b-qty">
              <span>Cantidad</span>
              <div class="qty">
                <button type="button" :disabled="builder.quantity <= 1" aria-label="Una menos" @click="builder.quantity -= 1">−</button>
                <span>{{ builder.quantity }}</span>
                <button type="button" :disabled="builder.quantity >= 99" aria-label="Una más" @click="builder.quantity += 1">+</button>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn" @click="closeBuilder">Cancelar</button>
              <button type="submit" class="btn primary">{{ builder.editIndex >= 0 ? 'Guardar' : 'Agregar' }} · {{ money(builderUnit * builder.quantity) }}</button>
            </div>
          </form>
        </div>
      </Teleport>

      <!-- Cobro -->
      <Teleport to="body">
        <div v-if="pay.open" class="modal-bg" @click.self="closePay">
          <form class="modal" role="dialog" aria-modal="true" aria-labelledby="pay-title" @submit.prevent="confirmPay" @keydown.esc="closePay">
            <template v-if="!pay.done">
              <h3 id="pay-title">Cobrar</h3>
              <p class="pay-total">{{ money(totals.total) }}</p>

              <div class="methods" role="group" aria-label="Método de pago">
                <button v-for="m in methods" :key="m.id" type="button" :aria-pressed="pay.method === m.id" @click="pay.method = m.id">{{ m.label }}</button>
              </div>

              <div v-if="pay.method === 'cash'" class="cash-box">
                <div class="quick" role="group" aria-label="Billetes">
                  <button type="button" @click="pay.received = totals.total">Exacto</button>
                  <button v-for="b in bills" :key="b" type="button" @click="pay.received = b">{{ money(b) }}</button>
                </div>
                <label>
                  Recibido
                  <input ref="receivedInput" v-model.number="pay.received" type="number" inputmode="decimal" min="0" step="0.5" />
                </label>
                <p class="change" :class="{ short: cashShort }" role="status">
                  <template v-if="cashShort">Faltan {{ money(totals.total - receivedNumber) }}</template>
                  <template v-else>Cambio: <strong>{{ money(receivedNumber - totals.total) }}</strong></template>
                </p>
              </div>

              <p v-if="pay.error" class="msg err" role="alert">{{ pay.error }}</p>
              <div class="modal-actions">
                <button type="button" class="btn" @click="closePay">Cancelar</button>
                <button type="submit" class="btn primary" :disabled="pay.busy || (pay.method === 'cash' && cashShort)">
                  {{ pay.busy ? 'Cobrando…' : 'Confirmar cobro' }}
                </button>
              </div>
            </template>

            <template v-else>
              <div class="done">
                <p class="done-mark" aria-hidden="true">✓</p>
                <h3 id="pay-title">Venta registrada</h3>
                <p class="turno">Turno <strong>#{{ pay.order.turno }}</strong><span v-if="pay.order.customerName"> · {{ pay.order.customerName }}</span></p>
                <p class="done-total">{{ money(pay.order.total) }} · {{ methodLabel(pay.order.paymentMethod) }}</p>
                <p v-if="pay.order.change > 0" class="done-change">Entrega de cambio: <strong>{{ money(pay.order.change) }}</strong></p>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn" @click="printReceipt">Imprimir ticket</button>
                <button ref="newSaleBtn" type="button" class="btn primary" @click="newSale">Nueva venta</button>
              </div>
            </template>
          </form>
        </div>
      </Teleport>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";
import { hasRole } from "../authStore";
import { bindLive } from "../live";
import { extrasOf, lineKey, missingIngredients, priceWithExtras } from "../recipeMath";

// El servidor recalcula todo (precios del menú, IVA, total); esto solo muestra lo mismo mientras se arma la cuenta.
const TAX_RATE = 0.08;
const round2 = (n) => Number(Number(n).toFixed(2));
const money = (n) => Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Notas que se repiten en un café: un toque en vez de escribir
const QUICK_NOTES = ["Descafeinado", "Sin azúcar", "Extra caliente", "Tibio", "Con hielo", "Sin hielo", "Poca leche"];

const methods = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "transfer", label: "Transferencia" },
];
const methodLabel = (id) => methods.find((m) => m.id === id)?.label || "Otro";

const isAdmin = hasRole("admin");
const loading = ref(true);
const menus = ref([]);
const productsByMenu = reactive({});
const selectedMenuId = ref("");

const lines = ref([]);
const ingredients = ref([]);
const ingredientsById = computed(() => new Map(ingredients.value.map((i) => [i.id, i])));
const missing = (p) => missingIngredients(p, ingredientsById.value);
const lowCount = computed(() => ingredients.value.filter((i) => i.status !== "ok").length);
// Aviso, nunca bloqueo: una venta no se frena por un conteo desactualizado
const stockAlert = computed(() => {
  const out = ingredients.value.filter((i) => i.status === "out").length;
  const low = ingredients.value.filter((i) => i.status === "low").length;
  const parts = [];
  if (out) parts.push(`${out} ${out === 1 ? "insumo agotado" : "insumos agotados"}`);
  if (low) parts.push(`${low} por agotarse`);
  return parts.join(" · ");
});
const noteOpen = reactive({});
const customerName = ref("");
const takeaway = ref(false);
const sheetOpen = ref(false);

const cash = reactive({ loaded: false, open: false, busy: false, error: "", total: 0, count: 0 });
const openingFloat = ref(0);

const pay = reactive({ open: false, done: false, busy: false, error: "", method: "cash", received: 0, ref: "", order: null });
const receivedInput = ref(null);
const newSaleBtn = ref(null);

const products = computed(() => productsByMenu[selectedMenuId.value] || []);
const itemCount = computed(() => lines.value.reduce((n, l) => n + l.quantity, 0));
const totals = computed(() => {
  const subtotal = lines.value.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const tax = round2(subtotal * TAX_RATE);
  return { subtotal: round2(subtotal), tax, total: round2(subtotal + tax) };
});
const receivedNumber = computed(() => Number(pay.received) || 0);
const cashShort = computed(() => receivedNumber.value + 1e-9 < totals.value.total);
// Billetes redondos que cubren el total (los dos más cercanos y el siguiente)
const bills = computed(() => [20, 50, 100, 200, 500, 1000].filter((b) => b >= totals.value.total).slice(0, 3));

const qtyOf = (foodId) => lines.value.filter((l) => l.foodId === foodId).reduce((n, l) => n + l.quantity, 0);

function pushLine(food, options, unitPrice, quantity, notes) {
  const key = lineKey(food.id, options, notes);
  const same = lines.value.find((l) => lineKey(l.foodId, l.options, l.notes) === key);
  if (same) same.quantity = Math.min(99, same.quantity + quantity);
  else lines.value.push({ foodId: food.id, name: food.name, basePrice: Number(food.price) || 0, price: unitPrice, quantity, notes, options, food });
}
function add(p) {
  pushLine(p, [], Number(p.price) || 0, 1, "");
}
// Un producto con extras abre el constructor; uno sin extras se agrega de un toque
function onTile(p) {
  if (extrasOf(p).length) openBuilder(p);
  else add(p);
}
const optionsText = (l) => l.options.map((o) => `${o.label} ×${o.quantity}`).join(" · ");
function inc(i) {
  lines.value[i].quantity = Math.min(99, lines.value[i].quantity + 1);
}
function dec(i) {
  if (lines.value[i].quantity > 1) lines.value[i].quantity -= 1;
  else removeLine(i);
}
function removeLine(i) {
  lines.value.splice(i, 1);
  Object.keys(noteOpen).forEach((k) => delete noteOpen[k]);
}
function clearCart() {
  lines.value = [];
  customerName.value = "";
  takeaway.value = false;
  Object.keys(noteOpen).forEach((k) => delete noteOpen[k]);
  sheetOpen.value = false;
}

/* —— Constructor de bebida —— */
const builder = reactive({ open: false, food: null, picks: {}, chips: [], note: "", quantity: 1, editIndex: -1 });
const built = computed(() => (builder.food ? priceWithExtras(builder.food, builder.picks) : { options: [], unitPrice: 0 }));
const builderUnit = computed(() => built.value.unitPrice);
const pickOf = (e) => builder.picks[e.ingredientId] || 0;
function setPick(e, n) {
  builder.picks[e.ingredientId] = Math.max(0, Math.min(e.max, n));
}
function toggleChip(n) {
  const i = builder.chips.indexOf(n);
  if (i >= 0) builder.chips.splice(i, 1);
  else builder.chips.push(n);
}
function openBuilder(food, editIndex = -1) {
  const line = editIndex >= 0 ? lines.value[editIndex] : null;
  const picks = {};
  for (const o of line?.options || []) picks[o.ingredientId] = o.quantity;
  // Al editar, la nota se vuelve a separar en las rápidas que tocó y lo que escribió a mano
  const tokens = (line?.notes || "").split(/,\s*/).filter(Boolean);
  Object.assign(builder, {
    open: true,
    food,
    picks,
    chips: tokens.filter((t) => QUICK_NOTES.includes(t)),
    note: tokens.filter((t) => !QUICK_NOTES.includes(t)).join(", "),
    quantity: line?.quantity || 1,
    editIndex,
  });
}
function closeBuilder() {
  builder.open = false;
}
function confirmBuilder() {
  const notes = [...QUICK_NOTES.filter((n) => builder.chips.includes(n)), builder.note.trim()].filter(Boolean).join(", ").slice(0, 80);
  const { options, unitPrice } = built.value;
  if (builder.editIndex >= 0) {
    const l = lines.value[builder.editIndex];
    Object.assign(l, { options, price: unitPrice, notes, quantity: builder.quantity });
    Object.keys(noteOpen).forEach((k) => delete noteOpen[k]);
  } else {
    pushLine(builder.food, options, unitPrice, builder.quantity, notes);
  }
  builder.open = false;
}

const newRef = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).slice(0, 64);

async function loadMenus() {
  try {
    const list = (await apiService.getAllMenus()) || [];
    menus.value = list;
    const full = await Promise.allSettled(list.map((m) => apiService.getMenuById(m.id)));
    full.forEach((r, i) => {
      productsByMenu[list[i].id] = r.status === "fulfilled" && Array.isArray(r.value.foods) ? r.value.foods : [];
    });
    if (!menus.value.some((m) => m.id === selectedMenuId.value)) selectedMenuId.value = menus.value[0]?.id || "";
  } catch {
    menus.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadIngredients() {
  try {
    ingredients.value = (await apiService.getIngredients()) || [];
  } catch {
    // Sin inventario la venta funciona igual: solo no hay avisos de existencias
  }
}

// silent: recarga automática (otro dispositivo vendió o cerró la caja); si falla, se queda lo que ya había
async function loadCash(silent = false) {
  try {
    const data = await apiService.getCashSession();
    cash.open = Boolean(data.open);
    cash.total = Number(data.totals?.total || 0);
    cash.count = Number(data.totals?.count || 0);
    cash.error = "";
  } catch {
    if (!silent) cash.open = false;
  } finally {
    cash.loaded = true;
  }
}

async function openCash() {
  cash.busy = true;
  cash.error = "";
  try {
    await apiService.openCashSession(Number(openingFloat.value || 0));
    await loadCash();
  } catch (e) {
    cash.error = typeof e.response?.data === "string" ? e.response.data : "No se pudo abrir la caja";
  } finally {
    cash.busy = false;
  }
}

function openPay() {
  if (!lines.value.length || !cash.open) return;
  Object.assign(pay, { open: true, done: false, busy: false, error: "", method: "cash", received: totals.value.total, order: null });
  pay.ref = pay.ref || newRef(); // se conserva si hubo un error: reintentar no duplica la venta
  sheetOpen.value = false;
}
function closePay() {
  if (pay.busy) return;
  pay.open = false;
}

watch(
  () => pay.method,
  async (m) => {
    if (m === "cash" && pay.open) {
      await nextTick();
      receivedInput.value?.select?.();
    }
  }
);
watch(
  () => pay.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      receivedInput.value?.select?.();
    }
  }
);

async function confirmPay() {
  if (pay.busy || (pay.method === "cash" && cashShort.value)) return;
  pay.busy = true;
  pay.error = "";
  try {
    const order = await apiService.counterSale({
      clientRef: pay.ref,
      paymentMethod: pay.method,
      amountReceived: pay.method === "cash" ? receivedNumber.value : undefined,
      customerName: customerName.value.trim(),
      takeaway: takeaway.value,
      items: lines.value.map((l) => ({
        foodId: l.foodId,
        quantity: l.quantity,
        notes: (l.notes || "").trim(),
        // Solo cuántos de cada extra: el precio y lo que ofrece el producto los decide el servidor
        options: l.options.map((o) => ({ ingredientId: o.ingredientId, quantity: o.quantity })),
      })),
    });
    pay.order = order;
    pay.done = true;
    pay.ref = "";
    loadCash(true);
    loadIngredients();
    await nextTick();
    newSaleBtn.value?.focus?.();
  } catch (e) {
    const msg = typeof e.response?.data === "string" ? e.response.data : "";
    pay.error = msg || "No se pudo registrar la venta. Revisa la conexión e intenta de nuevo.";
    if (/caja/i.test(msg)) loadCash(); // alguien cerró la caja desde otro dispositivo
  } finally {
    pay.busy = false;
  }
}

function printReceipt() {
  if (pay.order?.id) window.open(`/print/order/${pay.order.id}?mode=receipt&autoprint=1`, "_blank");
}
function newSale() {
  pay.open = false;
  pay.done = false;
  pay.order = null;
  clearCart();
}

const live = bindLive(["orders", "inventory"], (changed) => {
  if (changed.includes("orders")) loadCash(true);
  if (changed.includes("inventory")) loadIngredients();
});
onMounted(async () => {
  await live.ready;
  await Promise.all([loadMenus(), loadCash(), loadIngredients()]);
});
onUnmounted(() => live.stop());
</script>

<style scoped>
/* Solo opacidad: un transform (como t-fade-up) que se queda aplicado vuelve a su contenedor el origen de
   todo lo `position: fixed` de adentro (barra y hoja de la cuenta en celular), y dejarían de pegarse a la pantalla. */
.counter { display: grid; gap: 0.9rem; animation: counter-in 0.35s ease both; }
@keyframes counter-in { from { opacity: 0; } to { opacity: 1; } }

.btn { min-height: 3rem; border-radius: 0.85rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-weight: 700; font-size: 1rem; padding: 0 1.1rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
.btn.primary, .btn.charge { border: none; background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); box-shadow: var(--mirestaurante-shadow); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.link { background: none; border: none; color: var(--mirestaurante-muted); font-weight: 600; cursor: pointer; padding: 0.25rem 0.4rem; }
.msg { margin: 0; padding: 0.6rem 0.8rem; border-radius: 0.7rem; font-size: 0.9rem; font-weight: 600; }
.msg.err { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }

/* Caja */
.open-cash { display: grid; gap: 0.8rem; padding: 1.1rem; border-radius: 1.1rem; background: var(--mirestaurante-warning-soft); border: 1px solid color-mix(in srgb, var(--mirestaurante-warning) 40%, transparent); color: var(--mirestaurante-ink); }
.open-cash h2 { margin: 0 0 0.2rem; font-family: var(--font-display); font-size: 1.2rem; }
.open-cash p { margin: 0; color: var(--mirestaurante-muted); font-size: 0.92rem; }
.open-form { display: flex; gap: 0.6rem; align-items: end; flex-wrap: wrap; }
.open-form label { display: grid; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; }
.open-form input { min-height: 3rem; width: 9rem; border: 1px solid var(--mirestaurante-line); border-radius: 0.7rem; padding: 0 0.8rem; font: inherit; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); }
.cash-line { margin: 0; display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; color: var(--mirestaurante-muted); font-weight: 600; }
.dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--mirestaurante-free, #1f7a45); }

.grid { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr) 24rem; align-items: start; }
.grid.locked .products-col { opacity: 0.55; pointer-events: none; }

/* Productos */
.products-col { display: grid; gap: 0.8rem; min-width: 0; }
.cats { display: flex; gap: 0.45rem; overflow-x: auto; padding-bottom: 0.2rem; scrollbar-width: none; }
.cat { flex-shrink: 0; min-height: 2.6rem; padding: 0 1rem; border-radius: 999px; border: 1.5px solid var(--mirestaurante-line); background: var(--mirestaurante-panel); color: var(--mirestaurante-ink); font-weight: 700; cursor: pointer; }
.cat[aria-pressed="true"] { background: var(--mirestaurante-primary); border-color: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.6rem, 1fr)); gap: 0.7rem; }
.tile { position: relative; display: grid; gap: 0.3rem; align-content: space-between; min-height: 6.4rem; padding: 0.8rem; text-align: left; border-radius: 1rem; border: 1.5px solid var(--mirestaurante-line); background: var(--mirestaurante-panel); color: var(--mirestaurante-ink); cursor: pointer; box-shadow: var(--mirestaurante-shadow); transition: transform 0.12s ease, border-color 0.12s ease; font: inherit; }
.tile:active { transform: scale(0.97); }
.tile.picked { border-color: var(--mirestaurante-primary); background: var(--mirestaurante-primary-soft); }
.tile.sk { min-height: 6.4rem; background: var(--mirestaurante-surface); animation: sk 1.2s ease-in-out infinite; box-shadow: none; }
@keyframes sk { 50% { opacity: 0.5; } }
.thumb { display: block; height: 3.4rem; border-radius: 0.6rem; overflow: hidden; background: var(--mirestaurante-surface); }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile-name { font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
.tile-price { color: var(--mirestaurante-muted); font-weight: 600; font-size: 0.9rem; }
.qty-badge { position: absolute; top: 0.5rem; right: 0.5rem; min-width: 1.6rem; height: 1.6rem; padding: 0 0.4rem; display: grid; place-items: center; border-radius: 999px; background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); font-size: 0.8rem; font-weight: 800; }
.empty { display: grid; gap: 0.6rem; justify-items: start; padding: 1.4rem; border-radius: 1rem; border: 1.5px dashed var(--mirestaurante-line); color: var(--mirestaurante-ink); }
.empty h2 { margin: 0; font-family: var(--font-display); font-size: 1.15rem; }
.empty p { margin: 0; color: var(--mirestaurante-muted); }

/* Cuenta */
.ticket-col { position: sticky; top: 0.5rem; }
.ticket { display: grid; gap: 0.8rem; padding: 1rem; border-radius: 1.1rem; background: var(--mirestaurante-panel); border: 1px solid var(--mirestaurante-line); box-shadow: var(--mirestaurante-shadow); color: var(--mirestaurante-ink); }
.t-head { display: flex; align-items: center; gap: 0.5rem; }
.t-head h2 { margin: 0; flex: 1; font-family: var(--font-display); font-size: 1.2rem; }
.sheet-close { display: none; width: 2.4rem; height: 2.4rem; border-radius: 50%; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-size: 1.3rem; cursor: pointer; }
.lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; max-height: 38vh; overflow-y: auto; }
.line { display: grid; gap: 0.35rem; padding-bottom: 0.6rem; border-bottom: 1px solid var(--mirestaurante-line); }
.line-main { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 0.6rem; align-items: center; }
.name { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
.unit { margin: 0; font-size: 0.8rem; color: var(--mirestaurante-muted); }
.qty { display: flex; align-items: center; gap: 0.35rem; }
.qty button { width: 2.4rem; height: 2.4rem; border-radius: 0.7rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-size: 1.2rem; font-weight: 700; cursor: pointer; }
.qty span { min-width: 1.4rem; text-align: center; font-weight: 800; }
.line-total { margin: 0; min-width: 4.2rem; text-align: right; font-weight: 700; }
.note { min-height: 2.4rem; border: 1px solid var(--mirestaurante-line); border-radius: 0.6rem; padding: 0 0.7rem; font: inherit; font-size: 0.88rem; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); }
.add-note { justify-self: start; background: none; border: none; padding: 0; color: var(--mirestaurante-primary); font-weight: 600; font-size: 0.82rem; cursor: pointer; }
.empty-ticket { margin: 0; padding: 1rem 0; text-align: center; color: var(--mirestaurante-muted); }
.options { display: grid; gap: 0.6rem; }
.field { display: grid; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; }
.field em { font-weight: 500; color: var(--mirestaurante-muted); font-style: normal; }
.field input { min-height: 2.8rem; border: 1px solid var(--mirestaurante-line); border-radius: 0.7rem; padding: 0 0.8rem; font: inherit; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); min-width: 0; }
.where { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.where button { min-height: 2.6rem; border-radius: 0.7rem; border: 1.5px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); font-weight: 700; cursor: pointer; }
.where button[aria-pressed="true"] { background: var(--mirestaurante-primary-soft); border-color: var(--mirestaurante-primary); color: var(--mirestaurante-primary); }
.totals { display: grid; gap: 0.3rem; font-size: 0.92rem; color: var(--mirestaurante-muted); }
.totals div { display: flex; justify-content: space-between; }
.totals .grand { color: var(--mirestaurante-ink); font-size: 1.35rem; font-weight: 800; padding-top: 0.4rem; border-top: 1px dashed var(--mirestaurante-line); }
.charge { min-height: 3.6rem; font-size: 1.15rem; }

.cart-bar { display: none; }

.stock-note { margin: 0; padding: 0.55rem 0.8rem; border-radius: 0.7rem; background: var(--mirestaurante-warning-soft); color: var(--mirestaurante-warning); font-size: 0.85rem; font-weight: 600; }
.stock-note a { margin-left: 0.4rem; color: inherit; text-decoration: underline; }
.tile-extras { font-style: normal; font-weight: 500; font-size: 0.78rem; }
.tile-missing { justify-self: start; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); font-size: 0.7rem; font-weight: 800; }
.opts { margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--mirestaurante-primary); font-weight: 600; overflow-wrap: anywhere; }
.line-tools { display: flex; gap: 0.9rem; flex-wrap: wrap; }

/* Constructor de bebida */
.builder { gap: 0.8rem; }
.builder header { display: grid; gap: 0.1rem; }
.b-base { margin: 0; color: var(--mirestaurante-muted); font-size: 0.9rem; }
.b-section { display: grid; gap: 0.5rem; }
.b-section h4 { margin: 0; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mirestaurante-muted); }
.b-extra { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.6rem; align-items: center; padding: 0.55rem 0.7rem; border-radius: 0.85rem; border: 1.5px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); }
.b-extra.on { border-color: var(--mirestaurante-primary); background: var(--mirestaurante-primary-soft); }
.b-copy { min-width: 0; }
.b-label { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
.b-price { margin: 0; font-size: 0.8rem; color: var(--mirestaurante-muted); }
.qty button:disabled { opacity: 0.35; cursor: not-allowed; }
.chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.chips button { min-height: 2.5rem; padding: 0 0.85rem; border-radius: 999px; border: 1.5px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); font-weight: 600; font-size: 0.85rem; cursor: pointer; }
.chips button[aria-pressed="true"] { background: var(--mirestaurante-primary); border-color: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); }
.b-note { min-height: 2.8rem; border: 1px solid var(--mirestaurante-line); border-radius: 0.7rem; padding: 0 0.8rem; font: inherit; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); width: 100%; box-sizing: border-box; }
.b-qty { display: flex; align-items: center; justify-content: space-between; font-weight: 700; }
.builder { overflow-y: auto; }

/* Cobro */
.modal-bg { position: fixed; inset: 0; z-index: 300; background: rgba(10, 16, 14, 0.55); backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; padding: 0.75rem; padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
.modal { background: var(--mirestaurante-panel); color: var(--mirestaurante-ink); border-radius: 1.15rem; padding: 1.2rem; width: min(27rem, 100%); display: grid; gap: 0.9rem; border: 1px solid var(--mirestaurante-line); box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.22); max-height: 94dvh; overflow-y: auto; }
.modal h3 { margin: 0; font-family: var(--font-display); font-size: 1.3rem; }
.pay-total { margin: 0; font-size: 2.4rem; font-weight: 800; letter-spacing: -0.02em; }
.methods { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; }
.methods button { min-height: 3rem; border-radius: 0.8rem; border: 1.5px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); font-weight: 700; cursor: pointer; font-size: 0.9rem; }
.methods button[aria-pressed="true"] { background: var(--mirestaurante-primary-soft); border-color: var(--mirestaurante-primary); color: var(--mirestaurante-primary); }
.cash-box { display: grid; gap: 0.6rem; }
.quick { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.quick button { min-height: 2.6rem; padding: 0 0.9rem; border-radius: 0.7rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-weight: 700; cursor: pointer; }
.cash-box label { display: grid; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; }
.cash-box input { min-height: 3.2rem; border: 1px solid var(--mirestaurante-line); border-radius: 0.8rem; padding: 0 0.9rem; font: inherit; font-size: 1.3rem; font-weight: 700; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); width: 100%; box-sizing: border-box; }
.change { margin: 0; font-size: 1.1rem; color: var(--mirestaurante-success); }
.change.short { color: var(--mirestaurante-danger); font-weight: 700; }
.modal-actions { display: grid; grid-template-columns: 1fr 1.3fr; gap: 0.55rem; }
.modal-actions .btn { white-space: nowrap; padding: 0 0.7rem; font-size: 0.95rem; }
.done { display: grid; gap: 0.35rem; justify-items: center; text-align: center; padding: 0.4rem 0; }
.done-mark { margin: 0; width: 3.6rem; height: 3.6rem; display: grid; place-items: center; border-radius: 50%; background: var(--mirestaurante-success-soft); color: var(--mirestaurante-success); font-size: 2rem; font-weight: 800; }
.turno { margin: 0; font-size: 1.6rem; }
.done-total { margin: 0; color: var(--mirestaurante-muted); font-weight: 600; }
.done-change { margin: 0.2rem 0 0; font-size: 1.25rem; color: var(--mirestaurante-success); }

@media (min-width: 720px) {
  .modal-bg { align-items: center; padding: 1.5rem; }
}
@media (max-width: 899px) {
  .grid { grid-template-columns: minmax(0, 1fr); }
  /* En celular la cuenta es una hoja que sube desde abajo */
  .ticket-col { position: fixed; inset: 0 0 calc(4.6rem + env(safe-area-inset-bottom, 0px)) 0; z-index: 250; background: rgba(10, 16, 14, 0.5); display: none; align-items: flex-end; }
  .ticket-col.open { display: flex; }
  .ticket-col .ticket { width: 100%; box-sizing: border-box; border-radius: 1.2rem 1.2rem 0 0; max-height: 100%; overflow-y: auto; }
  .sheet-close { display: grid; place-items: center; }
  .lines { max-height: 34vh; }
  .cart-bar { position: fixed; left: 0.75rem; right: 0.75rem; bottom: calc(5.2rem + env(safe-area-inset-bottom, 0px)); z-index: 120; min-height: 3.4rem; padding: 0 1.1rem; display: flex; justify-content: space-between; align-items: center; border: none; border-radius: 1rem; background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); font: inherit; cursor: pointer; }
  .counter { padding-bottom: 4.5rem; }
}
@media (prefers-reduced-motion: reduce) { .tile, .tile.sk { transition: none; animation: none; } }
</style>
