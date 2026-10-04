<template>
  <AppShell>
    <section class="floor" aria-labelledby="floor-title">
      <header class="floor-head">
        <div class="head-copy">
          <h1 id="floor-title">Salón</h1>
          <p class="stats" aria-live="polite">
            <span class="stat"><i class="dot free" aria-hidden="true"></i><b>{{ stats.free }}</b> libres</span>
            <span class="stat"><i class="dot busy" aria-hidden="true"></i><b>{{ stats.busy }}</b> ocupadas</span>
            <span class="stat muted"><b>{{ stats.seated }}</b>/{{ stats.seats }} lugares en uso</span>
          </p>
        </div>
        <div class="head-actions">
          <button
            type="button"
            class="btn btn-quiet"
            :class="{ on: editMap }"
            :aria-pressed="editMap"
            @click="toggleEditMap"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path v-if="!editMap" d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
              <path v-else d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {{ editMap ? 'Listo' : 'Editar plano' }}
          </button>
          <button type="button" class="btn btn-primary" @click="mostrarModalAgregarMesa">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Mesa
          </button>
        </div>
      </header>

      <p v-if="editMap" class="edit-hint" role="status">
        Arrastra una mesa a su lugar, o selecciónala y usa las flechas del teclado. Los cambios se guardan solos.
      </p>

      <div v-if="loading" class="floor-scroll">
        <div class="floor-map skeleton" :style="mapStyle" aria-busy="true" aria-label="Cargando mesas">
          <span v-for="i in 6" :key="i" class="sk-piece" :style="{ gridColumn: (i * 2) - 1, gridRow: (i % 3) * 2 + 2 }" />
        </div>
      </div>

      <div v-else-if="!mesas.length" class="empty">
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="14" y="22" width="36" height="20" rx="4" />
          <path d="M22 16h8M34 16h8M22 48h8M34 48h8" stroke-linecap="round" />
        </svg>
        <h2>Tu salón está vacío</h2>
        <p>Agrega tu primera mesa y acomódala en el plano como está en tu local.</p>
        <button type="button" class="btn btn-primary" @click="mostrarModalAgregarMesa">Agregar mesa</button>
      </div>

      <div v-else class="floor-scroll">
        <div
          ref="mapRef"
          class="floor-map"
          :class="{ editing: editMap }"
          :style="mapStyle"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <template v-if="editMap">
            <div
              v-for="cell in gridCells"
              :key="`g-${cell.x}-${cell.y}`"
              class="grid-cell"
              :class="{ drop: dropTarget && dropTarget.x === cell.x && dropTarget.y === cell.y }"
              :style="cellStyle(cell.x, cell.y)"
            />
          </template>

          <button
            v-for="(mesa, i) in mesas"
            :key="mesa.id"
            type="button"
            class="table-piece"
            :class="[
              mesa.disponible ? 'is-free' : 'is-busy',
              shapeClass(mesa.capacidad),
              { dragging: drag?.id === mesa.id, 'edit-mode': editMap },
            ]"
            :style="[pieceStyle(mesa), { '--i': i }]"
            :aria-label="tableLabel(mesa)"
            @pointerdown="onPointerDown($event, mesa)"
            @click="onTableClick(mesa)"
            @keydown="onTableKey($event, mesa)"
          >
            <span class="table-unit" aria-hidden="true">
              <span
                v-for="n in seatCount(mesa.capacidad)"
                :key="n"
                class="chair"
                :class="`c${n}`"
              />
              <span class="table-top">
                <span class="table-name">{{ shortName(mesa.nombre) }}</span>
                <span class="table-cap">{{ mesa.capacidad }} pers.</span>
              </span>
              <span v-if="waiterInitials(mesa)" class="waiter-tag">{{ waiterInitials(mesa) }}</span>
            </span>
          </button>
        </div>
      </div>

      <!-- Detalle de mesa -->
      <Transition name="sheet">
        <div v-if="modalActivo && mesaSeleccionada" class="sheet-bg" @click.self="cerrarMesa">
          <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <div class="sheet-handle" aria-hidden="true"></div>
            <div class="sheet-head">
              <div>
                <h2 id="sheet-title">{{ mesaSeleccionada.nombre }}</h2>
                <p class="sheet-sub">
                  {{ mesaSeleccionada.capacidad }} personas · {{ shapeLabel(mesaSeleccionada.capacidad) }}
                </p>
              </div>
              <span class="status-pill" :class="mesaSeleccionada.disponible ? 'free' : 'busy'">
                {{ mesaSeleccionada.disponible ? 'Libre' : 'Ocupada' }}
              </span>
              <button ref="closeBtn" type="button" class="icon-close" aria-label="Cerrar" @click="cerrarMesa">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div class="sheet-actions">
              <button
                v-if="mesaSeleccionada.disponible"
                type="button"
                class="btn btn-primary btn-lg"
                :disabled="busy"
                @click="ocuparMesa"
              >
                Sentar clientes
              </button>
              <button type="button" class="btn btn-lg" :class="mesaSeleccionada.disponible ? 'btn-soft' : 'btn-primary'" @click="irAPedido">
                Tomar pedido
              </button>
              <button
                v-if="!mesaSeleccionada.disponible"
                type="button"
                class="btn btn-soft btn-lg"
                :disabled="busy"
                @click="desocuparMesa"
              >
                Liberar mesa
              </button>
            </div>

            <label class="field">
              <span>Mesero a cargo</span>
              <select v-model="selectedWaiterPhone" :disabled="busy" @change="guardarMesero">
                <option value="">Sin asignar</option>
                <option v-for="w in waiters" :key="w.cellphone" :value="w.cellphone">
                  {{ w.name }} {{ w.lastName }}
                </option>
              </select>
              <small v-if="waiterSaved" class="saved" role="status">Guardado</small>
            </label>

            <button type="button" class="link-danger" :disabled="busy" @click="eliminarMesa(mesaSeleccionada)">
              Eliminar mesa
            </button>
          </div>
        </div>
      </Transition>

      <!-- Nueva mesa -->
      <Transition name="sheet">
        <div v-if="modalAgregarMesa" class="sheet-bg" @click.self="cerrarModalAgregarMesa">
          <form
            class="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-title"
            @submit.prevent="agregarNuevaMesa"
          >
            <div class="sheet-handle" aria-hidden="true"></div>
            <div class="sheet-head">
              <h2 id="new-title">Nueva mesa</h2>
              <button type="button" class="icon-close" aria-label="Cerrar" @click="cerrarModalAgregarMesa">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <label class="field">
              <span>Nombre</span>
              <input
                ref="nameInput"
                v-model="nombreNuevaMesa"
                type="text"
                maxlength="30"
                autocomplete="off"
                enterkeyhint="done"
                :placeholder="`Mesa ${mesas.length + 1}`"
              />
            </label>

            <fieldset class="field">
              <legend>Capacidad</legend>
              <div class="cap-grid">
                <label
                  v-for="opt in capOptions"
                  :key="opt.value"
                  class="cap-opt"
                  :class="[shapeClass(opt.value), { on: capacidadNuevaMesa === opt.value }]"
                >
                  <input v-model="capacidadNuevaMesa" type="radio" name="cap" :value="opt.value" class="sr-only" />
                  <span class="cap-shape" aria-hidden="true"></span>
                  <b>{{ opt.value }}</b>
                  <small>{{ opt.label }}</small>
                </label>
              </div>
            </fieldset>

            <p v-if="!hasRoomFor(Number(capacidadNuevaMesa))" class="warn" role="alert">
              No queda espacio en el plano para una mesa de este tamaño. Mueve o elimina alguna.
            </p>

            <button type="submit" class="btn btn-primary btn-lg" :disabled="busy || !hasRoomFor(Number(capacidadNuevaMesa))">
              Crear mesa
            </button>
          </form>
        </div>
      </Transition>

      <Transition name="toast">
        <div v-if="toast" class="toast" :class="toast.tone" role="status">{{ toast.text }}</div>
      </Transition>
    </section>
  </AppShell>
</template>

<script setup>
import AppShell from '../components/AppShell.vue';
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { apiService } from '../apiService.ts';

const COLS = 12;
const ROWS = 8;

const capOptions = [
  { value: 2, label: 'Redonda' },
  { value: 4, label: 'Cuadrada' },
  { value: 6, label: 'Rectangular' },
  { value: 8, label: 'Grande' },
  { value: 10, label: 'Banquete' },
];

const router = useRouter();
const mapRef = ref(null);
const nameInput = ref(null);
const closeBtn = ref(null);
const mesas = ref([]);
const waiters = ref([]);
const loading = ref(true);
const busy = ref(false);
const modalActivo = ref(false);
const modalAgregarMesa = ref(false);
const nombreNuevaMesa = ref('');
const capacidadNuevaMesa = ref(4);
const mesaSeleccionada = ref(null);
const selectedWaiterPhone = ref('');
const waiterSaved = ref(false);
const editMap = ref(false);
const drag = ref(null);
const dropTarget = ref(null);
const skipClick = ref(false);
const toast = ref(null);
let toastTimer;
let lastFocus = null;

const stats = computed(() => {
  let free = 0;
  let busyCount = 0;
  let seats = 0;
  let seated = 0;
  for (const m of mesas.value) {
    const cap = Number(m.capacidad) || 0;
    seats += cap;
    if (m.disponible) free += 1;
    else {
      busyCount += 1;
      seated += cap;
    }
  }
  return { free, busy: busyCount, seats, seated };
});

const gridCells = computed(() => {
  const cells = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
});

const mapStyle = computed(() => ({
  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${ROWS}, minmax(3.4rem, 1fr))`,
}));

const waiterByPhone = computed(() => {
  const map = new Map();
  for (const w of waiters.value) map.set(String(w.cellphone), w);
  return map;
});

function showToast(text, tone = 'ok') {
  clearTimeout(toastTimer);
  toast.value = { text, tone };
  toastTimer = setTimeout(() => { toast.value = null; }, 2800);
}

function waiterPhone(mesa) {
  return typeof mesa.mesero === 'string' ? mesa.mesero : mesa.mesero?.cellphone || '';
}

function waiterInitials(mesa) {
  const w = waiterByPhone.value.get(String(waiterPhone(mesa)));
  if (!w) return '';
  return `${(w.name || '')[0] || ''}${(w.lastName || '')[0] || ''}`.toUpperCase();
}

function tableLabel(mesa) {
  const w = waiterByPhone.value.get(String(waiterPhone(mesa)));
  const parts = [mesa.nombre, mesa.disponible ? 'libre' : 'ocupada', `${mesa.capacidad} personas`];
  if (w) parts.push(`mesero ${w.name}`);
  return parts.join(', ');
}

function shapeClass(cap) {
  const n = Number(cap) || 4;
  if (n <= 2) return 'shape-2';
  if (n <= 4) return 'shape-4';
  if (n <= 6) return 'shape-6';
  if (n <= 8) return 'shape-8';
  return 'shape-10';
}

function shapeLabel(cap) {
  const n = Number(cap) || 4;
  if (n <= 2) return 'Redonda chica';
  if (n <= 4) return 'Cuadrada';
  if (n <= 6) return 'Rectangular';
  if (n <= 8) return 'Grande';
  return 'Banquete';
}

function shortName(name) {
  const t = String(name || '').trim();
  const m = t.match(/(\d+)/);
  if (m) return m[1];
  return t.slice(0, 4).toUpperCase();
}

function seatCount(cap) {
  const n = Number(cap) || 4;
  if (n <= 2) return 2;
  if (n <= 4) return 4;
  if (n <= 6) return 6;
  if (n <= 8) return 8;
  return 10;
}

function cellStyle(x, y) {
  return { gridColumn: x + 1, gridRow: y + 1 };
}

function pieceStyle(mesa) {
  const x = Number(mesa.posX) || 0;
  const y = Number(mesa.posY) || 0;
  const span = spanFor(mesa.capacidad);
  const style = {
    gridColumn: `${x + 1} / span ${span.w}`,
    gridRow: `${y + 1} / span ${span.h}`,
  };
  if (drag.value?.id === mesa.id && drag.value.ghost) {
    style.transform = `translate(${drag.value.ghost.dx}px, ${drag.value.ghost.dy}px)`;
    style.zIndex = 20;
  }
  return style;
}

function spanFor(cap) {
  const n = Number(cap) || 4;
  if (n <= 2) return { w: 1, h: 1 };
  if (n <= 4) return { w: 1, h: 1 };
  if (n <= 6) return { w: 2, h: 1 };
  if (n <= 8) return { w: 2, h: 2 };
  return { w: 3, h: 1 };
}

function occupiedKeys(excludeId = null) {
  const set = new Set();
  for (const m of mesas.value) {
    if (excludeId && m.id === excludeId) continue;
    const span = spanFor(m.capacidad);
    const x0 = Number(m.posX) || 0;
    const y0 = Number(m.posY) || 0;
    for (let dy = 0; dy < span.h; dy += 1) {
      for (let dx = 0; dx < span.w; dx += 1) {
        set.add(`${x0 + dx},${y0 + dy}`);
      }
    }
  }
  return set;
}

function canPlace(x, y, cap, excludeId = null) {
  const span = spanFor(cap);
  if (x < 0 || y < 0 || x + span.w > COLS || y + span.h > ROWS) return false;
  const taken = occupiedKeys(excludeId);
  for (let dy = 0; dy < span.h; dy += 1) {
    for (let dx = 0; dx < span.w; dx += 1) {
      if (taken.has(`${x + dx},${y + dy}`)) return false;
    }
  }
  return true;
}

function findFreeSlot(cap, excludeId = null) {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (canPlace(x, y, cap, excludeId)) return { x, y };
    }
  }
  return null;
}

function hasRoomFor(cap) {
  return findFreeSlot(cap) !== null;
}

async function ensurePositions(list) {
  const assigned = list.map((m) => ({ ...m }));
  const pending = [];

  // Solo las que ya tienen posición cuentan para colisión
  mesas.value = assigned.filter(
    (m) => m.posX != null && m.posY != null && !Number.isNaN(Number(m.posX))
  );

  for (const m of assigned) {
    if (m.posX != null && m.posY != null && !Number.isNaN(Number(m.posX))) continue;
    const slot = findFreeSlot(m.capacidad) || { x: 0, y: 0 };
    m.posX = slot.x;
    m.posY = slot.y;
    mesas.value = [...mesas.value, m];
    pending.push(m);
  }

  mesas.value = assigned;
  await Promise.all(
    pending.map((m) =>
      apiService.editTable(m.id, { posX: m.posX, posY: m.posY }).catch(() => null)
    )
  );
}

async function refillMesas() {
  try {
    const list = (await apiService.getTables()) || [];
    mesas.value = list;
    await ensurePositions(list);
  } catch {
    mesas.value = [];
    showToast('No se pudieron cargar las mesas', 'error');
  }
}

async function loadWaiters() {
  try {
    waiters.value = (await apiService.getWaiters()) || [];
  } catch {
    waiters.value = [];
  }
}

function toggleEditMap() {
  editMap.value = !editMap.value;
  drag.value = null;
  dropTarget.value = null;
}

function onTableClick(mesa) {
  if (editMap.value || skipClick.value) {
    skipClick.value = false;
    return;
  }
  abrirMesa(mesa);
}

async function abrirMesa(mesa) {
  lastFocus = document.activeElement;
  mesaSeleccionada.value = mesa;
  selectedWaiterPhone.value = waiterPhone(mesa);
  waiterSaved.value = false;
  modalActivo.value = true;
  await nextTick();
  closeBtn.value?.focus();
}

function irAPedido() {
  const m = mesaSeleccionada.value;
  if (!m) return;
  router.push({ path: '/menu', query: { tableId: m.id, tableName: m.nombre } });
}

async function mostrarModalAgregarMesa() {
  lastFocus = document.activeElement;
  modalAgregarMesa.value = true;
  await nextTick();
  nameInput.value?.focus();
}
function cerrarModalAgregarMesa() {
  modalAgregarMesa.value = false;
  nombreNuevaMesa.value = '';
  lastFocus?.focus?.();
}
function cerrarMesa() {
  modalActivo.value = false;
  mesaSeleccionada.value = null;
  lastFocus?.focus?.();
}

function onKeydown(e) {
  if (e.key !== 'Escape') return;
  if (modalActivo.value) cerrarMesa();
  else if (modalAgregarMesa.value) cerrarModalAgregarMesa();
  else if (editMap.value) toggleEditMap();
}

function pointerToCell(clientX, clientY) {
  const el = mapRef.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const x = Math.floor(((clientX - rect.left) / rect.width) * COLS);
  const y = Math.floor(((clientY - rect.top) / rect.height) * ROWS);
  return {
    x: Math.max(0, Math.min(COLS - 1, x)),
    y: Math.max(0, Math.min(ROWS - 1, y)),
  };
}

function onPointerDown(e, mesa) {
  if (!editMap.value || drag.value) return;
  e.preventDefault();
  e.currentTarget.setPointerCapture?.(e.pointerId);
  drag.value = {
    id: mesa.id,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    originX: Number(mesa.posX) || 0,
    originY: Number(mesa.posY) || 0,
    capacidad: mesa.capacidad,
    ghost: { dx: 0, dy: 0 },
  };
  dropTarget.value = { x: drag.value.originX, y: drag.value.originY };
}

function onPointerMove(e) {
  if (!drag.value || e.pointerId !== drag.value.pointerId) return;
  const dx = e.clientX - drag.value.startX;
  const dy = e.clientY - drag.value.startY;
  drag.value = { ...drag.value, ghost: { dx, dy } };
  if (Math.abs(dx) + Math.abs(dy) > 6) skipClick.value = true;
  const cell = pointerToCell(e.clientX, e.clientY);
  if (!cell) return;
  if (canPlace(cell.x, cell.y, drag.value.capacidad, drag.value.id)) {
    dropTarget.value = cell;
  }
}

async function moveMesa(id, x, y) {
  const idx = mesas.value.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const prev = mesas.value[idx];
  mesas.value[idx] = { ...prev, posX: x, posY: y };
  try {
    const updated = await apiService.editTable(id, { posX: x, posY: y });
    mesas.value[idx] = { ...mesas.value[idx], ...updated };
  } catch {
    mesas.value[idx] = prev;
    showToast('No se pudo guardar la posición', 'error');
  }
}

async function onPointerUp(e) {
  if (!drag.value || (e && e.pointerId !== drag.value.pointerId)) return;
  const { id, capacidad, originX, originY } = drag.value;
  const target = dropTarget.value;
  drag.value = null;
  dropTarget.value = null;

  if (!target || (target.x === originX && target.y === originY)) return;
  if (!canPlace(target.x, target.y, capacidad, id)) return;
  await moveMesa(id, target.x, target.y);
}

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function onTableKey(e, mesa) {
  if (!editMap.value || !ARROWS[e.key]) return;
  e.preventDefault();
  const [dx, dy] = ARROWS[e.key];
  const x = (Number(mesa.posX) || 0) + dx;
  const y = (Number(mesa.posY) || 0) + dy;
  if (canPlace(x, y, mesa.capacidad, mesa.id)) moveMesa(mesa.id, x, y);
}

async function agregarNuevaMesa() {
  const capacidad = Number(capacidadNuevaMesa.value) || 4;
  const slot = findFreeSlot(capacidad);
  if (!slot) return;
  busy.value = true;
  try {
    const response = await apiService.createTable({
      nombre: nombreNuevaMesa.value.trim() || `Mesa ${mesas.value.length + 1}`,
      capacidad,
      disponible: true,
      posX: slot.x,
      posY: slot.y,
    });
    mesas.value = [...mesas.value, response];
    showToast(`${response.nombre || 'Mesa'} creada`);
    cerrarModalAgregarMesa();
  } catch {
    showToast('No se pudo crear la mesa', 'error');
  } finally {
    busy.value = false;
  }
}

async function eliminarMesa(mesa) {
  if (!mesa) return;
  if (!confirm(`¿Eliminar ${mesa.nombre}? Esta acción no se puede deshacer.`)) return;
  busy.value = true;
  try {
    await apiService.deleteTable(mesa.id);
    mesas.value = mesas.value.filter((m) => m.id !== mesa.id);
    showToast(`${mesa.nombre} eliminada`);
    cerrarMesa();
  } catch {
    showToast('No se pudo eliminar la mesa', 'error');
  } finally {
    busy.value = false;
  }
}

async function updateSelected(patch) {
  busy.value = true;
  try {
    const updated = await apiService.editTable(mesaSeleccionada.value.id, patch);
    const idx = mesas.value.findIndex((m) => m.id === updated.id);
    if (idx >= 0) mesas.value[idx] = { ...mesas.value[idx], ...updated };
    mesaSeleccionada.value = { ...mesaSeleccionada.value, ...updated };
    return true;
  } catch {
    showToast('No se pudo actualizar la mesa', 'error');
    return false;
  } finally {
    busy.value = false;
  }
}

async function guardarMesero() {
  if (!mesaSeleccionada.value) return;
  waiterSaved.value = await updateSelected({ mesero: selectedWaiterPhone.value || null });
}

async function ocuparMesa() {
  const ok = await updateSelected({
    disponible: false,
    mesero: selectedWaiterPhone.value || waiterPhone(mesaSeleccionada.value) || null,
  });
  if (ok) cerrarMesa();
}

async function desocuparMesa() {
  const ok = await updateSelected({ disponible: true, personaTitular: null });
  if (ok) cerrarMesa();
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  await Promise.all([refillMesas(), loadWaiters()]);
  loading.value = false;
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  clearTimeout(toastTimer);
});
</script>

<style scoped>
.floor {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --free: var(--mirestaurante-free);
  --busy: var(--mirestaurante-busy);
  --floor-bg: #e6dccb;
  --floor-bg-2: #dccfb9;
  --floor-line: rgba(92, 72, 44, 0.08);
  --floor-edge: rgba(92, 72, 44, 0.18);
  --chair: #5a4b3a;
  max-width: 1200px;
  margin: 0 auto;
}
:global(html[data-theme="dark"]) .floor {
  --floor-bg: #1c2420;
  --floor-bg-2: #171e1a;
  --floor-line: rgba(238, 242, 239, 0.05);
  --floor-edge: rgba(238, 242, 239, 0.1);
  --chair: #3b4842;
}

/* —— Cabecera —— */
.floor-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.floor-head h1 {
  margin: 0;
  font-family: "Bricolage Grotesque", var(--font-display);
  font-size: clamp(1.6rem, 1.2rem + 1.4vw, 2.1rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0.4rem 0 0;
  font-size: 0.92rem;
  color: var(--mirestaurante-ink);
}
.stat { display: inline-flex; align-items: center; gap: 0.4rem; }
.stat b { font-weight: 700; font-variant-numeric: tabular-nums; }
.stat.muted { color: var(--mirestaurante-muted); }
.stat.muted b { color: var(--mirestaurante-ink); font-weight: 600; }
.dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; display: inline-block; }
.dot.free { background: var(--free); }
.dot.busy { background: var(--busy); }

.head-actions { display: flex; gap: 0.5rem; }

/* —— Botones —— */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.9rem;
  padding: 0 1.05rem;
  border: 1px solid transparent;
  border-radius: 0.8rem;
  font-weight: 600;
  font-size: 0.98rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  transition: transform 140ms var(--ease-out), background-color 160ms ease, border-color 160ms ease;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:focus-visible,
.icon-close:focus-visible,
.link-danger:focus-visible,
.table-piece:focus-visible .table-top,
.cap-opt:focus-within {
  outline: 2px solid var(--mirestaurante-primary);
  outline-offset: 3px;
}
.btn-primary {
  background: var(--mirestaurante-primary);
  color: var(--mirestaurante-on-primary);
  box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--mirestaurante-primary) 70%, transparent);
}
.btn-quiet {
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  border-color: var(--mirestaurante-line);
}
.btn-quiet.on {
  background: var(--mirestaurante-ink);
  color: var(--mirestaurante-panel);
  border-color: transparent;
}
.btn-soft {
  background: var(--mirestaurante-surface);
  color: var(--mirestaurante-ink);
  border-color: var(--mirestaurante-line);
}
.btn-lg { min-height: 3.35rem; font-size: 1.05rem; width: 100%; }
@media (hover: hover) and (pointer: fine) {
  .btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--mirestaurante-primary) 88%, #000); }
  .btn-quiet:hover:not(.on), .btn-soft:hover:not(:disabled) { background: color-mix(in srgb, var(--mirestaurante-surface) 70%, var(--mirestaurante-line)); }
}

.edit-hint {
  margin: 0 0 0.75rem;
  padding: 0.65rem 0.9rem;
  border-radius: 0.7rem;
  background: var(--mirestaurante-primary-soft);
  color: var(--mirestaurante-ink);
  font-size: 0.9rem;
  text-wrap: pretty;
}

/* —— Plano —— */
.floor-scroll {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  border-radius: 1.1rem;
  -webkit-overflow-scrolling: touch;
}
.floor-map {
  position: relative;
  display: grid;
  min-width: 46rem;
  min-height: min(68dvh, 34rem);
  padding: 0.25rem;
  background:
    radial-gradient(120% 90% at 15% 0%, color-mix(in srgb, #fff 18%, transparent), transparent 60%),
    repeating-linear-gradient(90deg, transparent 0 47px, var(--floor-line) 47px 48px),
    linear-gradient(180deg, var(--floor-bg) 0%, var(--floor-bg-2) 100%);
  border: 1px solid var(--floor-edge);
  border-radius: 1.1rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -24px 48px -32px rgba(60, 40, 15, 0.25);
  transition: box-shadow 200ms ease;
}
:global(html[data-theme="dark"]) .floor-map {
  background:
    repeating-linear-gradient(90deg, transparent 0 47px, var(--floor-line) 47px 48px),
    linear-gradient(180deg, var(--floor-bg) 0%, var(--floor-bg-2) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.floor-map.editing {
  touch-action: none;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--mirestaurante-primary) 60%, transparent);
}

.grid-cell {
  pointer-events: none;
  min-height: 3.4rem;
  margin: 2px;
  border-radius: 0.5rem;
  border: 1px dashed color-mix(in srgb, var(--floor-edge) 90%, transparent);
  transition: background-color 120ms ease, border-color 120ms ease;
}
.grid-cell.drop {
  background: color-mix(in srgb, var(--mirestaurante-primary) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--mirestaurante-primary) 55%, transparent);
}

/* —— Mesa —— */
.table-piece {
  position: relative;
  margin: 0;
  border: none;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
  z-index: 2;
  outline: none;
  animation: piece-in 320ms var(--ease-out) backwards;
  animation-delay: calc(min(var(--i, 0), 12) * 30ms);
}
@keyframes piece-in {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
}
.table-piece.edit-mode { cursor: grab; touch-action: none; }
.table-piece.dragging { cursor: grabbing; z-index: 30; }

.table-unit {
  position: relative;
  width: 4.5rem;
  height: 4.5rem;
  flex-shrink: 0;
  transition: transform 160ms var(--ease-out), filter 160ms ease;
}
.table-piece:active:not(.edit-mode) .table-unit { transform: scale(0.95); }
.table-piece.dragging .table-unit {
  transform: scale(1.06);
  filter: drop-shadow(0 14px 18px rgba(30, 20, 8, 0.3));
}
@media (hover: hover) and (pointer: fine) {
  .table-piece:hover .table-unit { transform: translateY(-2px); }
}

.chair {
  position: absolute;
  width: 0.85rem;
  height: 0.55rem;
  border-radius: 0.22rem;
  background: var(--chair);
  pointer-events: none;
  z-index: 0;
  transition: background-color 200ms ease;
}
.is-busy .chair { background: color-mix(in srgb, var(--busy) 55%, var(--chair)); }

.table-top {
  position: absolute;
  inset: 18%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  border-radius: 0.6rem;
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
}
.is-free .table-top {
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  border: 2px solid color-mix(in srgb, var(--free) 70%, transparent);
  box-shadow: 0 4px 10px -2px rgba(40, 28, 12, 0.18);
}
.is-busy .table-top {
  background: var(--busy);
  color: #fff;
  border: 2px solid color-mix(in srgb, var(--busy) 70%, #000);
  box-shadow: 0 6px 14px -4px color-mix(in srgb, var(--busy) 60%, transparent);
}

.table-name {
  font-family: "Bricolage Grotesque", var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.table-cap {
  font-size: 0.62rem;
  font-weight: 600;
  opacity: 0.75;
  white-space: nowrap;
}
.shape-2 .table-cap { display: none; }

.waiter-tag {
  position: absolute;
  top: 6%;
  right: 6%;
  z-index: 2;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.25rem;
  border-radius: 0.4rem;
  display: grid;
  place-items: center;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: var(--mirestaurante-ink);
  color: var(--mirestaurante-panel);
  box-shadow: 0 0 0 2px var(--floor-bg);
}

/* —— 2 personas: redonda —— */
.shape-2 .table-unit { width: 3.6rem; height: 3.6rem; }
.shape-2 .table-top { inset: 22%; border-radius: 999px; }
.shape-2 .chair { width: 0.7rem; height: 0.48rem; }
.shape-2 .c1 { left: 50%; top: 2%; transform: translateX(-50%); }
.shape-2 .c2 { left: 50%; bottom: 2%; transform: translateX(-50%); }
.shape-2 .waiter-tag { top: -2%; right: -6%; }

/* —— 4 personas: cuadrada —— */
.shape-4 .table-unit { width: 4.2rem; height: 4.2rem; }
.shape-4 .table-top { inset: 20%; border-radius: 0.55rem; }
.shape-4 .c1 { left: 50%; top: 2%; transform: translateX(-50%); }
.shape-4 .c2 { right: 2%; top: 50%; transform: translateY(-50%) rotate(90deg); }
.shape-4 .c3 { left: 50%; bottom: 2%; transform: translateX(-50%); }
.shape-4 .c4 { left: 2%; top: 50%; transform: translateY(-50%) rotate(90deg); }
.shape-4 .waiter-tag { top: 0; right: 0; }

/* —— 6 personas: rectangular —— */
.shape-6 .table-unit { width: 7.2rem; height: 4rem; }
.shape-6 .table-top { inset: 20% 12%; border-radius: 0.7rem; }
.shape-6 .c1 { left: 28%; top: 2%; transform: translateX(-50%); }
.shape-6 .c2 { left: 50%; top: 2%; transform: translateX(-50%); }
.shape-6 .c3 { left: 72%; top: 2%; transform: translateX(-50%); }
.shape-6 .c4 { left: 28%; bottom: 2%; transform: translateX(-50%); }
.shape-6 .c5 { left: 50%; bottom: 2%; transform: translateX(-50%); }
.shape-6 .c6 { left: 72%; bottom: 2%; transform: translateX(-50%); }

/* —— 8 personas: mesa grande —— */
.shape-8 .table-unit { width: 6.6rem; height: 6.6rem; }
.shape-8 .table-top { inset: 18%; border-radius: 0.65rem; }
.shape-8 .c1 { left: 32%; top: 2%; transform: translateX(-50%); }
.shape-8 .c2 { left: 68%; top: 2%; transform: translateX(-50%); }
.shape-8 .c3 { right: 2%; top: 32%; transform: translateY(-50%) rotate(90deg); }
.shape-8 .c4 { right: 2%; top: 68%; transform: translateY(-50%) rotate(90deg); }
.shape-8 .c5 { left: 68%; bottom: 2%; transform: translateX(-50%); }
.shape-8 .c6 { left: 32%; bottom: 2%; transform: translateX(-50%); }
.shape-8 .c7 { left: 2%; top: 68%; transform: translateY(-50%) rotate(90deg); }
.shape-8 .c8 { left: 2%; top: 32%; transform: translateY(-50%) rotate(90deg); }

/* —— 10 personas: banquete —— */
.shape-10 .table-unit { width: 10.5rem; height: 3.8rem; }
.shape-10 .table-top { inset: 22% 8%; border-radius: 999px; }
.shape-10 .chair { width: 0.72rem; }
.shape-10 .c1 { left: 18%; top: 2%; transform: translateX(-50%); }
.shape-10 .c2 { left: 34%; top: 2%; transform: translateX(-50%); }
.shape-10 .c3 { left: 50%; top: 2%; transform: translateX(-50%); }
.shape-10 .c4 { left: 66%; top: 2%; transform: translateX(-50%); }
.shape-10 .c5 { left: 82%; top: 2%; transform: translateX(-50%); }
.shape-10 .c6 { left: 18%; bottom: 2%; transform: translateX(-50%); }
.shape-10 .c7 { left: 34%; bottom: 2%; transform: translateX(-50%); }
.shape-10 .c8 { left: 50%; bottom: 2%; transform: translateX(-50%); }
.shape-10 .c9 { left: 66%; bottom: 2%; transform: translateX(-50%); }
.shape-10 .c10 { left: 82%; bottom: 2%; transform: translateX(-50%); }
.shape-10 .waiter-tag { top: 14%; right: 4%; }

/* —— Carga y vacío —— */
.skeleton .sk-piece {
  align-self: center;
  justify-self: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--floor-edge) 70%, transparent);
  animation: pulse 1.2s ease-in-out infinite alternate;
}
@keyframes pulse { to { opacity: 0.45; } }

.empty {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 3.5rem 1.25rem 4rem;
  text-align: center;
  border: 1px dashed var(--mirestaurante-line);
  border-radius: 1.1rem;
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-muted);
}
.empty h2 {
  margin: 0.4rem 0 0;
  color: var(--mirestaurante-ink);
  font-family: "Bricolage Grotesque", var(--font-display);
  font-size: 1.35rem;
  letter-spacing: -0.02em;
}
.empty p { margin: 0 0 0.75rem; max-width: 30ch; text-wrap: balance; }

/* —— Hoja inferior —— */
.sheet-bg {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(10, 16, 14, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: min(30rem, 100%);
  margin: 0;
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  border-radius: 1.4rem 1.4rem 0 0;
  padding: 0.6rem 1.15rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
  display: grid;
  gap: 0.9rem;
  max-height: 88dvh;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--mirestaurante-line);
  box-shadow: 0 -12px 40px rgba(10, 16, 14, 0.18);
}
.sheet-handle {
  width: 2.5rem;
  height: 0.3rem;
  border-radius: 999px;
  background: var(--mirestaurante-line);
  margin: 0 auto -0.2rem;
}
.sheet-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.sheet-head > div { flex: 1; min-width: 0; }
.sheet h2 {
  margin: 0;
  font-family: "Bricolage Grotesque", var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.sheet-head h2:only-of-type { flex: 1; }
.sheet-sub { margin: 0.15rem 0 0; color: var(--mirestaurante-muted); font-size: 0.92rem; }

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.65rem;
  border-radius: 0.5rem;
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}
.status-pill::before { content: ""; width: 0.45rem; height: 0.45rem; border-radius: 50%; background: currentColor; }
.status-pill.free { background: var(--mirestaurante-success-soft); color: var(--mirestaurante-success); }
.status-pill.busy { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }

.icon-close {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  flex-shrink: 0;
  border: none;
  border-radius: 0.7rem;
  background: var(--mirestaurante-surface);
  color: var(--mirestaurante-ink);
  cursor: pointer;
  transition: transform 140ms var(--ease-out);
}
.icon-close:active { transform: scale(0.94); }

.sheet-actions { display: grid; gap: 0.5rem; }

.field {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  border: none;
  font-weight: 600;
  font-size: 0.9rem;
}
.field legend { padding: 0; margin-bottom: 0.4rem; }
.field input, .field select {
  min-height: 3rem;
  border: 1px solid var(--mirestaurante-line);
  border-radius: 0.75rem;
  padding: 0.65rem 0.8rem;
  font: inherit;
  font-size: 16px; /* evita zoom en iOS */
  font-weight: 500;
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.field input:focus-visible, .field select:focus-visible {
  outline: none;
  border-color: var(--mirestaurante-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mirestaurante-primary) 22%, transparent);
}
.saved { color: var(--mirestaurante-success); font-weight: 600; font-size: 0.8rem; }

.cap-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.4rem; }
.cap-opt {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  padding: 0.65rem 0.2rem 0.55rem;
  border: 1px solid var(--mirestaurante-line);
  border-radius: 0.8rem;
  background: var(--mirestaurante-panel-elevated);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: border-color 150ms ease, background-color 150ms ease, transform 140ms var(--ease-out);
}
.cap-opt:active { transform: scale(0.96); }
.cap-opt.on {
  border-color: var(--mirestaurante-primary);
  background: var(--mirestaurante-primary-soft);
}
.cap-opt b { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.cap-opt small { font-size: 0.66rem; font-weight: 500; color: var(--mirestaurante-muted); }
.cap-shape {
  height: 1.1rem;
  width: 1.1rem;
  border-radius: 0.25rem;
  border: 2px solid currentColor;
  opacity: 0.7;
}
.cap-opt.shape-2 .cap-shape { border-radius: 50%; width: 0.95rem; height: 0.95rem; }
.cap-opt.shape-6 .cap-shape { width: 1.7rem; }
.cap-opt.shape-8 .cap-shape { width: 1.5rem; height: 1.5rem; margin-top: -0.2rem; }
.cap-opt.shape-10 .cap-shape { width: 2.1rem; border-radius: 999px; }

.warn {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-radius: 0.7rem;
  background: var(--mirestaurante-warning-soft);
  color: var(--mirestaurante-warning);
  font-size: 0.88rem;
  font-weight: 600;
}

.link-danger {
  justify-self: center;
  min-height: 2.75rem;
  padding: 0 0.75rem;
  border: none;
  border-radius: 0.6rem;
  background: none;
  color: var(--mirestaurante-danger);
  font-weight: 600;
  cursor: pointer;
}
@media (hover: hover) and (pointer: fine) {
  .link-danger:hover { background: var(--mirestaurante-danger-soft); }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Transiciones de la hoja (interrumpibles) */
.sheet-enter-active, .sheet-leave-active { transition: opacity 240ms ease; }
.sheet-enter-active .sheet { transition: transform 360ms var(--ease-drawer); }
.sheet-leave-active { transition-duration: 180ms; }
.sheet-leave-active .sheet { transition: transform 180ms ease-out; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }

/* —— Toast —— */
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
  z-index: 70;
  transform: translateX(-50%);
  max-width: calc(100% - 2rem);
  padding: 0.75rem 1.1rem;
  border-radius: 0.85rem;
  background: var(--mirestaurante-ink);
  color: var(--mirestaurante-panel);
  font-weight: 600;
  font-size: 0.92rem;
  box-shadow: 0 12px 30px rgba(10, 16, 14, 0.25);
}
.toast.error { background: var(--mirestaurante-danger); color: #fff; }
.toast-enter-active { transition: opacity 200ms ease, transform 260ms var(--ease-out); }
.toast-leave-active { transition: opacity 160ms ease, transform 160ms ease-out; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 0.75rem); }

@media (min-width: 900px) {
  .sheet-bg { align-items: center; padding: 1rem; }
  .sheet { border-radius: 1.3rem; padding: 1.25rem 1.35rem 1.4rem; }
  .sheet-handle { display: none; }
  .sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(12px) scale(0.97); }
  .floor-map { min-width: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .table-piece { animation: none; }
  .skeleton .sk-piece { animation: none; }
  .sheet-enter-from .sheet, .sheet-leave-to .sheet,
  .toast-enter-from, .toast-leave-to { transform: none; }
  .toast-enter-from, .toast-leave-to { transform: translateX(-50%); }
}
</style>
