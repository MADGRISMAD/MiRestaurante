<template>
  <AppShell>
    <div class="billing">
      <header class="head">
        <h1>Facturación</h1>
        <p>Planes MiRestaurante con Mercado Pago · prueba de 14 días</p>
      </header>

      <div v-if="loading" class="card">Cargando…</div>
      <div v-else-if="err" class="card err">{{ err }}</div>
      <template v-else>
        <div class="card status" :class="{ warn: !status.active }">
          <p class="label">Estado</p>
          <p class="value">{{ statusLabel }}</p>
          <p v-if="status.billingStatus === 'trialing'" class="meta">
            Quedan <strong>{{ status.trialDaysLeft }}</strong> días de prueba
            <span v-if="status.trialEndsAt"> · hasta {{ formatDate(status.trialEndsAt) }}</span>
          </p>
          <p v-else-if="status.currentPeriodEnd" class="meta">
            Periodo hasta {{ formatDate(status.currentPeriodEnd) }}
          </p>
          <p class="meta">Plan actual: <strong>{{ planName(status.plan) }}</strong></p>
          <p v-if="!status.mpConfigured" class="hint">
            Modo desarrollo: Mercado Pago no configurado. Puedes activar un plan con el botón mock.
          </p>
        </div>

        <div class="plans">
          <article
            v-for="p in plans"
            :key="p.id"
            class="plan"
            :class="{ current: status.plan === p.id && status.active }"
          >
            <h2>{{ p.name }}</h2>
            <p class="price">${{ p.price }} <span>/ mes {{ p.currency }}</span></p>
            <p class="desc">{{ p.description }}</p>
            <button
              type="button"
              class="btn"
              :disabled="busy"
              @click="startCheckout(p.id)"
            >
              {{ status.mpConfigured ? 'Pagar con Mercado Pago' : 'Activar (mock)' }}
            </button>
          </article>
        </div>
      </template>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const busy = ref(false);
const err = ref("");
const status = ref({
  plan: "basic",
  billingStatus: "trialing",
  trialDaysLeft: 14,
  active: true,
  mpConfigured: false,
});
const plans = ref([]);

const statusLabel = computed(() => {
  const map = {
    trialing: "Prueba activa",
    active: "Suscripción activa",
    past_due: "Pago pendiente",
    suspended: "Cuenta suspendida",
  };
  return map[status.value.billingStatus] || status.value.billingStatus;
});

function planName(id) {
  return plans.value.find((p) => p.id === id)?.name || id;
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const [s, p] = await Promise.all([
      apiService.getBillingStatus(),
      apiService.getBillingPlans(),
    ]);
    status.value = s;
    plans.value = p.plans || [];
  } catch (e) {
    err.value = e.response?.data?.message || e.response?.data || "No se pudo cargar facturación";
  } finally {
    loading.value = false;
  }
}

async function startCheckout(plan) {
  busy.value = true;
  try {
    const res = await apiService.billingCheckout(plan);
    if (res.mock || !status.value.mpConfigured) {
      await apiService.billingDevActivate(plan, res.preapprovalId);
      await load();
      alert("Plan activado (modo desarrollo)");
      return;
    }
    const url = res.init_point || res.sandbox_init_point;
    if (url) window.location.href = url;
    else alert("No se recibió link de Mercado Pago");
  } catch (e) {
    alert(e.response?.data || "Error al iniciar pago");
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  await load();
  if (route.query.mock === "1" && route.query.plan) {
    try {
      await apiService.billingDevActivate(String(route.query.plan));
      await load();
      router.replace({ path: "/billing" });
    } catch {
      /* ignore */
    }
  }
});
</script>

<style scoped>
.billing { max-width: 52rem; margin: 0 auto; display: grid; gap: 1rem; }
.head h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.65rem;
  letter-spacing: -0.02em;
}
.head p { margin: 0.25rem 0 0; color: var(--mirestaurante-muted); }
.card {
  background: var(--mirestaurante-panel);
  border: 1px solid var(--mirestaurante-line);
  border-radius: 1rem;
  padding: 1rem 1.1rem;
}
.card.warn { border-color: color-mix(in srgb, var(--mirestaurante-danger) 45%, var(--mirestaurante-line)); }
.card.err { color: var(--mirestaurante-danger); }
.label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--mirestaurante-muted);
}
.value {
  margin: 0.2rem 0;
  font-size: 1.35rem;
  font-weight: 700;
  font-family: var(--font-display);
}
.meta { margin: 0.25rem 0 0; color: var(--mirestaurante-muted); font-size: 0.95rem; }
.hint {
  margin: 0.65rem 0 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.6rem;
  background: var(--mirestaurante-surface);
  font-size: 0.88rem;
}
.plans {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
}
.plan {
  background: var(--mirestaurante-panel);
  border: 1px solid var(--mirestaurante-line);
  border-radius: 1rem;
  padding: 1.1rem;
  display: grid;
  gap: 0.45rem;
}
.plan.current { outline: 2px solid var(--mirestaurante-primary); }
.plan h2 { margin: 0; font-family: var(--font-display); font-size: 1.25rem; }
.price {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
}
.price span { font-size: 0.85rem; font-weight: 600; color: var(--mirestaurante-muted); }
.desc { margin: 0; color: var(--mirestaurante-muted); font-size: 0.92rem; min-height: 2.6rem; }
.btn {
  margin-top: 0.35rem;
  min-height: 3rem;
  border: none;
  border-radius: 0.8rem;
  background: var(--mirestaurante-primary);
  color: var(--mirestaurante-on-primary);
  font-weight: 700;
  cursor: pointer;
}
.btn:disabled { opacity: 0.6; cursor: wait; }
</style>
