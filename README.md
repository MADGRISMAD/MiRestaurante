# MiRestaurante

## Descripción
MiRestaurante es una plataforma web de gestión de salón para restaurantes, cafés y hostelería. Cada cliente configura su negocio (nombre, logo e información operativa) mediante un asistente inicial.

Stack: Vue.js (frontend), Express.js (backend) y MongoDB.

## Correr el programa
El proyecto funciona como monorepositorio. Todo se ejecuta desde la raíz.

### Paso 1: Instalación de dependencias
```bash
npm install
```
### Paso 2: Correr los scripts
En el `package.json` de la raíz existen 3 comandos:

> back:dev

> front:dev

> dev

Si quieres correr únicamente el backend:
```bash
npm run back:dev
```

Si es el frontend únicamente:
```bash
npm run front:dev
```

Ambas partes en conjunto:
```bash
npm run dev
```

## Configuración inicial
Al entrar por primera vez (o tras registrarte), MiRestaurante abre el **wizard de configuración** en `/setup` para definir:

- Nombre y tipo de negocio
- Logo
- Zona horaria y preferencias operativas

La configuración se guarda en la API (`/settings`) y también en el navegador como respaldo.

## Panel de control (estilo POS tablet)
Tras el setup entras a **Mesas** (pantalla principal tipo POS tablet):

- Barra inferior grande: Mesas · Pedido · Cocina · Caja
- Menú “Más”: resumen, waitlist, personal, facturación, configuración
- Mesas en plano arrastrable
- Pedido con botones grandes de productos

### Alcance actual
Incluye operación diaria: mesas, pedidos, cocina, caja, menú, personal, waitlist, invitaciones, **trial/billing Mercado Pago** y panel **platform admin**.

Aún no incluye: inventario/recetas, CFDI, PWA, nómina ni multi-sucursal.

### Invitaciones por correo
Copia `backend/.env.example` → `backend/.env` y configura SMTP (Resend, Gmail, etc.):

```bash
APP_URL=http://localhost:5173
SMTP_HOST=smtp.ejemplo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=MiRestaurante <noreply@tu-dominio.com>
```

Si SMTP no está definido, la invitación se crea igual y el enlace se imprime en la consola del backend.

### Billing (Mercado Pago)
Variables en `backend/.env`:

```bash
MP_ACCESS_TOKEN=          # vacío = modo mock (activar plan en /billing)
MP_CURRENCY=MXN
MP_PLAN_BASIC_PRICE=799
MP_PLAN_PRO_PRICE=1499
API_PUBLIC_URL=http://localhost:8081
```

- Registro → trial **14 días**
- `/billing` → planes Básico/Pro
- Webhook: `POST /billing/webhook`

### Platform admin
```bash
cd backend && npm run seed:platform-admin
```
Login con `platform` / `Platform123!` (o lo que definas en env) → `/platform` para listar/suspender tenants.

## Deploy con Docker
En un VPS (o local con Docker):

```bash
cp backend/.env.example backend/.env
# Edita SECRET_KEY, APP_URL, API_PUBLIC_URL, MP_*, SMTP_*

docker compose up --build -d
```

- Web: `http://localhost` (nginx + SPA, proxy `/api` → API)
- API directa: `http://localhost:8081`
- Mongo: puerto `27017` (volumen `mongo_data`)

HTTPS: pon Caddy/nginx en el host delante del puerto 80.

Backup diario (cron):
```bash
MONGO_CONTAINER=<nombre_contenedor_mongo> ./deploy/backup-mongo.sh
```

## Todo se maneja desde la raíz ahora

### Notas extras
Si quieres agregar dependencias a los workspaces:
```bash
npm install -workspace (frontend, backend) (dependencia)
```

Ejemplo:
```bash
npm install -workspace frontend nodemon
```
Este comando instalará en el frontend la librería nodemon.

Tambien puedes acortar el anterior script de la siguiente forma:
```bash
npm install -w frontend nodemon
```
Funciona exactamente igual

## Roles y permisos
Cada cuenta de un negocio tiene uno de cinco roles. El administrador crea las cuentas desde **Equipo y roles**
(`/team`): usuario, contraseña inicial (se puede generar), rol y, para meseros, celular. También puede cambiar el
rol, restablecer la contraseña o eliminar cuentas. Siempre debe quedar al menos un administrador, y nadie puede
cambiar o eliminar su propia cuenta desde ahí. El alta por correo sigue disponible en **Configuración → Equipo**.

**Fuente única de verdad:** `backend/models/roles.js` y `frontend/src/roles.js` (el test
`backend/tests/roles.test.js` verifica que coincidan). Para agregar una pantalla, añade una fila a `SCREENS` en
`frontend/src/roles.js`: el menú, la protección de rutas y la pantalla de inicio salen de ahí. Los endpoints del
backend se protegen aparte con `requireRoles(...)` en cada router.

| Pantalla | Ruta | Modo | Administrador | Mesero | Cocina | Caja | Anfitrión | Plataforma |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Resumen | `/dashboard` | Ambos | ✓ |  |  |  |  |  |
| Mostrador | `/counter` | Solo café | café |  |  | café |  |  |
| Mesas | `/main` | Solo salón | salón | salón |  | salón | salón |  |
| Cocina | `/kitchen` | Solo salón | salón | salón | salón | salón |  |  |
| Lista de espera | `/waitlist` | Solo salón | salón |  |  |  | salón |  |
| Meseros | `/staff` | Solo salón | salón |  |  |  |  |  |
| Pedido | `/menu` | Ambos | ✓ | salón |  | salón |  |  |
| Caja | `/orders` | Ambos | ✓ |  |  | ✓ |  |  |
| Equipo y roles | `/team` | Ambos | ✓ |  |  |  |  |  |
| Inventario | `/inventory` | Ambos | ✓ |  |  |  |  |  |
| Facturación y planes | `/billing` | Ambos | ✓ |  |  | ✓ |  |  |
| Configuración | `/settings` | Ambos | ✓ |  |  |  |  |  |
| Cuenta | `/print/order/:id` | Ambos | ✓ | ✓ | ✓ | ✓ |  |  |
| Cierre de caja | `/print/cash/:id` | Ambos | ✓ |  |  | ✓ |  |  |
| Plataforma | `/platform` | Ambos |  |  |  |  |  | ✓ |

| Rol | Entra directo a (salón) | Entra directo a (café) |
|---|---|---|
| Administrador | Mesas (`/main`) | Mostrador (`/counter`) |
| Mesero | Mesas (`/main`) | — (no existe en café) |
| Cocina | Cocina (`/kitchen`) | — (no existe en café) |
| Caja | Caja (`/orders`) | Mostrador (`/counter`) |
| Anfitrión | Lista de espera (`/waitlist`) | — (no existe en café) |

"✓" = en ambos modos; "salón" / "café" = solo en ese modo.

`hosstess` (nombre anterior del Anfitrión) se migra a `host` automáticamente en la base de datos y en los tokens
de sesión existentes.

Pruebas del backend: `npm --workspace backend test`.

## Modo Café (mostrador)
Un negocio de tipo **Café** (se elige en el asistente inicial o en Configuración) opera como **mostrador**: se pide,
se cobra y se entrega en un solo paso, **sin mesas, cocina, mesero ni anfitrión**, y con un equipo de **hasta 2
personas** (Administrador y Caja). Los demás tipos de negocio usan el flujo de salón de siempre.

**El flujo, de punta a punta**
1. **Abrir caja** con el fondo inicial (sin caja abierta no se puede vender).
2. **Mostrador** (`/counter`): se toca cada producto, se ajustan cantidades, notas ("leche de avena") y, si se
   quiere, el nombre del cliente y *Aquí / Para llevar*.
3. **Cobrar**: efectivo (con billetes rápidos y cambio en vivo), tarjeta o transferencia. Muestra el **turno** del
   día (#1, #2…, se reinicia cada día) para llamar al cliente, y permite imprimir el ticket.
4. **Caja**: todas las ventas entran al cierre del turno, desglosadas por método de pago.
5. **Resumen**: ventas del día, tickets, ticket promedio y lo más vendido.
Si hay dos personas con sesión, lo que vende una se ve en la otra en ≤ ~1.5 s (ver *Tiempo real*).

**Reglas** (todas se hacen cumplir en el servidor, no solo en la pantalla)
- Una venta de mostrador nace **cobrada y entregada**: no pasa por cocina ni toca mesas.
- Los **precios salen del menú del negocio**, nunca del cliente; el IVA y el total los calcula el servidor.
- `POST /orders/counter` acepta un `clientRef`: reintentar o hacer doble clic **no duplica la venta**
  (índice único por negocio + `clientRef`).
- Equipo: solo Administrador y Caja, máximo 2 cuentas **contando invitaciones pendientes**. No se puede cambiar un
  negocio a Café si su equipo no cabe (se explica qué cuentas hay que quitar); volver a restaurante siempre se puede.
- El administrador edita los productos desde **Menú**; el cajero solo vende.

**Dónde vive en el código:** `backend/models/venueMode.js` y `frontend/src/roles.js` (modos, límites y qué pantallas
existen en cada modo; un test verifica que coincidan), `backend/controllers/orders.controller.js` (`counterSale`) y
`frontend/src/views/CounterView.vue`.

## Inventario, recetas y extras
El administrador lleva el inventario de **ingredientes** (leche, café, jarabes, vasos…) desde **Inventario**
(`/inventory`, en café y en restaurante). Cada producto puede tener una **receta** y **extras**, y al vender se
descuenta solo.

**Ingredientes.** Nombre, unidad (pieza, ml, litro, gramo, kilo, pump, shot, sobre, cucharadita), existencia y un
mínimo para avisar. La existencia **solo cambia con movimientos**, que quedan en el historial: *Entrada* (compra),
*Merma*, *Conteo* (inventario físico; se guarda la diferencia real) y los automáticos de *Venta* y *Devolución*.
Una existencia en cero o menos es "Agotado"; en o bajo el mínimo, "Por agotarse". El panel y el Mostrador avisan,
y todo se actualiza solo entre dispositivos (canal `inventory` de *Tiempo real*).

**Asistente de productos** (Menú → "+ Platillo" o tocar un producto), en 4 pasos:
1. **Producto:** nombre, precio base, descripción e imagen.
2. **Receta:** qué ingredientes lleva y cuánto de cada uno por unidad vendida. Se puede crear un ingrediente
   nuevo sin salir del asistente.
3. **Extras:** ingredientes que el cliente puede agregar encima (sabores, azúcar, un shot extra). Por cada uno:
   cuánto consume cada extra, su precio (0 = sin costo), su nombre en la cuenta y un máximo.
4. **Resumen:** un ejemplo de venta con el precio y el descuento reales.

**Constructor de bebida** (Mostrador): al tocar un producto con extras se abre el paso a paso — extras con +/−,
una nota rápida (Descafeinado, Sin azúcar, Extra caliente…) o escrita a mano, y la cantidad. La cuenta muestra
cada personalización y se pueden editar los extras de una línea. Ejemplo: *Latte $40 con 5 pumps de lavanda
($5 c/u), 3 de azúcar (gratis) y nota "descafeinado", ×2 = $130 + IVA*; descuenta 2 shots, 480 ml de leche, 2
vasos, 10 pumps de lavanda y 6 sobres de azúcar.

**Reglas** (las cumple el servidor, no solo la pantalla)
- Los extras y su precio salen **de lo que el producto ofrece**; el cliente solo manda cuántos de cada uno.
  Un extra que el producto no ofrece, o por encima de su máximo, se rechaza.
- **Una venta nunca se bloquea por falta de existencia**: el stock puede quedar en negativo (se marca "Agotado")
  para que se note que el conteo está desactualizado.
- Al vender se guarda en el pedido una **instantánea de lo descontado**; al **cancelar** se devuelve exactamente
  eso (aunque la receta haya cambiado después) y **una sola vez**, aunque el pedido se reabra y se cancele otra vez.
- Un reintento o doble clic no vuelve a descontar. Si el descuento de algún ingrediente falla, la venta ya hecha
  no se pierde (queda registrado el error).
- Los pedidos de **salón** descuentan la receta base de cada producto (el armado de extras es por ahora del
  Mostrador).
- No se puede **borrar** un ingrediente ni **cambiarle la unidad** si algún producto lo usa (receta o extra).
- La caja puede ver las existencias; solo el administrador las cambia. Cada negocio ve únicamente lo suyo.
- Editar un producto solo cambia los campos que llegan y nunca su negocio.

**Dónde vive en el código:** `backend/models/inventory.js` (unidades, validación y cálculo de precio y consumo),
`backend/services/inventory.service.js` (descuento y devolución), `backend/controllers/ingredients.controller.js`,
`frontend/src/recipeMath.js` e `inventoryUnits.js` (el mismo cálculo en pantalla; `tests/inventory-parity.test.js`
verifica que ambos lados den exactamente lo mismo), `InventoryView.vue`, `components/ProductWizard.vue` y el
constructor dentro de `CounterView.vue`.

## Tiempo real
Cocina, mesas, lista de espera, caja, panel y los avisos del mesero se actualizan solos: un cambio hecho en
un dispositivo se ve en los demás en **≤ ~1.8 s** (medido: 1.1 s en promedio, 1.3 s en el peor caso en cocina),
sin recargar y sin botón de actualizar. Arriba aparece el indicador **En vivo / Reconectando…**.

**Cómo funciona.** El backend lleva un contador de cambios por negocio y por canal (`orders`, `tables`,
`waitlist`) en la colección `sync`; `database/mongodb.js` lo incrementa en cada escritura de pedidos, mesas, lista
de espera y caja. `GET /sync` devuelve esos tres números (una sola lectura). El frontend (`src/live.js` +
`src/liveCore.js`) hace **un único sondeo para toda la app** cada 1.5 s mientras la pestaña está a la vista; cada
pantalla se suscribe a sus canales y recarga sus datos solo cuando cambió uno de ellos.

```js
const live = bindLive(["orders"], () => load(true)); // en la pantalla
onMounted(async () => { await live.ready; await load(); });
onUnmounted(() => live.stop());
```

**Por qué sondeo y no WebSockets/SSE.** Vercel (funciones serverless) no sostiene WebSockets, y una conexión SSE
abierta por dispositivo cuesta tiempo de función y no se puede probar sin desplegar. El sondeo de contadores
funciona en cualquier hosting, se prueba por completo en local y baja el tráfico respecto a antes (cocina pedía
la lista completa de pedidos cada 5 s; ahora solo descarga cuando algo cambió).

**Comportamiento a conocer**
- Pestaña oculta: se pausa (no gasta peticiones) y al volver se pone al día al instante. Los avisos del mesero
  siguen aunque esté oculta si dio permiso a las notificaciones.
- Sin red: reintenta con espera creciente (1.5 → 3 → 6 → 10 s), muestra "Reconectando…", conserva lo que ya
  había en pantalla y al volver recarga lo que cambió durante la caída.
- Cocina: la comanda nueva se resalta y suena (botón **Sonido: sí/no**, se recuerda por dispositivo).
- Si estás arrastrando una mesa o editando el plano, el cambio recibido se aplica al terminar.

**Costo y cómo crecer.** Cada dispositivo abierto hace ~40 peticiones/min a `/sync` (1 lectura a la base cada
una). Con 5 dispositivos 12 h al día son ~4 millones de invocaciones al mes por restaurante: considera el plan
de Vercel y el tamaño del cluster al sumar negocios. Si llega a pesar, solo hay que cambiar el transporte en
`src/live.js` (SSE, Ably o Pusher): las pantallas únicamente usan `bindLive`/`subscribe`.

## Despliegue en Vercel (producción)
Frontend (Vite) y backend (Express) se despliegan juntos en un solo proyecto de Vercel
(`vercel.json` con `services`). El backend responde bajo `/api`, en el mismo dominio que el frontend.

Cada push a `main` despliega a **producción** (`--prod`) con `.github/workflows/vercel-production.yml`, en el
proyecto `mirestaurante` de la cuenta dueña de `VERCEL_TOKEN` (se crea solo en el primer deploy).

Secrets del repositorio (Settings → Secrets and variables → Actions):
- `VERCEL_TOKEN`: token de tu cuenta de Vercel (Account Settings → Tokens).
- `DATABASE_URI`: conexión de MongoDB Atlas (ver abajo).
- `SECRET_KEY`: valor largo y aleatorio para firmar sesiones.

Variable opcional `APP_URL` si usas un dominio propio (por defecto `https://mirestaurante-ten.vercel.app`).

## Base de datos (producción)
MiRestaurante usa el mismo cluster de MongoDB Atlas que MiTiendita (`cluster0.8z0wbpq.mongodb.net`), pero en
su propia base `mirestaurante`, así que los datos no se comparten. En el hosting del backend define:

```
DATABASE_URI=mongodb+srv://madgrismad_db_user:<db_password>@cluster0.8z0wbpq.mongodb.net/
DATABASE_NAME=mirestaurante
```

La contraseña va solo en las variables de entorno del servidor, nunca en el repositorio.
