<template>
  <AppShell>
    <div class="pos-menu">
      <header class="pm-head">
        <router-link v-if="tableId" to="/main" class="back" aria-label="Volver a mesas">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </router-link>
        <div class="pm-title">
          <p class="kicker">{{ tableId ? 'Pedido para' : mode === 'manage' ? 'Editar menú' : 'Pedido' }}</p>
          <h1>{{ counter ? 'Menú y productos' : tableName || 'Sin mesa' }}</h1>
        </div>
        <div v-if="isAdmin && !counter" class="mode-toggle" role="group" aria-label="Modo">
          <button type="button" :aria-pressed="mode === 'pos'" @click="mode = 'pos'">Vender</button>
          <button type="button" :aria-pressed="mode === 'manage'" @click="mode = 'manage'">Editar</button>
        </div>
      </header>

      <nav class="cats" aria-label="Categorías">
        <button
          v-for="menu in menus"
          :key="menu.id"
          type="button"
          class="cat"
          :aria-pressed="selectedMenuId === menu.id"
          @click="loadMenuProducts(menu.id)"
        >{{ menu.name }}</button>
        <button v-if="mode === 'manage'" type="button" class="cat add" @click="showMenuForm = true">+ Categoría</button>
      </nav>

      <div class="workspace">
        <div class="products">
          <button
            v-for="(producto, i) in productosFiltrados"
            :key="producto.id"
            type="button"
            class="prod"
            :class="{ picked: qtyById[producto.id] }"
            :style="{ '--i': i }"
            @click="mode === 'pos' ? agregarAOrden(producto) : editFood(producto)"
          >
            <span v-if="producto.imgUrl" class="thumb">
              <img :src="producto.imgUrl" :alt="producto.name" loading="lazy" />
            </span>
            <span class="pname">{{ producto.name }}</span>
            <span class="price">{{ money(producto.price) }}</span>
            <span
              v-if="mode === 'pos' && qtyById[producto.id]"
              :key="`${producto.id}-${bumps[producto.id] || 0}`"
              class="qty-badge"
              aria-hidden="true"
            >{{ qtyById[producto.id] }}</span>
          </button>
          <p v-if="!productosFiltrados.length" class="empty">
            {{ mode === 'manage' ? 'Crea categorías y platillos aquí.' : menus.length ? 'Esta categoría no tiene platillos.' : 'Aún no hay menú. Pide al administrador que lo cargue.' }}
          </p>
          <button
            v-if="mode === 'manage' && selectedMenuId"
            type="button"
            class="add-food"
            @click="showFoodForm = true"
          >+ Platillo</button>
        </div>

        <div v-if="mode === 'pos'" class="cart-wrap" :class="{ open: cartOpen }" @click.self="cartOpen = false">
          <LSidebar class="cart" :table-id="tableId" :table-name="tableName" @sent="cartOpen = false">
            <template #close>
              <button type="button" class="cart-close" aria-label="Cerrar cuenta" @click="cartOpen = false">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </template>
          </LSidebar>
        </div>
      </div>

      <Transition name="bar">
        <button v-if="mode === 'pos' && cartCount && !cartOpen" type="button" class="cart-bar" @click="cartOpen = true">
          <span class="cb-count">{{ cartCount }}</span>
          <span class="cb-label">Ver cuenta</span>
          <b class="cb-total">{{ money(cartTotal) }}</b>
          <span class="cb-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" /></svg>
          </span>
        </button>
      </Transition>

      <div v-if="showMenuForm" class="sheet-bg" @click.self="showMenuForm = false">
        <form class="sheet" @submit.prevent="createMenu">
          <h3>Nueva categoría</h3>
          <input v-model="menuForm.name" class="inp" placeholder="Nombre" required />
          <input v-model="menuForm.description" class="inp" placeholder="Descripción" />
          <button type="submit" class="act primary">Crear</button>
          <button type="button" class="act" @click="showMenuForm = false">Cancelar</button>
        </form>
      </div>

      <div v-if="showFoodForm" class="sheet-bg" @click.self="closeFoodForm">
        <form class="sheet" @submit.prevent="createFood">
          <h3>{{ editingFood ? 'Editar' : 'Nuevo' }} platillo</h3>
          <input v-model="foodForm.name" class="inp" placeholder="Nombre" required />
          <input v-model.number="foodForm.price" class="inp" type="number" min="0" step="0.01" placeholder="Precio" required />
          <input v-model="foodForm.description" class="inp" placeholder="Descripción" />
          <input v-model="foodForm.imgUrl" class="inp" type="url" placeholder="URL de imagen (https://…)" />
          <div v-if="foodForm.imgUrl" class="preview">
            <img :src="foodForm.imgUrl" alt="Vista previa" />
          </div>
          <button type="submit" class="act primary">Guardar</button>
          <button v-if="editingFood" type="button" class="act danger" @click="deleteFood">Eliminar</button>
          <button type="button" class="act" @click="closeFoodForm">Cancelar</button>
        </form>
      </div>
    </div>
  </AppShell>
</template>

<script>
import AppShell from "../components/AppShell.vue";
import LSidebar from "../components/LSidebar.vue";
import { ref, computed, reactive, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { apiService } from "../apiService";
import { store } from "../store";
import { hasRole } from "../authStore";
import { isCounterMode } from "../roles";

export default {
  components: { AppShell, LSidebar },
  setup() {
    const route = useRoute();
    const menus = ref([]);
    const productos = ref([]);
    const selectedMenuId = ref("");
    // En café no se pide aquí (se vende en el Mostrador): esta pantalla solo edita los productos
    const counter = isCounterMode();
    const mode = ref(counter ? "manage" : "pos");
    const showMenuForm = ref(false);
    const showFoodForm = ref(false);
    const editingFood = ref(null);
    const tableId = ref(route.query.tableId || "");
    const tableName = ref(route.query.tableName || "");
    const menuForm = reactive({ name: "", description: "" });
    const foodForm = reactive({ name: "", price: 0, description: "", imgUrl: "" });

    const productosFiltrados = computed(() => productos.value);
    const isAdmin = hasRole("admin");
    const cartOpen = ref(false);
    const bumps = reactive({});

    // El carrito es de una mesa: al entrar a otra, empieza vacío
    if (store.forTable !== tableId.value) {
      store.platillosSeleccionados.splice(0, store.platillosSeleccionados.length);
      store.forTable = tableId.value;
    }

    const qtyById = computed(() => {
      const map = {};
      for (const p of store.platillosSeleccionados) map[p.id] = (map[p.id] || 0) + p.quantity;
      return map;
    });
    const cartCount = computed(() => store.platillosSeleccionados.reduce((n, p) => n + p.quantity, 0));
    const cartTotal = computed(() =>
      store.platillosSeleccionados.reduce((sum, p) => sum + p.price * p.quantity, 0) * 1.08
    );
    watch(cartCount, (n) => { if (!n) cartOpen.value = false; });

    const money = (n) =>
      Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

    const fetchMenus = async () => {
      try {
        menus.value = (await apiService.getAllMenus()) || [];
        if (menus.value[0]) loadMenuProducts(menus.value[0].id);
      } catch {
        menus.value = [];
      }
    };

    const loadMenuProducts = async (menuId) => {
      selectedMenuId.value = menuId;
      try {
        const menu = await apiService.getMenuById(menuId);
        productos.value = Array.isArray(menu.foods) ? menu.foods : [];
      } catch {
        productos.value = [];
      }
    };

    const agregarAOrden = (producto) => {
      const line = store.platillosSeleccionados.find((p) => p.id === producto.id && !p.notes);
      if (line) line.quantity += 1;
      else store.platillosSeleccionados.push({ ...producto, quantity: 1, notes: "" });
      bumps[producto.id] = (bumps[producto.id] || 0) + 1;
    };

    const createMenu = async () => {
      const created = await apiService.createMenu({ ...menuForm });
      menus.value.push(created);
      menuForm.name = "";
      menuForm.description = "";
      showMenuForm.value = false;
      loadMenuProducts(created.id);
    };

    const editFood = (producto) => {
      editingFood.value = producto;
      foodForm.name = producto.name;
      foodForm.price = producto.price;
      foodForm.description = producto.description || "";
      foodForm.imgUrl = producto.imgUrl || "";
      showFoodForm.value = true;
    };

    const closeFoodForm = () => {
      showFoodForm.value = false;
      editingFood.value = null;
      foodForm.name = "";
      foodForm.price = 0;
      foodForm.description = "";
      foodForm.imgUrl = "";
    };

    const createFood = async () => {
      const payload = {
        name: foodForm.name,
        price: foodForm.price,
        description: foodForm.description,
        imgUrl: (foodForm.imgUrl || "").trim(),
        menuId: selectedMenuId.value,
      };
      if (editingFood.value) {
        const updated = await apiService.editFood(editingFood.value.id, payload);
        const idx = productos.value.findIndex((p) => p.id === updated.id);
        if (idx >= 0) productos.value[idx] = updated;
      } else {
        const created = await apiService.createFood(payload);
        productos.value.push(created);
      }
      closeFoodForm();
    };

    const deleteFood = async () => {
      if (!editingFood.value) return;
      await apiService.deleteFood(editingFood.value.id);
      productos.value = productos.value.filter((p) => p.id !== editingFood.value.id);
      closeFoodForm();
    };

    onMounted(fetchMenus);

    return {
      menus,
      productos,
      productosFiltrados,
      loadMenuProducts,
      agregarAOrden,
      mode,
      showMenuForm,
      showFoodForm,
      menuForm,
      foodForm,
      createMenu,
      createFood,
      editFood,
      closeFoodForm,
      deleteFood,
      editingFood,
      selectedMenuId,
      tableId,
      tableName,
      isAdmin,
      counter,
      cartOpen,
      bumps,
      qtyById,
      cartCount,
      cartTotal,
      money,
    };
  },
};
</script>

<style scoped>
.pos-menu {
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --display: "Bricolage Grotesque", var(--font-sans);
  --tomato: #d0371f;
  --amber: #e8a020;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  max-width: 1280px;
  margin: 0 auto;
}

/* —— Cabecera —— */
.pm-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.9rem; }
.back {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.8rem;
  border: 1.5px solid var(--mirestaurante-line);
  color: var(--mirestaurante-ink);
  text-decoration: none;
  transition: transform 140ms var(--ease-out), background-color 160ms ease;
}
.back:active { transform: scale(0.94); }
.pm-title { flex: 1; min-width: 0; }
.kicker { margin: 0; font-family: var(--mono); font-size: 0.72rem; color: var(--mirestaurante-muted); }
.pm-title h1 {
  margin: 0.1rem 0 0;
  font-family: var(--display);
  font-size: clamp(1.6rem, 1.2rem + 1.5vw, 2.3rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mode-toggle {
  display: inline-flex;
  padding: 0.2rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--mirestaurante-ink) 7%, transparent);
}
.mode-toggle button {
  min-height: 2.4rem;
  padding: 0 0.8rem;
  border: none;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--mirestaurante-muted);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}
.mode-toggle button[aria-pressed="true"] { background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); box-shadow: 0 1px 2px rgba(27, 24, 20, 0.1); }

/* —— Categorías —— */
.cats {
  display: flex;
  gap: 0.4rem;
  margin: 0 -0.85rem 0.9rem;
  padding: 0 0.85rem 0.15rem;
  overflow-x: auto;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}
.cats::-webkit-scrollbar { display: none; }
.cat {
  flex: 0 0 auto;
  min-height: 2.6rem;
  padding: 0 1rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 99px;
  background: transparent;
  color: var(--mirestaurante-ink);
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 140ms var(--ease-out);
}
.cat:active { transform: scale(0.96); }
.cat[aria-pressed="true"] { background: var(--mirestaurante-ink); border-color: var(--mirestaurante-ink); color: var(--mirestaurante-panel); }
.cat.add { border-style: dashed; color: var(--mirestaurante-muted); }

/* —— Platillos —— */
.workspace { display: grid; grid-template-columns: 1fr; gap: 1rem; align-items: start; }
.products { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.6rem; }
.prod {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.4rem 0.4rem 0.7rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 1.1rem;
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  text-align: left;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
  animation: rise 280ms var(--ease-out) backwards;
  animation-delay: calc(min(var(--i, 0), 10) * 25ms);
  transition: transform 140ms var(--ease-out), border-color 160ms ease;
}
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
.prod:active { transform: scale(0.96); }
.prod.picked { border-color: var(--tomato); }
@media (hover: hover) and (pointer: fine) {
  .prod:hover:not(.picked) { border-color: color-mix(in srgb, var(--mirestaurante-ink) 28%, transparent); }
}
.thumb {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 0.8rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--mirestaurante-ink) 5%, transparent);
}
/* Sin foto: tarjeta compacta de nombre y precio, más platillos a la vista */
.prod:not(:has(.thumb)) { min-height: 5.6rem; padding: 0.75rem 0.5rem 0.7rem; }
.prod:not(:has(.thumb)) .pname { padding-right: 2.2rem; font-size: 0.95rem; }
.prod:not(:has(.thumb)) .qty-badge { top: 0.5rem; right: 0.5rem; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pname { padding: 0 0.3rem; font-weight: 600; font-size: 0.9rem; line-height: 1.2; }
.price { padding: 0 0.3rem; margin-top: auto; font-family: var(--mono); font-size: 0.85rem; font-weight: 700; }
/* Contador con un pequeño rebote al agregar: confirma el toque */
.qty-badge {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  min-width: 1.9rem;
  height: 1.9rem;
  padding: 0 0.45rem;
  display: grid;
  place-items: center;
  border-radius: 99px;
  background: var(--tomato);
  color: #fff;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 0.85rem;
  box-shadow: 0 0 0 3px var(--mirestaurante-panel);
  animation: bump 160ms var(--ease-out);
}
@keyframes bump { from { transform: scale(0.8); } }
.add-food {
  grid-column: 1 / -1;
  min-height: 3.2rem;
  border: 1.5px dashed var(--mirestaurante-line);
  border-radius: 0.9rem;
  background: transparent;
  color: var(--mirestaurante-ink);
  font-weight: 700;
  cursor: pointer;
}
.empty { grid-column: 1 / -1; padding: 2rem 1rem; text-align: center; color: var(--mirestaurante-muted); border: 1.5px dashed var(--mirestaurante-line); border-radius: 1rem; }
.preview { width: 100%; aspect-ratio: 16 / 9; border-radius: 0.75rem; overflow: hidden; background: var(--mirestaurante-surface); border: 1px solid var(--mirestaurante-line); }
.preview img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* —— Cuenta: hoja inferior en celular, columna fija en escritorio —— */
.cart-close {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--mirestaurante-ink) 6%, transparent);
  color: var(--mirestaurante-ink);
  cursor: pointer;
}
.cart-bar {
  position: fixed;
  left: 0.85rem;
  right: 0.85rem;
  bottom: calc(4.9rem + env(safe-area-inset-bottom, 0px));
  z-index: 35;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.45rem 0.45rem 0.45rem 0.5rem;
  border: none;
  border-radius: 99px;
  background: #1c1a17;
  color: #f4efe6;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 18px 40px -16px rgba(20, 18, 16, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  touch-action: manipulation;
  transition: transform 140ms var(--ease-out);
}
.cart-bar:active { transform: scale(0.98); }
.cb-count {
  display: grid;
  place-items: center;
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0 0.5rem;
  border-radius: 99px;
  background: var(--tomato);
  font-family: var(--mono);
}
.cb-label { flex: 1; text-align: left; }
.cb-total { font-family: var(--mono); font-weight: 700; }
.cb-arrow {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 99px;
  background: rgba(244, 239, 230, 0.12);
}
.bar-enter-active { transition: opacity 200ms ease, transform 320ms var(--ease-drawer); }
.bar-leave-active { transition: opacity 140ms ease, transform 160ms ease-out; }
.bar-enter-from, .bar-leave-to { opacity: 0; transform: translateY(1rem); }

@media (max-width: 899px) {
  /* Espacio para que la barra de cuenta no tape el último platillo */
  .products { padding-bottom: 4.5rem; }
  .cart-wrap {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    background: rgba(20, 18, 16, 0.5);
    opacity: 0;
    visibility: hidden;
    transition: opacity 200ms ease, visibility 0s linear 200ms;
  }
  .cart-wrap.open { opacity: 1; visibility: visible; transition: opacity 240ms ease; }
  .cart {
    width: 100%;
    max-height: 88dvh;
    overflow: auto;
    overscroll-behavior: contain;
    border-radius: 1.4rem 1.4rem 0 0;
    padding-bottom: calc(1.1rem + env(safe-area-inset-bottom, 0px));
    transform: translateY(100%);
    transition: transform 200ms ease-out;
  }
  .cart-wrap.open .cart { transform: translateY(0); transition: transform 380ms var(--ease-drawer); }
}

@media (min-width: 900px) {
  .workspace { grid-template-columns: 1fr 23rem; }
  .products { grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); }
  .cart-wrap { position: sticky; top: 0.5rem; }
  .cart-close, .cart-bar { display: none; }
  .sheet-bg { align-items: center; padding: 1rem; }
  .sheet { border-radius: 1.15rem; }
}

@media (prefers-reduced-motion: reduce) {
  .prod, .qty-badge { animation: none; }
  .cart, .cart-wrap.open .cart { transform: none; }
  .bar-enter-from, .bar-leave-to { transform: none; }
}

button:focus-visible, .back:focus-visible { outline: 2.5px solid var(--tomato); outline-offset: 2px; }

/* —— Formularios de edición (admin) —— */
.sheet-bg {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(20, 18, 16, 0.5);
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet {
  width: min(28rem, 100%);
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  border-radius: 1.3rem 1.3rem 0 0;
  padding: 1.1rem 1.1rem calc(1.2rem + env(safe-area-inset-bottom, 0px));
  display: grid;
  gap: 0.6rem;
}
.sheet h3 { margin: 0 0 0.2rem; font-family: var(--display); font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; }
.inp {
  min-height: 3rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 0.75rem;
  padding: 0.6rem 0.8rem;
  font: inherit;
  font-size: 16px;
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
}
.act {
  min-height: 3.2rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 0.85rem;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  background: transparent;
  color: var(--mirestaurante-ink);
}
.act.primary { background: var(--tomato); border-color: var(--tomato); color: #fff; }
.act.danger { color: var(--mirestaurante-danger); }
</style>
