<template>
  <AppShell>
    <div class="inv">
      <div class="toolbar">
        <p>Lleva el control de tus ingredientes. Al vender, lo que cada producto lleva se descuenta solo.</p>
        <button type="button" class="btn-primary" @click="openCreate">+ Ingrediente</button>
      </div>

      <p v-if="error" class="banner err" role="alert">{{ error }}</p>
      <p v-if="notice" class="banner ok" role="status">{{ notice }}</p>

      <div class="filters" role="group" aria-label="Filtrar">
        <button v-for="f in filters" :key="f.id" type="button" class="chip" :class="{ hot: f.id !== 'all' && counts[f.id] }" :aria-pressed="filter === f.id" @click="filter = f.id">
          {{ f.label }} <b>{{ counts[f.id] }}</b>
        </button>
        <input v-model="search" class="search" type="search" placeholder="Buscar ingrediente" aria-label="Buscar ingrediente" />
      </div>

      <div v-if="loading" class="grid" aria-busy="true"><span v-for="i in 4" :key="i" class="card sk"></span></div>

      <div v-else-if="!items.length" class="empty">
        <h2>Aún no tienes ingredientes</h2>
        <p>Agrega lo que usas (leche, café, jarabes, vasos…) y luego dile a cada producto cuánto lleva en su receta.</p>
        <button type="button" class="btn-primary" @click="openCreate">Agregar el primero</button>
      </div>

      <p v-else-if="!visible.length" class="empty-note">Ningún ingrediente coincide.</p>

      <div v-else class="grid">
        <article v-for="i in visible" :key="i.id" class="card" :class="`s-${i.status}`">
          <div class="card-head">
            <h3>{{ i.name }}</h3>
            <span class="badge" :class="`b-${i.status}`">{{ STOCK_STATUS_LABEL[i.status] }}</span>
          </div>
          <p class="stock"><strong>{{ formatQty(i.stock) }}</strong> <span>{{ unitShort(i.unit) }}</span></p>
          <p class="min">
            <template v-if="i.minStock > 0">Avisa en {{ qtyWithUnit(i.minStock, i.unit) }}</template>
            <template v-else>Sin mínimo de aviso</template>
          </p>
          <div class="bar" aria-hidden="true"><span :style="{ width: barWidth(i) + '%' }"></span></div>
          <div class="actions">
            <button type="button" class="primary" @click="openStock(i, 'restock')">+ Entrada</button>
            <button type="button" @click="openStock(i, 'waste')">Merma</button>
            <button type="button" @click="openStock(i, 'adjust')">Contar</button>
            <button type="button" aria-label="Editar" title="Editar" @click="openEdit(i)">Editar</button>
            <button type="button" class="danger" aria-label="Eliminar" title="Eliminar" @click="remove(i)">Eliminar</button>
          </div>
        </article>
      </div>

      <section v-if="items.length" class="history" aria-labelledby="hist-title">
        <h2 id="hist-title">Últimos movimientos</h2>
        <p v-if="!movements.length" class="empty-note">Todavía no hay movimientos.</p>
        <ul v-else class="mov-list">
          <li v-for="m in movements" :key="m.id">
            <span class="mov-type" :class="`t-${m.type}`">{{ MOVEMENT_LABEL[m.type] || m.type }}</span>
            <span class="mov-name">{{ m.ingredientName }}<small v-if="m.note"> · {{ m.note }}</small></span>
            <span class="mov-delta" :class="m.delta < 0 ? 'neg' : 'pos'">{{ m.delta > 0 ? '+' : '' }}{{ formatQty(m.delta) }} {{ unitShort(m.unit) }}</span>
            <span class="mov-after">quedan {{ formatQty(m.stockAfter) }}</span>
            <span class="mov-when">{{ when(m.at) }}</span>
          </li>
        </ul>
      </section>

      <Teleport to="body">
        <!-- Crear / editar -->
        <div v-if="form.open" class="modal-bg" @click.self="form.open = false">
          <form class="modal" role="dialog" aria-modal="true" aria-labelledby="ing-title" @submit.prevent="saveIngredient">
            <h3 id="ing-title">{{ form.id ? 'Editar ingrediente' : 'Nuevo ingrediente' }}</h3>
            <div class="modal-body">
              <label>Nombre<input v-model="form.name" required maxlength="60" autocomplete="off" placeholder="Ej. Leche entera, Jarabe de lavanda" /></label>
              <label>Se mide en
                <select v-model="form.unit" required>
                  <option v-for="u in UNIT_OPTIONS" :key="u.key" :value="u.key">{{ u.label }}</option>
                </select>
              </label>
              <label v-if="!form.id">Existencia inicial
                <input v-model.number="form.stock" type="number" inputmode="decimal" min="0" step="any" />
              </label>
              <label>Avisarme cuando queden <em>(opcional)</em>
                <input v-model.number="form.minStock" type="number" inputmode="decimal" min="0" step="any" placeholder="0 = sin aviso" />
              </label>
              <p v-if="form.id" class="hint">La existencia se cambia con Entrada, Merma o Contar, para que quede en el historial.</p>
            </div>
            <p v-if="form.error" class="banner err" role="alert">{{ form.error }}</p>
            <div class="modal-actions">
              <button type="button" @click="form.open = false">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="form.saving">{{ form.saving ? 'Guardando…' : 'Guardar' }}</button>
            </div>
          </form>
        </div>

        <!-- Entrada / merma / conteo -->
        <div v-if="op.open" class="modal-bg" @click.self="op.open = false">
          <form class="modal" role="dialog" aria-modal="true" aria-labelledby="op-title" @submit.prevent="saveStock">
            <h3 id="op-title">{{ opTitle }}</h3>
            <p class="hint">{{ op.item.name }} · ahora hay <strong>{{ qtyWithUnit(op.item.stock, op.item.unit) }}</strong></p>
            <div class="modal-body">
              <label>{{ op.type === 'adjust' ? 'Cantidad contada' : 'Cantidad' }} <em>({{ unitShort(op.item.unit) }})</em>
                <input ref="opInput" v-model.number="op.quantity" type="number" inputmode="decimal" min="0" step="any" required />
              </label>
              <label>Nota <em>(opcional)</em>
                <input v-model="op.note" maxlength="120" autocomplete="off" :placeholder="opNotePlaceholder" />
              </label>
              <p v-if="opPreview" class="hint">{{ opPreview }}</p>
            </div>
            <p v-if="op.error" class="banner err" role="alert">{{ op.error }}</p>
            <div class="modal-actions">
              <button type="button" @click="op.open = false">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="op.saving">{{ op.saving ? 'Guardando…' : 'Registrar' }}</button>
            </div>
          </form>
        </div>
      </Teleport>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";
import { bindLive } from "../live";
import { MOVEMENT_LABEL, STOCK_STATUS_LABEL, UNIT_OPTIONS, formatQty, qtyWithUnit, unitShort } from "../inventoryUnits";

const items = ref([]);
const movements = ref([]);
const loading = ref(true);
const error = ref("");
const notice = ref("");
const filter = ref("all");
const search = ref("");

const filters = [
  { id: "all", label: "Todos" },
  { id: "low", label: "Por agotarse" },
  { id: "out", label: "Agotados" },
];
const counts = computed(() => ({
  all: items.value.length,
  low: items.value.filter((i) => i.status === "low").length,
  out: items.value.filter((i) => i.status === "out").length,
}));
const visible = computed(() => {
  const q = search.value.trim().toLowerCase();
  return items.value.filter((i) => (filter.value === "all" || i.status === filter.value) && (!q || i.name.toLowerCase().includes(q)));
});

// La barra muestra cuánto queda respecto al doble del mínimo (o lleno si no hay mínimo)
const barWidth = (i) => {
  if (i.stock <= 0) return 0;
  if (!(i.minStock > 0)) return 100;
  return Math.min(100, Math.round((i.stock / (i.minStock * 2)) * 100));
};

const message = (e, fallback) => (typeof e?.response?.data === "string" && e.response.data ? e.response.data : fallback);
function flash(text) {
  notice.value = text;
  setTimeout(() => { if (notice.value === text) notice.value = ""; }, 4000);
}
const when = (d) =>
  new Date(d).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// silent: recarga automática (otro dispositivo vendió o movió inventario); si falla se queda lo que ya había
async function load(silent = false) {
  try {
    const [list, mov] = await Promise.all([apiService.getIngredients(), apiService.getStockMovements({ limit: 25 })]);
    items.value = list || [];
    movements.value = mov || [];
    error.value = "";
  } catch (e) {
    if (!silent) error.value = message(e, "No se pudo cargar el inventario.");
  } finally {
    loading.value = false;
  }
}

/* —— Crear / editar —— */
const form = reactive({ open: false, id: "", name: "", unit: "pza", stock: 0, minStock: 0, saving: false, error: "" });
function openCreate() {
  Object.assign(form, { open: true, id: "", name: "", unit: "pza", stock: 0, minStock: 0, saving: false, error: "" });
}
function openEdit(i) {
  Object.assign(form, { open: true, id: i.id, name: i.name, unit: i.unit, stock: 0, minStock: i.minStock, saving: false, error: "" });
}
async function saveIngredient() {
  form.saving = true;
  form.error = "";
  try {
    const body = { name: form.name, unit: form.unit, minStock: Number(form.minStock) || 0 };
    if (form.id) await apiService.updateIngredient(form.id, body);
    else await apiService.createIngredient({ ...body, stock: Number(form.stock) || 0 });
    form.open = false;
    flash(form.id ? "Ingrediente actualizado." : "Ingrediente agregado.");
    await load(true);
  } catch (e) {
    form.error = message(e, "No se pudo guardar el ingrediente.");
  } finally {
    form.saving = false;
  }
}

async function remove(i) {
  if (!confirm(`¿Eliminar "${i.name}"?`)) return;
  error.value = "";
  try {
    await apiService.deleteIngredient(i.id);
    flash("Ingrediente eliminado.");
    await load(true);
  } catch (e) {
    error.value = message(e, "No se pudo eliminar.");
  }
}

/* —— Entrada / merma / conteo —— */
const op = reactive({ open: false, type: "restock", item: null, quantity: 0, note: "", saving: false, error: "" });
const opInput = ref(null);
const opTitle = computed(() => ({ restock: "Entrada de mercancía", waste: "Registrar merma", adjust: "Contar existencia" }[op.type]));
const opNotePlaceholder = computed(() => ({ restock: "Ej. Compra del lunes", waste: "Ej. Se echó a perder", adjust: "Ej. Conteo de cierre" }[op.type]));
const opPreview = computed(() => {
  if (!op.item || op.quantity === "" || op.quantity === null) return "";
  const q = Number(op.quantity) || 0;
  const now = op.item.stock;
  const next = op.type === "restock" ? now + q : op.type === "waste" ? now - q : q;
  return `Quedarán ${qtyWithUnit(Math.round(next * 1000) / 1000, op.item.unit)}`;
});
async function openStock(item, type) {
  Object.assign(op, { open: true, type, item, quantity: type === "adjust" ? item.stock : 0, note: "", saving: false, error: "" });
  await nextTick();
  opInput.value?.select?.();
}
async function saveStock() {
  op.saving = true;
  op.error = "";
  try {
    await apiService.stockMovement(op.item.id, { type: op.type, quantity: Number(op.quantity), note: op.note });
    op.open = false;
    flash("Movimiento registrado.");
    await load(true);
  } catch (e) {
    op.error = message(e, "No se pudo registrar el movimiento.");
  } finally {
    op.saving = false;
  }
}

const live = bindLive(["inventory"], () => load(true));
onMounted(async () => {
  await live.ready;
  await load();
});
onUnmounted(() => live.stop());
</script>

<style scoped>
.inv { display: grid; gap: 1.1rem; animation: inv-in 0.35s ease both; }
@keyframes inv-in { from { opacity: 0; } to { opacity: 1; } }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.toolbar p { margin: 0; color: var(--mirestaurante-muted); max-width: 40rem; }
.btn-primary { background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); border: none; border-radius: 0.7rem; padding: 0.65rem 1.05rem; font-weight: 600; cursor: pointer; box-shadow: var(--mirestaurante-shadow); min-height: 2.8rem; }
.btn-primary:disabled { opacity: 0.65; cursor: wait; }
.banner { margin: 0; padding: 0.65rem 0.9rem; border-radius: 0.7rem; font-size: 0.9rem; font-weight: 600; }
.banner.err { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }
.banner.ok { background: var(--mirestaurante-success-soft); color: var(--mirestaurante-success); }

.filters { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.chip { min-height: 2.5rem; padding: 0 0.95rem; border-radius: 999px; border: 1.5px solid var(--mirestaurante-line); background: var(--mirestaurante-panel); color: var(--mirestaurante-ink); font-weight: 600; cursor: pointer; }
.chip b { margin-left: 0.25rem; }
.chip[aria-pressed="true"] { background: var(--mirestaurante-primary); border-color: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); }
.chip.hot:not([aria-pressed="true"]) { border-color: var(--mirestaurante-warning); color: var(--mirestaurante-warning); }
.search { flex: 1; min-width: 11rem; min-height: 2.5rem; border: 1px solid var(--mirestaurante-line); border-radius: 999px; padding: 0 1rem; font: inherit; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 0.9rem; }
.card { display: grid; gap: 0.35rem; align-content: start; padding: 1rem; border-radius: 1.1rem; background: var(--mirestaurante-panel); border: 1.5px solid var(--mirestaurante-line); box-shadow: var(--mirestaurante-shadow); color: var(--mirestaurante-ink); }
.card.s-low { border-color: color-mix(in srgb, var(--mirestaurante-warning) 60%, var(--mirestaurante-line)); }
.card.s-out { border-color: var(--mirestaurante-danger); }
.card.sk { min-height: 9rem; background: var(--mirestaurante-surface); box-shadow: none; }
.card-head { display: flex; justify-content: space-between; align-items: start; gap: 0.5rem; }
.card h3 { margin: 0; font-family: var(--font-display); font-size: 1.1rem; overflow-wrap: anywhere; }
.badge { flex-shrink: 0; padding: 0.2rem 0.65rem; border-radius: 999px; font-size: 0.72rem; font-weight: 800; background: var(--mirestaurante-success-soft); color: var(--mirestaurante-success); }
.badge.b-low { background: var(--mirestaurante-warning-soft); color: var(--mirestaurante-warning); }
.badge.b-out { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }
.stock { margin: 0.2rem 0 0; font-size: 1.9rem; letter-spacing: -0.02em; }
.stock strong { font-weight: 800; }
.stock span { font-size: 0.95rem; color: var(--mirestaurante-muted); font-weight: 600; }
.card.s-out .stock strong { color: var(--mirestaurante-danger); }
.min { margin: 0; font-size: 0.82rem; color: var(--mirestaurante-muted); }
.bar { height: 0.4rem; border-radius: 999px; background: var(--mirestaurante-surface); overflow: hidden; margin: 0.2rem 0 0.4rem; }
.bar span { display: block; height: 100%; border-radius: 999px; background: var(--mirestaurante-success); }
.s-low .bar span { background: var(--mirestaurante-warning); }
.s-out .bar span { background: var(--mirestaurante-danger); }
.actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.actions button { min-height: 2.5rem; padding: 0 0.75rem; border-radius: 0.65rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); font-weight: 600; font-size: 0.82rem; cursor: pointer; }
.actions .primary { background: var(--mirestaurante-primary-soft); border-color: var(--mirestaurante-primary); color: var(--mirestaurante-primary); }
.actions .danger { color: var(--mirestaurante-danger); border-color: color-mix(in srgb, var(--mirestaurante-danger) 35%, transparent); }

.empty { display: grid; gap: 0.6rem; justify-items: start; padding: 1.4rem; border-radius: 1rem; border: 1.5px dashed var(--mirestaurante-line); color: var(--mirestaurante-ink); }
.empty h2 { margin: 0; font-family: var(--font-display); font-size: 1.15rem; }
.empty p, .empty-note { margin: 0; color: var(--mirestaurante-muted); }

.history { display: grid; gap: 0.6rem; }
.history h2 { margin: 0; font-family: var(--font-display); font-size: 1.1rem; color: var(--mirestaurante-ink); }
.mov-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
.mov-list li { display: grid; grid-template-columns: 6.2rem minmax(0, 1fr) auto auto auto; gap: 0.7rem; align-items: center; padding: 0.6rem 0.8rem; border-radius: 0.8rem; background: var(--mirestaurante-panel); border: 1px solid var(--mirestaurante-line); font-size: 0.85rem; color: var(--mirestaurante-ink); }
.mov-type { font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--mirestaurante-muted); }
.mov-type.t-restock, .mov-type.t-return { color: var(--mirestaurante-success); }
.mov-type.t-waste { color: var(--mirestaurante-danger); }
.mov-type.t-sale { color: var(--mirestaurante-primary); }
.mov-name { overflow-wrap: anywhere; font-weight: 600; }
.mov-name small { font-weight: 400; color: var(--mirestaurante-muted); }
.mov-delta { font-weight: 800; white-space: nowrap; }
.mov-delta.pos { color: var(--mirestaurante-success); }
.mov-delta.neg { color: var(--mirestaurante-danger); }
.mov-after, .mov-when { color: var(--mirestaurante-muted); white-space: nowrap; }

.modal-bg { position: fixed; inset: 0; z-index: 300; background: rgba(10, 16, 14, 0.55); backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; padding: 0.75rem; padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
.modal { background: var(--mirestaurante-panel); color: var(--mirestaurante-ink); border-radius: 1.15rem; padding: 1.15rem; width: min(26rem, 100%); max-height: 92dvh; display: flex; flex-direction: column; gap: 0.75rem; border: 1px solid var(--mirestaurante-line); box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.22); overflow: hidden; }
.modal h3 { margin: 0; font-family: var(--font-display); font-size: 1.3rem; }
.modal-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem; overflow-y: auto; overflow-x: hidden; min-height: 0; }
.modal label { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.3rem; font-size: 0.88rem; font-weight: 600; min-width: 0; }
.modal label em { font-weight: 500; color: var(--mirestaurante-muted); font-style: normal; }
.modal input, .modal select { min-height: 3rem; border: 1px solid var(--mirestaurante-line); border-radius: 0.7rem; padding: 0.65rem 0.8rem; font: inherit; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); width: 100%; box-sizing: border-box; min-width: 0; }
.hint { margin: 0; font-size: 0.85rem; color: var(--mirestaurante-muted); }
.modal-actions { display: grid; grid-template-columns: 1fr 1.2fr; gap: 0.55rem; padding-top: 0.25rem; border-top: 1px solid var(--mirestaurante-line); }
.modal-actions button { min-height: 3.1rem; border-radius: 0.85rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-weight: 700; font-size: 1rem; cursor: pointer; }
.modal-actions .btn-primary { border: none; background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); }

@media (min-width: 720px) { .modal-bg { align-items: center; padding: 1.5rem; } }
@media (max-width: 719px) {
  .mov-list li { grid-template-columns: minmax(0, 1fr) auto; }
  .mov-type, .mov-after, .mov-when { grid-column: 1 / -1; }
}
</style>
