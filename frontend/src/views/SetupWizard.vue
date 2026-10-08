<template>
  <div class="setup-shell">
    <div class="setup-atmosphere" aria-hidden="true"></div>

    <div class="setup-panel">
      <header class="setup-brand">
        <img src="/logo.svg" alt="MiRestaurante" class="setup-logo" />
        <div>
          <p class="setup-eyebrow">MiRestaurante</p>
          <h1 class="setup-title">Configura tu operación</h1>
        </div>
      </header>

      <div class="progress-track" role="progressbar" :aria-valuenow="step" aria-valuemin="1" aria-valuemax="4">
        <div class="progress-fill" :style="{ width: `${(step / 4) * 100}%` }"></div>
      </div>
      <p class="step-label">Paso {{ step }} de 4 — {{ stepTitles[step - 1] }}</p>

      <!-- Paso 1: Bienvenida -->
      <section v-if="step === 1" class="step-body">
        <h2>Bienvenido a MiRestaurante</h2>
        <p>
          Plataforma de gestión para restaurantes, cafés y hotelería.
          En unos minutos personalizas la marca de tu cliente y dejas el sistema listo para operar.
        </p>
        <ul class="feature-list">
          <li>Identidad visual del negocio</li>
          <li>Datos operativos editables</li>
          <li>Listo para múltiples clientes</li>
        </ul>
      </section>

      <!-- Paso 2: Negocio -->
      <section v-else-if="step === 2" class="step-body">
        <h2>Datos del negocio</h2>
        <p>Esta información se muestra en el panel y puede cambiarse después.</p>

        <label class="field">
          <span>Nombre del negocio</span>
          <input v-model="form.businessName" type="text" maxlength="80" placeholder="Ej. Casa Norte" />
        </label>

        <label class="field">
          <span>Tipo de establecimiento</span>
          <select v-model="form.businessType">
            <option value="restaurant">Restaurante</option>
            <option value="cafe">Café</option>
            <option value="bar">Bar</option>
            <option value="hotel">Hotel / Hostelería</option>
            <option value="other">Otro</option>
          </select>
        </label>

        <p v-if="isCafe" class="cafe-note">
          <strong>Modo Café (mostrador).</strong> Se pide, se cobra y se entrega en un solo paso, sin mesas, cocina ni
          meseros. Incluye hasta 2 personas: Administrador y Caja.
        </p>

        <label class="field">
          <span>Dirección <em>(opcional)</em></span>
          <input v-model="form.address" type="text" maxlength="200" placeholder="Calle, colonia, ciudad" />
        </label>

        <label class="field">
          <span>Teléfono <em>(opcional)</em></span>
          <input v-model="form.phone" type="tel" maxlength="30" placeholder="+52 ..." />
        </label>
      </section>

      <!-- Paso 3: Identidad -->
      <section v-else-if="step === 3" class="step-body">
        <h2>Logo del negocio</h2>
        <p>El sistema usa colores fijos (claro/oscuro). Aquí solo personalizas el logo del cliente.</p>

        <div class="identity-preview">
          <img :src="previewLogo" alt="Vista previa del logo" class="preview-logo" />
          <div>
            <p class="preview-name">{{ form.businessName || "Nombre del negocio" }}</p>
            <p class="preview-meta">{{ typeLabel }}</p>
          </div>
        </div>

        <label class="field">
          <span>Logo (URL)</span>
          <input v-model="form.logoUrl" type="url" placeholder="https://... o deja /logo.svg" />
        </label>

        <label class="field">
          <span>Subir logo</span>
          <input type="file" accept="image/*" @change="onLogoFile" />
        </label>
      </section>

      <!-- Paso 4: Operación -->
      <section v-else class="step-body">
        <h2>Preferencias operativas</h2>
        <p>Ajusta el punto de partida. Las mesas se pueden gestionar después desde el panel.</p>

        <label class="field">
          <span>Zona horaria</span>
          <select v-model="form.timezone">
            <option value="America/Mexico_City">Ciudad de México</option>
            <option value="America/Tijuana">Tijuana</option>
            <option value="America/Monterrey">Monterrey</option>
            <option value="America/Cancun">Cancún</option>
            <option value="America/Bogota">Bogotá</option>
            <option value="America/Lima">Lima</option>
            <option value="America/Santiago">Santiago</option>
            <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
            <option value="Europe/Madrid">Madrid</option>
          </select>
        </label>

        <label v-if="!isCafe" class="field">
          <span>Mesas iniciales (referencia)</span>
          <input v-model.number="form.initialTables" type="number" min="0" max="100" />
        </label>

        <div class="summary-card">
          <h3>Resumen</h3>
          <dl>
            <div><dt>Negocio</dt><dd>{{ form.businessName || "—" }}</dd></div>
            <div><dt>Tipo</dt><dd>{{ typeLabel }}</dd></div>
            <div><dt>Dirección</dt><dd>{{ form.address || "Sin definir" }}</dd></div>
            <div v-if="!isCafe"><dt>Mesas</dt><dd>{{ form.initialTables }}</dd></div>
            <div v-else><dt>Modo</dt><dd>Mostrador</dd></div>
          </dl>
        </div>

        <p v-if="error" class="error-text">{{ error }}</p>
      </section>

      <footer class="setup-actions">
        <button v-if="step > 1" type="button" class="btn-ghost" @click="prev" :disabled="saving">
          Atrás
        </button>
        <div class="spacer"></div>
        <button
          v-if="step < 4"
          type="button"
          class="btn-primary"
          @click="next"
          :disabled="!canContinue"
        >
          Continuar
        </button>
        <button
          v-else
          type="button"
          class="btn-primary"
          @click="finish"
          :disabled="saving || !canContinue"
        >
          {{ saving ? "Guardando…" : "Finalizar e ir al panel" }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { saveVenueSettings, venueStore } from "../venueStore";
import { homeForRole } from "../authStore";
import { modeForBusinessType } from "../roles";

const router = useRouter();
const step = ref(1);
const isCafe = computed(() => modeForBusinessType(form.businessType) === "counter");
const saving = ref(false);
const error = ref("");

const stepTitles = [
  "Bienvenida",
  "Negocio",
  "Identidad",
  "Operación",
];

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

const typeLabels = {
  restaurant: "Restaurante",
  cafe: "Café",
  bar: "Bar",
  hotel: "Hotel / Hostelería",
  other: "Otro",
};

const typeLabel = computed(() => typeLabels[form.businessType] || "Negocio");

const previewLogo = computed(() => form.logoUrl || "/logo.svg");

const canContinue = computed(() => {
  if (step.value === 2) return form.businessName.trim().length >= 2;
  if (step.value === 3) return true;
  if (step.value === 4) return form.initialTables >= 0;
  return true;
});

function next() {
  if (!canContinue.value) return;
  error.value = "";
  step.value = Math.min(4, step.value + 1);
}

function prev() {
  error.value = "";
  step.value = Math.max(1, step.value - 1);
}

function onLogoFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    error.value = "El logo debe pesar menos de 2 MB.";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    form.logoUrl = String(reader.result);
  };
  reader.readAsDataURL(file);
}

async function finish() {
  if (!canContinue.value) return;
  saving.value = true;
  error.value = "";
  try {
    await saveVenueSettings({ ...form });
    router.push({ name: homeForRole() });
  } catch (e) {
    error.value = e?.message || "No se pudo guardar la configuración. Intenta de nuevo.";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.cafe-note { margin: 0; padding: 0.75rem 0.9rem; border-radius: 0.8rem; background: var(--mirestaurante-primary-soft); color: var(--mirestaurante-ink); font-size: 0.9rem; line-height: 1.45; }
.setup-shell {
  --primary: var(--mirestaurante-primary);
  --accent: #9a7b52;
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  font-family: var(--font-sans);
  color: #1c1f1d;
}

.setup-atmosphere {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 10% 20%, rgba(196, 165, 116, 0.28), transparent 55%),
    radial-gradient(ellipse 70% 50% at 90% 80%, rgba(31, 77, 58, 0.35), transparent 50%),
    linear-gradient(160deg, #f3efe7 0%, #e4ebe4 45%, #d5ddd6 100%);
  animation: drift 14s ease-in-out infinite alternate;
}

@keyframes drift {
  from { filter: hue-rotate(0deg); transform: scale(1); }
  to { filter: hue-rotate(8deg); transform: scale(1.03); }
}

.setup-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 34rem;
  background: rgba(255, 252, 248, 0.92);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(31, 77, 58, 0.12);
  border-radius: 1.25rem;
  padding: 1.75rem 1.5rem 1.5rem;
  box-shadow: 0 24px 60px rgba(28, 40, 32, 0.12);
  animation: rise 0.55s ease-out;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.setup-brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1.25rem;
}

.setup-logo {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
}

.setup-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primary, #1f4d3a);
  font-weight: 600;
  margin: 0;
}

.setup-title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0.15rem 0 0;
  line-height: 1.25;
}

.progress-track {
  height: 0.35rem;
  background: rgba(31, 77, 58, 0.12);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary, #1f4d3a), var(--accent, #c4a574));
  transition: width 0.35s ease;
}

.step-label {
  margin: 0.6rem 0 1.1rem;
  font-size: 0.8rem;
  color: #5c675f;
}

.step-body h2 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 0.4rem;
}

.step-body > p {
  margin: 0 0 1rem;
  color: #4d5751;
  font-size: 0.95rem;
  line-height: 1.5;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.55rem;
}

.feature-list li {
  padding: 0.7rem 0.85rem;
  background: rgba(31, 77, 58, 0.06);
  border-left: 3px solid var(--accent, #c4a574);
  border-radius: 0 0.5rem 0.5rem 0;
  font-size: 0.92rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #3a433d;
}

.field em {
  font-style: normal;
  font-weight: 400;
  color: #7a857e;
}

.field input,
.field select {
  appearance: none;
  border: 1px solid #cdd5cf;
  border-radius: 0.55rem;
  padding: 0.7rem 0.8rem;
  font: inherit;
  background: #fff;
  color: #1c1f1d;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--primary, #1f4d3a);
  box-shadow: 0 0 0 3px rgba(31, 77, 58, 0.18);
}

.identity-preview {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.9rem;
  margin-bottom: 1rem;
  border-radius: 0.75rem;
  border: 2px solid var(--primary);
  background: #fff;
}

.preview-logo {
  width: 3rem;
  height: 3rem;
  object-fit: cover;
  border-radius: 0.6rem;
}

.preview-name {
  margin: 0;
  font-weight: 600;
}

.preview-meta {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: #66706a;
}

.color-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.color-input {
  height: 2.75rem;
  padding: 0.25rem !important;
  cursor: pointer;
}

.summary-card {
  margin-top: 0.5rem;
  padding: 0.9rem 1rem;
  border-radius: 0.75rem;
  background: rgba(31, 77, 58, 0.07);
}

.summary-card h3 {
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary, #1f4d3a);
}

.summary-card dl {
  margin: 0;
  display: grid;
  gap: 0.4rem;
}

.summary-card dl > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9rem;
}

.summary-card dt {
  color: #66706a;
}

.summary-card dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
}

.error-text {
  color: #b42318;
  font-size: 0.85rem;
  margin: 0.75rem 0 0;
}

.setup-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.35rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(31, 77, 58, 0.1);
}

.spacer {
  flex: 1;
}

.btn-primary,
.btn-ghost {
  border: none;
  border-radius: 0.55rem;
  padding: 0.7rem 1.1rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
}

.btn-primary {
  background: var(--primary, #1f4d3a);
  color: #f7f4ef;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  color: #3a433d;
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(31, 77, 58, 0.08);
}

@media (max-width: 480px) {
  .setup-panel {
    padding: 1.35rem 1.1rem;
  }

  .color-row {
    grid-template-columns: 1fr;
  }
}
</style>
