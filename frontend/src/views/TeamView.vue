<template>
  <AppShell>
    <div class="team-page">
      <div class="toolbar">
        <p>Crea las cuentas de tu equipo y elige qué pantallas ve cada persona.</p>
        <button type="button" class="btn-primary" @click="openCreate">+ Nueva cuenta</button>
      </div>

      <p v-if="error" class="banner err" role="alert">{{ error }}</p>
      <p v-if="notice" class="banner ok" role="status">{{ notice }}</p>

      <section aria-labelledby="members-title">
        <h2 id="members-title" class="section-title">Cuentas</h2>
        <div class="grid">
          <article v-for="m in members" :key="m.id" class="card">
            <div class="card-head">
              <div class="who">
                <h3>{{ m.name }} {{ m.lastName }}</h3>
                <p class="handle">@{{ m.username }}<span v-if="isMe(m)" class="me">tú</span></p>
              </div>
              <span class="role-badge" :class="`r-${m.role}`">{{ roleText(m.role) }}</span>
            </div>
            <p v-if="m.email" class="meta">{{ m.email }}</p>
            <p v-if="m.cellphone" class="meta">Cel. {{ m.cellphone }}</p>

            <label class="role-select">
              Rol
              <select :value="m.role" :disabled="isMe(m) || busyId === m.id" @change="changeRole(m, $event.target.value)">
                <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.label }}</option>
              </select>
            </label>

            <div class="actions">
              <button type="button" @click="openPassword(m)">Cambiar contraseña</button>
              <button type="button" class="danger" :disabled="isMe(m)" @click="remove(m)">Eliminar</button>
            </div>
          </article>
          <p v-if="!members.length && !loading" class="empty">Aún no hay cuentas.</p>
        </div>
      </section>

      <section aria-labelledby="roles-title" class="roles-section">
        <h2 id="roles-title" class="section-title">Qué ve cada rol</h2>
        <div class="roles-grid">
          <article v-for="r in roles" :key="r.id" class="role-card">
            <span class="role-badge" :class="`r-${r.id}`">{{ r.label }}</span>
            <p>{{ r.description }}</p>
            <ul>
              <li v-for="s in r.sees" :key="s">{{ s }}</li>
            </ul>
            <p class="home-note">Entra directo a: <strong>{{ homeLabel(r.id) }}</strong></p>
          </article>
        </div>
        <p class="invite-note">
          ¿Prefieres invitar por correo? Usa
          <router-link to="/settings">Configuración → Equipo</router-link>.
        </p>
      </section>

      <Teleport to="body">
        <!-- Nueva cuenta -->
        <div v-if="showCreate" class="modal-bg" @click.self="showCreate = false">
          <form class="modal" @submit.prevent="create" role="dialog" aria-modal="true" aria-labelledby="team-create-title">
            <h3 id="team-create-title">Nueva cuenta</h3>
            <div class="modal-body">
              <div class="two">
                <label>Nombre<input v-model="form.name" required autocomplete="off" /></label>
                <label>Apellido<input v-model="form.lastName" required autocomplete="off" /></label>
              </div>
              <label>Usuario
                <input v-model="form.username" required minlength="3" maxlength="30" autocapitalize="none" autocomplete="off" placeholder="p. ej. luis.cocina" />
              </label>
              <label>Contraseña
                <span class="pw-row">
                  <input v-model="form.password" :type="showPw ? 'text' : 'password'" required minlength="8" autocomplete="new-password" />
                  <button type="button" class="mini" @click="showPw = !showPw">{{ showPw ? 'Ocultar' : 'Ver' }}</button>
                  <button type="button" class="mini" @click="form.password = generatePassword(); showPw = true">Generar</button>
                </span>
              </label>

              <fieldset class="role-pick">
                <legend>Rol</legend>
                <label v-for="r in roles" :key="r.id" class="role-opt" :class="{ on: form.role === r.id }">
                  <input v-model="form.role" type="radio" name="role" :value="r.id" />
                  <span class="opt-title">{{ r.label }}</span>
                  <span class="opt-desc">{{ r.sees.join(' · ') }}</span>
                </label>
              </fieldset>

              <label v-if="form.role === 'waiter'">Celular (10 dígitos, obligatorio para meseros)
                <input v-model="form.cellphone" maxlength="10" pattern="\d{10}" inputmode="numeric" required />
              </label>
              <label v-else>Celular (opcional)
                <input v-model="form.cellphone" maxlength="10" pattern="\d{10}" inputmode="numeric" />
              </label>
              <label>Correo (opcional)
                <input v-model="form.email" type="email" autocomplete="off" placeholder="sirve para recuperar la contraseña" />
              </label>
            </div>
            <p v-if="formError" class="banner err">{{ formError }}</p>
            <div class="modal-actions">
              <button type="button" @click="showCreate = false">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Creando…' : 'Crear cuenta' }}</button>
            </div>
          </form>
        </div>

        <!-- Datos para entregar -->
        <div v-if="created" class="modal-bg" @click.self="created = null">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="team-done-title">
            <h3 id="team-done-title">Cuenta creada</h3>
            <div class="modal-body">
              <p class="hint">Entrégale estos datos a <strong>{{ created.name }}</strong>. La contraseña no se vuelve a mostrar.</p>
              <dl class="creds">
                <dt>Entrar en</dt><dd>{{ loginUrl }}</dd>
                <dt>Usuario</dt><dd>{{ created.username }}</dd>
                <dt>Contraseña</dt><dd>{{ created.password }}</dd>
                <dt>Rol</dt><dd>{{ roleText(created.role) }}</dd>
              </dl>
            </div>
            <div class="modal-actions">
              <button type="button" @click="copyCreds">{{ copied ? '¡Copiado!' : 'Copiar datos' }}</button>
              <button type="button" class="btn-primary" @click="created = null">Listo</button>
            </div>
          </div>
        </div>

        <!-- Cambiar contraseña -->
        <div v-if="pwTarget" class="modal-bg" @click.self="pwTarget = null">
          <form class="modal" @submit.prevent="savePassword" role="dialog" aria-modal="true" aria-labelledby="team-pw-title">
            <h3 id="team-pw-title">Nueva contraseña para {{ pwTarget.name }}</h3>
            <div class="modal-body">
              <label>Contraseña
                <span class="pw-row">
                  <input v-model="newPassword" :type="showPw ? 'text' : 'password'" required minlength="8" autocomplete="new-password" />
                  <button type="button" class="mini" @click="showPw = !showPw">{{ showPw ? 'Ocultar' : 'Ver' }}</button>
                  <button type="button" class="mini" @click="newPassword = generatePassword(); showPw = true">Generar</button>
                </span>
              </label>
            </div>
            <p v-if="formError" class="banner err">{{ formError }}</p>
            <div class="modal-actions">
              <button type="button" @click="pwTarget = null">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
            </div>
          </form>
        </div>
      </Teleport>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AppShell from "../components/AppShell.vue";
import { apiService } from "../apiService";
import { authStore } from "../authStore";
import { ROLE_DEFS, SCREENS, roleHome, roleLabel } from "../roles";

const members = ref([]);
const roles = ref(ROLE_DEFS);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const notice = ref("");
const formError = ref("");
const busyId = ref("");

const showCreate = ref(false);
const showPw = ref(false);
const created = ref(null);
const copied = ref(false);
const pwTarget = ref(null);
const newPassword = ref("");

const emptyForm = () => ({ name: "", lastName: "", username: "", password: "", role: "waiter", cellphone: "", email: "" });
const form = reactive(emptyForm());

const loginUrl = computed(() => `${window.location.origin}/login`);

const isMe = (m) => m.username === authStore.username;
const roleText = (r) => roleLabel[r] || r;
const homeLabel = (roleId) => SCREENS.find((s) => s.name === roleHome[roleId])?.label || "Mesas";

/** Contraseña legible: sin caracteres que se confunden (0/O, 1/l/I). */
function generatePassword(len = 10) {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function message(e, fallback) {
  const d = e?.response?.data;
  return typeof d === "string" && d ? d : fallback;
}

function flash(text) {
  notice.value = text;
  setTimeout(() => { if (notice.value === text) notice.value = ""; }, 4000);
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await apiService.getTeam();
    members.value = data.members || [];
    if (data.roles?.length) roles.value = data.roles.map((r) => ({ ...ROLE_DEFS.find((d) => d.id === r.id), ...r }));
  } catch (e) {
    error.value = message(e, "No se pudo cargar el equipo.");
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, emptyForm());
  formError.value = "";
  showPw.value = false;
  showCreate.value = true;
}

async function create() {
  saving.value = true;
  formError.value = "";
  try {
    const payload = { ...form };
    if (!payload.email) delete payload.email;
    if (!payload.cellphone) delete payload.cellphone;
    const member = await apiService.createTeamMember(payload);
    members.value = [...members.value, member];
    created.value = { ...member, password: form.password };
    copied.value = false;
    showCreate.value = false;
  } catch (e) {
    formError.value = message(e, "No se pudo crear la cuenta.");
  } finally {
    saving.value = false;
  }
}

async function copyCreds() {
  const c = created.value;
  const text = `MiRestaurante\nEntrar en: ${loginUrl.value}\nUsuario: ${c.username}\nContraseña: ${c.password}`;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

async function changeRole(m, role) {
  if (role === m.role) return;
  busyId.value = m.id;
  error.value = "";
  try {
    const updated = await apiService.changeTeamRole(m.id, role);
    m.role = updated.role;
    flash(`${m.name} ahora es ${roleText(updated.role)}.`);
  } catch (e) {
    error.value = message(e, "No se pudo cambiar el rol.");
    await load();
  } finally {
    busyId.value = "";
  }
}

function openPassword(m) {
  pwTarget.value = m;
  newPassword.value = "";
  formError.value = "";
  showPw.value = false;
}

async function savePassword() {
  saving.value = true;
  formError.value = "";
  try {
    await apiService.resetTeamPassword(pwTarget.value.id, newPassword.value);
    flash(`Contraseña de ${pwTarget.value.name} actualizada.`);
    pwTarget.value = null;
  } catch (e) {
    formError.value = message(e, "No se pudo cambiar la contraseña.");
  } finally {
    saving.value = false;
  }
}

async function remove(m) {
  if (!confirm(`¿Eliminar la cuenta de ${m.name} ${m.lastName}? Ya no podrá entrar.`)) return;
  error.value = "";
  try {
    await apiService.deleteTeamMember(m.id);
    members.value = members.value.filter((x) => x.id !== m.id);
    flash("Cuenta eliminada.");
  } catch (e) {
    error.value = message(e, "No se pudo eliminar la cuenta.");
  }
}

onMounted(load);
</script>

<style scoped>
.team-page { animation: t-fade-up .45s ease both; display: grid; gap: 1.6rem; }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.toolbar p { margin: 0; color: var(--mirestaurante-muted); }
.section-title { margin: 0 0 .8rem; font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; color: var(--mirestaurante-ink); }
.btn-primary { background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); border: none; border-radius: .7rem; padding: .65rem 1.05rem; font-weight: 600; cursor: pointer; box-shadow: var(--mirestaurante-shadow); }
.btn-primary:disabled { opacity: .65; cursor: wait; }

.banner { margin: 0; padding: .65rem .9rem; border-radius: .7rem; font-size: .9rem; font-weight: 600; }
.banner.err { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }
.banner.ok { background: var(--mirestaurante-success-soft); color: var(--mirestaurante-success); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 1rem; }
.card { background: var(--mirestaurante-panel); border: 1px solid var(--mirestaurante-line); border-radius: 1.1rem; padding: 1.1rem; box-shadow: var(--mirestaurante-shadow); color: var(--mirestaurante-ink); display: grid; gap: .5rem; align-content: start; }
.card-head { display: flex; justify-content: space-between; gap: .5rem; align-items: start; }
.card h3 { margin: 0; font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; }
.handle { margin: .15rem 0 0; font-size: .85rem; color: var(--mirestaurante-muted); }
.me { margin-left: .4rem; padding: .05rem .4rem; border-radius: 999px; background: var(--mirestaurante-primary-soft); color: var(--mirestaurante-primary); font-size: .7rem; font-weight: 700; }
.meta { margin: 0; font-size: .85rem; color: var(--mirestaurante-muted); overflow-wrap: anywhere; }

.role-badge { display: inline-flex; align-items: center; height: 1.7rem; padding: 0 .75rem; border-radius: 999px; font-size: .75rem; font-weight: 700; white-space: nowrap; background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); }
.r-admin { background: var(--mirestaurante-primary-soft); color: var(--mirestaurante-primary); }
.r-waiter { background: var(--mirestaurante-warning-soft); color: var(--mirestaurante-warning); }
.r-kitchen { background: var(--mirestaurante-danger-soft); color: var(--mirestaurante-danger); }
.r-cashier { background: var(--mirestaurante-success-soft); color: var(--mirestaurante-success); }
.r-host { background: var(--mirestaurante-surface); color: var(--mirestaurante-accent); border: 1px solid var(--mirestaurante-line); }

.role-select { display: grid; gap: .25rem; font-size: .8rem; font-weight: 600; color: var(--mirestaurante-muted); margin-top: .25rem; }
.role-select select { min-height: 2.6rem; border: 1px solid var(--mirestaurante-line); border-radius: .6rem; padding: .4rem .6rem; font: inherit; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); }
.role-select select:disabled { opacity: .6; }

.actions { display: flex; gap: .45rem; margin-top: .4rem; flex-wrap: wrap; }
.actions button { border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); border-radius: .6rem; padding: .5rem .75rem; cursor: pointer; font-size: .8rem; font-weight: 600; }
.actions .danger { color: var(--mirestaurante-danger); border-color: color-mix(in srgb, var(--mirestaurante-danger) 35%, transparent); }
.actions button:disabled { opacity: .45; cursor: not-allowed; }
.empty { color: var(--mirestaurante-muted); }

.roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: .9rem; }
.role-card { background: var(--mirestaurante-panel); border: 1px solid var(--mirestaurante-line); border-radius: 1rem; padding: 1rem; color: var(--mirestaurante-ink); display: grid; gap: .5rem; align-content: start; }
.role-card p { margin: 0; font-size: .88rem; color: var(--mirestaurante-muted); }
.role-card ul { margin: 0; padding-left: 1.1rem; font-size: .88rem; display: grid; gap: .15rem; }
.role-card .home-note { font-size: .8rem; }
.role-card .home-note strong { color: var(--mirestaurante-ink); }
.invite-note { margin: .9rem 0 0; font-size: .88rem; color: var(--mirestaurante-muted); }
.invite-note a { color: var(--mirestaurante-primary); font-weight: 600; }

.modal-bg { position: fixed; inset: 0; z-index: 200; background: rgba(10, 16, 14, 0.55); backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; padding: .75rem; padding-bottom: calc(.75rem + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
.modal { background: var(--mirestaurante-panel); color: var(--mirestaurante-ink); border-radius: 1.15rem 1.15rem .85rem .85rem; padding: 1.15rem 1.15rem .85rem; width: min(28rem, 100%); max-height: min(92dvh, 44rem); display: flex; flex-direction: column; gap: .75rem; border: 1px solid var(--mirestaurante-line); box-shadow: 0 -8px 32px rgba(0, 0, 0, .22); overflow: hidden; }
.modal h3 { margin: 0; flex-shrink: 0; font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; letter-spacing: -0.01em; }
.modal-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: .75rem; overflow-x: hidden; overflow-y: auto; min-height: 0; padding-right: .15rem; -webkit-overflow-scrolling: touch; }
.modal label { display: grid; grid-template-columns: minmax(0, 1fr); gap: .3rem; font-size: .88rem; font-weight: 600; min-width: 0; }
.modal input:not([type="radio"]) { min-height: 3rem; border: 1px solid var(--mirestaurante-line); border-radius: .7rem; padding: .65rem .8rem; font: inherit; background: var(--mirestaurante-panel-elevated); color: var(--mirestaurante-ink); min-width: 0; width: 100%; box-sizing: border-box; }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; }
.pw-row { display: flex; gap: .4rem; align-items: stretch; }
.pw-row input { flex: 1; min-width: 0; }
.mini { flex-shrink: 0; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); border-radius: .6rem; padding: 0 .7rem; font-size: .8rem; font-weight: 700; cursor: pointer; }

.role-pick { border: 0; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: .45rem; min-width: 0; }
.role-pick legend { font-size: .88rem; font-weight: 600; padding: 0; margin-bottom: .35rem; }
.role-opt { position: relative; display: grid; gap: .1rem; border: 1.5px solid var(--mirestaurante-line); border-radius: .8rem; padding: .6rem .8rem; cursor: pointer; background: var(--mirestaurante-panel-elevated); }
.role-opt input { position: absolute; opacity: 0; pointer-events: none; }
.role-opt.on { border-color: var(--mirestaurante-primary); background: var(--mirestaurante-primary-soft); }
.role-opt:focus-within { outline: 2px solid var(--mirestaurante-primary); outline-offset: 2px; }
.opt-title { font-weight: 700; }
.opt-desc { font-size: .8rem; font-weight: 500; color: var(--mirestaurante-muted); overflow-wrap: anywhere; }

.hint { margin: 0; color: var(--mirestaurante-muted); font-size: .9rem; }
.creds { display: grid; grid-template-columns: auto 1fr; gap: .45rem .9rem; margin: 0; padding: .9rem; border-radius: .8rem; background: var(--mirestaurante-surface); font-size: .95rem; }
.creds dt { color: var(--mirestaurante-muted); font-weight: 600; }
.creds dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.modal-actions { flex-shrink: 0; display: grid; grid-template-columns: 1fr 1.2fr; gap: .55rem; padding-top: .25rem; padding-bottom: env(safe-area-inset-bottom, 0px); border-top: 1px solid var(--mirestaurante-line); margin-top: .15rem; }
.modal-actions button { min-height: 3.15rem; border-radius: .85rem; border: 1px solid var(--mirestaurante-line); background: var(--mirestaurante-surface); color: var(--mirestaurante-ink); font-weight: 700; font-size: 1rem; cursor: pointer; }
.modal-actions .btn-primary { border: none; background: var(--mirestaurante-primary); color: var(--mirestaurante-on-primary); box-shadow: var(--mirestaurante-shadow); }

@media (min-width: 720px) {
  .modal-bg { align-items: center; padding: 1.5rem; }
  .modal { border-radius: 1.15rem; }
}
</style>
