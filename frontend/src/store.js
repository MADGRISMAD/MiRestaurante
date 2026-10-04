import { reactive } from "vue";

export const store = reactive({
  platillosSeleccionados: [],
  forTable: null, // mesa a la que pertenece el carrito
});
