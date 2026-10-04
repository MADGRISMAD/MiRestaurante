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

## Despliegue en Vercel (producción)
El frontend se despliega automáticamente a **producción** (`--prod`, no preview) en cada push a `main`
mediante `.github/workflows/vercel-production.yml`. Requiere los secrets del repositorio
`VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID`. El backend (Express + MongoDB) no corre en Vercel;
define `VITE_API_URL`/la URL de API según `apiService.ts` apuntando a donde lo alojes.
