<template>
  <AppShell>
    <section class="floor" aria-labelledby="floor-title">
      <header class="floor-head">
        <div class="head-copy">
          <p class="kicker"><span class="pulse" aria-hidden="true"></span>Salón en vivo</p>
          <h1 id="floor-title">Mesas</h1>
          <p class="stats" aria-live="polite">
            <span class="stat"><i class="lg free" aria-hidden="true"></i><b>{{ stats.free }}</b> libres</span>
            <span class="stat"><i class="lg busy" aria-hidden="true"></i><b>{{ stats.busy }}</b> ocupadas</span>
            <span class="stat muted"><b>{{ stats.seated }}</b> de {{ stats.seats }} lugares</span>
          </p>
        </div>
        <div class="head-actions">
          <div class="seg" role="group" aria-label="Vista">
            <button type="button" :aria-pressed="view === 'plano'" @click="setView('plano')">Plano</button>
            <button type="button" :aria-pressed="view === 'lista'" @click="setView('lista')">Lista</button>
          </div>
          <button
            v-if="view === 'plano' && mesas.length"
            type="button"
            class="btn btn-quiet"
            :class="{ on: editMap }"
            :aria-pressed="editMap"
            @click="toggleEditMap"
          >
            {{ editMap ? 'Listo' : 'Editar' }}
          </button>
          <button type="button" class="btn btn-primary" aria-label="Agregar mesa" @click="mostrarModalAgregarMesa">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span class="btn-label">Mesa</span>
          </button>
        </div>
      </header>

      <p v-if="editMap && view === 'plano'" class="edit-hint" role="status">
        Arrastra cada mesa a su lugar (o usa las flechas del teclado). Se guarda solo.
      </p>

      <div v-if="loading" class="floor-map skeleton" :style="mapStyle" aria-busy="true" aria-label="Cargando mesas">
        <span v-for="i in 6" :key="i" class="sk-piece" :style="{ gridColumn: (i * 2) - 1, gridRow: (i % 3) * 2 + 2 }" />
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

      <ul v-else-if="view === 'lista'" class="table-list">
        <li v-for="(mesa, i) in sortedMesas" :key="mesa.id" :style="{ '--i': i }">
          <button
            type="button"
            class="table-card"
            :class="mesa.disponible ? 'is-free' : 'is-busy'"
            :aria-label="tableLabel(mesa)"
            @click="abrirMesa(mesa)"
          >
            <span class="card-num">{{ shortName(mesa.nombre) }}</span>
            <span class="card-body">
              <span class="card-name">{{ mesa.nombre }}</span>
              <span class="card-meta">{{ mesa.capacidad }} pers.<template v-if="waiterName(mesa)"> · {{ waiterName(mesa) }}</template></span>
            </span>
            <span class="card-status">{{ mesa.disponible ? 'Libre' : 'Ocupada' }}</span>
          </button>
        </li>
      </ul>

      <div
        v-else
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
              <span v-if="waiterInitials(mesa)" class="table-waiter">{{ waiterInitials(mesa) }}</span>
            </span>
          </span>
        </button>
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
const view = ref(
  typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? 'lista' : 'plano'
);
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
  gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
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

const sortedMesas = computed(() =>
  [...mesas.value].sort((a, b) =>
    String(a.nombre).localeCompare(String(b.nombre), 'es', { numeric: true })
  )
);

function setView(v) {
  view.value = v;
  if (v !== 'plano') toggleEditMap(false);
}

function waiterName(mesa) {
  const w = waiterByPhone.value.get(String(waiterPhone(mesa)));
  return w ? `${w.name} ${w.lastName || ''}`.trim() : '';
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
  return t.slice(0, 3).toUpperCase();
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

function toggleEditMap(force) {
  editMap.value = typeof force === 'boolean' ? force : !editMap.value;
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
  /* Identidad de la landing */
  --paper: #f4efe6;
  --board: #1c1a17;
  --board-2: #272420;
  --tomato: #d0371f;
  --amber: #e8a020;
  --basil: #2f8f4e;
  --basil-l: #4cc274;
  --display: "Bricolage Grotesque", var(--font-sans);
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --free: var(--basil-l);
  --busy: var(--tomato);
  /* El plano (3:2) cabe en la pantalla sin quedar bajo el dock */
  max-width: min(1200px, max(36rem, calc((100dvh - 19rem) * 1.5)));
  margin: 0 auto;
}

/* —— Cabecera —— */
.floor-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.9rem 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.35rem;
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--mirestaurante-muted);
}
.pulse { position: relative; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--basil-l); }
.pulse::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: inherit; animation: ping 1.8s var(--ease-out) infinite; }
@keyframes ping { to { transform: scale(2.6); opacity: 0; } }
.floor-head h1 {
  margin: 0;
  font-family: var(--display);
  font-size: clamp(2rem, 1.4rem + 2vw, 2.8rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 0.98;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1rem;
  margin: 0.55rem 0 0;
  font-family: var(--mono);
  font-size: 0.8rem;
  color: var(--mirestaurante-muted);
}
.stat { display: inline-flex; align-items: center; gap: 0.35rem; }
.stat b { color: var(--mirestaurante-ink); font-weight: 700; font-variant-numeric: tabular-nums; }
.lg { width: 0.6rem; height: 0.6rem; border-radius: 0.2rem; display: inline-block; }
.lg.free { border: 1.5px dashed color-mix(in srgb, var(--mirestaurante-ink) 45%, transparent); }
.lg.busy { background: var(--busy); }

.head-actions { display: flex; gap: 0.5rem; align-items: center; }

.seg {
  display: inline-flex;
  padding: 0.2rem;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--mirestaurante-ink) 6%, transparent);
}
.seg button {
  min-height: 2.5rem;
  padding: 0 0.85rem;
  border: none;
  border-radius: 0.6rem;
  background: transparent;
  color: var(--mirestaurante-muted);
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: background-color 160ms ease, color 160ms ease;
}
.seg button[aria-pressed="true"] {
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  box-shadow: 0 1px 2px rgba(18, 24, 22, 0.08), 0 2px 6px rgba(18, 24, 22, 0.06);
}
.seg button:focus-visible { outline: 2px solid var(--mirestaurante-primary); outline-offset: 1px; }

/* —— Botones —— */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.9rem;
  padding: 0 1rem;
  border: 1px solid transparent;
  border-radius: 0.8rem;
  font-weight: 600;
  font-size: 0.96rem;
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
.table-card:focus-visible,
.table-piece:focus-visible .table-top,
.cap-opt:focus-within {
  outline: 2px solid var(--mirestaurante-primary);
  outline-offset: 3px;
}
.btn-primary {
  background: var(--tomato);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 6px 18px -6px rgba(208, 55, 31, 0.6);
}
.btn-quiet {
  background: transparent;
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
  .btn-primary:hover:not(:disabled) { background: #bb2f19; }
  .btn-quiet:hover:not(.on), .btn-soft:hover:not(:disabled) { background: color-mix(in srgb, var(--mirestaurante-ink) 5%, transparent); }
  .seg button:hover:not([aria-pressed="true"]) { color: var(--mirestaurante-ink); }
}

.edit-hint {
  margin: 0 0 0.75rem;
  padding: 0.6rem 0.85rem;
  border-radius: 0.7rem;
  background: var(--mirestaurante-primary-soft);
  color: var(--mirestaurante-ink);
  font-size: 0.9rem;
  text-wrap: pretty;
}

/* —— Lista —— */
.table-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.6rem;
}
.table-list li { animation: piece-in 280ms var(--ease-out) backwards; animation-delay: calc(min(var(--i, 0), 12) * 25ms); }
.table-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 0.9rem 0.75rem 0.75rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 1rem;
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  text-align: left;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  transition: transform 140ms var(--ease-out), border-color 160ms ease;
}
.table-card:active { transform: scale(0.98); }
@media (hover: hover) and (pointer: fine) {
  .table-card:hover { border-color: color-mix(in srgb, var(--mirestaurante-ink) 22%, transparent); }
}
.card-num {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  font-family: var(--mono);
  font-size: 1.05rem;
  font-weight: 700;
}
.is-free .card-num { border: 1.5px dashed color-mix(in srgb, var(--mirestaurante-ink) 35%, transparent); color: var(--mirestaurante-muted); }
.is-busy .card-num { background: var(--busy); color: #fff; }
.card-body { flex: 1; min-width: 0; display: grid; gap: 0.1rem; }
.card-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-meta { font-size: 0.85rem; color: var(--mirestaurante-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-status {
  padding: 0.15rem 0.45rem;
  border-radius: 0.3rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.is-free .card-status { color: var(--mirestaurante-muted); border: 1.5px dashed var(--mirestaurante-line); }
.is-busy .card-status { background: var(--tomato); color: #fff; }

/* —— Plano ——
   Todo se mide en cqw (ancho del plano) para que las mesas llenen la celda
   en cualquier pantalla. Una celda = 100cqw / 12. */
.floor-map {
  --cell: calc(100cqw / 12);
  container-type: inline-size;
  position: relative;
  display: grid;
  width: 100%;
  aspect-ratio: 3 / 2;
  background-color: var(--board);
  background-image: radial-gradient(circle, rgba(244, 239, 230, 0.09) 1.2px, transparent 1.6px);
  background-size: calc(100% / 12) calc(100% / 8);
  background-position: calc(100% / 24) calc(100% / 16);
  border-radius: 1.4rem;
  box-shadow: 0 30px 60px -30px rgba(27, 24, 20, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  user-select: none;
  -webkit-user-select: none;
}
.floor-map.editing {
  touch-action: none;
  box-shadow: 0 0 0 2px var(--amber), 0 30px 60px -30px rgba(27, 24, 20, 0.6);
}
@container (max-width: 40rem) {
  .table-waiter { display: none; }
}

.grid-cell {
  pointer-events: none;
  margin: 2px;
  border-radius: 0.4rem;
  transition: background-color 120ms ease;
}
.grid-cell.drop {
  background: color-mix(in srgb, var(--amber) 18%, transparent);
  box-shadow: inset 0 0 0 1.5px var(--amber);
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
  -webkit-touch-callout: none;
  touch-action: manipulation;
  z-index: 2;
  outline: none;
  animation: piece-in 320ms var(--ease-out) backwards;
  animation-delay: calc(min(var(--i, 0), 12) * 30ms);
}
@keyframes piece-in {
  from { opacity: 0; transform: translateY(6px) scale(0.97); }
}
.table-piece.edit-mode { cursor: grab; touch-action: none; }
.table-piece.dragging { cursor: grabbing; z-index: 30; }

.table-unit {
  position: relative;
  width: calc(var(--cell) * 0.86);
  height: calc(var(--cell) * 0.86);
  flex-shrink: 0;
  transition: transform 160ms var(--ease-out), filter 160ms ease;
}
.table-piece:active:not(.edit-mode) .table-unit { transform: scale(0.95); }
.table-piece.dragging .table-unit {
  transform: scale(1.05);
  filter: drop-shadow(0 12px 16px rgba(30, 20, 8, 0.25));
}
@media (hover: hover) and (pointer: fine) {
  .is-free:hover .table-top { border-color: rgba(244, 239, 230, 0.6); color: var(--paper); }
  .is-busy:hover .table-top { background: #e0452c; }
}

.chair {
  --cw: calc(var(--cell) * 0.17);
  --ch: calc(var(--cell) * 0.1);
  position: absolute;
  width: var(--cw);
  height: var(--ch);
  border-radius: 999px;
  background: rgba(244, 239, 230, 0.16);
  pointer-events: none;
  z-index: 0;
}

.table-top {
  position: absolute;
  inset: 16%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15em;
  border-radius: calc(var(--cell) * 0.12);
  font-size: calc(var(--cell) * 0.24);
  transition: background-color 200ms ease, color 200ms ease, box-shadow 160ms ease;
}
.is-free .table-top {
  background: rgba(244, 239, 230, 0.03);
  color: rgba(244, 239, 230, 0.6);
  border: 1.5px dashed rgba(244, 239, 230, 0.3);
}
.is-busy .table-top {
  background: var(--tomato);
  color: #fff;
  border: 1.5px solid var(--tomato);
  box-shadow: 0 6px 18px -6px rgba(208, 55, 31, 0.7);
}
.is-busy .chair { background: rgba(244, 239, 230, 0.32); }

.table-name {
  font-family: var(--mono);
  font-size: 0.9em;
  font-weight: 700;
  line-height: 1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}
.table-waiter {
  font-family: var(--mono);
  font-size: 0.42em;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  opacity: 0.7;
}
.shape-2 .table-waiter { display: none; }

/* —— 2 personas: redonda —— */
.shape-2 .table-unit { width: calc(var(--cell) * 0.78); height: calc(var(--cell) * 0.78); }
.shape-2 .table-top { inset: 20%; border-radius: 999px; font-size: calc(var(--cell) * 0.2); }
.shape-2 .c1 { left: 50%; top: 4%; transform: translateX(-50%); }
.shape-2 .c2 { left: 50%; bottom: 4%; transform: translateX(-50%); }

/* —— 4 personas: cuadrada —— */
.shape-4 .c1 { left: 50%; top: 4%; transform: translateX(-50%); }
.shape-4 .c2 { right: 4%; top: 50%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
.shape-4 .c3 { left: 50%; bottom: 4%; transform: translateX(-50%); }
.shape-4 .c4 { left: 4%; top: 50%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }

/* —— 6 personas: rectangular —— */
.shape-6 .table-unit { width: calc(var(--cell) * 1.86); }
.shape-6 .table-top { inset: 16% 6%; }
.shape-6 .c1 { left: 25%; top: 4%; transform: translateX(-50%); }
.shape-6 .c2 { left: 50%; top: 4%; transform: translateX(-50%); }
.shape-6 .c3 { left: 75%; top: 4%; transform: translateX(-50%); }
.shape-6 .c4 { left: 25%; bottom: 4%; transform: translateX(-50%); }
.shape-6 .c5 { left: 50%; bottom: 4%; transform: translateX(-50%); }
.shape-6 .c6 { left: 75%; bottom: 4%; transform: translateX(-50%); }

/* —— 8 personas: mesa grande —— */
.shape-8 .table-unit { width: calc(var(--cell) * 1.8); height: calc(var(--cell) * 1.8); }
.shape-8 .table-top { inset: 11%; font-size: calc(var(--cell) * 0.34); border-radius: calc(var(--cell) * 0.16); }
.shape-8 .c1 { left: 33%; top: 2%; transform: translateX(-50%); }
.shape-8 .c2 { left: 67%; top: 2%; transform: translateX(-50%); }
.shape-8 .c3 { right: 2%; top: 33%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
.shape-8 .c4 { right: 2%; top: 67%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
.shape-8 .c5 { left: 67%; bottom: 2%; transform: translateX(-50%); }
.shape-8 .c6 { left: 33%; bottom: 2%; transform: translateX(-50%); }
.shape-8 .c7 { left: 2%; top: 67%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
.shape-8 .c8 { left: 2%; top: 33%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }

/* —— 10 personas: banquete —— */
.shape-10 .table-unit { width: calc(var(--cell) * 2.86); }
.shape-10 .table-top { inset: 16% 4%; border-radius: 999px; }
.shape-10 .c1 { left: 14%; top: 4%; transform: translateX(-50%); }
.shape-10 .c2 { left: 32%; top: 4%; transform: translateX(-50%); }
.shape-10 .c3 { left: 50%; top: 4%; transform: translateX(-50%); }
.shape-10 .c4 { left: 68%; top: 4%; transform: translateX(-50%); }
.shape-10 .c5 { left: 86%; top: 4%; transform: translateX(-50%); }
.shape-10 .c6 { left: 14%; bottom: 4%; transform: translateX(-50%); }
.shape-10 .c7 { left: 32%; bottom: 4%; transform: translateX(-50%); }
.shape-10 .c8 { left: 50%; bottom: 4%; transform: translateX(-50%); }
.shape-10 .c9 { left: 68%; bottom: 4%; transform: translateX(-50%); }
.shape-10 .c10 { left: 86%; bottom: 4%; transform: translateX(-50%); }

@media (max-width: 480px) {
  .btn-label { display: none; }
  .head-actions { width: 100%; }
  .head-actions .seg { margin-right: auto; }
}

/* —— Carga y vacío —— */
.skeleton .sk-piece {
  align-self: center;
  justify-self: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.6rem;
  background: rgba(244, 239, 230, 0.08);
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
  font-family: var(--display);
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
  font-family: var(--display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.sheet-head h2:only-of-type { flex: 1; }
.sheet-sub { margin: 0.3rem 0 0; color: var(--mirestaurante-muted); font-family: var(--mono); font-size: 0.78rem; }

.status-pill {
  padding: 0.25rem 0.55rem;
  border-radius: 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.status-pill.free { color: var(--mirestaurante-muted); border: 1.5px dashed var(--mirestaurante-line); }
.status-pill.busy { background: var(--tomato); color: #fff; }

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
.cap-opt b { font-family: var(--mono); font-size: 1rem; }
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
}

@media (prefers-reduced-motion: reduce) {
  .table-piece, .table-list li { animation: none; }
  .skeleton .sk-piece { animation: none; }
  .sheet-enter-from .sheet, .sheet-leave-to .sheet,
  .toast-enter-from, .toast-leave-to { transform: none; }
  .toast-enter-from, .toast-leave-to { transform: translateX(-50%); }
}
</style>
