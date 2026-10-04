<template>
  <div class="auth-shell">
    <div class="auth-atmosphere" aria-hidden="true"></div>

    <div class="auth-panel">
      <div class="brand-block">
        <img src="/logo.svg" alt="MiRestaurante" class="brand-logo" />
        <h1 class="brand-name">MiRestaurante</h1>
        <p class="brand-tagline">Gestión de salón para tu negocio</p>
      </div>

      <h2 class="auth-heading">Ingresar</h2>
      <form @submit.prevent="login" class="auth-form">
        <label class="field">
          <span>Usuario o correo</span>
          <input v-model="username" type="text" placeholder="tu@negocio.com" required />
        </label>
        <label class="field">
          <span>Contraseña</span>
          <input v-model="password" type="password" placeholder="••••••••" required />
        </label>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
        <p v-if="error" class="error-text">{{ error }}</p>
      </form>

      <router-link to="/forgot" class="auth-link">¿Olvidaste tu contraseña?</router-link>
      <router-link to="/register" class="auth-link">¿No tienes cuenta? Regístrate</router-link>
    </div>
  </div>
</template>

<script>
import { apiService } from "../apiService";
import { setSession, homeForRole } from "../authStore";
import { fetchVenueSettings, isSetupComplete } from "../venueStore";

export default {
  data() {
    return {
      username: "",
      password: "",
      error: "",
      loading: false,
    };
  },
  methods: {
    async login() {
      this.error = "";
      this.loading = true;
      try {
        const res = await apiService.login(this.username, this.password);
        setSession({
          token: res.token,
          role: res.role,
          tenantId: res.tenantId,
          username: res.username,
        });
        await fetchVenueSettings();
        if (res.role === "admin" && !isSetupComplete()) {
          this.$router.push("/setup");
        } else {
          this.$router.push({ name: homeForRole(res.role) });
        }
      } catch (e) {
        this.error = typeof e.response?.data === "string" ? e.response.data : "Usuario o contraseña incorrectos";
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.auth-shell {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  font-family: var(--font-sans);
}
.auth-atmosphere {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 12% 18%, rgba(184, 149, 108, 0.32), transparent 55%),
    radial-gradient(ellipse 55% 40% at 88% 78%, rgba(208, 55, 31, 0.28), transparent 50%),
    linear-gradient(155deg, #1c1a17 0%, #272420 45%, #2e2a25 100%);
}
.auth-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 26rem;
  background: var(--mirestaurante-panel, #fffcf8);
  border-radius: 1.15rem;
  padding: 1.75rem 1.5rem 1.4rem;
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.28);
}
.brand-block { 
  text-align: center; 
  margin-bottom: 1.5rem; }
.brand-logo {
  width: 3.6rem; 
  height: 3.6rem; 
  border-radius: 0.95rem;
  margin: 0 auto 0.85rem; 
  display: block;
}
.brand-name {
  font-family: var(--font-display);
  font-size: 2.1rem;
  margin: 0;
  color: var(--mirestaurante-primary);
  font-weight: 800;
}
.brand-tagline { 
  margin: 0.4rem 0 0; 
  color: var(--mirestaurante-muted, #66706a); 
  font-size: 0.92rem; 
}
.auth-heading { 
  font-size: 1.05rem; 
  font-weight: 600; 
  margin: 0 0 1rem; 
}
.auth-form { 
  display: grid; 
  gap: 0.9rem; 
}
.field { 
  display: grid; 
  gap: 0.35rem; 
  font-size: 0.85rem; 
  font-weight: 500; 
}
.field input {
  border: 1px solid var(--mirestaurante-line, rgba(18,24,22,.12));
  border-radius: 0.7rem;
  padding: 0.75rem 0.85rem;
  font: inherit;
  background: #fff;
  color: #000;
  color-scheme: light;
}
.btn-primary {
  margin-top: 0.25rem;
  border: none;
  border-radius: 0.7rem;
  padding: 0.8rem;
  background: var(--mirestaurante-primary);
  color: #f8f6f2;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:hover {
  background: #16382b;
}
.btn-primary:disabled { opacity: 0.6; }
.error-text { margin: 0; text-align: center; color: #b42318; font-size: 0.85rem; }
.auth-link {
  display: block;
  text-align: center;
  margin-top: 0.75rem;
  color: var(--mirestaurante-primary);
  font-weight: 600;
  font-size: 0.9rem;
  text-decoration: none;
}
.auth-link:hover {
  color: #1f4d3a;
}
</style>
