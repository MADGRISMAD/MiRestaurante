import axios from 'axios';
import { authStore, clearSession } from './authStore';

const envUrl = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL;
const publicUrl =
  envUrl ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8081/'
    : '/api/');

axios.defaults.baseURL = publicUrl;
axios.defaults.headers.common['Content-Type'] = 'application/json';

axios.interceptors.request.use((config) => {
  const token = authStore.token;
  if (token) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.match(/^\/($|register|invite|forgot|reset)/)
      ) {
        window.location.href = '/login';
      }
    }
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === 'SUBSCRIPTION_REQUIRED' &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/billing') &&
      !window.location.pathname.startsWith('/platform')
    ) {
      window.location.href = '/billing';
    }
    return Promise.reject(error);
  }
);

export const apiClient = axios;

export const apiService = {
  login(data: string, password: string) {
    return axios.post('/usuarios/login', { data, password }).then((r) => r.data);
  },
  register(payload: Record<string, unknown>) {
    return axios.post('/usuarios/register', payload).then((r) => r.data);
  },
  forgotPassword(email: string) {
    return axios.post('/usuarios/forgot-password', { email }).then((r) => r.data);
  },
  resetPassword(token: string, password: string) {
    return axios.post('/usuarios/reset-password', { token, password }).then((r) => r.data);
  },
  me() {
    return axios.get('/usuarios/me').then((r) => r.data);
  },

  getAllFoods() {
    return axios.get('/foods').then((r) => r.data);
  },
  getFoodById(foodId: string) {
    return axios.get(`/foods/${foodId}`).then((r) => r.data);
  },
  createFood(foodDTO: {
    name: string;
    price: number;
    description?: string;
    imgUrl?: string;
    menuId: string;
  }) {
    return axios.post('/foods', foodDTO).then((r) => r.data);
  },
  editFood(foodId: string, foodDTO: Record<string, unknown>) {
    return axios.put(`/foods/${foodId}`, foodDTO).then((r) => r.data);
  },
  deleteFood(foodId: string) {
    return axios.delete(`/foods/${foodId}`).then((r) => r.status === 200);
  },

  getAllMenus() {
    return axios.get('/menus').then((r) => r.data);
  },
  getMenuById(menuId: string) {
    return axios.get(`/menus/${menuId}`).then((r) => r.data);
  },
  createMenu(menuDTO: { name: string; description?: string }) {
    return axios.post('/menus', menuDTO).then((r) => r.data);
  },
  editMenu(menuId: string, menuDTO: Record<string, unknown>) {
    return axios.put(`/menus/${menuId}`, menuDTO).then((r) => r.data);
  },
  deleteMenu(menuId: string) {
    return axios.delete(`/menus/${menuId}`).then((r) => r.status === 200);
  },

  getSync() {
    return axios.get('/sync').then((r) => r.data);
  },
  getOrders() {
    return axios.get('/orders').then((r) => r.data);
  },
  getOrdersById(orderId: string) {
    return axios.get(`/orders/${orderId}`).then((r) => r.data);
  },
  createOrder(orderDTO: Record<string, unknown>) {
    return axios.post('/orders', orderDTO).then((r) => r.data);
  },
  updateOrderStatus(orderId: string, status: string) {
    return axios.put(`/orders/${orderId}/status`, { status }).then((r) => r.data);
  },
  payOrder(orderId: string, paymentMethod: string) {
    return axios.put(`/orders/${orderId}/pay`, { paymentMethod }).then((r) => r.data);
  },
  editOrderAsCompleted(orderId: string) {
    return this.updateOrderStatus(orderId, 'served');
  },
  deleteOrder(_orderId: string) {
    return Promise.resolve(false);
  },

  getTables() {
    return axios.get('/tables').then((r) => r.data);
  },
  getTableById(tableId: string) {
    return axios.get(`/tables/${tableId}`).then((r) => r.data);
  },
  createTable(tableDTO: Record<string, unknown>) {
    return axios.post('/tables', tableDTO).then((r) => r.data);
  },
  editTable(tableId: string, tableDTO: Record<string, unknown>) {
    return axios.put(`/tables/${tableId}`, tableDTO).then((r) => r.data);
  },
  deleteTable(tableId: string) {
    return axios.delete(`/tables/${tableId}`).then((r) => r.status === 200);
  },

  getWaiters() {
    return axios.get('/waiters').then((r) => r.data);
  },
  createWaiter(waiterDTO: Record<string, unknown>) {
    return axios.post('/waiters/add', waiterDTO).then((r) => r.data);
  },
  updateWaiter(cellphone: string, waiterDTO: Record<string, unknown>) {
    return axios.put(`/waiters/${cellphone}`, waiterDTO).then((r) => r.data);
  },
  deleteWaiter(cellphone: string) {
    return axios.delete(`/waiters/${cellphone}`).then((r) => r.data);
  },

  getWaitlist() {
    return axios.get('/usuarios/waitlist/').then((r) => r.data);
  },
  addWaitlist(data: { nombre: string; telefono: string | number }) {
    return axios.post('/usuarios/waitlist/add', data).then((r) => r.data);
  },
  deleteWaitlist(id: string | number) {
    return axios.delete(`/usuarios/waitlist/delete/${id}`).then((r) => r.data);
  },

  getSettings() {
    return axios.get('/settings').then((r) => r.data);
  },
  saveSettings(settingsDTO: Record<string, unknown>) {
    return axios.post('/settings', settingsDTO).then((r) => r.data);
  },

  getTeam() {
    return axios.get('/team').then((r) => r.data);
  },
  createTeamMember(data: Record<string, unknown>) {
    return axios.post('/team', data).then((r) => r.data);
  },
  changeTeamRole(id: string, role: string) {
    return axios.put(`/team/${id}/role`, { role }).then((r) => r.data);
  },
  resetTeamPassword(id: string, password: string) {
    return axios.put(`/team/${id}/password`, { password }).then((r) => r.data);
  },
  deleteTeamMember(id: string) {
    return axios.delete(`/team/${id}`).then((r) => r.data);
  },
  getInvites() {
    return axios.get('/invites').then((r) => r.data);
  },
  createInvite(data: { email: string; role: string }) {
    return axios.post('/invites', data).then((r) => r.data);
  },
  revokeInvite(id: string) {
    return axios.put(`/invites/${id}/revoke`).then((r) => r.data);
  },
  deleteInvite(id: string) {
    return axios.delete(`/invites/${id}`).then((r) => r.data);
  },
  getInviteByToken(token: string) {
    return axios.get(`/invites/token/${token}`).then((r) => r.data);
  },
  acceptInvite(payload: Record<string, unknown>) {
    return axios.post('/invites/accept', payload).then((r) => r.data);
  },

  getCashSession() {
    return axios.get('/cash/session').then((r) => r.data);
  },
  openCashSession(openingFloat: number) {
    return axios.post('/cash/session/open', { openingFloat }).then((r) => r.data);
  },
  closeCashSession(countedCash: number, notes = '') {
    return axios.post('/cash/session/close', { countedCash, notes }).then((r) => r.data);
  },
  getCashSessionById(id: string) {
    return axios.get(`/cash/session/${id}`).then((r) => r.data);
  },

  getBillingPlans() {
    return axios.get('/billing/plans').then((r) => r.data);
  },
  getBillingStatus() {
    return axios.get('/billing/status').then((r) => r.data);
  },
  billingCheckout(plan: string, email?: string) {
    return axios.post('/billing/checkout', { plan, email }).then((r) => r.data);
  },
  billingDevActivate(plan: string, preapprovalId?: string) {
    return axios
      .post('/billing/dev/activate', { plan, preapprovalId })
      .then((r) => r.data);
  },

  platformListTenants() {
    return axios.get('/platform/tenants').then((r) => r.data);
  },
  platformSuspendTenant(id: string, reason: string) {
    return axios.post(`/platform/tenants/${id}/suspend`, { reason }).then((r) => r.data);
  },
  platformReactivateTenant(id: string, mode: 'active' | 'trial' = 'active') {
    return axios.post(`/platform/tenants/${id}/reactivate`, { mode }).then((r) => r.data);
  },
  platformSetPlan(id: string, plan: string) {
    return axios.patch(`/platform/tenants/${id}/plan`, { plan }).then((r) => r.data);
  },
};
