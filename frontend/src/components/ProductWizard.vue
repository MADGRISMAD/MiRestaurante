<template>
  <div class="wiz-bg" @click.self="emit('close')">
    <div class="wiz" role="dialog" aria-modal="true" aria-labelledby="wiz-title">
      <header class="wiz-head">
        <h3 id="wiz-title">{{ food ? 'Editar producto' : 'Nuevo producto' }}</h3>
        <button type="button" class="x" aria-label="Cerrar" @click="emit('close')">×</button>
      </header>

      <ol class="steps" aria-label="Pasos">
        <li v-for="s in STEPS" :key="s.n">
          <button type="button" :aria-current="step === s.n ? 'step' : undefined" :class="{ done: step > s.n }" :disabled="s.n > 1 && !step1Ok" @click="go(s.n)">
            <span class="n">{{ step > s.n ? '✓' : s.n }}</span><span class="t">{{ s.label }}</span>
          </button>
        </li>
      </ol>

      <form class="wiz-body" @submit.prevent="next">
        <!-- 1 · Producto -->
        <section v-show="step === 1" class="pane">
          <p class="lead">Lo básico: cómo se llama y cuánto cuesta.</p>
          <label>Nombre<input v-model="form.name" required maxlength="80" autocomplete="off" placeholder="Ej. Latte, Pan de elote" /></label>
          <label>Precio base <em>(sin extras)</em><input v-model.number="form.price" type="number" inputmode="decimal" min="0" step="0.5" required /></label>
          <label>Descripción <em>(opcional)</em><input v-model="form.description" maxlength="300" autocomplete="off" /></label>
          <label>Imagen <em>(opcional, URL)</em><input v-model="form.imgUrl" type="url" placeholder="https://…" autocomplete="off" /></label>
          <div v-if="form.imgUrl" class="preview"><img :src="form.imgUrl" alt="Vista previa" /></div>
        </section>

        <!-- 2 · Receta -->
        <section v-show="step === 2" class="pane">
          <p class="lead">¿Qué lleva? Cada vez que se venda uno, esto se descuenta del inventario. Puedes saltarte este paso.</p>
          <ul v-if="recipe.length" class="lines">
            <li v-for="(l, i) in recipe" :key="l.ingredientId" class="line">
              <span class="ing">{{ nameOf(l.ingredientId) }}</span>
              <label class="qty">
                <input v-model.number="l.quantity" type="number" inputmode="decimal" min="0.001" step="any" :aria-label="`Cantidad de ${nameOf(l.ingredientId)}`" />
                <span>{{ unitOf(l.ingredientId) }}</span>
              </label>
              <button type="button" class="rm" :aria-label="`Quitar ${nameOf(l.ingredientId)}`" @click="recipe.splice(i, 1)">×</button>
            </li>
          </ul>
          <p v-else class="none">Todavía no hay ingredientes en la receta.</p>
          <p v-if="recipe.length" class="hint">Cantidad que lleva <strong>cada {{ form.name || 'producto' }}</strong>.</p>

          <div class="adder">
            <select v-model="pickRecipe" aria-label="Agregar ingrediente a la receta" @change="addRecipe">
              <option value="">+ Agregar ingrediente…</option>
              <option v-for="i in recipeChoices" :key="i.id" :value="i.id">{{ i.name }} ({{ unitShort(i.unit) }})</option>
            </select>
            <button type="button" class="link" @click="openNew('recipe')">Crear ingrediente nuevo</button>
          </div>
        </section>

        <!-- 3 · Extras -->
        <section v-show="step === 3" class="pane">
          <p class="lead">¿Qué puede agregarle el cliente? Por ejemplo sabores, azúcar o un shot extra. Cada extra se cobra y se descuenta del inventario. Puedes saltarte este paso.</p>
          <ul v-if="extras.length" class="lines extras">
            <li v-for="(e, i) in extras" :key="e.ingredientId" class="extra">
              <div class="extra-head">
                <span class="ing">{{ nameOf(e.ingredientId) }}</span>
                <button type="button" class="rm" :aria-label="`Quitar el extra ${nameOf(e.ingredientId)}`" @click="extras.splice(i, 1)">×</button>
              </div>
              <label>Nombre en la cuenta
                <input v-model="e.label" maxlength="40" autocomplete="off" :placeholder="nameOf(e.ingredientId)" />
              </label>
              <div class="trio">
                <label>Cada uno usa
                  <span class="with-unit"><input v-model.number="e.amount" type="number" inputmode="decimal" min="0.001" step="any" required /><b>{{ unitOf(e.ingredientId) }}</b></span>
                </label>
                <label>Precio c/u $
                  <input v-model.number="e.price" type="number" inputmode="decimal" min="0" step="0.5" placeholder="0" />
                </label>
                <label>Máximo
                  <input v-model.number="e.max" type="number" inputmode="numeric" min="1" max="20" step="1" required />
                </label>
              </div>
              <p class="hint">{{ extraHint(e) }}</p>
            </li>
          </ul>
          <p v-else class="none">Este producto no tendrá extras.</p>

          <div class="adder">
            <select v-model="pickExtra" aria-label="Agregar extra" @change="addExtra">
              <option value="">+ Agregar extra…</option>
              <option v-for="i in extraChoices" :key="i.id" :value="i.id">{{ i.name }} ({{ unitShort(i.unit) }})</option>
            </select>
            <button type="button" class="link" @click="openNew('extras')">Crear ingrediente nuevo</button>
          </div>
        </section>

        <!-- 4 · Resumen -->
        <section v-show="step === 4" class="pane">
          <p class="lead">Revisa cómo quedará.</p>
          <div class="sum-card">
            <div class="sum-top"><strong>{{ form.name || 'Sin nombre' }}</strong><span>{{ money(form.price) }}</span></div>
            <p v-if="form.description" class="hint">{{ form.description }}</p>
            <h4>Receta</h4>
            <ul v-if="recipe.length" class="plain"><li v-for="l in recipe" :key="l.ingredientId">{{ nameOf(l.ingredientId) }} · {{ qtyWithUnit(l.quantity, unitKey(l.ingredientId)) }}</li></ul>
            <p v-else class="none">Sin receta: no descuenta inventario.</p>
            <h4>Extras</h4>
            <ul v-if="extras.length" class="plain">
              <li v-for="e in extras" :key="e.ingredientId">{{ e.label || nameOf(e.ingredientId) }} · {{ e.price > 0 ? `+${money(e.price)} c/u` : 'sin costo' }} · usa {{ qtyWithUnit(e.amount, unitKey(e.ingredientId)) }} · hasta {{ e.max }}</li>
            </ul>
            <p v-else class="none">Sin extras.</p>
          </div>
          <div v-if="example" class="example">
            <h4>Ejemplo de venta</h4>
            <p>{{ example.title }} → <strong>{{ money(example.price) }}</strong></p>
            <p class="hint">Descuenta: {{ example.uses }}</p>
          </div>
          <p v-if="error" class="banner err" role="alert">{{ error }}</p>
        </section>

        <footer class="wiz-foot">
          <button v-if="food && step === 4" type="button" class="danger" :disabled="saving" @click="remove">Eliminar</button>
          <span class="spacer"></span>
          <button v-if="step > 1" type="button" :disabled="saving" @click="step -= 1">Atrás</button>
          <button v-if="step < 4" type="submit" class="primary" :disabled="step === 1 && !step1Ok">Siguiente</button>
          <button v-else type="button" class="primary" :disabled="saving || !step1Ok" @click="save">{{ saving ? 'Guardando…' : food ? 'Guardar cambios' : 'Guardar producto' }}</button>
        </footer>
      </form>

      <!-- Crear un ingrediente sin salir del asistente -->
      <div v-if="neu.open" class="inline-bg" @click.self="neu.open = false">
        <form class="inline" @submit.prevent="createIngredient">
          <h4>Nuevo ingrediente</h4>
          <label>Nombre<input v-model="neu.name" required maxlength="60" autocomplete="off" placeholder="Ej. Jarabe de lavanda" /></label>
          <label>Se mide en
            <select v-model="neu.unit"><option v-for="u in UNIT_OPTIONS" :key="u.key" :value="u.key">{{ u.label }}</option></select>
          </label>
          <p class="hint">Después le registras existencia en Inventario.</p>
          <p v-if="neu.error" class="banner err" role="alert">{{ neu.error }}</p>
          <div class="inline-actions">
            <button type="button" @click="neu.open = false">Cancelar</button>
            <button type="submit" class="primary" :disabled="neu.saving">{{ neu.saving ? 'Creando…' : 'Crear y usar' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { apiService } from "../apiService";
import { UNIT_OPTIONS, qtyWithUnit, unitShort } from "../inventoryUnits";
import { consumptionFor, priceWithExtras, round2 } from "../recipeMath";

const props = defineProps({
  food: { type: Object, default: null }, // null = producto nuevo
  menuId: { type: String, required: true },
  ingredients: { type: Array, default: () => [] },
});
const emit = defineEmits(["saved", "deleted", "close", "ingredients-changed"]);

const STEPS = [
  { n: 1, label: "Producto" },
  { n: 2, label: "Receta" },
  { n: 3, label: "Extras" },
  { n: 4, label: "Resumen" },
];
const money = (n) => Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const step = ref(1);
const saving = ref(false);
const error = ref("");

const form = reactive({
  name: props.food?.name || "",
  price: props.food?.price ?? 0,
  description: props.food?.description || "",
  imgUrl: props.food?.imgUrl || "",
});
const recipe = ref((props.food?.recipe || []).map((l) => ({ ingredientId: String(l.ingredientId), quantity: l.quantity })));
const extras = ref(
  (props.food?.extras || []).map((e) => ({ ingredientId: String(e.ingredientId), label: e.label || "", amount: e.amount, price: e.price, max: e.max }))
);

// Los ingredientes creados aquí mismo se usan de inmediato, aunque el padre aún no haya recargado la lista
const created = ref([]);
const all = computed(() => [...props.ingredients, ...created.value.filter((c) => !props.ingredients.some((i) => i.id === c.id))]);
const byId = computed(() => new Map(all.value.map((i) => [i.id, i])));
const nameOf = (id) => byId.value.get(id)?.name || "Ingrediente";
const unitKey = (id) => byId.value.get(id)?.unit || "";
const unitOf = (id) => unitShort(unitKey(id));

const step1Ok = computed(() => form.name.trim().length > 0 && Number.isFinite(Number(form.price)) && Number(form.price) >= 0);
const recipeChoices = computed(() => all.value.filter((i) => !recipe.value.some((l) => l.ingredientId === i.id)));
const extraChoices = computed(() => all.value.filter((i) => !extras.value.some((e) => e.ingredientId === i.id)));

const pickRecipe = ref("");
const pickExtra = ref("");
function addRecipe() {
  if (!pickRecipe.value) return;
  recipe.value.push({ ingredientId: pickRecipe.value, quantity: 1 });
  pickRecipe.value = "";
}
function addExtra() {
  if (!pickExtra.value) return;
  extras.value.push({ ingredientId: pickExtra.value, label: "", amount: 1, price: 0, max: 5 });
  pickExtra.value = "";
}

function extraHint(e) {
  const n = Number(e.amount) || 0;
  const u = unitOf(e.ingredientId);
  const cobra = Number(e.price) > 0 ? `cobra ${money(e.price)}` : "no cobra nada";
  return `Cada ${e.label || nameOf(e.ingredientId)} que pida el cliente descuenta ${n} ${u} y ${cobra}.`;
}

/* Paso 4: un ejemplo con los dos primeros extras, para ver el precio y el descuento reales */
const example = computed(() => {
  if (!recipe.value.length && !extras.value.length) return null;
  const picks = extras.value.slice(0, 2).map((e) => ({ ingredientId: e.ingredientId, quantity: Math.min(Number(e.max) || 1, 3) }));
  const food = {
    price: Number(form.price) || 0,
    recipe: recipe.value.map((l) => ({ ingredientId: l.ingredientId, quantity: Number(l.quantity) || 0 })),
    // Sin nombre propio, el extra se llama como su ingrediente (igual que lo hace el servidor al guardar)
    extras: extras.value.map((e) => ({ ...e, label: (e.label || "").trim() || nameOf(e.ingredientId), amount: Number(e.amount) || 0, price: Number(e.price) || 0, max: Number(e.max) || 1 })),
  };
  const { options, unitPrice } = priceWithExtras(food, picks);
  const uses = [...consumptionFor(food, options, 1)].map(([id, n]) => qtyWithUnit(n, unitKey(id)) + " de " + nameOf(id));
  const withExtras = options.length ? ` con ${options.map((o) => `${o.quantity} ${o.label}`).join(" y ")}` : "";
  return { title: `1 ${form.name || "producto"}${withExtras}`, price: round2(unitPrice), uses: uses.join(", ") || "nada" };
});

function go(n) {
  if (n > 1 && !step1Ok.value) return;
  step.value = n;
}
function next() {
  if (step.value < 4) go(step.value + 1);
}

/* Crear un ingrediente nuevo sin salir */
const neu = reactive({ open: false, target: "recipe", name: "", unit: "pza", saving: false, error: "" });
function openNew(target) {
  Object.assign(neu, { open: true, target, name: "", unit: "pza", saving: false, error: "" });
}
async function createIngredient() {
  neu.saving = true;
  neu.error = "";
  try {
    const ing = await apiService.createIngredient({ name: neu.name, unit: neu.unit, stock: 0, minStock: 0 });
    created.value.push(ing);
    if (neu.target === "recipe") recipe.value.push({ ingredientId: ing.id, quantity: 1 });
    else extras.value.push({ ingredientId: ing.id, label: "", amount: 1, price: 0, max: 5 });
    neu.open = false;
    emit("ingredients-changed");
  } catch (e) {
    neu.error = typeof e.response?.data === "string" ? e.response.data : "No se pudo crear el ingrediente.";
  } finally {
    neu.saving = false;
  }
}

async function save() {
  saving.value = true;
  error.value = "";
  try {
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      description: form.description,
      imgUrl: (form.imgUrl || "").trim(),
      menuId: props.menuId,
      recipe: recipe.value.map((l) => ({ ingredientId: l.ingredientId, quantity: Number(l.quantity) })),
      extras: extras.value.map((e) => ({ ingredientId: e.ingredientId, label: (e.label || "").trim(), amount: Number(e.amount), price: Number(e.price) || 0, max: Number(e.max) })),
    };
    const saved = props.food ? await apiService.editFood(props.food.id, payload) : await apiService.createFood(payload);
    emit("saved", saved);
  } catch (e) {
    error.value = typeof e.response?.data === "string" ? e.response.data : "No se pudo guardar el producto.";
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!confirm(`¿Eliminar "${props.food.name}"?`)) return;
  saving.value = true;
  try {
    await apiService.deleteFood(props.food.id);
    emit("deleted", props.food.id);
  } catch (e) {
    error.value = typeof e.response?.data === "string" ? e.response.data : "No se pudo eliminar.";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.wiz-bg { position: fixed; inset: 0; z-index: 320; background: rgba(10, 16, 14, 0.55); backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; padding: 0.5rem; padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
.wiz { position: relative; background: var(--mirestaurante-panel); color: var(--mirestaurante-ink); border-radius: 1.15rem; width: min(34rem, 100%); max-height: 96dvh; display: flex; flex-direction: column; border: 1px solid var(--mirestaurante-line); box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.25); overflow: hidden; }
.wiz-head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.1rem 0.4rem; }
.wiz-head h3 { margin: 0; font-family: var(--font-display); font-size: 1.3rem; }
.x { width: 2.4rem; height: 2.4rem; border-radius: 50%; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-size: 1.3rem; cursor: pointer; }

.steps { list-style: none; margin: 0; padding: 0.4rem 1.1rem 0.7rem; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; border-bottom: 1px solid var(--mirestaurante-line); }
.steps button { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.4rem; min-height: 2.5rem; padding: 0 0.3rem; border-radius: 0.7rem; border: 1.5px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-muted); font-weight: 700; font-size: 0.8rem; cursor: pointer; }
.steps button[aria-current="step"] { border-color: var(--mirestaurante-primary); background: var(--mirestaurante-primary-soft); color: var(--mirestaurante-primary); }
.steps button.done { color: var(--mirestaurante-success); }
.steps button:disabled { opacity: 0.45; cursor: not-allowed; }
.steps .n { width: 1.4rem; height: 1.4rem; display: grid; place-items: center; border-radius: 50%; background: var(--mirestaurante-surface); font-size: 0.75rem; flex-shrink: 0; }
.steps .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wiz-body { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.pane { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.8rem; padding: 1rem 1.1rem; overflow-y: auto; overflow-x: hidden; align-content: start; flex: 1; min-height: 14rem; }
.lead { margin: 0; color: var(--mirestaurante-muted); font-size: 0.92rem; line-height: 1.45; }
.pane label { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.3rem; font-size: 0.86rem; font-weight: 600; min-width: 0; }
.pane label em { font-weight: 500; color: var(--mirestaurante-muted); font-style: normal; }
.pane input, .pane select, .inline input, .inline select { min-height: 2.9rem; border: 1px solid var(--mirestaurante-line); border-radius: 0.7rem; padding: 0.5rem 0.75rem; font: inherit; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); width: 100%; box-sizing: border-box; min-width: 0; }
.preview { border-radius: 0.8rem; overflow: hidden; max-height: 9rem; background: var(--mirestaurante-surface); }
.preview img { width: 100%; max-height: 9rem; object-fit: cover; display: block; }

.lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.line { display: grid; grid-template-columns: minmax(0, 1fr) 9rem auto; gap: 0.5rem; align-items: center; padding: 0.55rem 0.7rem; border-radius: 0.8rem; background: var(--mirestaurante-surface); }
.ing { font-weight: 700; overflow-wrap: anywhere; }
.line .qty { display: flex; align-items: center; gap: 0.4rem; grid-template-columns: none; }
.line .qty span { color: var(--mirestaurante-muted); font-size: 0.85rem; font-weight: 600; min-width: 2rem; }
.rm { width: 2.4rem; height: 2.4rem; border-radius: 0.65rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-danger); font-size: 1.2rem; cursor: pointer; }
.extra { display: grid; gap: 0.6rem; padding: 0.8rem; border-radius: 0.9rem; background: var(--mirestaurante-surface); }
.extra-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.trio { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 0.9fr); gap: 0.5rem; }
.with-unit { display: flex; align-items: center; gap: 0.35rem; }
.with-unit b { color: var(--mirestaurante-muted); font-size: 0.8rem; }
.none { margin: 0; padding: 0.8rem; border-radius: 0.8rem; border: 1.5px dashed var(--mirestaurante-line); color: var(--mirestaurante-muted); font-size: 0.9rem; }
.hint { margin: 0; font-size: 0.82rem; color: var(--mirestaurante-muted); line-height: 1.4; }
.adder { display: grid; gap: 0.4rem; }
.link { justify-self: start; background: none; border: none; padding: 0.2rem 0; color: var(--mirestaurante-primary); font-weight: 700; font-size: 0.88rem; cursor: pointer; }

.sum-card { display: grid; gap: 0.35rem; padding: 0.9rem; border-radius: 0.9rem; background: var(--mirestaurante-surface); }
.sum-top { display: flex; justify-content: space-between; gap: 1rem; font-size: 1.1rem; }
.sum-card h4, .example h4 { margin: 0.5rem 0 0; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mirestaurante-muted); }
.plain { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.2rem; font-size: 0.9rem; }
.example { padding: 0.9rem; border-radius: 0.9rem; background: var(--mirestaurante-primary-soft); }
.example p { margin: 0.25rem 0 0; }
.banner { margin: 0; padding: 0.65rem 0.9rem; border-radius: 0.7rem; font-size: 0.9rem; font-weight: 600; }
.banner.err { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }

.wiz-foot { display: flex; gap: 0.5rem; align-items: center; padding: 0.8rem 1.1rem; border-top: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-panel); }
.spacer { flex: 1; }
.wiz-foot button { min-height: 3rem; padding: 0 1.2rem; border-radius: 0.85rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-weight: 700; font-size: 0.95rem; cursor: pointer; }
.wiz-foot .primary, .inline-actions .primary { border: none; background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); box-shadow: var(--mirestaurante-shadow); }
.wiz-foot .danger { color: var(--mirestaurante-danger); }
.wiz-foot button:disabled { opacity: 0.5; cursor: not-allowed; }

.inline-bg { position: absolute; inset: 0; z-index: 2; background: rgba(10, 16, 14, 0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; }
.inline { display: grid; gap: 0.7rem; width: 100%; padding: 1rem; border-radius: 1rem; background: var(--mirestaurante-panel); border: 1px solid var(--mirestaurante-line); box-shadow: var(--mirestaurante-shadow); }
.inline h4 { margin: 0; font-family: var(--font-display); font-size: 1.1rem; }
.inline label { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.3rem; font-size: 0.86rem; font-weight: 600; }
.inline-actions { display: grid; grid-template-columns: 1fr 1.2fr; gap: 0.5rem; }
.inline-actions button { min-height: 2.9rem; border-radius: 0.8rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-weight: 700; cursor: pointer; }

@media (min-width: 720px) { .wiz-bg { align-items: center; padding: 1.5rem; } }
@media (max-width: 480px) {
  .line { grid-template-columns: minmax(0, 1fr) auto; }
  .line .qty { grid-column: 1 / -1; order: 3; }
  .trio { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .trio label:first-child { grid-column: 1 / -1; }
  .steps .t { display: none; }
}
</style>
