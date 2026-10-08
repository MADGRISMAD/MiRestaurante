<template>
  <div class="pos-shell">
    <header class="pos-top">
      <div class="brand">
        <img :src="logoSrc" alt="" class="brand-logo" />
        <div>
          <p class="brand-name">MiRestaurante</p>
          <p class="brand-venue">{{ businessName }}</p>
        </div>
      </div>
      <div class="top-actions">
        <span
          v-if="live.status !== 'idle'"
          class="live-badge"
          :class="live.status"
          role="status"
          :title="live.status === 'live' ? 'Los cambios llegan solos' : 'Sin conexión; reintentando…'"
        >
          <span class="live-dot" aria-hidden="true"></span>
          <span class="live-text">{{ live.status === 'live' ? 'En vivo' : 'Reconectando…' }}</span>
        </span>
        <span class="clock">{{ clock }}</span>
        <button
          type="button"
          class="icon-btn theme-toggle"
          :title="isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
          @click="toggleUiTheme"
        >
          {{ isDark ? '☀' : '☾' }}
        </button>
        <button type="button" class="icon-btn" @click="moreOpen = !moreOpen" aria-label="Más opciones">
          Más
        </button>
        <button type="button" class="icon-btn ghost" @click="logout">Salir</button>
      </div>
    </header>

    <div class="pos-body">
      <div v-if="billingBanner" class="billing-banner" :class="billingBanner.tone">
        <span>{{ billingBanner.text }}</span>
        <router-link to="/billing">Facturación</router-link>
      </div>

      <div v-if="moreOpen" class="more-sheet" @click.self="moreOpen = false">
        <div class="more-panel">
          <h3>Más opciones</h3>
          <button type="button" class="more-link theme-btn" @click="toggleUiTheme">
            Tema: {{ isDark ? 'Oscuro' : 'Claro' }} (cambiar)
          </button>
          <router-link v-for="item in moreItems" :key="item.to" :to="item.to" class="more-link" @click="moreOpen = false">
            {{ item.label }}
          </router-link>
        </div>
      </div>

      <section v-if="isWaiter && (waiterAlerts.length || askPermission)" class="alerts" aria-live="polite" aria-label="Avisos">
        <TransitionGroup name="alert">
          <article
            v-for="a in waiterAlerts.slice(0, 3)"
            :key="a.key"
            class="alert"
            :class="`al-${a.kind}`"
          >
            <span class="al-mark" aria-hidden="true">{{ a.kind === 'ready' ? '✓' : shortName(a.table.nombre) }}</span>
            <div class="al-copy">
              <p class="al-title">{{ alertText(a).title }}</p>
              <p class="al-body">{{ alertText(a).body }}<span v-if="a.at"> · {{ ago(a.at) }}</span></p>
            </div>
            <button type="button" class="al-go" @click="goTo(a)">
              {{ a.kind === 'ready' ? 'Ver mesa' : 'Voy' }}
            </button>
            <button type="button" class="al-x" aria-label="Enterado" @click="ackAlert(a)">×</button>
          </article>
        </TransitionGroup>
        <p v-if="waiterAlerts.length > 3" class="al-more">+{{ waiterAlerts.length - 3 }} avisos más en Mesas</p>
        <div v-if="askPermission" class="al-perm">
          <span>Activa los avisos del teléfono</span>
          <button type="button" @click="enableSystemAlerts">Activar</button>
        </div>
      </section>

      <main class="pos-content">
        <slot />
      </main>
    </div>

    <nav class="pos-dock" aria-label="Navegación principal">
      <router-link
        v-for="item in dock"
        :key="item.to"
        :to="item.to"
        class="dock-item"
      >
        <span class="dock-ico" v-html="item.icon"></span>
        <span v-if="item.name === 'main' && isWaiter && waiterAlerts.length" class="dock-badge">{{ waiterAlerts.length }}</span>
        <span class="dock-label">{{ item.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { venueStore } from "../venueStore";
import { themeStore, toggleUiTheme } from "../themeStore";
import { clearSession, canAccessRoute, hasRole } from "../authStore";
import { apiService } from "../apiService";
import { isCounterMode } from "../roles";
import { liveState as live } from "../live";
import {
  alertsState,
  waiterAlerts,
  alertText,
  ackAlert,
  startWaiterAlerts,
  stopWaiterAlerts,
  enableSystemAlerts,
} from "../waiterAlerts";

const router = useRouter();
const moreOpen = ref(false);
const now = ref(new Date());
const billingStatus = ref(null);
let timer;

const businessName = computed(() => venueStore.businessName || "Mi negocio");
const logoSrc = computed(() => venueStore.logoUrl || "/logo.svg");
const isDark = computed(() => themeStore.mode === "dark");
const clock = computed(() =>
  now.value.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
);

const billingBanner = computed(() => {
  const s = billingStatus.value;
  if (!s || !hasRole("admin", "cashier")) return null;
  if (s.billingStatus === "past_due") {
    return { tone: "danger", text: "Pago pendiente — regulariza tu suscripción." };
  }
  if (s.billingStatus === "suspended") {
    return { tone: "danger", text: "Cuenta suspendida — contacta a MiRestaurante o paga tu plan." };
  }
  if (s.billingStatus === "trialing" && Number(s.trialDaysLeft) <= 3) {
    return {
      tone: "warn",
      text: `Tu prueba termina en ${s.trialDaysLeft} día(s). Activa un plan.`,
    };
  }
  return null;
});

const ico = {
  tables: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="8" width="18" height="3" rx="1"/><path d="M6 11v7M18 11v7M9 14h6"/></svg>`,
  order: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>`,
  kitchen: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4v8a4 4 0 008 0V4M12 16v4M9 20h6"/></svg>`,
  counter: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9v8a4.5 4.5 0 01-9 0V3z"/><path d="M15 5h2.5a2.5 2.5 0 010 5H15M5 21h11"/></svg>`,
  cash: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>`,
};

const allDock = [
  { to: "/counter", name: "counter", label: "Mostrador", icon: ico.counter },
  { to: "/main", name: "main", label: "Mesas", icon: ico.tables },
  { to: "/menu", name: "menu", label: "Pedido", icon: ico.order },
  { to: "/kitchen", name: "kitchen", label: "Cocina", icon: ico.kitchen },
  { to: "/orders", name: "orders", label: "Caja", icon: ico.cash },
];

const allMore = [
  { to: "/dashboard", name: "dashboard", label: "Resumen / Dashboard" },
  { to: "/waitlist", name: "waitlist", label: "Lista de espera" },
  { to: "/menu", name: "menu", label: "Menú y productos" },
  { to: "/team", name: "team", label: "Equipo y roles" },
  { to: "/staff", name: "staff", label: "Personal / Meseros" },
  { to: "/billing", name: "billing", label: "Facturación / Planes" },
  { to: "/settings", name: "settings", label: "Configuración" },
];

// En café "Pedido" no existe (se vende en el Mostrador): esa pantalla es solo el menú del admin
const dock = computed(() =>
  allDock
    .filter((i) => canAccessRoute(i.name))
    .map((i) => (i.name === "menu" && isCounterMode() ? { ...i, label: "Menú" } : i))
);
// "Más" muestra lo que no está ya en la barra de abajo (p. ej. el menú, que en café solo edita el admin)
const moreItems = computed(() =>
  allMore.filter((i) => canAccessRoute(i.name) && !dock.value.some((d) => d.name === i.name))
);

const isWaiter = computed(() => hasRole("waiter"));
const askPermission = computed(() => isWaiter.value && alertsState.permission === "default");

function shortName(name) {
  const m = String(name || "").match(/(\d+)/);
  return m ? m[1] : String(name || "").slice(0, 3).toUpperCase();
}

function ago(at) {
  const min = Math.max(0, Math.floor((now.value - new Date(at)) / 60000));
  return min < 1 ? "ahora" : `hace ${min} min`;
}

function goTo(a) {
  ackAlert(a);
  router.push({ path: "/main", query: { mesa: a.table.id } });
}

function logout() {
  stopWaiterAlerts();
  moreOpen.value = false;
  clearSession();
  router.push("/login");
}

async function loadBilling() {
  if (!hasRole("admin", "cashier")) return;
  try {
    billingStatus.value = await apiService.getBillingStatus();
  } catch {
    billingStatus.value = null;
  }
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date();
  }, 30000);
  loadBilling();
  startWaiterAlerts();
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.pos-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background:
    radial-gradient(ellipse 80% 50% at 100% 0%, color-mix(in srgb, var(--mirestaurante-accent) 18%, transparent), transparent 50%),
    var(--mirestaurante-surface);
  font-family: var(--font-sans);
  color: var(--mirestaurante-ink);
}

.billing-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
}
.billing-banner.warn {
  background: color-mix(in srgb, #b8956c 28%, var(--mirestaurante-panel));
  color: var(--mirestaurante-ink);
}
.billing-banner.danger {
  background: var(--mirestaurante-danger-soft);
  color: var(--mirestaurante-danger);
}
.billing-banner a {
  color: inherit;
  font-weight: 800;
  text-decoration: underline;
}

.pos-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  background: var(--mirestaurante-topbar);
  color: var(--mirestaurante-topbar-text);
  position: sticky;
  top: 0;
  z-index: 30;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.brand-logo {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.65rem;
  object-fit: cover;
}

.brand-name {
  margin: 0;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--mirestaurante-accent);
  font-weight: 700;
}

.brand-venue {
  margin: 0.1rem 0 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 36vw;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  justify-content: flex-end;
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 1.7rem;
  padding: 0 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.1);
  color: var(--mirestaurante-topbar-text);
}
.live-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #3ddc84;
  box-shadow: 0 0 0 0 rgba(61, 220, 132, 0.6);
  animation: live-pulse 2s ease-out infinite;
}
.live-badge.reconnecting { background: rgba(255, 170, 60, 0.2); }
.live-badge.reconnecting .live-dot { background: #ffb23c; animation: none; }
@keyframes live-pulse {
  70% { box-shadow: 0 0 0 0.45rem rgba(61, 220, 132, 0); }
  100% { box-shadow: 0 0 0 0 rgba(61, 220, 132, 0); }
}
@media (prefers-reduced-motion: reduce) { .live-dot { animation: none; } }
@media (max-width: 480px) { .live-text { display: none; } }
.clock {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 1rem;
  margin-right: 0.15rem;
  opacity: 0.9;
}

.icon-btn {
  min-height: 2.75rem;
  min-width: 3.4rem;
  padding: 0 0.85rem;
  border: none;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.12);
  color: var(--mirestaurante-topbar-text);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}

.icon-btn.ghost {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.pos-body {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.pos-content {
  overflow: auto;
  padding: 0.85rem 0.85rem 0.5rem;
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
}

.pos-dock {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.35rem;
  padding: 0.45rem 0.55rem calc(0.55rem + env(safe-area-inset-bottom, 0px));
  background: var(--mirestaurante-dock);
  border-top: 1px solid var(--mirestaurante-line);
  box-shadow: 0 -10px 30px color-mix(in srgb, var(--mirestaurante-ink) 8%, transparent);
  position: sticky;
  bottom: 0;
  z-index: 30;
}

.dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-height: 4.25rem;
  border-radius: 0.9rem;
  text-decoration: none;
  color: var(--mirestaurante-dock-text);
  font-weight: 700;
  font-size: 0.82rem;
  transition: background 0.15s ease, color 0.15s ease;
}

.dock-item.router-link-active {
  background: var(--mirestaurante-primary-soft);
  color: var(--mirestaurante-primary);
}

.dock-ico {
  display: grid;
  place-items: center;
}

.dock-item { position: relative; }
.dock-badge {
  position: absolute;
  top: 0.35rem;
  left: calc(50% + 0.5rem);
  min-width: 1.2rem;
  height: 1.2rem;
  padding: 0 0.3rem;
  border-radius: 99px;
  display: grid;
  place-items: center;
  background: var(--mirestaurante-primary);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--mirestaurante-dock);
}

/* —— Avisos del mesero —— */
.alerts {
  position: sticky;
  top: 0;
  z-index: 25;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.45rem;
  padding: 0.6rem 0.85rem 0;
}
.alert {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.6rem 0.6rem 0.65rem;
  border-radius: 1rem;
  background: #1c1a17;
  color: #f4efe6;
  box-shadow: 0 14px 30px -14px rgba(20, 18, 16, 0.55);
}
.al-mark {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.7rem;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1.05rem;
}
.al-assigned .al-mark { background: #e8a020; color: #2a1d05; animation: al-pulse 1.6s ease-out infinite; }
.al-ready .al-mark { background: #4cc274; color: #08210f; }
@keyframes al-pulse { 0% { box-shadow: 0 0 0 0 rgba(232, 160, 32, 0.6); } 100% { box-shadow: 0 0 0 0.6rem rgba(232, 160, 32, 0); } }
.al-copy { flex: 1; min-width: 0; }
.al-title { margin: 0; font-weight: 700; font-size: 0.95rem; line-height: 1.2; }
.al-body { margin: 0.15rem 0 0; font-size: 0.8rem; color: rgba(244, 239, 230, 0.7); line-height: 1.3; }
.al-go {
  flex-shrink: 0;
  min-height: 2.6rem;
  padding: 0 1rem;
  border: none;
  border-radius: 0.7rem;
  background: var(--mirestaurante-primary);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}
.al-ready .al-go { background: #2f8f4e; }
.al-go:active, .al-x:active { transform: scale(0.95); }
.al-x {
  flex-shrink: 0;
  width: 2.2rem;
  height: 2.6rem;
  border: none;
  border-radius: 0.6rem;
  background: transparent;
  color: rgba(244, 239, 230, 0.55);
  font-size: 1.4rem;
  cursor: pointer;
}
.al-more { margin: 0; font-size: 0.78rem; color: var(--mirestaurante-muted); text-align: center; }
.al-perm {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.6rem 0.55rem 0.85rem;
  border-radius: 0.85rem;
  border: 1.5px dashed var(--mirestaurante-line);
  font-size: 0.82rem;
  color: var(--mirestaurante-ink);
}
.al-perm span { flex: 1; }
.al-perm button {
  min-height: 2.4rem;
  padding: 0 0.9rem;
  border: 1.5px solid var(--mirestaurante-ink);
  border-radius: 0.65rem;
  background: transparent;
  color: var(--mirestaurante-ink);
  font-weight: 700;
  cursor: pointer;
}
.alert-enter-active { transition: opacity 220ms ease, transform 320ms cubic-bezier(0.23, 1, 0.32, 1); }
.alert-leave-active { transition: opacity 160ms ease, transform 160ms ease-out; }
.alert-enter-from { opacity: 0; transform: translateY(-0.75rem) scale(0.98); }
.alert-leave-to { opacity: 0; transform: translateX(1.5rem); }
@media (max-width: 640px) {
  .alerts { padding: 0.5rem 0.6rem 0; gap: 0.35rem; }
  .alert { gap: 0.55rem; padding: 0.4rem 0.35rem 0.4rem 0.4rem; border-radius: 0.9rem; }
  .al-mark { width: 2.2rem; height: 2.2rem; font-size: 0.95rem; border-radius: 0.6rem; }
  .al-title, .al-body { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .al-title { font-size: 0.88rem; }
  .al-body { font-size: 0.74rem; }
  .al-go { min-height: 2.3rem; padding: 0 0.8rem; font-size: 0.88rem; }
  .al-x { width: 1.9rem; height: 2.3rem; }
  .al-perm { padding: 0.3rem 0.35rem 0.3rem 0.75rem; font-size: 0.78rem; }
  .al-perm button { min-height: 2.1rem; padding: 0 0.7rem; }
}
@media (prefers-reduced-motion: reduce) {
  .al-assigned .al-mark { animation: none; }
  .alert-enter-from, .alert-leave-to { transform: none; }
}

@media (max-width: 640px) {
  .pos-top { padding: 0.5rem 0.75rem; }
  .brand-logo { width: 2.2rem; height: 2.2rem; }
  .brand-venue { max-width: 42vw; }
  .clock, .theme-toggle { display: none; }
  .icon-btn { min-height: 2.5rem; min-width: 0; padding: 0 0.75rem; }
  .pos-dock { padding-top: 0.35rem; }
  .dock-item { min-height: 3.5rem; font-size: 0.75rem; }
}

.more-sheet {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(10, 16, 14, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 3.5rem 0.75rem 1rem;
}

.more-panel {
  width: min(22rem, 92vw);
  background: var(--mirestaurante-panel);
  color: var(--mirestaurante-ink);
  border-radius: 1rem;
  padding: 1rem;
  display: grid;
  gap: 0.4rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--mirestaurante-line);
}

.more-panel h3 {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.more-link {
  display: block;
  width: 100%;
  text-align: left;
  padding: 1rem 0.9rem;
  border-radius: 0.75rem;
  text-decoration: none;
  color: var(--mirestaurante-ink);
  font-weight: 600;
  font-size: 1.05rem;
  background: var(--mirestaurante-primary-soft);
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.more-link:hover,
.more-link:active {
  filter: brightness(0.97);
}

.theme-btn {
  background: color-mix(in srgb, var(--mirestaurante-accent) 18%, var(--mirestaurante-panel));
}

@media (min-width: 900px) {
  .pos-content {
    padding: 1rem 1.25rem;
  }
  .brand-venue {
    max-width: 20rem;
  }
}
</style>
