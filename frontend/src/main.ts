import { createApp } from "vue";
import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import App from "./App.vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "./index.css";
import { fetchVenueSettings, isSetupComplete } from "./venueStore";
import "./themeStore";
import {
  canAccessRoute,
  clearSession,
  homeForRole,
  isAuthenticated,
} from "./authStore";
import "./apiService";

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
  { path: "/dashboard", name: "dashboard", component: DashboardView, meta: authMeta(["admin"]) },
  { path: "/main", name: "main", component: main, meta: authMeta(["admin", "hosstess", "waiter", "cashier"]) },
  { path: "/menu", name: "menu", component: MenuView, meta: authMeta(["admin", "waiter", "cashier"]) },
  { path: "/meseros", redirect: "/menu" },
  { path: "/staff", name: "staff", component: StaffView, meta: authMeta(["admin"]) },
  { path: "/orders", name: "orders", component: OrdersView, meta: authMeta(["admin", "cashier"]) },
  { path: "/kitchen", name: "kitchen", component: KitchenView, meta: authMeta(["admin", "kitchen", "cashier", "waiter"]) },
  { path: "/waitlist", name: "waitlist", component: waitlist, meta: authMeta(["admin", "hosstess"]) },
  { path: "/settings", name: "settings", component: SettingsView, meta: authMeta(["admin"]) },
  {
    path: "/billing",
    name: "billing",
    component: BillingView,
    meta: { requiresAuth: true, roles: ["admin", "cashier"] },
  },
  {
    path: "/platform",
    name: "platform",
    component: PlatformAdminView,
    meta: { requiresAuth: true, roles: ["platform_admin"] },
  },
  {
    path: "/print/order/:id",
    name: "printOrder",
    component: PrintOrderView,
    meta: { requiresAuth: true, roles: ["admin", "cashier", "waiter", "kitchen"] },
  },
  {
    path: "/print/cash/:id",
    name: "printCash",
    component: PrintCashCloseView,
    meta: { requiresAuth: true, roles: ["admin", "cashier"] },
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
      return { name: homeForRole() };
    }
    return true;
  }

  if (to.meta.requiresAuth && !isAuthenticated()) {
    return { name: "login" };
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
