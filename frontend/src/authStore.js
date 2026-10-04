import { reactive } from "vue";

const STORAGE_KEY = "mirestaurante_auth";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, role: null, tenantId: null, username: null };
    return JSON.parse(raw);
  } catch {
    return { token: null, role: null, tenantId: null, username: null };
  }
}

export const authStore = reactive({
  ...load(),
});

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: authStore.token,
      role: authStore.role,
      tenantId: authStore.tenantId,
      username: authStore.username,
    })
  );
}

export function setSession({ token, role, tenantId, username }) {
  authStore.token = token || null;
  authStore.role = role || null;
  authStore.tenantId = tenantId || null;
  authStore.username = username || null;
  persist();
}

export function clearSession() {
  authStore.token = null;
  authStore.role = null;
  authStore.tenantId = null;
  authStore.username = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated() {
  return Boolean(authStore.token);
}

export function hasRole(...roles) {
  if (!roles.length) return true;
  return roles.includes(authStore.role);
}

export function isPlatformAdmin() {
  return authStore.role === "platform_admin";
}

/** Rutas permitidas por rol (path names) */
export const roleHome = {
  admin: "main",
  hosstess: "main",
  waiter: "main",
  kitchen: "kitchen",
  cashier: "orders",
  platform_admin: "platform",
};

export const routeRoles = {
  dashboard: ["admin"],
  main: ["admin", "hosstess", "waiter", "cashier"],
  menu: ["admin", "waiter", "cashier"],
  staff: ["admin"],
  orders: ["admin", "cashier"],
  kitchen: ["admin", "kitchen", "cashier", "waiter"],
  waitlist: ["admin", "hosstess"],
  settings: ["admin"],
  setup: ["admin"],
  billing: ["admin", "cashier"],
  platform: ["platform_admin"],
  printOrder: ["admin", "cashier", "waiter", "kitchen"],
  printCash: ["admin", "cashier"],
};

export function canAccessRoute(name) {
  const allowed = routeRoles[name];
  if (!allowed) return true;
  return hasRole(...allowed);
}

export function homeForRole(role = authStore.role) {
  return roleHome[role] || "main";
}
