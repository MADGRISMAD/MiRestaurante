<template>
  <AppShell>
    <section class="floor" aria-labelledby="floor-title">
      <header class="floor-head">
        <div>
          <p class="kicker"><span class="pulse" aria-hidden="true"></span>Salón en vivo</p>
          <h1 id="floor-title">Mesas</h1>
        </div>
        <div class="head-actions">
          <div v-if="!isPhone" class="seg" role="group" aria-label="Vista">
            <button type="button" :aria-pressed="view === 'lista'" @click="setView('lista')">Mesas</button>
            <button type="button" :aria-pressed="view === 'plano'" @click="setView('plano')">Plano</button>
          </div>
          <button
            v-if="canManageFloor && view === 'plano' && mesas.length"
            type="button"
            class="btn btn-quiet edit-btn"
            :class="{ on: editMap }"
            :aria-pressed="editMap"
            @click="toggleEditMap"
          >
            {{ editMap ? 'Listo' : 'Acomodar' }}
          </button>
          <button v-if="canManageFloor" type="button" class="btn btn-primary" aria-label="Agregar mesa" @click="mostrarModalAgregarMesa">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span class="btn-label">Mesa</span>
          </button>
        </div>
      </header>

      <div v-if="mesas.length" class="filters" role="group" aria-label="Filtrar mesas">
        <button
          v-for="f in filterOptions"
          :key="f.id"
          type="button"
          class="chip"
          :class="{ hot: f.id === 'attention' && counts.attention }"
          :aria-pressed="filter === f.id"
          @click="filter = f.id"
        >
          {{ f.label }} <b>{{ counts[f.id] }}</b>
        </button>
        <span class="summary">
          <b>{{ counts.guests }}</b>/{{ counts.seats }} lugares<template v-if="counts.open"> · <b>{{ money(counts.open) }}</b> abiertos</template>
        </span>
      </div>

      <p v-if="editMap && view === 'plano'" class="edit-hint" role="status">
        Arrastra cada mesa a su lugar (o usa las flechas del teclado). Se guarda solo.
      </p>

      <!-- Carga -->
      <div v-if="loading" class="tiles" aria-busy="true" aria-label="Cargando mesas">
        <span v-for="i in 6" :key="i" class="tile sk"></span>
      </div>

      <!-- Vacío -->
      <div v-else-if="!mesas.length" class="empty">
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="14" y="22" width="36" height="20" rx="4" stroke-dasharray="4 3" />
          <path d="M22 16h8M34 16h8M22 48h8M34 48h8" stroke-linecap="round" />
        </svg>
        <h2>Tu salón está vacío</h2>
        <template v-if="canManageFloor">
          <p>Agrega tus mesas y acomódalas en el plano como están en tu local.</p>
          <button type="button" class="btn btn-primary" @click="mostrarModalAgregarMesa">Agregar mesa</button>
        </template>
        <p v-else>Pide al administrador que agregue las mesas del local.</p>
      </div>

      <!-- Mesas (tarjetas) -->
      <template v-else-if="view === 'lista'">
        <ul v-if="visibleMesas.length" class="tiles" :class="{ intro }">
          <li v-for="(mesa, i) in visibleMesas" :key="mesa.id" :style="{ '--i': i }">
            <button
              type="button"
              class="tile"
              :class="[`st-${info(mesa).state}`, { fresh: info(mesa).fresh, mine: isMine(mesa) }]"
              :aria-label="tableLabel(mesa)"
              @click="abrirMesa(mesa)"
            >
              <span class="tile-top">
                <span class="tile-num">{{ shortName(mesa.nombre) }}</span>
                <span v-if="info(mesa).fresh" class="tile-new">Nueva</span>
                <span v-else-if="info(mesa).since" class="tile-time">{{ elapsed(info(mesa).since) }}</span>
              </span>
              <span class="tile-state"><i aria-hidden="true"></i>{{ STATES[info(mesa).state] }}<small v-if="info(mesa).state === 'free'"> · {{ mesa.capacidad }} pers.</small></span>
              <span v-if="info(mesa).state !== 'free'" class="tile-meta">
                <span>{{ partyLabel(mesa) }}<template v-if="waiterFirst(mesa)"> · {{ waiterFirst(mesa) }}</template></span>
                <b v-if="info(mesa).total">{{ money(info(mesa).total) }}</b>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="no-match">No hay mesas en este filtro.</p>
      </template>

      <!-- Plano -->
      <div v-else class="board">
        <div ref="scrollRef" class="map-scroll" :style="mapH ? { height: `${mapH}px` } : null">
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
              `st-${info(mesa).state}`,
              shapeClass(mesa.capacidad),
              { fresh: info(mesa).fresh },
              { dragging: drag?.id === mesa.id, 'edit-mode': editMap, dim: !editMap && !matches(mesa) },
            ]"
            :style="[pieceStyle(mesa), { '--i': i }]"
            :aria-label="tableLabel(mesa)"
            @pointerdown="onPointerDown($event, mesa)"
            @click="onTableClick(mesa)"
            @keydown="onTableKey($event, mesa)"
          >
            <span class="table-unit" aria-hidden="true">
              <span v-for="n in seatCount(mesa.capacidad)" :key="n" class="chair" :class="`c${n}`" />
              <span class="table-top">
                <span class="table-name">{{ shortName(mesa.nombre) }}</span>
                <span v-if="info(mesa).since" class="table-sub">{{ elapsed(info(mesa).since) }}</span>
              </span>
            </span>
          </button>
        </div>
        </div>
        <ul ref="legendRef" class="legend" aria-hidden="true">
          <li v-for="(label, st) in STATES" :key="st" :class="`lg-${st}`">{{ label }}</li>
        </ul>
      </div>

      <!-- Detalle de mesa -->
      <Transition name="sheet">
        <div v-if="modalActivo && sel" class="sheet-bg" @click.self="cerrarMesa">
          <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <div class="sheet-handle" aria-hidden="true"></div>
            <div class="sheet-head">
              <div class="sheet-title">
                <h2 id="sheet-title">{{ sel.nombre }}</h2>
                <p class="sheet-sub">
                  <span class="state-pill" :class="`st-${selInfo.state}`">{{ STATES[selInfo.state] }}</span>
                  <span>{{ partyLabel(sel) }}<template v-if="selInfo.since"> · {{ elapsed(selInfo.since) }}</template><template v-if="waiterName(sel)"> · {{ waiterName(sel) }}</template></span>
                </p>
              </div>
              <button ref="closeBtn" type="button" class="icon-close" aria-label="Cerrar" @click="cerrarMesa">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <!-- Cuenta de la mesa -->
            <div v-if="selInfo.orders.length" class="ticket">
              <div v-for="o in selInfo.orders" :key="o.id" class="tk-order">
                <p class="tk-head">
                  <b>#{{ folio(o) }}</b>
                  <span class="tk-st" :class="`os-${o.status}`">{{ ORDER_STATUS[o.status] || o.status }}</span>
                </p>
                <ul>
                  <li v-for="(it, k) in o.items" :key="k">
                    <span>{{ it.quantity }}× {{ it.name }}</span>
                    <span>{{ money(it.price * it.quantity) }}</span>
                  </li>
                </ul>
              </div>
              <p class="tk-total"><span>Total</span><b>{{ money(selInfo.total) }}</b></p>
            </div>

            <!-- Sentar clientes (hostess, mesero o admin) -->
            <form v-if="selInfo.state === 'free'" class="seat" @submit.prevent="ocuparMesa">
              <div class="seat-row">
                <span class="seat-label">Personas</span>
                <div class="stepper">
                  <button type="button" aria-label="Menos personas" :disabled="seatForm.personas <= 1" @click="seatForm.personas -= 1">−</button>
                  <b aria-live="polite">{{ seatForm.personas }}</b>
                  <button type="button" aria-label="Más personas" @click="seatForm.personas += 1">+</button>
                </div>
              </div>
              <p v-if="seatForm.personas > Number(sel.capacidad)" class="seat-warn">Son más que los {{ sel.capacidad }} lugares de la mesa.</p>
              <label class="field">
                <span>Nombre <small>(opcional)</small></span>
                <input v-model="seatForm.nombre" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="Ej. Familia Ruiz" />
              </label>
              <fieldset v-if="!isWaiter && waiters.length" class="field">
                <legend>Mesero</legend>
                <div class="waiter-pick">
                  <label
                    v-for="w in waiterOptions"
                    :key="w.cellphone"
                    class="wp"
                    :class="{ on: seatForm.mesero === w.cellphone }"
                  >
                    <input v-model="seatForm.mesero" type="radio" name="mesero" :value="w.cellphone" class="sr-only" />
                    <span class="wp-name">{{ w.name }} {{ (w.lastName || '').slice(0, 1) }}.</span>
                    <span class="wp-load">{{ w.load === 1 ? '1 mesa' : `${w.load} mesas` }}</span>
                    <span v-if="w.suggested" class="wp-tag">Sugerido</span>
                  </label>
                  <label class="wp" :class="{ on: !seatForm.mesero }">
                    <input v-model="seatForm.mesero" type="radio" name="mesero" value="" class="sr-only" />
                    <span class="wp-name">Sin mesero</span>
                  </label>
                </div>
              </fieldset>
              <button type="submit" class="btn btn-primary btn-lg" :disabled="busy">{{ seatLabel }}</button>
              <button v-if="canOrder" type="button" class="btn btn-soft btn-lg" @click="irAPedido">Solo tomar pedido</button>
            </form>

            <div v-else class="sheet-actions">
              <template v-if="selInfo.state === 'seated'">
                <button v-if="canOrder" type="button" class="btn btn-primary btn-lg" @click="irAPedido">Tomar pedido</button>
                <button type="button" class="btn btn-soft btn-lg" :disabled="busy" @click="desocuparMesa">Liberar mesa</button>
              </template>
              <template v-else-if="selInfo.state === 'ready'">
                <button v-if="canOrder" type="button" class="btn btn-basil btn-lg" :disabled="busy" @click="marcarServido">Marcar como servido</button>
                <button v-if="canOrder" type="button" class="btn btn-soft btn-lg" @click="irAPedido">Agregar al pedido</button>
              </template>
              <template v-else-if="selInfo.state === 'kitchen'">
                <button v-if="canOrder" type="button" class="btn btn-primary btn-lg" @click="irAPedido">Agregar al pedido</button>
                <button v-if="canCharge" type="button" class="btn btn-soft btn-lg" @click="irACaja">Ver cuenta en caja</button>
              </template>
              <template v-else>
                <button v-if="canCharge" type="button" class="btn btn-primary btn-lg" @click="irACaja">Cobrar {{ money(selInfo.total) }}</button>
                <button v-if="canOrder" type="button" class="btn btn-soft btn-lg" @click="irAPedido">Agregar al pedido</button>
                <p v-if="!canCharge" class="hint">Cuando pidan la cuenta, avisa en caja para cobrar {{ money(selInfo.total) }}.</p>
              </template>
            </div>

            <details class="more">
              <summary>Ajustes de la mesa</summary>
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
              <template v-if="isAdmin">
                <button type="button" class="link-danger" :disabled="busy || selInfo.orders.length > 0" @click="eliminarMesa(sel)">
                  Eliminar mesa
                </button>
                <small v-if="selInfo.orders.length" class="hint">No se puede eliminar con una cuenta abierta.</small>
              </template>
            </details>
          </div>
        </div>
      </Transition>

      <!-- Nueva mesa -->
      <Transition name="sheet">
        <div v-if="modalAgregarMesa" class="sheet-bg" @click.self="cerrarModalAgregarMesa">
          <form class="sheet" role="dialog" aria-modal="true" aria-labelledby="new-title" @submit.prevent="agregarNuevaMesa">
            <div class="sheet-handle" aria-hidden="true"></div>
            <div class="sheet-head">
              <h2 id="new-title" class="sheet-title">Nueva mesa</h2>
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { apiService } from '../apiService.ts';
import { hasRole, canAccessRoute } from '../authStore';
import { alertsState, myPhone, startWaiterAlerts, ackTable } from '../waiterAlerts';
import { bindLive } from '../live';

const COLS = 12;
const ROWS = 8;

// Mismos estados que dibuja la landing
const STATES = {
  free: 'Libre',
  seated: 'Por pedir',
  kitchen: 'En cocina',
  ready: 'Listo para servir',
  eating: 'Comiendo',
};
const ORDER_STATUS = {
  pending: 'Nuevo',
  preparing: 'Preparando',
  ready: 'Listo',
  served: 'Servido',
};
const BASE_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'attention', label: 'Atender' },
  { id: 'free', label: 'Libres' },
  { id: 'busy', label: 'Ocupadas' },
];
const capOptions = [
  { value: 2, label: 'Redonda' },
  { value: 4, label: 'Cuadrada' },
  { value: 6, label: 'Rectangular' },
  { value: 8, label: 'Grande' },
  { value: 10, label: 'Banquete' },
];

const router = useRouter();
const route = useRoute();
const isWaiter = hasRole('waiter');
const canOrder = canAccessRoute('menu');
const canCharge = canAccessRoute('orders');
// Lo mismo que permite el backend: crear y acomodar mesas (admin y hostess), eliminar (admin)
const isAdmin = hasRole('admin');
const canManageFloor = hasRole('admin', 'host');
const seatForm = ref({ personas: 2, nombre: '', mesero: '' });
const mapRef = ref(null);
const scrollRef = ref(null);
const legendRef = ref(null);
const mapH = ref(null);
const nameInput = ref(null);
const closeBtn = ref(null);
const mesas = ref([]);
const orders = ref([]);
const waiters = ref([]);
const loading = ref(true);
const intro = ref(true);
const busy = ref(false);
const now = ref(Date.now());
const filter = ref('all');
// En celular no hay plano: las tarjetas son la forma usable de ver el salón
const phoneQuery = window.matchMedia('(max-width: 720px)');
const isPhone = ref(phoneQuery.matches);
const view = ref(isPhone.value ? 'lista' : 'plano');
function onPhoneChange(e) {
  isPhone.value = e.matches;
  if (e.matches) setView('lista');
}
const modalActivo = ref(false);
const modalAgregarMesa = ref(false);
const nombreNuevaMesa = ref('');
const capacidadNuevaMesa = ref(4);
const selId = ref(null);
const selectedWaiterPhone = ref('');
const waiterSaved = ref(false);
const editMap = ref(false);
const drag = ref(null);
const dropTarget = ref(null);
const skipClick = ref(false);
const toast = ref(null);
let toastTimer;
const live = bindLive(['tables', 'orders'], () => refresh());
let staleWhileBusy = false;
let clockTimer;
let lastFocus = null;

/* —— Estado de cada mesa a partir de sus pedidos abiertos —— */

const openOrdersByTable = computed(() => {
  const map = new Map();
  for (const o of orders.value) {
    if (!o.tableId || o.paymentStatus === 'paid' || o.status === 'cancelled') continue;
    if (!map.has(o.tableId)) map.set(o.tableId, []);
    map.get(o.tableId).push(o);
  }
  return map;
});

const infoById = computed(() => {
  const map = new Map();
  for (const m of mesas.value) {
    const list = openOrdersByTable.value.get(m.id) || [];
    let state = 'free';
    if (list.some((o) => o.status === 'ready')) state = 'ready';
    else if (list.some((o) => o.status === 'pending' || o.status === 'preparing')) state = 'kitchen';
    else if (list.length) state = 'eating';
    else if (!m.disponible) state = 'seated';
    const times = list.map((o) => new Date(o.createdAt).getTime()).filter(Number.isFinite);
    const total = list.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const assignedAt = m.asignadaEn ? new Date(m.asignadaEn).getTime() : NaN;
    if (Number.isFinite(assignedAt) && state === 'seated') times.push(assignedAt);
    const fresh = !m.disponible && m.avisoVisto === false;
    map.set(m.id, { state, orders: list, since: times.length ? Math.min(...times) : null, total, fresh });
  }
  return map;
});

const EMPTY_INFO = { state: 'free', orders: [], since: null, total: 0, fresh: false };

function isMine(mesa) {
  return Boolean(myPhone.value) && String(mesa.mesero || '') === myPhone.value;
}

const filterOptions = computed(() =>
  myPhone.value ? [{ id: 'mine', label: 'Mías' }, ...BASE_FILTERS] : BASE_FILTERS
);
function info(mesa) {
  return infoById.value.get(mesa.id) || EMPTY_INFO;
}

function matches(mesa) {
  const st = info(mesa).state;
  if (filter.value === 'mine') return isMine(mesa);
  if (filter.value === 'attention') return st === 'seated' || st === 'ready' || info(mesa).fresh;
  if (filter.value === 'free') return st === 'free';
  if (filter.value === 'busy') return st !== 'free';
  return true;
}

const counts = computed(() => {
  const c = { all: 0, mine: 0, attention: 0, free: 0, busy: 0, seats: 0, guests: 0, open: 0 };
  for (const m of mesas.value) {
    const i = info(m);
    const cap = Number(m.capacidad) || 0;
    c.all += 1;
    if (isMine(m)) c.mine += 1;
    c.seats += cap;
    c.open += i.total;
    if (i.state === 'free') c.free += 1;
    else {
      c.busy += 1;
      c.guests += Number(m.personas) || cap;
    }
    if (i.state === 'seated' || i.state === 'ready' || i.fresh) c.attention += 1;
  }
  return c;
});

const visibleMesas = computed(() =>
  mesas.value
    .filter(matches)
    .sort((a, b) => {
      const fa = info(a).state === 'free';
      const fb = info(b).state === 'free';
      if (fa !== fb) return fa ? 1 : -1;
      return String(a.nombre).localeCompare(String(b.nombre), 'es', { numeric: true });
    })
);

const sel = computed(() => mesas.value.find((m) => m.id === selId.value) || null);
const selInfo = computed(() => (sel.value ? info(sel.value) : EMPTY_INFO));

/* —— Formato —— */

function money(n) {
  return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function elapsed(since) {
  const min = Math.max(0, Math.floor((now.value - since) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

function folio(o) {
  return String(o.number || o.folio || o.id || '').slice(-4).toUpperCase();
}

const waiterByPhone = computed(() => {
  const map = new Map();
  for (const w of waiters.value) map.set(String(w.cellphone), w);
  return map;
});

function waiterPhone(mesa) {
  return typeof mesa.mesero === 'string' ? mesa.mesero : mesa.mesero?.cellphone || '';
}
function waiterOf(mesa) {
  return waiterByPhone.value.get(String(waiterPhone(mesa)));
}
function waiterName(mesa) {
  const w = waiterOf(mesa);
  return w ? `${w.name} ${w.lastName || ''}`.trim() : '';
}
function waiterFirst(mesa) {
  return waiterOf(mesa)?.name || '';
}

function partyLabel(mesa) {
  if (!mesa.disponible && (mesa.personaTitular || mesa.personas)) {
    const who = mesa.personaTitular ? `${mesa.personaTitular} · ` : '';
    return `${who}${mesa.personas || mesa.capacidad} pers.`;
  }
  return `${mesa.capacidad} pers.`;
}

// Mesas ocupadas por mesero, para sugerir al menos cargado
const waiterOptions = computed(() => {
  const load = new Map();
  for (const m of mesas.value) {
    if (!m.disponible && m.mesero) load.set(String(m.mesero), (load.get(String(m.mesero)) || 0) + 1);
  }
  const list = waiters.value.map((w) => ({ ...w, load: load.get(String(w.cellphone)) || 0 }));
  const min = Math.min(...list.map((w) => w.load));
  const firstMin = list.find((w) => w.load === min);
  return list
    .map((w) => ({ ...w, suggested: list.length > 1 && w === firstMin }))
    .sort((a, b) => a.load - b.load);
});

const seatLabel = computed(() => {
  if (isWaiter) return 'Sentar clientes';
  const w = waiters.value.find((x) => String(x.cellphone) === String(seatForm.value.mesero));
  return w ? `Sentar y avisar a ${w.name}` : 'Sentar clientes';
});

function tableLabel(mesa) {
  const i = info(mesa);
  const parts = [mesa.nombre, STATES[i.state], `${mesa.capacidad} personas`];
  if (i.since) parts.push(elapsed(i.since));
  if (i.total) parts.push(money(i.total));
  return parts.join(', ');
}

function shortName(name) {
  const t = String(name || '').trim();
  const m = t.match(/(\d+)/);
  if (m) return m[1];
  return t.slice(0, 3).toUpperCase();
}

// Si el servidor niega la acción por rol, decirlo claro en vez de un error genérico
function failText(e, fallback) {
  return e?.response?.status === 403 ? 'Tu rol no tiene permiso para hacer esto.' : fallback;
}

function showToast(text, tone = 'ok') {
  clearTimeout(toastTimer);
  toast.value = { text, tone };
  toastTimer = setTimeout(() => { toast.value = null; }, 2800);
}

/* —— Plano —— */

const gridCells = computed(() => {
  const cells = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) cells.push({ x, y });
  }
  return cells;
});

const mapStyle = computed(() => ({
  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
}));

function shapeClass(cap) {
  const n = Number(cap) || 4;
  if (n <= 2) return 'shape-2';
  if (n <= 4) return 'shape-4';
  if (n <= 6) return 'shape-6';
  if (n <= 8) return 'shape-8';
  return 'shape-10';
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

function spanFor(cap) {
  const n = Number(cap) || 4;
  if (n <= 4) return { w: 1, h: 1 };
  if (n <= 6) return { w: 2, h: 1 };
  if (n <= 8) return { w: 2, h: 2 };
  return { w: 3, h: 1 };
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

function occupiedKeys(excludeId = null) {
  const set = new Set();
  for (const m of mesas.value) {
    if (excludeId && m.id === excludeId) continue;
    const span = spanFor(m.capacidad);
    const x0 = Number(m.posX) || 0;
    const y0 = Number(m.posY) || 0;
    for (let dy = 0; dy < span.h; dy += 1) {
      for (let dx = 0; dx < span.w; dx += 1) set.add(`${x0 + dx},${y0 + dy}`);
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

function hasPos(m) {
  return m.posX != null && m.posY != null && !Number.isNaN(Number(m.posX));
}

async function ensurePositions(list) {
  const assigned = list.map((m) => ({ ...m }));
  const pending = [];
  // Solo las que ya tienen posición cuentan para colisión
  mesas.value = assigned.filter(hasPos);
  for (const m of assigned) {
    if (hasPos(m)) continue;
    const slot = findFreeSlot(m.capacidad) || { x: 0, y: 0 };
    m.posX = slot.x;
    m.posY = slot.y;
    mesas.value = [...mesas.value, m];
    pending.push(m);
  }
  mesas.value = assigned;
  await Promise.all(
    pending.map((m) => apiService.editTable(m.id, { posX: m.posX, posY: m.posY }).catch(() => null))
  );
}

/* —— Datos —— */

async function loadTables() {
  const list = (await apiService.getTables()) || [];
  if (list.some((m) => !hasPos(m))) await ensurePositions(list);
  else mesas.value = list;
}

async function loadOrders() {
  try {
    orders.value = (await apiService.getOrders()) || [];
  } catch {
    // Sin pedidos la vista sigue funcionando con libre / por pedir
  }
}

async function loadWaiters() {
  try {
    waiters.value = (await apiService.getWaiters()) || [];
  } catch {
    waiters.value = [];
  }
}

// Llega un cambio (otro mesero, cocina, hostess…). Si justo estás arrastrando una mesa, editando el
// plano o con una acción en curso, no se pisa lo que estás haciendo: se recuerda y se aplica al terminar.
async function refresh() {
  if (drag.value || editMap.value || busy.value) {
    staleWhileBusy = true;
    return;
  }
  staleWhileBusy = false;
  try {
    await Promise.all([loadTables(), loadOrders()]);
  } catch {
    // Se conserva lo que ya hay en pantalla; el siguiente cambio vuelve a intentarlo
    staleWhileBusy = true;
  }
}

watch([drag, editMap, busy], () => {
  if (staleWhileBusy) refresh();
});

/* —— Interacción —— */

// En escritorio el plano ocupa todo el alto entre la cabecera y el dock.
// En celular tiene tamaño fijo legible y se desplaza con el dedo.
function fitMap() {
  const el = scrollRef.value;
  if (!el || window.matchMedia('(max-width: 720px)').matches) {
    mapH.value = null;
    return;
  }
  const top = el.getBoundingClientRect().top;
  const dock = document.querySelector('.pos-dock')?.offsetHeight || 0;
  const legend = legendRef.value?.offsetHeight || 0;
  mapH.value = Math.max(320, Math.floor(window.innerHeight - top - dock - legend - 28));
}

watch([view, editMap, loading, () => mesas.value.length], () => nextTick(fitMap));

function setView(v) {
  view.value = v;
  if (v !== 'plano') toggleEditMap(false);
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
  selId.value = mesa.id;
  selectedWaiterPhone.value = waiterPhone(mesa);
  // Sentar: el mesero se asigna a sí mismo; la hostess parte del dueño de la sección o del sugerido
  const suggested = waiterOptions.value.find((w) => w.suggested)?.cellphone || waiterOptions.value[0]?.cellphone || '';
  seatForm.value = {
    personas: Math.min(2, Number(mesa.capacidad) || 2),
    nombre: '',
    mesero: isWaiter ? myPhone.value : waiterPhone(mesa) || suggested,
  };
  // Abrir una mesa nueva propia cuenta como "enterado"
  if (info(mesa).fresh && isMine(mesa)) {
    const idx = mesas.value.findIndex((m) => m.id === mesa.id);
    if (idx >= 0) mesas.value[idx] = { ...mesas.value[idx], avisoVisto: true };
    ackTable(mesa.id);
  }
  waiterSaved.value = false;
  modalActivo.value = true;
  await nextTick();
  closeBtn.value?.focus();
}

function cerrarMesa() {
  modalActivo.value = false;
  selId.value = null;
  lastFocus?.focus?.();
}

function irAPedido() {
  const m = sel.value;
  if (!m) return;
  router.push({ path: '/menu', query: { tableId: m.id, tableName: m.nombre } });
}

function irACaja() {
  router.push('/orders');
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

function onKeydown(e) {
  if (e.key !== 'Escape') return;
  if (modalActivo.value) cerrarMesa();
  else if (modalAgregarMesa.value) cerrarModalAgregarMesa();
  else if (editMap.value) toggleEditMap(false);
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
  if (cell && canPlace(cell.x, cell.y, drag.value.capacidad, drag.value.id)) {
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
  } catch (e) {
    mesas.value[idx] = prev;
    showToast(failText(e, 'No se pudo guardar la posición'), 'error');
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

/* —— Acciones —— */

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
  } catch (e) {
    showToast(failText(e, 'No se pudo crear la mesa'), 'error');
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
  } catch (e) {
    showToast(failText(e, 'No se pudo eliminar la mesa'), 'error');
  } finally {
    busy.value = false;
  }
}

async function updateSelected(patch) {
  busy.value = true;
  try {
    const updated = await apiService.editTable(sel.value.id, patch);
    const idx = mesas.value.findIndex((m) => m.id === sel.value.id);
    if (idx >= 0) mesas.value[idx] = { ...mesas.value[idx], ...updated };
    return true;
  } catch (e) {
    showToast(failText(e, 'No se pudo actualizar la mesa'), 'error');
    return false;
  } finally {
    busy.value = false;
  }
}

async function guardarMesero() {
  if (!sel.value) return;
  waiterSaved.value = await updateSelected({ mesero: selectedWaiterPhone.value || null });
}

async function ocuparMesa() {
  const f = seatForm.value;
  const mesero = f.mesero || null;
  const ok = await updateSelected({
    disponible: false,
    mesero,
    personaTitular: f.nombre.trim() || null,
    personas: f.personas,
  });
  if (!ok) return;
  const w = waiters.value.find((x) => String(x.cellphone) === String(mesero));
  showToast(w && !isWaiter ? `${sel.value.nombre} asignada a ${w.name}. Ya le avisamos.` : `${sel.value.nombre} ocupada`);
  cerrarMesa();
}

async function desocuparMesa() {
  const ok = await updateSelected({ disponible: true, personaTitular: null });
  if (ok) cerrarMesa();
}

async function marcarServido() {
  const ready = selInfo.value.orders.filter((o) => o.status === 'ready');
  busy.value = true;
  try {
    const updated = await Promise.all(ready.map((o) => apiService.updateOrderStatus(o.id, 'served')));
    const byId = new Map(updated.filter(Boolean).map((o) => [o.id, o]));
    orders.value = orders.value.map((o) => (byId.has(o.id) ? { ...o, ...byId.get(o.id) } : o));
    showToast('Marcado como servido');
  } catch (e) {
    showToast(failText(e, 'No se pudo actualizar el pedido'), 'error');
  } finally {
    busy.value = false;
  }
}

function openFromRoute() {
  const id = route.query.mesa;
  if (!id) return;
  const mesa = mesas.value.find((m) => m.id === id);
  if (mesa) abrirMesa(mesa);
  router.replace({ query: { ...route.query, mesa: undefined } });
}

watch(() => route.query.mesa, () => !loading.value && openFromRoute());

// El mesero ve primero sus mesas
watch(myPhone, (p) => {
  if (p && isWaiter && filter.value === 'all') filter.value = 'mine';
}, { immediate: true });

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  startWaiterAlerts();
  window.addEventListener('resize', fitMap);
  phoneQuery.addEventListener('change', onPhoneChange);
  try {
    await Promise.all([loadTables(), loadOrders(), loadWaiters()]);
  } catch {
    showToast('No se pudieron cargar las mesas', 'error');
  }
  loading.value = false;
  setTimeout(() => { intro.value = false; }, 700);
  openFromRoute();
  clockTimer = setInterval(() => { now.value = Date.now(); }, 30000);
  // Se suscribe después de la primera carga y se recarga una vez al engancharse (barato),
  // para no perder cambios ocurridos justo durante ese primer arranque.
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', fitMap);
  phoneQuery.removeEventListener('change', onPhoneChange);
  live.stop();
  clearInterval(clockTimer);
  clearTimeout(toastTimer);
});
</script>

<style scoped>
.floor {
  /* Identidad de la landing */
  --paper: #f4efe6;
  --board: #1c1a17;
  --tomato: #d0371f;
  --amber: #e8a020;
  --amber-ink: #2a1d05;
  --basil: #2f8f4e;
  --basil-l: #4cc274;
  --display: "Bricolage Grotesque", var(--font-sans);
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  margin: 0 auto;
}

/* —— Cabecera —— */
.floor-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}
.kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.3rem;
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--mirestaurante-muted);
}
.pulse { position: relative; width: 0.45rem; height: 0.45rem; border-radius: 50%; background: var(--basil-l); }
.pulse::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: inherit; animation: ping 1.8s var(--ease-out) infinite; }
@keyframes ping { to { transform: scale(2.6); opacity: 0; } }
.floor-head h1 {
  margin: 0;
  font-family: var(--display);
  font-size: clamp(1.9rem, 1.4rem + 1.8vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 0.95;
}
.head-actions { display: flex; gap: 0.5rem; align-items: center; }

.seg {
  display: inline-flex;
  padding: 0.2rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--mirestaurante-ink) 7%, transparent);
}
.seg button {
  min-height: 2.4rem;
  padding: 0 0.8rem;
  border: none;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--mirestaurante-muted);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: background-color 160ms ease, color 160ms ease;
}
.seg button[aria-pressed="true"] {
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  box-shadow: 0 1px 2px rgba(27, 24, 20, 0.1);
}

/* —— Filtros —— */
.filters {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 -0.85rem 1rem;
  padding: 0 0.85rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.filters::-webkit-scrollbar { display: none; }
.chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.4rem;
  padding: 0 0.85rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 99px;
  background: transparent;
  color: var(--mirestaurante-ink);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 140ms var(--ease-out);
}
.chip:active { transform: scale(0.96); }
.chip b { font-family: var(--mono); font-size: 0.8rem; font-weight: 700; opacity: 0.55; }
.chip[aria-pressed="true"] {
  background: var(--mirestaurante-ink);
  border-color: var(--mirestaurante-ink);
  color: var(--mirestaurante-panel);
}
.chip[aria-pressed="true"] b { opacity: 0.75; }
.chip.hot:not([aria-pressed="true"]) { border-color: var(--amber); }
.chip.hot b { color: var(--amber); opacity: 1; }
.chip.hot[aria-pressed="true"] { background: var(--amber); border-color: var(--amber); color: var(--amber-ink); }
.chip.hot[aria-pressed="true"] b { color: inherit; }
.summary {
  margin-left: auto;
  flex-shrink: 0;
  padding-left: 0.5rem;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--mirestaurante-muted);
  white-space: nowrap;
}
.summary b { color: var(--mirestaurante-ink); font-weight: 700; }

/* —— Botones —— */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.8rem;
  padding: 0 1rem;
  border: 1.5px solid transparent;
  border-radius: 0.8rem;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  transition: transform 140ms var(--ease-out), background-color 160ms ease, border-color 160ms ease;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary {
  background: var(--tomato);
  color: #fff;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 6px 18px -6px rgba(208, 55, 31, 0.6);
}
.btn-basil {
  background: var(--basil);
  color: #fff;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 6px 18px -6px rgba(47, 143, 78, 0.6);
}
.btn-quiet { background: transparent; color: var(--mirestaurante-ink); border-color: var(--mirestaurante-line); }
.btn-quiet.on { background: var(--amber); color: var(--amber-ink); border-color: transparent; }
.btn-soft { background: transparent; color: var(--mirestaurante-ink); border-color: var(--mirestaurante-line); }
.btn-lg { min-height: 3.3rem; font-size: 1.02rem; width: 100%; }
@media (hover: hover) and (pointer: fine) {
  .btn-primary:hover:not(:disabled) { background: #bb2f19; }
  .btn-basil:hover:not(:disabled) { background: #287a43; }
  .btn-quiet:hover:not(.on), .btn-soft:hover:not(:disabled) { background: color-mix(in srgb, var(--mirestaurante-ink) 5%, transparent); }
  .chip:hover:not([aria-pressed="true"]) { border-color: color-mix(in srgb, var(--mirestaurante-ink) 30%, transparent); }
  .seg button:hover:not([aria-pressed="true"]) { color: var(--mirestaurante-ink); }
}
.btn:focus-visible, .chip:focus-visible, .seg button:focus-visible, .tile:focus-visible,
.icon-close:focus-visible, .link-danger:focus-visible, .more summary:focus-visible,
.table-piece:focus-visible .table-top, .cap-opt:focus-within {
  outline: 2.5px solid var(--tomato);
  outline-offset: 2px;
}

.edit-hint {
  margin: 0 0 0.75rem;
  padding: 0.6rem 0.85rem;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--amber) 14%, transparent);
  font-size: 0.88rem;
  text-wrap: pretty;
}

/* —— Tarjetas de mesa —— */
.tiles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: 0.6rem;
}
/* Entrada escalonada solo al abrir la pantalla; cambiar de filtro es instantáneo */
.tiles.intro li { animation: rise 260ms var(--ease-out) backwards; animation-delay: calc(min(var(--i, 0), 12) * 22ms); }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }

.tile {
  position: relative;
  width: 100%;
  min-height: 7.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 0.8rem 0.7rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 1rem;
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  text-align: left;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
  transition: transform 140ms var(--ease-out), border-color 160ms ease, background-color 160ms ease;
}
.tile:active { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) {
  .tile:hover { border-color: color-mix(in srgb, var(--mirestaurante-ink) 28%, transparent); }
}
.tile-top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.tile-num {
  font-family: var(--mono);
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}
.tile-time { font-family: var(--mono); font-size: 0.75rem; color: var(--mirestaurante-muted); white-space: nowrap; }
.tile-state {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: auto;
  font-size: 0.86rem;
  font-weight: 700;
}
.tile-state i { width: 0.5rem; height: 0.5rem; border-radius: 0.15rem; flex-shrink: 0; background: currentColor; }
.tile-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--mirestaurante-muted);
}
.tile-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tile-meta b { font-family: var(--mono); font-weight: 700; color: var(--mirestaurante-ink); white-space: nowrap; }

.tile.st-free { background: transparent; border-style: dashed; border-color: color-mix(in srgb, var(--mirestaurante-ink) 22%, transparent); }
.tile.st-free .tile-num { color: var(--mirestaurante-muted); }
.tile.st-free .tile-state { color: var(--mirestaurante-muted); font-weight: 600; }
.tile.st-free .tile-state i { background: none; border: 1.5px dashed currentColor; }
.tile.st-free { min-height: 5.2rem; }
.tile-state small { font-size: inherit; font-weight: 500; }

.tile.st-seated { border-color: var(--amber); background: color-mix(in srgb, var(--amber) 10%, var(--mirestaurante-panel)); }
.tile.st-seated .tile-state { color: color-mix(in srgb, var(--amber) 70%, var(--mirestaurante-ink)); }

.tile.st-kitchen .tile-state { color: var(--mirestaurante-ink); }
.tile.st-kitchen .tile-state i { background: var(--amber); animation: blink 1.6s ease-in-out infinite; }
@keyframes blink { 50% { opacity: 0.35; } }

.tile.st-ready { border-color: var(--basil-l); background: color-mix(in srgb, var(--basil-l) 12%, var(--mirestaurante-panel)); }
.tile.st-ready .tile-state { color: var(--mirestaurante-success); }
.tile.st-ready::after {
  content: "";
  position: absolute;
  inset: -1.5px;
  border-radius: inherit;
  border: 2px solid var(--basil-l);
  animation: ring 1.6s var(--ease-out) infinite;
  pointer-events: none;
}
@keyframes ring { to { transform: scale(1.06); opacity: 0; } }

.tile.st-eating .tile-state { color: var(--mirestaurante-muted); }

.tile-new {
  padding: 0.15rem 0.45rem;
  border-radius: 0.3rem;
  background: var(--tomato);
  color: #fff;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  animation: blink 1.4s ease-in-out infinite;
}
.tile.fresh { border-color: var(--tomato); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tomato) 18%, transparent); }
.tile.mine:not(.st-free)::before {
  content: "";
  position: absolute;
  left: -1.5px;
  top: 0.9rem;
  bottom: 0.9rem;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--mirestaurante-ink);
}
.table-piece.fresh .table-top { box-shadow: 0 0 0 2px var(--tomato); }
.table-piece.fresh .table-top::before {
  content: "";
  position: absolute;
  inset: -1.5px;
  border-radius: inherit;
  border: 2px solid var(--tomato);
  animation: ring-lg 1.4s var(--ease-out) infinite;
}

.tile.sk { min-height: 7.4rem; border-style: dashed; background: transparent; animation: pulse 1.1s ease-in-out infinite alternate; cursor: default; }
@keyframes pulse { to { opacity: 0.45; } }

.no-match { color: var(--mirestaurante-muted); text-align: center; padding: 2.5rem 1rem; }

/* —— Plano: la pizarra de la landing ——
   Las mesas se miden con la celda (la menor entre ancho y alto)
   para llenar el plano a cualquier tamaño. */
.board { display: grid; gap: 0.7rem; }
.map-scroll {
  height: min(70dvh, 46rem);
  overflow: auto;
  overscroll-behavior: contain;
  border-radius: 1.4rem;
  box-shadow: 0 30px 60px -30px rgba(27, 24, 20, 0.6);
  scrollbar-width: thin;
}
.floor-map {
  --cell: min(calc(100cqw / 12), calc(100cqh / 8));
  container-type: size;
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  background-color: var(--board);
  background-image: radial-gradient(circle, rgba(244, 239, 230, 0.09) 1.2px, transparent 1.6px);
  background-size: calc(100% / 12) calc(100% / 8);
  background-position: calc(100% / 24) calc(100% / 16);
  border-radius: 1.4rem;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  user-select: none;
  -webkit-user-select: none;
}
.floor-map.editing { box-shadow: inset 0 0 0 2px var(--amber); }
.grid-cell { pointer-events: none; margin: 2px; border-radius: 0.4rem; transition: background-color 120ms ease; }
.grid-cell.drop { background: color-mix(in srgb, var(--amber) 18%, transparent); box-shadow: inset 0 0 0 1.5px var(--amber); }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0;
  padding: 0 0.25rem;
  list-style: none;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--mirestaurante-muted);
}
.legend li::before {
  content: "";
  display: inline-block;
  width: 0.6rem;
  height: 0.6rem;
  margin-right: 0.4rem;
  border-radius: 0.2rem;
  vertical-align: -0.05em;
}
.lg-free::before { border: 1.5px dashed color-mix(in srgb, var(--mirestaurante-ink) 40%, transparent); }
.lg-seated::before { background: var(--amber); }
.lg-kitchen::before { background: color-mix(in srgb, var(--mirestaurante-ink) 25%, transparent); box-shadow: inset 0 0 0 1.5px var(--amber); }
.lg-ready::before { background: var(--basil-l); }
.lg-eating::before { background: color-mix(in srgb, var(--mirestaurante-ink) 25%, transparent); }

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
  animation: rise 320ms var(--ease-out) backwards;
  animation-delay: calc(min(var(--i, 0), 12) * 30ms);
  transition: opacity 200ms ease;
}
.table-piece.dim { opacity: 0.25; }
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
.table-piece.dragging .table-unit { transform: scale(1.05); filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.4)); }

.chair {
  --cw: calc(var(--cell) * 0.17);
  --ch: calc(var(--cell) * 0.1);
  position: absolute;
  width: var(--cw);
  height: var(--ch);
  border-radius: 99px;
  background: rgba(244, 239, 230, 0.16);
  pointer-events: none;
}
.table-piece:not(.st-free) .chair { background: rgba(244, 239, 230, 0.3); }

.table-top {
  position: absolute;
  inset: 16%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2em;
  border-radius: calc(var(--cell) * 0.12);
  border: 1.5px solid transparent;
  font-size: calc(var(--cell) * 0.22);
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
}
.table-name { font-family: var(--mono); font-size: 1em; font-weight: 700; line-height: 1; white-space: nowrap; overflow: hidden; max-width: 100%; }
.table-sub { font-family: var(--mono); font-size: 0.48em; font-weight: 600; line-height: 1; opacity: 0.8; white-space: nowrap; }
.shape-2 .table-sub { display: none; }
@container (max-width: 40rem) { .table-sub { display: none; } }

.st-free .table-top { background: rgba(244, 239, 230, 0.03); color: rgba(244, 239, 230, 0.55); border: 1.5px dashed rgba(244, 239, 230, 0.3); }
.st-seated .table-top { background: var(--amber); color: var(--amber-ink); border-color: var(--amber); }
.st-kitchen .table-top { background: rgba(244, 239, 230, 0.14); color: var(--paper); border-color: var(--amber); }
.st-ready .table-top { background: var(--basil-l); color: #08210f; border-color: var(--basil-l); }
.st-ready .table-top::after { content: ""; position: absolute; inset: -1.5px; border-radius: inherit; border: 2px solid var(--basil-l); animation: ring-lg 1.4s var(--ease-out) infinite; }
@keyframes ring-lg { to { transform: scale(1.35); opacity: 0; } }
.st-eating .table-top { background: rgba(244, 239, 230, 0.14); color: var(--paper); border-color: rgba(244, 239, 230, 0.2); }
@media (hover: hover) and (pointer: fine) {
  .st-free:hover .table-top { border-color: rgba(244, 239, 230, 0.6); color: var(--paper); }
}

/* 2 personas: redonda */
.shape-2 .table-unit { width: calc(var(--cell) * 0.78); height: calc(var(--cell) * 0.78); }
.shape-2 .table-top { inset: 20%; border-radius: 999px; font-size: calc(var(--cell) * 0.2); }
.shape-2 .c1 { left: 50%; top: 4%; transform: translateX(-50%); }
.shape-2 .c2 { left: 50%; bottom: 4%; transform: translateX(-50%); }
/* 4 personas: cuadrada */
.shape-4 .c1 { left: 50%; top: 4%; transform: translateX(-50%); }
.shape-4 .c2 { right: 4%; top: 50%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
.shape-4 .c3 { left: 50%; bottom: 4%; transform: translateX(-50%); }
.shape-4 .c4 { left: 4%; top: 50%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
/* 6 personas: rectangular */
.shape-6 .table-unit { width: calc(var(--cell) * 1.86); }
.shape-6 .table-top { inset: 16% 6%; }
.shape-6 .c1 { left: 25%; top: 4%; transform: translateX(-50%); }
.shape-6 .c2 { left: 50%; top: 4%; transform: translateX(-50%); }
.shape-6 .c3 { left: 75%; top: 4%; transform: translateX(-50%); }
.shape-6 .c4 { left: 25%; bottom: 4%; transform: translateX(-50%); }
.shape-6 .c5 { left: 50%; bottom: 4%; transform: translateX(-50%); }
.shape-6 .c6 { left: 75%; bottom: 4%; transform: translateX(-50%); }
/* 8 personas: grande */
.shape-8 .table-unit { width: calc(var(--cell) * 1.8); height: calc(var(--cell) * 1.8); }
.shape-8 .table-top { inset: 11%; font-size: calc(var(--cell) * 0.32); border-radius: calc(var(--cell) * 0.16); }
.shape-8 .c1 { left: 33%; top: 2%; transform: translateX(-50%); }
.shape-8 .c2 { left: 67%; top: 2%; transform: translateX(-50%); }
.shape-8 .c3 { right: 2%; top: 33%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
.shape-8 .c4 { right: 2%; top: 67%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
.shape-8 .c5 { left: 67%; bottom: 2%; transform: translateX(-50%); }
.shape-8 .c6 { left: 33%; bottom: 2%; transform: translateX(-50%); }
.shape-8 .c7 { left: 2%; top: 67%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
.shape-8 .c8 { left: 2%; top: 33%; width: var(--ch); height: var(--cw); transform: translateY(-50%); }
/* 10 personas: banquete */
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

/* —— Vacío —— */
.empty {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 3.5rem 1.25rem 4rem;
  text-align: center;
  border: 1.5px dashed var(--mirestaurante-line);
  border-radius: 1.2rem;
  color: var(--mirestaurante-muted);
}
.empty h2 { margin: 0.4rem 0 0; color: var(--mirestaurante-ink); font-family: var(--display); font-size: 1.45rem; font-weight: 800; letter-spacing: -0.02em; }
.empty p { margin: 0 0 0.75rem; max-width: 30ch; text-wrap: balance; }

/* —— Hoja —— */
.sheet-bg {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(20, 18, 16, 0.5);
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
  padding: 0.6rem 1.1rem calc(1.2rem + env(safe-area-inset-bottom, 0px));
  display: grid;
  gap: 0.9rem;
  max-height: 90dvh;
  overflow: auto;
  overscroll-behavior: contain;
  box-shadow: 0 -12px 40px rgba(20, 18, 16, 0.2);
}
.sheet-handle { width: 2.5rem; height: 0.3rem; border-radius: 99px; background: var(--mirestaurante-line); margin: 0 auto -0.2rem; }
.sheet-head { display: flex; align-items: flex-start; gap: 0.6rem; }
.sheet-title { flex: 1; min-width: 0; margin: 0; }
.sheet h2 {
  margin: 0;
  font-family: var(--display);
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  overflow-wrap: anywhere;
}
.sheet-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.6rem; margin: 0.45rem 0 0; color: var(--mirestaurante-muted); font-family: var(--mono); font-size: 0.76rem; }
.state-pill {
  font-family: var(--font-sans);
  padding: 0.25rem 0.55rem;
  border-radius: 0.3rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.state-pill.st-free { color: var(--mirestaurante-muted); border: 1.5px dashed var(--mirestaurante-line); }
.state-pill.st-seated { background: var(--amber); color: var(--amber-ink); }
.state-pill.st-kitchen { background: color-mix(in srgb, var(--amber) 18%, transparent); color: color-mix(in srgb, var(--amber) 65%, var(--mirestaurante-ink)); }
.state-pill.st-ready { background: var(--basil); color: #fff; }
.state-pill.st-eating { background: color-mix(in srgb, var(--mirestaurante-ink) 8%, transparent); color: var(--mirestaurante-ink); }

.icon-close {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  flex-shrink: 0;
  border: none;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--mirestaurante-ink) 6%, transparent);
  color: var(--mirestaurante-ink);
  cursor: pointer;
  transition: transform 140ms var(--ease-out);
}
.icon-close:active { transform: scale(0.94); }

/* La cuenta, como el ticket de la landing */
.ticket {
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem 0.9rem 0.8rem;
  border-radius: 0.3rem;
  background: #fbf7ef;
  color: #1b1814;
  font-family: var(--mono);
  font-size: 0.78rem;
  line-height: 1.5;
  box-shadow: 0 1px 0 rgba(27, 24, 20, 0.06), 0 8px 20px -12px rgba(27, 24, 20, 0.35);
}
.tk-order + .tk-order { padding-top: 0.6rem; border-top: 1px dashed rgba(27, 24, 20, 0.2); }
.tk-head { display: flex; justify-content: space-between; align-items: center; margin: 0 0 0.25rem; }
.tk-st { padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.os-pending { background: var(--tomato); color: #fff; }
.os-preparing { background: var(--amber); color: var(--amber-ink); }
.os-ready { background: var(--basil); color: #fff; }
.os-served { background: rgba(27, 24, 20, 0.08); color: #4d463c; }
.ticket ul { list-style: none; margin: 0; padding: 0; }
.ticket li { display: flex; justify-content: space-between; gap: 1rem; }
.ticket li span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tk-total { display: flex; justify-content: space-between; margin: 0; padding-top: 0.55rem; border-top: 1.5px solid rgba(27, 24, 20, 0.8); font-size: 0.9rem; }

.sheet-actions { display: grid; gap: 0.5rem; }

/* Sentar clientes */
.seat { display: grid; gap: 0.85rem; }
.seat-row { display: flex; justify-content: space-between; align-items: center; }
.seat-label { font-weight: 600; font-size: 0.88rem; }
.seat-warn { margin: -0.4rem 0 0; font-size: 0.8rem; color: var(--mirestaurante-warning); }
.field small { font-weight: 500; color: var(--mirestaurante-muted); }
.stepper { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem; border-radius: 0.85rem; border: 1.5px solid var(--mirestaurante-line); }
.stepper button {
  width: 2.75rem;
  height: 2.75rem;
  border: none;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--mirestaurante-ink) 6%, transparent);
  color: var(--mirestaurante-ink);
  font-size: 1.3rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 120ms var(--ease-out);
}
.stepper button:active:not(:disabled) { transform: scale(0.92); }
.stepper button:disabled { opacity: 0.35; }
.stepper b { min-width: 2.2rem; text-align: center; font-family: var(--mono); font-size: 1.15rem; }
.waiter-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 0.4rem; }
.wp {
  position: relative;
  display: grid;
  gap: 0.1rem;
  min-height: 3.2rem;
  padding: 0.5rem 0.7rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 0.8rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: border-color 150ms ease, background-color 150ms ease, transform 140ms var(--ease-out);
}
.wp:active { transform: scale(0.97); }
.wp.on { border-color: var(--tomato); background: color-mix(in srgb, var(--tomato) 8%, transparent); }
.wp:focus-within { outline: 2.5px solid var(--tomato); outline-offset: 2px; }
.wp-name { font-weight: 700; font-size: 0.9rem; }
.wp-load { font-family: var(--mono); font-size: 0.7rem; color: var(--mirestaurante-muted); }
.wp-tag {
  position: absolute;
  top: -0.5rem;
  right: 0.5rem;
  padding: 0.05rem 0.35rem;
  border-radius: 0.25rem;
  background: var(--basil);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.more { border-top: 1px solid var(--mirestaurante-line); padding-top: 0.25rem; }
.more summary {
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--mirestaurante-muted);
  cursor: pointer;
  list-style: none;
  border-radius: 0.5rem;
}
.more summary::-webkit-details-marker { display: none; }
.more summary::after { content: ""; width: 0.45rem; height: 0.45rem; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg) translateY(-2px); margin-left: 0.2rem; transition: transform 200ms var(--ease-out); }
.more[open] summary::after { transform: rotate(225deg) translateY(-1px); }
.more[open] { display: grid; gap: 0.75rem; padding-bottom: 0.25rem; }
.hint { color: var(--mirestaurante-muted); font-size: 0.78rem; text-align: center; }

.field { display: grid; gap: 0.4rem; margin: 0; padding: 0; border: none; font-weight: 600; font-size: 0.88rem; }
.field legend { padding: 0; margin-bottom: 0.4rem; }
.field input, .field select {
  min-height: 3rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 0.75rem;
  padding: 0.6rem 0.8rem;
  font: inherit;
  font-size: 16px; /* evita zoom en iOS */
  font-weight: 500;
  background: var(--mirestaurante-panel-elevated);
  color: var(--mirestaurante-ink);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.field input:focus-visible, .field select:focus-visible {
  outline: none;
  border-color: var(--tomato);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tomato) 18%, transparent);
}
.saved { color: var(--mirestaurante-success); font-weight: 600; font-size: 0.8rem; }

.cap-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.4rem; }
.cap-opt {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  padding: 0.65rem 0.2rem 0.55rem;
  border: 1.5px solid var(--mirestaurante-line);
  border-radius: 0.8rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: border-color 150ms ease, background-color 150ms ease, transform 140ms var(--ease-out);
}
.cap-opt:active { transform: scale(0.96); }
.cap-opt.on { border-color: var(--tomato); background: color-mix(in srgb, var(--tomato) 8%, transparent); }
.cap-opt b { font-family: var(--mono); font-size: 1rem; }
.cap-opt small { font-size: 0.64rem; font-weight: 500; color: var(--mirestaurante-muted); }
.cap-shape { height: 1.1rem; width: 1.1rem; border-radius: 0.25rem; border: 2px solid currentColor; opacity: 0.7; }
.cap-opt.shape-2 .cap-shape { border-radius: 50%; width: 0.95rem; height: 0.95rem; }
.cap-opt.shape-6 .cap-shape { width: 1.7rem; }
.cap-opt.shape-8 .cap-shape { width: 1.5rem; height: 1.5rem; margin-top: -0.2rem; }
.cap-opt.shape-10 .cap-shape { width: 2.1rem; border-radius: 999px; }

.warn { margin: 0; padding: 0.6rem 0.8rem; border-radius: 0.7rem; background: var(--mirestaurante-warning-soft); color: var(--mirestaurante-warning); font-size: 0.86rem; font-weight: 600; }

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
.link-danger:disabled { opacity: 0.4; cursor: not-allowed; }
@media (hover: hover) and (pointer: fine) {
  .link-danger:hover:not(:disabled) { background: var(--mirestaurante-danger-soft); }
}

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 240ms ease; }
.sheet-enter-active .sheet { transition: transform 360ms var(--ease-drawer); }
.sheet-leave-active { transition-duration: 180ms; }
.sheet-leave-active .sheet { transition: transform 180ms ease-out; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }

.toast {
  position: fixed;
  left: 50%;
  bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
  z-index: 70;
  transform: translateX(-50%);
  max-width: calc(100% - 2rem);
  padding: 0.7rem 1.05rem;
  border-radius: 0.8rem;
  background: var(--board);
  color: var(--paper);
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 12px 30px rgba(20, 18, 16, 0.3);
}
.toast.error { background: var(--tomato); color: #fff; }
.toast-enter-active { transition: opacity 200ms ease, transform 260ms var(--ease-out); }
.toast-leave-active { transition: opacity 160ms ease, transform 160ms ease-out; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 0.75rem); }

/* —— Celular —— */
@media (max-width: 720px) {
  .floor-head { align-items: center; }
  .btn-label { display: none; }
  .head-actions .btn-primary { width: 2.8rem; padding: 0; }
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
  .summary { display: none; }
  .chip { padding: 0 0.7rem; font-size: 0.84rem; gap: 0.3rem; }
  .filters { gap: 0.3rem; }
}

@media (min-width: 900px) {
  .sheet-bg { align-items: center; padding: 1rem; }
  .sheet { border-radius: 1.3rem; padding: 1.25rem 1.35rem 1.35rem; }
  .sheet-handle { display: none; }
  .sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(12px) scale(0.97); }
}

@media (prefers-reduced-motion: reduce) {
  .tiles li, .table-piece, .tile.sk, .tile-new, .table-piece.fresh .table-top::before, .pulse::after, .tile.st-ready::after,
  .st-ready .table-top::after, .tile.st-kitchen .tile-state i { animation: none; }
  .sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: none; }
  .toast-enter-from, .toast-leave-to { transform: translateX(-50%); }
}
</style>
