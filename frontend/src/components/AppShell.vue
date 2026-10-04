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
        <span class="clock">{{ clock }}</span>
        <button
          type="button"
          class="icon-btn"
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
  cash: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>`,
};

const allDock = [
  { to: "/main", name: "main", label: "Mesas", icon: ico.tables },
  { to: "/menu", name: "menu", label: "Pedido", icon: ico.order },
  { to: "/kitchen", name: "kitchen", label: "Cocina", icon: ico.kitchen },
  { to: "/orders", name: "orders", label: "Caja", icon: ico.cash },
];

const allMore = [
  { to: "/dashboard", name: "dashboard", label: "Resumen / Dashboard" },
  { to: "/waitlist", name: "waitlist", label: "Lista de espera" },
  { to: "/staff", name: "staff", label: "Personal / Meseros" },
  { to: "/billing", name: "billing", label: "Facturación / Planes" },
  { to: "/settings", name: "settings", label: "Configuración" },
];

const dock = computed(() => allDock.filter((i) => canAccessRoute(i.name)));
const moreItems = computed(() => allMore.filter((i) => canAccessRoute(i.name)));

function logout() {
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
  flex-wrap: wrap;
  justify-content: flex-end;
}

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
  background: var(--mirestaurante-primary);
  color: var(--mirestaurante-on-primary);
  box-shadow: var(--mirestaurante-shadow);
}

.dock-ico {
  display: grid;
  place-items: center;
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
