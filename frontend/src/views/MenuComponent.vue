<template>
  <AppShell>
    <div class="pos-menu">
      <div class="pos-head">
        <div v-if="tableName" class="mesa-pill">Mesa: {{ tableName }}</div>
        <div v-else class="mesa-pill muted">Pedido sin mesa / para llevar</div>
        <div class="mode-toggle">
          <button type="button" :class="{ on: mode === 'pos' }" @click="mode = 'pos'">Vender</button>
          <button type="button" :class="{ on: mode === 'manage' }" @click="mode = 'manage'">Editar</button>
        </div>
      </div>

      <div class="cats">
        <button
          v-for="menu in menus"
          :key="menu.id"
          type="button"
          class="cat"
          :class="{ on: selectedMenuId === menu.id }"
          @click="loadMenuProducts(menu.id)"
        >{{ menu.name }}</button>
        <button v-if="mode === 'manage'" type="button" class="cat add" @click="showMenuForm = true">+ Cat.</button>
      </div>

      <div class="workspace">
        <div class="products">
          <button
            v-for="producto in productosFiltrados"
            :key="producto.id"
            type="button"
            class="prod"
            @click="mode === 'pos' ? agregarAOrden(producto) : editFood(producto)"
          >
            <div class="thumb" :class="{ empty: !producto.imgUrl }">
              <img v-if="producto.imgUrl" :src="producto.imgUrl" :alt="producto.name" loading="lazy" />
            </div>
            <span class="price">${{ Number(producto.price || 0).toFixed(0) }}</span>
            <span class="pname">{{ producto.name }}</span>
          </button>
          <p v-if="!productosFiltrados.length" class="empty">
            {{ mode === 'manage' ? 'Crea categorías y platillos en Editar.' : 'Elige una categoría.' }}
          </p>
          <button
            v-if="mode === 'manage' && selectedMenuId"
            type="button"
            class="add-food"
            @click="showFoodForm = true"
          >+ Platillo</button>
        </div>

        <LSidebar v-if="mode === 'pos'" class="cart" :table-id="tableId" :table-name="tableName" />
      </div>

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
import { ref, computed, reactive, onMounted } from "vue";
import { useRoute } from "vue-router";
import { apiService } from "../apiService";
import { store } from "../store";

export default {
  components: { AppShell, LSidebar },
  setup() {
    const route = useRoute();
    const menus = ref([]);
    const productos = ref([]);
    const selectedMenuId = ref("");
    const mode = ref("pos");
    const showMenuForm = ref(false);
    const showFoodForm = ref(false);
    const editingFood = ref(null);
    const tableId = ref(route.query.tableId || "");
    const tableName = ref(route.query.tableName || "");
    const menuForm = reactive({ name: "", description: "" });
    const foodForm = reactive({ name: "", price: 0, description: "", imgUrl: "" });

    const productosFiltrados = computed(() => productos.value);

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
      store.platillosSeleccionados.push({ ...producto, quantity: 1 });
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
    };
  },
};
</script>

<style scoped>
.pos-menu { max-width: 1200px; margin: 0 auto; }
.pos-head {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.mesa-pill {
  background: var(--mirestaurante-primary);
  color: var(--mirestaurante-on-primary);
  font-weight: 700;
  padding: 0.65rem 1rem;
  border-radius: 0.8rem;
  font-size: 1rem;
}
.mesa-pill.muted { background: var(--mirestaurante-surface); color: var(--mirestaurante-muted); }
.mode-toggle {
  display: flex;
  background: var(--mirestaurante-panel-elevated);
  border-radius: 0.8rem;
  padding: 0.2rem;
  border: 1px solid var(--mirestaurante-line);
}
.mode-toggle button {
  min-height: 2.75rem;
  min-width: 5.5rem;
  border: none;
  border-radius: 0.65rem;
  background: transparent;
  color: var(--mirestaurante-ink);
  font-weight: 700;
  cursor: pointer;
}
.mode-toggle button.on {
  background: var(--mirestaurante-ink);
  color: var(--mirestaurante-panel);
}
.cats {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding-bottom: 0.55rem;
  margin-bottom: 0.55rem;
  -webkit-overflow-scrolling: touch;
}
.cat {
  flex: 0 0 auto;
  min-height: 3rem;
  padding: 0 1rem;
  border: none;
  border-radius: 999px;
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: var(--mirestaurante-shadow);
}
.cat.on {
  background: var(--mirestaurante-primary);
  color: var(--mirestaurante-on-primary);
}
.cat.add {
  border: 1px dashed var(--mirestaurante-primary);
  color: var(--mirestaurante-primary);
  background: transparent;
  box-shadow: none;
}
.workspace {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
.products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
  gap: 0.55rem;
}
.prod {
  min-height: 9.5rem;
  border: none;
  border-radius: 1rem;
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  box-shadow: var(--mirestaurante-shadow);
  padding: 0.45rem 0.55rem 0.65rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  gap: 0.35rem;
  overflow: hidden;
}
.prod:active { transform: scale(0.97); }
.thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 0.7rem;
  overflow: hidden;
  background: var(--mirestaurante-surface);
}
.thumb.empty {
  background: linear-gradient(135deg, var(--mirestaurante-surface), var(--mirestaurante-panel-elevated));
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.price {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--mirestaurante-primary);
}
.pname {
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1.2;
}
.preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0.75rem;
  overflow: hidden;
  background: var(--mirestaurante-surface);
  border: 1px solid var(--mirestaurante-line);
}
.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.add-food {
  grid-column: 1 / -1;
  min-height: 3.2rem;
  border: 1px dashed var(--mirestaurante-primary);
  border-radius: 0.9rem;
  background: transparent;
  color: var(--mirestaurante-primary);
  font-weight: 700;
  cursor: pointer;
}
.empty { color: var(--mirestaurante-muted); grid-column: 1 / -1; }
.sheet-bg {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(10,16,14,.5);
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet {
  width: min(28rem, 100%);
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  border-radius: 1.2rem 1.2rem 0 0;
  padding: 1rem 1rem calc(1.2rem + env(safe-area-inset-bottom));
  display: grid;
  gap: 0.55rem;
  border: 1px solid var(--mirestaurante-line);
}
.sheet h3 { margin: 0; font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; letter-spacing: -0.01em; }
.inp {
  min-height: 3rem;
  border: 1px solid var(--mirestaurante-line);
  border-radius: 0.75rem;
  padding: 0.65rem 0.8rem;
  font: inherit;
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
}
.act {
  min-height: 3.2rem;
  border: none;
  border-radius: 0.85rem;
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
  background: var(--mirestaurante-surface);
  color: var(--mirestaurante-ink);
}
.act.primary { background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); }
.act.danger { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }

@media (min-width: 900px) {
  .workspace {
    grid-template-columns: 1fr 22rem;
    align-items: start;
  }
  .products {
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  }
  .sheet-bg { align-items: center; padding: 1rem; }
  .sheet { border-radius: 1.15rem; }
}
</style>
