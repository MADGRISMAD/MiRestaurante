<template>
  <div class="platform">
    <header class="head">
      <div>
        <p class="brand">MiRestaurante Platform</p>
        <h1>Tenants</h1>
      </div>
      <button type="button" class="logout" @click="logout">Salir</button>
    </header>

    <p v-if="loading">Cargando…</p>
    <p v-else-if="err" class="err">{{ err }}</p>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Negocio</th>
            <th>Plan</th>
            <th>Estado</th>
            <th>Trial</th>
            <th>Users</th>
            <th>Creado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tenants" :key="t.id">
            <td>
              <strong>{{ t.name }}</strong>
              <div class="id">{{ t.id.slice(-8) }}</div>
            </td>
            <td>
              <select :value="t.plan" @change="changePlan(t, $event.target.value)">
                <option value="basic">Básico</option>
                <option value="pro">Pro</option>
              </select>
            </td>
            <td>
              <span class="pill" :class="t.billingStatus">{{ t.billingStatus }}</span>
            </td>
            <td>{{ formatDate(t.trialEndsAt) }}</td>
            <td>{{ t.usersCount }}</td>
            <td>{{ formatDate(t.createdAt) }}</td>
            <td class="actions">
              <button
                v-if="t.billingStatus !== 'suspended'"
                type="button"
                class="danger"
                @click="suspend(t)"
              >
                Suspender
              </button>
              <template v-else>
                <button type="button" @click="reactivate(t, 'active')">Activar</button>
                <button type="button" class="ghost" @click="reactivate(t, 'trial')">+14d trial</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!tenants.length" class="empty">No hay tenants aún.</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiService } from "../apiService";
import { clearSession } from "../authStore";

const router = useRouter();
const tenants = ref([]);
const loading = ref(true);
const err = ref("");

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-MX");
  } catch {
    return "—";
  }
}

async function load() {
  loading.value = true;
  err.value = "";
  try {
    tenants.value = await apiService.platformListTenants();
  } catch (e) {
    err.value = e.response?.data || "No se pudo cargar";
  } finally {
    loading.value = false;
  }
}

async function suspend(t) {
  const reason = prompt("Motivo de suspensión", "manual") || "manual";
  if (!confirm(`¿Suspender ${t.name}?`)) return;
  await apiService.platformSuspendTenant(t.id, reason);
  await load();
}

async function reactivate(t, mode) {
  await apiService.platformReactivateTenant(t.id, mode);
  await load();
}

async function changePlan(t, plan) {
  await apiService.platformSetPlan(t.id, plan);
  await load();
}

function logout() {
  clearSession();
  router.push("/login");
}

onMounted(load);
</script>

<style scoped>
.platform {
  min-height: 100vh;
  padding: 1.25rem;
  background: #0f1412;
  color: #f2f4f3;
  font-family: var(--font-sans, "Figtree", system-ui, sans-serif);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}
.brand {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #b8956c;
  font-weight: 700;
}
h1 {
  margin: 0.2rem 0 0;
  font-size: 1.75rem;
  font-family: var(--font-display, Georgia, serif);
}
.logout, .actions button, select {
  border: 1px solid #2a3530;
  background: #1a221f;
  color: #f2f4f3;
  border-radius: 0.55rem;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  font: inherit;
}
.logout { min-height: 2.5rem; }
.table-wrap { overflow: auto; border: 1px solid #2a3530; border-radius: 0.85rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
th, td { padding: 0.75rem 0.85rem; text-align: left; border-bottom: 1px solid #2a3530; vertical-align: middle; }
th { color: #9aa8a1; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
.id { font-size: 0.75rem; color: #7d8b84; margin-top: 0.15rem; }
.pill {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #24302b;
}
.pill.trialing { color: #7dd3a8; }
.pill.active { color: #6ee7b7; }
.pill.past_due { color: #fbbf24; }
.pill.suspended { color: #f87171; }
.actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.actions .danger { color: #fca5a5; border-color: #7f1d1d; }
.actions .ghost { opacity: 0.85; }
.err { color: #f87171; }
.empty { padding: 1.5rem; color: #9aa8a1; }
</style>
