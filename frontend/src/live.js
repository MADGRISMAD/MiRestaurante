/**
 * Conexión "en vivo" de la app: un solo sondeo compartido por todas las pantallas.
 * La lógica está en liveCore.js (con pruebas); aquí solo se conecta con Vue y el navegador.
 *
 * Uso en una pantalla (suscribirse ANTES de la primera carga, y cancelar al salir):
 *
 *   const live = bindLive(["orders"], () => load(true));
 *   onMounted(async () => {
 *     await live.ready;   // ya hay línea base de cambios
 *     await load();
 *   });
 *   onUnmounted(() => live.stop());
 *
 * Canales: "orders" (pedidos y caja), "tables" (mesas), "waitlist" (lista de espera).
 */
import { reactive } from "vue";
import { apiService } from "./apiService";
import { createLive } from "./liveCore";

export const liveState = reactive({ status: "idle" });

const live = createLive({
  fetchVersions: async () => (await apiService.getSync()).v || {},
  isHidden: () => document.hidden,
  onStatus: (s) => {
    liveState.status = s;
  },
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) live.wake();
});
window.addEventListener("online", () => live.wake());
window.addEventListener("offline", () => live.markOffline());

/** subscribeLive(canales, alCambiar, { background }) → Promise<función para cancelar> */
export const subscribeLive = live.subscribe;
/**
 * Suscripción con dueño: si la pantalla se cierra mientras aún está conectando, la suscripción
 * se cancela sola en cuanto termina (si no, quedaría activa sin nadie que la escuche).
 */
export function bindLive(channels, onChange, options) {
  let cancel = null;
  let stopped = false;
  const ready = live.subscribe(channels, onChange, options).then((unsubscribe) => {
    if (stopped) unsubscribe();
    else cancel = unsubscribe;
  });
  return {
    ready,
    stop() {
      stopped = true;
      cancel?.();
      cancel = null;
    },
  };
}

/** Sondea de inmediato (p. ej. justo después de una acción propia). */
export const refreshLive = live.wake;
