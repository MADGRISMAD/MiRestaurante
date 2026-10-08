<template>
  <AppShell>
    <div class="settings">
      <div class="tabs">
        <button v-for="t in tabs" :key="t.id" type="button" :class="{ active: tab === t.id }" @click="tab = t.id">
          {{ t.label }}
        </button>
      </div>

      <section v-if="tab === 'brand'" class="panel">
        <h2>Negocio y marca</h2>
        <div class="form-grid">
          <label>Nombre<input v-model="form.businessName" /></label>
          <label>Tipo
            <select v-model="form.businessType">
              <option value="restaurant">Restaurante</option>
              <option value="cafe">Café</option>
              <option value="bar">Bar</option>
              <option value="hotel">Hotel</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <p v-if="form.businessType === 'cafe'" class="hint cafe-note">
            <strong>Modo Café (mostrador):</strong> se pide, se cobra y se entrega en un solo paso, sin mesas ni cocina.
            Incluye hasta 2 personas (Administrador y Caja).
          </p>
          <label>Dirección<input v-model="form.address" /></label>
          <label>Teléfono<input v-model="form.phone" /></label>
          <label>Logo URL<input v-model="form.logoUrl" /></label>
          <label>Zona horaria
            <select v-model="form.timezone">
              <option value="America/Mexico_City">Ciudad de México</option>
              <option value="America/Tijuana">Tijuana</option>
              <option value="America/Monterrey">Monterrey</option>
              <option value="America/Bogota">Bogotá</option>
              <option value="Europe/Madrid">Madrid</option>
            </select>
          </label>
        </div>
        <button type="button" class="btn-primary" :disabled="saving" @click="saveBrand">
          {{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </button>
        <p v-if="message" class="ok">{{ message }}</p>
      </section>

      <section v-else-if="tab === 'appearance'" class="panel">
        <h2>Apariencia</h2>
        <p class="hint">Paleta MiRestaurante fija (verde bosque + acento bronce). Solo eliges claro u oscuro.</p>
        <div class="theme-switch" role="group" aria-label="Tema de interfaz">
          <button type="button" :class="{ on: !isDark }" @click="setLight">
            <span class="theme-ico" aria-hidden="true">☀</span>
            Claro
          </button>
          <button type="button" :class="{ on: isDark }" @click="setDark">
            <span class="theme-ico" aria-hidden="true">☾</span>
            Oscuro
          </button>
        </div>
        <div class="swatch-row" aria-hidden="true">
          <span class="swatch primary" />
          <span class="swatch accent" />
          <span class="swatch surface" />
          <span class="swatch ink" />
        </div>
      </section>

      <section v-else-if="tab === 'team'" class="panel">
        <h2>Invitar al equipo</h2>
        <p class="hint">Se envía un correo con enlace para unirse. ¿Sin correo? Crea la cuenta directo en <router-link to="/team">Equipo y roles</router-link>.</p>
        <form class="invite-form" @submit.prevent="sendInvite">
          <label>Correo<input v-model="invite.email" type="email" required placeholder="persona@negocio.com" /></label>
          <label>Rol
            <select v-model="invite.role">
              <option v-for="r in ROLE_DEFS" :key="r.id" :value="r.id">{{ r.label }}</option>
            </select>
          </label>
          <button type="submit" class="btn-primary" :disabled="inviting">{{ inviting ? 'Enviando…' : 'Enviar invitación' }}</button>
        </form>
        <p v-if="inviteMsg" class="ok">{{ inviteMsg }}</p>
        <p v-if="inviteErr" class="err">{{ inviteErr }}</p>

        <h3>Invitaciones</h3>
        <ul class="invite-list">
          <li v-for="i in invites" :key="i.id">
            <div>
              <strong>{{ i.email }}</strong>
              <span class="meta">{{ roleText(i.role) }} · {{ inviteText(i.status) }}</span>
            </div>
            <div class="row-actions">
              <button v-if="i.status === 'pending'" type="button" @click="revoke(i)">Revocar</button>
              <button type="button" class="danger" @click="removeInvite(i)">Eliminar</button>
            </div>
          </li>
          <li v-if="!invites.length" class="empty">Sin invitaciones aún.</li>
        </ul>
      </section>

      <section v-else class="panel">
        <h2>Preferencias</h2>
        <p class="hint">Mesas iniciales de referencia (no crea mesas automáticamente).</p>
        <label v-if="form.businessType !== 'cafe'">Mesas iniciales<input v-model.number="form.initialTables" type="number" min="0" max="100" /></label>
        <p v-else class="hint">El modo Café no usa mesas: se vende desde el Mostrador.</p>
        <button type="button" class="btn-primary" @click="saveBrand">Guardar</button>
        <router-link to="/setup" class="link">Volver a ejecutar el wizard de configuración</router-link>
      </section>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from "vue";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";
import { saveVenueSettings, venueStore } from "../venueStore";
import { themeStore, applyUiTheme } from "../themeStore";
import { inviteStatusLabel, labelOf, roleLabel } from "../labels";
import { ROLE_DEFS } from "../roles";

const tab = ref("brand");
const tabs = [
  { id: "brand", label: "Negocio / Marca" },
  { id: "appearance", label: "Apariencia" },
  { id: "team", label: "Equipo" },
  { id: "prefs", label: "Preferencias" },
];

const isDark = computed(() => themeStore.mode === "dark");
function setLight() { applyUiTheme("light"); }
function setDark() { applyUiTheme("dark"); }
function inviteText(s) { return labelOf(inviteStatusLabel, s); }
function roleText(r) { return labelOf(roleLabel, r); }

const form = reactive({
  businessName: venueStore.businessName || "",
  businessType: venueStore.businessType || "restaurant",
  address: venueStore.address || "",
  phone: venueStore.phone || "",
  logoUrl: venueStore.logoUrl || "/logo.svg",
  primaryColor: venueStore.primaryColor || "#1F4D3A",
  accentColor: venueStore.accentColor || "#C4A574",
  timezone: venueStore.timezone || "America/Mexico_City",
  initialTables: venueStore.initialTables || 8,
});

const saving = ref(false);
const message = ref("");
const invites = ref([]);
const inviting = ref(false);
const inviteMsg = ref("");
const inviteErr = ref("");
const invite = reactive({ email: "", role: "waiter" });

async function saveBrand() {
  saving.value = true;
  message.value = "";
  try {
    await saveVenueSettings({ ...form });
    message.value = "Configuración guardada.";
  } catch (e) {
    // El servidor puede rechazar el cambio con una razón clara (p. ej. el equipo no cabe en modo Café)
    message.value = e?.message || "No se pudo guardar.";
  } finally {
    saving.value = false;
  }
}

async function loadInvites() {
  try {
    invites.value = (await apiService.getInvites()) || [];
  } catch {
    invites.value = [];
  }
}

async function sendInvite() {
  inviting.value = true;
  inviteMsg.value = "";
  inviteErr.value = "";
  try {
    const res = await apiService.createInvite({ email: invite.email, role: invite.role });
    inviteMsg.value = res.mail?.fallback
      ? "Invitación creada. Revisa la consola del backend (SMTP no configurado)."
      : "Invitación enviada por correo.";
    invite.email = "";
    await loadInvites();
  } catch (e) {
    inviteErr.value = e.response?.data || "No se pudo enviar la invitación.";
  } finally {
    inviting.value = false;
  }
}

async function revoke(i) {
  await apiService.revokeInvite(i.id);
  await loadInvites();
}

async function removeInvite(i) {
  if (!confirm("¿Eliminar invitación?")) return;
  await apiService.deleteInvite(i.id);
  await loadInvites();
}

onMounted(loadInvites);
</script>

<style scoped>
.cafe-note { grid-column: 1 / -1; margin: 0; padding: 0.7rem 0.9rem; border-radius: 0.8rem; background: var(--mirestaurante-primary-soft); color: var(--mirestaurante-ink); }
.settings { animation: t-fade-up .45s ease both; }
.tabs { display:flex; gap:.45rem; margin-bottom:1.1rem; flex-wrap:wrap; }
.tabs button { border:1px solid var(--mirestaurante-line); background:var(--mirestaurante-panel-elevated); color:var(--mirestaurante-ink); border-radius:999px; padding:.45rem .9rem; cursor:pointer; font-size:.85rem; font-weight:600; }
.tabs button.active { background:var(--mirestaurante-primary); color:var(--mirestaurante-on-primary); border-color:transparent; }
.panel { background:var(--mirestaurante-panel); border:1px solid var(--mirestaurante-line); border-radius:1.15rem; padding:1.3rem; box-shadow:var(--mirestaurante-shadow); }
.panel h2 { margin:0 0 .75rem; font-family:var(--font-display); font-size:1.35rem; font-weight:700; letter-spacing:-0.01em; }
.panel h3 { margin:1.25rem 0 .6rem; font-size:.95rem; }
.hint { color:var(--mirestaurante-muted); font-size:.9rem; margin:0 0 .9rem; line-height:1.45; }
.theme-switch {
  display: flex;
  gap: 0.5rem;
  background: var(--mirestaurante-surface);
  padding: 0.35rem;
  border-radius: 0.9rem;
  border: 1px solid var(--mirestaurante-line);
  max-width: 22rem;
}
.theme-switch button {
  flex: 1;
  min-height: 3rem;
  border: none;
  border-radius: 0.7rem;
  background: transparent;
  color: var(--mirestaurante-ink);
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
.theme-switch button.on {
  background: var(--mirestaurante-primary);
  color: var(--mirestaurante-on-primary);
}
.theme-ico { font-size: 1.05rem; line-height: 1; }
.swatch-row {
  display: flex;
  gap: 0.45rem;
  margin-top: 1rem;
}
.swatch {
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 0.45rem;
  border: 1px solid var(--mirestaurante-line);
}
.swatch.primary { background: var(--mirestaurante-primary); }
.swatch.accent { background: var(--mirestaurante-accent); }
.swatch.surface { background: var(--mirestaurante-surface); }
.swatch.ink { background: var(--mirestaurante-ink); }
.form-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(14rem,1fr)); gap:.8rem; margin-bottom:1rem; }
label { display:grid; gap:.3rem; font-size:.85rem; font-weight:500; }
input, select { border:1px solid var(--mirestaurante-line); border-radius:.65rem; padding:.65rem .75rem; font:inherit; background:var(--mirestaurante-panel-elevated); color:var(--mirestaurante-ink); }
.btn-primary { background:var(--mirestaurante-primary); color:var(--mirestaurante-on-primary); border:none; border-radius:.7rem; padding:.65rem 1.05rem; font-weight:600; cursor:pointer; box-shadow:var(--mirestaurante-shadow); }
.ok { color:var(--mirestaurante-success); font-size:.88rem; }
.err { color:var(--mirestaurante-danger); font-size:.88rem; }
.invite-form { display:grid; grid-template-columns:1.4fr .8fr auto; gap:.65rem; align-items:end; margin-bottom:.85rem; }
.invite-list { list-style:none; margin:0; padding:0; }
.invite-list li { display:flex; justify-content:space-between; gap:1rem; padding:.75rem 0; border-bottom:1px solid var(--mirestaurante-line); }
.meta { display:block; font-size:.8rem; color:var(--mirestaurante-muted); }
.row-actions { display:flex; gap:.35rem; }
.row-actions button { border:1px solid var(--mirestaurante-line); background:var(--mirestaurante-panel-elevated); color:var(--mirestaurante-ink); border-radius:.55rem; padding:.4rem .6rem; cursor:pointer; font-size:.78rem; font-weight:600; }
.danger { color:var(--mirestaurante-danger); }
.link { display:inline-block; margin-top:1rem; color:var(--mirestaurante-primary); font-weight:600; }
.empty { color:var(--mirestaurante-muted); }
@media (max-width:720px) { .invite-form { grid-template-columns:1fr; } }
</style>
