import { createApp } from "vue";
import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import App from "./App.vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "./index.css";
import { fetchVenueSettings, isSetupComplete, venueStore } from "./venueStore";
import "./themeStore";
import {
  canAccessRoute,
  clearSession,
  homeForRole,
  isAuthenticated,
  isPlatformAdmin,
} from "./authStore";
import "./apiService";
import { screenRoles, setModeProvider } from "./roles";
import CounterView from "./views/CounterView.vue";
import InventoryView from "./views/InventoryView.vue";

import main from "./views/MainComponent.vue";
import Landing from "./views/LandingView.vue";
import Login from "./views/LoginComponent.vue";
import Register from "./views/RegisterComponent.vue";
import MenuView from "./views/MenuComponent.vue";
import waitlist from "./views/WaitListComponent.vue";
import SetupWizard from "./views/SetupWizard.vue";
import DashboardView from "./views/DashboardView.vue";
import StaffView from "./views/StaffView.vue";
import OrdersView from "./views/OrdersView.vue";
import KitchenView from "./views/KitchenView.vue";
import SettingsView from "./views/SettingsView.vue";
import InviteAcceptView from "./views/InviteAcceptView.vue";
import ForgotPasswordView from "./views/ForgotPasswordView.vue";
import ResetPasswordView from "./views/ResetPasswordView.vue";
import PrintOrderView from "./views/PrintOrderView.vue";
import PrintCashCloseView from "./views/PrintCashCloseView.vue";
import BillingView from "./views/BillingView.vue";
import PlatformAdminView from "./views/PlatformAdminView.vue";
import TeamView from "./views/TeamView.vue";

const authMeta = (roles?: string[]) => ({
  requiresAuth: true,
  requiresSetup: true,
  roles,
});

const routes: RouteRecordRaw[] = [
  { path: "/", name: "landing", component: Landing },
  { path: "/login", name: "login", component: Login },
  { path: "/register", name: "register", component: Register },
  { path: "/forgot", name: "forgot", component: ForgotPasswordView },
  { path: "/reset/:token", name: "reset", component: ResetPasswordView },
  { path: "/invite/:token", name: "invite", component: InviteAcceptView },
  { path: "/setup", name: "setup", component: SetupWizard, meta: { requiresAuth: true } },
  { path: "/dashboard", name: "dashboard", component: DashboardView, meta: authMeta(screenRoles("dashboard")) },
  { path: "/main", name: "main", component: main, meta: authMeta(screenRoles("main")) },
  { path: "/menu", name: "menu", component: MenuView, meta: authMeta(screenRoles("menu")) },
  { path: "/meseros", redirect: "/menu" },
  { path: "/counter", name: "counter", component: CounterView, meta: authMeta(screenRoles("counter")) },
  { path: "/inventory", name: "inventory", component: InventoryView, meta: authMeta(screenRoles("inventory")) },
  { path: "/team", name: "team", component: TeamView, meta: authMeta(screenRoles("team")) },
  { path: "/staff", name: "staff", component: StaffView, meta: authMeta(screenRoles("staff")) },
  { path: "/orders", name: "orders", component: OrdersView, meta: authMeta(screenRoles("orders")) },
  { path: "/kitchen", name: "kitchen", component: KitchenView, meta: authMeta(screenRoles("kitchen")) },
  { path: "/waitlist", name: "waitlist", component: waitlist, meta: authMeta(screenRoles("waitlist")) },
  { path: "/settings", name: "settings", component: SettingsView, meta: authMeta(screenRoles("settings")) },
  {
    path: "/billing",
    name: "billing",
    component: BillingView,
    meta: { requiresAuth: true, roles: screenRoles("billing") },
  },
  {
    path: "/platform",
    name: "platform",
    component: PlatformAdminView,
    meta: { requiresAuth: true, roles: screenRoles("platform") },
  },
  {
    path: "/print/order/:id",
    name: "printOrder",
    component: PrintOrderView,
    meta: { requiresAuth: true, roles: screenRoles("printOrder") },
  },
  {
    path: "/print/cash/:id",
    name: "printCash",
    component: PrintCashCloseView,
    meta: { requiresAuth: true, roles: screenRoles("printCash") },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const publicNames = new Set(["landing", "login", "register", "forgot", "reset", "invite"]);

router.beforeEach(async (to) => {
  if (publicNames.has(String(to.name))) {
    if (isAuthenticated() && (to.name === "login" || to.name === "register")) {
      // La pantalla de inicio depende del modo del negocio (salón o mostrador): primero los ajustes
      if (!venueStore.ready && !isPlatformAdmin()) await fetchVenueSettings();
      return { name: homeForRole() };
    }
    return true;
  }

  if (to.meta.requiresAuth && !isAuthenticated()) {
    return { name: "login" };
  }

  // El modo (salón o mostrador) sale de los ajustes del negocio: en un dispositivo nuevo hay que
  // traerlos ANTES de decidir a qué pantallas puede entrar esta sesión.
  if (to.meta.roles && !venueStore.ready && !isPlatformAdmin()) {
    await fetchVenueSettings();
  }

  if (to.meta.roles && !canAccessRoute(String(to.name))) {
    return { name: homeForRole() };
  }

  if (to.name === "setup" || to.name === "billing" || to.name === "platform") {
    return true;
  }

  if (to.meta.requiresSetup) {
    await fetchVenueSettings();
    if (!isSetupComplete()) {
      return { name: "setup" };
    }
  }

  return true;
});

// El modo de servicio (salón o mostrador) depende del tipo de negocio de los ajustes
setModeProvider(() => venueStore.businessType);

const vuetify = createVuetify({
  components,
  directives,
});

const app = createApp(App);
app.use(router);
app.use(vuetify);
app.mount("#app");

export { clearSession };
export { apiClient as default } from "./apiService";
