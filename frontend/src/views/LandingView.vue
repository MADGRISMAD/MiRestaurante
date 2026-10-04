<template>
  <div class="landing">
    <header class="nav" :class="{ scrolled }">
      <a href="#top" class="nav-brand">
        <img src="/logo.svg" alt="" class="nav-logo" />
        <span>MiRestaurante</span>
      </a>
      <nav class="nav-links" aria-label="Principal">
        <a href="#funciones">Funciones</a>
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#planes">Planes</a>
        <a href="#preguntas">Preguntas</a>
      </nav>
      <div class="nav-cta">
        <router-link v-if="logged" :to="{ name: home }" class="btn btn-solid btn-sm">Ir a mi salón</router-link>
        <template v-else>
          <router-link to="/login" class="nav-login">Ingresar</router-link>
          <router-link to="/register" class="btn btn-solid btn-sm">Empezar gratis</router-link>
        </template>
      </div>
    </header>

    <main id="top">
      <!-- HERO -->
      <section class="hero">
        <div class="hero-glow" aria-hidden="true"></div>
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <p class="eyebrow">Gestión de salón para restaurantes y cafés</p>
            <h1>Tu restaurante, <em>en orden</em> de la mesa a la caja.</h1>
            <p class="lead">
              Mapa de mesas, pedidos, cocina, lista de espera y cierre de caja en una sola
              plataforma. Configúrala en minutos y úsala desde cualquier celular o tablet.
            </p>
            <div class="hero-actions">
              <router-link to="/register" class="btn btn-solid">Crear mi cuenta</router-link>
              <a href="#como-funciona" class="btn btn-ghost">Ver cómo funciona</a>
            </div>
            <ul class="hero-points">
              <li>Sin instalar nada</li>
              <li>Roles para todo el equipo</li>
              <li>Hecho para el servicio real</li>
            </ul>
          </div>

          <div class="hero-visual" aria-hidden="true">
            <div class="mock">
              <div class="mock-bar">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                <span class="mock-title">Salón principal</span>
              </div>
              <div class="mock-floor">
                <div v-for="t in tables" :key="t.n" class="mock-table" :class="[t.state, t.shape]" :style="{ left: t.x + '%', top: t.y + '%' }">
                  <span>{{ t.n }}</span>
                </div>
              </div>
              <div class="mock-legend">
                <span class="lg free">Libre</span>
                <span class="lg busy">Ocupada</span>
              </div>
            </div>
            <div class="ticket">
              <p class="ticket-head">Mesa 4 · 3 personas</p>
              <p class="ticket-row"><span>2 × Tacos al pastor</span><b>$180</b></p>
              <p class="ticket-row"><span>1 × Limonada</span><b>$45</b></p>
              <p class="ticket-total"><span>Total</span><b>$225</b></p>
            </div>
          </div>
        </div>
      </section>

      <!-- STATS -->
      <section class="stats">
        <div class="wrap stats-grid">
          <div v-for="s in stats" :key="s.label" class="stat">
            <strong>{{ s.value }}</strong>
            <span>{{ s.label }}</span>
          </div>
        </div>
      </section>

      <!-- FEATURES -->
      <section id="funciones" class="section">
        <div class="wrap">
          <p class="eyebrow center">Todo lo que necesitas</p>
          <h2 class="title">Una herramienta para cada momento del servicio</h2>
          <div class="features">
            <article v-for="f in features" :key="f.title" class="feature">
              <span class="feature-icon" v-html="f.icon" aria-hidden="true"></span>
              <h3>{{ f.title }}</h3>
              <p>{{ f.text }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- STEPS -->
      <section id="como-funciona" class="section section-dark">
        <div class="wrap">
          <p class="eyebrow center light">Cómo funciona</p>
          <h2 class="title light">Listo para atender en tres pasos</h2>
          <ol class="steps">
            <li v-for="(s, i) in steps" :key="s.title">
              <span class="step-n">{{ i + 1 }}</span>
              <h3>{{ s.title }}</h3>
              <p>{{ s.text }}</p>
            </li>
          </ol>
        </div>
      </section>

      <!-- ROLES -->
      <section class="section">
        <div class="wrap roles">
          <div>
            <p class="eyebrow">Para todo tu equipo</p>
            <h2 class="title left">Cada persona ve solo lo que necesita</h2>
            <p class="lead dark">
              Administrador, meseros, cocina, caja y anfitriones tienen su propia vista. Menos
              ruido, menos errores y un servicio más rápido.
            </p>
          </div>
          <ul class="role-list">
            <li v-for="r in roles" :key="r.name">
              <b>{{ r.name }}</b>
              <span>{{ r.text }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- PLANS -->
      <section id="planes" class="section section-soft">
        <div class="wrap">
          <p class="eyebrow center">Planes</p>
          <h2 class="title">Elige el que va con tu negocio</h2>
          <div class="plans">
            <article v-for="p in plans" :key="p.name" class="plan" :class="{ featured: p.featured }">
              <p v-if="p.featured" class="plan-tag">Más popular</p>
              <h3>{{ p.name }}</h3>
              <p class="plan-price">{{ p.price }} <small>MXN / mes</small></p>
              <p class="plan-desc">{{ p.desc }}</p>
              <ul>
                <li v-for="i in p.items" :key="i">{{ i }}</li>
              </ul>
              <router-link to="/register" class="btn" :class="p.featured ? 'btn-solid' : 'btn-outline'">
                Empezar con {{ p.name }}
              </router-link>
            </article>
          </div>
          <p class="note">Prueba gratis 14 días. Los cobros se gestionan con Mercado Pago dentro de la plataforma.</p>
        </div>
      </section>

      <!-- FAQ -->
      <section id="preguntas" class="section">
        <div class="wrap narrow">
          <p class="eyebrow center">Preguntas frecuentes</p>
          <h2 class="title">Lo que suelen preguntarnos</h2>
          <details v-for="q in faqs" :key="q.q" class="faq">
            <summary>{{ q.q }}</summary>
            <p>{{ q.a }}</p>
          </details>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta">
        <div class="wrap cta-inner">
          <h2>Pon tu salón a trabajar para ti</h2>
          <p>Crea tu cuenta, configura tu negocio y toma tu primer pedido hoy.</p>
          <router-link to="/register" class="btn btn-light">Crear mi cuenta</router-link>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="wrap footer-inner">
        <span class="nav-brand dim"><img src="/logo.svg" alt="" class="nav-logo" /> MiRestaurante</span>
        <span>© {{ year }} MiRestaurante. Todos los derechos reservados.</span>
        <router-link to="/login">Ingresar</router-link>
      </div>
    </footer>
  </div>
</template>

<script>
import { isAuthenticated, homeForRole } from "../authStore";

const ico = (d) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export default {
  name: "LandingView",
  data() {
    return {
      scrolled: false,
      year: new Date().getFullYear(),
      logged: isAuthenticated(),
      home: isAuthenticated() ? homeForRole() : "login",
      tables: [
        { n: 1, x: 6, y: 10, state: "free", shape: "round" },
        { n: 2, x: 36, y: 8, state: "busy", shape: "wide" },
        { n: 3, x: 72, y: 10, state: "free", shape: "round" },
        { n: 4, x: 8, y: 52, state: "busy", shape: "round" },
        { n: 5, x: 40, y: 54, state: "free", shape: "wide" },
        { n: 6, x: 74, y: 52, state: "busy", shape: "round" },
      ],
      stats: [
        { value: "5", label: "roles de equipo" },
        { value: "100%", label: "en la nube" },
        { value: "14 días", label: "de prueba" },
        { value: "MXN", label: "pagos con Mercado Pago" },
      ],
      features: [
        {
          title: "Mapa de mesas",
          text: "Arrastra y acomoda tu salón. Ve de un vistazo qué mesas están libres u ocupadas.",
          icon: ico('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><circle cx="17.5" cy="17.5" r="3.5"/>'),
        },
        {
          title: "Pedidos y menú",
          text: "Toma pedidos desde el celular, con tu menú organizado por categorías y precios.",
          icon: ico('<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
        },
        {
          title: "Cocina en tiempo real",
          text: "Los pedidos llegan a la cocina al instante y se marcan al salir. Sin papelitos perdidos.",
          icon: ico('<path d="M6 13h12v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M8 13a4 4 0 1 1 8 0"/><path d="M12 5V3"/>'),
        },
        {
          title: "Lista de espera",
          text: "Registra a los clientes que esperan mesa y asígnalos en cuanto se libere una.",
          icon: ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
        },
        {
          title: "Caja y cierre",
          text: "Cobra, imprime cuentas y haz el cierre de caja con el detalle del día.",
          icon: ico('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
        },
        {
          title: "Tu marca",
          text: "Pon el nombre y logo de tu negocio. Modo claro y oscuro para cualquier turno.",
          icon: ico('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z"/>'),
        },
      ],
      steps: [
        { title: "Crea tu cuenta", text: "Regístrate como administrador con tu correo en menos de un minuto." },
        { title: "Configura tu negocio", text: "El asistente te guía: nombre, logo, mesas, menú y tu equipo." },
        { title: "Empieza a servir", text: "Invita a tu personal y toma pedidos desde cualquier dispositivo." },
      ],
      roles: [
        { name: "Administrador", text: "Panel, menú, personal, ajustes y facturación." },
        { name: "Mesero", text: "Mapa de mesas y toma de pedidos." },
        { name: "Cocina", text: "Cola de pedidos por preparar." },
        { name: "Caja", text: "Cobros, cuentas y cierre del día." },
        { name: "Anfitrión", text: "Lista de espera y asignación de mesas." },
      ],
      plans: [
        {
          name: "Básico",
          price: "$799",
          desc: "Para negocios que están empezando.",
          items: ["1 local", "Mesas, pedidos y menú", "Cocina y caja", "Impresión de cuentas"],
          featured: false,
        },
        {
          name: "Pro",
          price: "$1,499",
          desc: "Para operaciones con más volumen.",
          items: ["Todo lo del plan Básico", "Prioridad de soporte", "Reportes (próximamente)"],
          featured: true,
        },
      ],
      faqs: [
        { q: "¿Necesito instalar algo?", a: "No. MiRestaurante funciona desde el navegador en celular, tablet o computadora." },
        { q: "¿Puedo usarlo con mi equipo?", a: "Sí. Invita a meseros, cocina, caja y anfitriones; cada rol ve solo sus herramientas." },
        { q: "¿Puedo personalizarlo con mi marca?", a: "Sí. En el asistente inicial configuras el nombre y logo de tu negocio." },
        { q: "¿Cómo pago?", a: "La suscripción se gestiona dentro de la plataforma, en la sección de facturación." },
      ],
    };
  },
  mounted() {
    this.onScroll();
    window.addEventListener("scroll", this.onScroll, { passive: true });
  },
  beforeUnmount() {
    window.removeEventListener("scroll", this.onScroll);
  },
  methods: {
    onScroll() {
      this.scrolled = window.scrollY > 8;
    },
  },
};
</script>

<style scoped>
.landing {
  --g900: #0f241c;
  --g700: #1a4a38;
  --g500: #2f7a5c;
  --bronze: #c4a574;
  --bronze-d: #9a7b52;
  --paper: #f6f3ee;
  --ink: #141a17;
  --muted: #5b655f;
  font-family: var(--font-sans);
  color: var(--ink);
  background: #fffcf8;
  scroll-behavior: smooth;
  overflow-x: hidden;
}
.landing :where(h1, h2, h3, p, ul, ol) { margin: 0; }
.landing :where(ul, ol) { padding: 0; list-style: none; }
.wrap { width: min(72rem, 100% - 2.5rem); margin-inline: auto; }
.narrow { max-width: 46rem; }

/* NAV */
.nav {
  position: fixed; inset: 0 0 auto 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.85rem clamp(1rem, 4vw, 2.5rem);
  color: #fff; transition: background 0.2s, box-shadow 0.2s;
}
.nav.scrolled { background: rgba(15, 36, 28, 0.94); backdrop-filter: blur(10px); box-shadow: 0 1px 0 rgba(255,255,255,.08); }
.nav-brand { display: inline-flex; align-items: center; gap: 0.6rem; font-weight: 700; font-size: 1.05rem; color: inherit; text-decoration: none; }
.nav-logo { width: 2rem; height: 2rem; border-radius: 0.5rem; }
.nav-links { display: flex; gap: 1.75rem; }
.nav-links a, .nav-login { color: rgba(255,255,255,.82); text-decoration: none; font-weight: 500; font-size: 0.95rem; }
.nav-links a:hover, .nav-login:hover { color: #fff; }
.nav-cta { display: flex; align-items: center; gap: 1.1rem; }

/* BUTTONS */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.85rem 1.5rem; border-radius: 0.8rem; font-weight: 600; font-size: 1rem;
  text-decoration: none; border: 1.5px solid transparent; cursor: pointer;
  transition: transform 0.15s, background 0.15s, border-color 0.15s;
}
.btn:hover { transform: translateY(-1px); }
.btn-sm { padding: 0.55rem 1.05rem; font-size: 0.92rem; }
.btn-solid { background: var(--bronze); color: #1a1408; }
.btn-solid:hover { background: #d4b684; }
.btn-ghost { color: #fff; border-color: rgba(255,255,255,.35); }
.btn-ghost:hover { border-color: #fff; }
.btn-outline { color: var(--g700); border-color: var(--g700); }
.btn-outline:hover { background: var(--g700); color: #fff; }
.btn-light { background: #fff; color: var(--g900); }
.btn:focus-visible, a:focus-visible, summary:focus-visible { outline: 3px solid var(--bronze); outline-offset: 3px; }

/* HERO */
.hero {
  position: relative; color: #fff; padding: 9rem 0 5.5rem;
  background: linear-gradient(155deg, var(--g900) 0%, #1a3f32 50%, #2a4d40 100%);
}
.hero-glow {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 60% 50% at 10% 15%, rgba(196,165,116,.30), transparent 60%),
    radial-gradient(ellipse 50% 40% at 90% 85%, rgba(47,122,92,.45), transparent 55%);
}
.hero-grid { position: relative; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 3.5rem; align-items: center; }
.eyebrow { color: var(--bronze); text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.78rem; font-weight: 700; margin-bottom: 1rem; }
.eyebrow.center { text-align: center; }
.eyebrow.light { color: var(--bronze); }
.hero h1 { font-size: clamp(2.3rem, 5vw, 3.8rem); line-height: 1.05; font-weight: 800; letter-spacing: -0.02em; }
.hero h1 em { font-style: italic; color: var(--bronze); font-weight: 700; }
.lead { margin-top: 1.4rem; font-size: 1.15rem; line-height: 1.6; color: rgba(255,255,255,.82); max-width: 34rem; }
.lead.dark { color: var(--muted); }
.hero-actions { display: flex; flex-wrap: wrap; gap: 0.85rem; margin-top: 2rem; }
.hero-points { display: flex; flex-wrap: wrap; gap: 0.6rem 1.5rem; margin-top: 2rem; color: rgba(255,255,255,.7); font-size: 0.92rem; }
.hero-points li::before { content: "✓"; color: var(--bronze); margin-right: 0.45rem; font-weight: 700; }

/* HERO MOCK */
.hero-visual { position: relative; }
.mock { background: #fffcf8; color: var(--ink); border-radius: 1.2rem; box-shadow: 0 30px 70px rgba(0,0,0,.4); overflow: hidden; }
.mock-bar { display: flex; align-items: center; gap: 0.4rem; padding: 0.75rem 1rem; background: #ece8e1; }
.dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: #c9c3b8; }
.mock-title { margin-left: 0.6rem; font-size: 0.8rem; font-weight: 600; color: var(--muted); }
.mock-floor {
  position: relative; height: 15rem; margin: 1rem; border-radius: 0.8rem;
  background-color: #f6f3ee;
  background-image: radial-gradient(rgba(20,26,23,.12) 1px, transparent 1px);
  background-size: 18px 18px;
}
.mock-table { position: absolute; display: grid; place-items: center; font-weight: 700; font-size: 0.95rem; color: #fff; }
.mock-table.round { width: 4rem; height: 4rem; border-radius: 50%; }
.mock-table.wide { width: 6.2rem; height: 3.6rem; border-radius: 0.9rem; }
.mock-table.free { background: #1f7a45; box-shadow: 0 0 0 5px rgba(31,122,69,.18); }
.mock-table.busy { background: #c0392b; box-shadow: 0 0 0 5px rgba(192,57,43,.18); }
.mock-legend { display: flex; gap: 1rem; padding: 0 1rem 1rem; font-size: 0.8rem; font-weight: 600; }
.lg::before { content: ""; display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 50%; margin-right: 0.4rem; }
.lg.free::before { background: #1f7a45; }
.lg.busy::before { background: #c0392b; }
.ticket {
  position: absolute; right: -0.5rem; bottom: -2.2rem; width: 13.5rem;
  background: #fff; color: var(--ink); border-radius: 0.9rem; padding: 1rem 1.1rem;
  box-shadow: 0 20px 45px rgba(0,0,0,.35); font-size: 0.82rem;
}
.ticket-head { font-weight: 700; margin-bottom: 0.6rem; }
.ticket-row, .ticket-total { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.2rem 0; color: var(--muted); }
.ticket-total { margin-top: 0.4rem; padding-top: 0.5rem; border-top: 1px dashed #d8d2c7; color: var(--ink); font-weight: 700; font-size: 0.95rem; }

/* STATS */
.stats { background: var(--paper); border-bottom: 1px solid rgba(20,26,23,.08); padding: 3.2rem 0 2.2rem; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; text-align: center; }
.stat strong { display: block; font-size: 2rem; font-weight: 800; color: var(--g700); letter-spacing: -0.02em; }
.stat span { color: var(--muted); font-size: 0.92rem; }

/* SECTIONS */
.section { padding: 6rem 0; }
.section-soft { background: var(--paper); }
.section-dark { background: var(--g900); color: #fff; }
.title { text-align: center; font-size: clamp(1.8rem, 3.6vw, 2.6rem); font-weight: 800; line-height: 1.12; letter-spacing: -0.02em; max-width: 40rem; margin: 0 auto 3rem; }
.title.left { text-align: left; margin: 0 0 1.2rem; }
.title.light { color: #fff; }

.features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; }
.feature { padding: 1.8rem; border-radius: 1.1rem; background: #fff; border: 1px solid rgba(20,26,23,.08); transition: transform 0.2s, box-shadow 0.2s; }
.feature:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(18,24,22,.09); }
.feature-icon { display: grid; place-items: center; width: 3rem; height: 3rem; border-radius: 0.85rem; background: #e4efe9; color: var(--g700); margin-bottom: 1.1rem; }
.feature h3 { font-size: 1.15rem; margin-bottom: 0.5rem; }
.feature p { color: var(--muted); line-height: 1.55; }

.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; counter-reset: s; }
.steps li { padding: 1.8rem; border-radius: 1.1rem; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); }
.step-n { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: 50%; background: var(--bronze); color: #1a1408; font-weight: 800; margin-bottom: 1.1rem; }
.steps h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.steps p { color: rgba(255,255,255,.75); line-height: 1.55; }

.roles { display: grid; grid-template-columns: 1fr 1fr; gap: 3.5rem; align-items: center; }
.role-list { display: grid; gap: 0.75rem; }
.role-list li { display: flex; flex-direction: column; gap: 0.15rem; padding: 1rem 1.3rem; border-left: 4px solid var(--bronze); background: var(--paper); border-radius: 0 0.8rem 0.8rem 0; }
.role-list b { font-size: 1.02rem; }
.role-list span { color: var(--muted); font-size: 0.93rem; }

.plans { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.6rem; max-width: 50rem; margin: 0 auto; }
.plan { position: relative; display: flex; flex-direction: column; gap: 1rem; padding: 2.2rem; border-radius: 1.2rem; background: #fff; border: 1.5px solid rgba(20,26,23,.1); }
.plan.featured { background: var(--g900); color: #fff; border-color: var(--g900); box-shadow: 0 24px 50px rgba(15,36,28,.28); }
.plan-tag { position: absolute; top: -0.8rem; right: 1.5rem; background: var(--bronze); color: #1a1408; font-size: 0.75rem; font-weight: 800; padding: 0.3rem 0.8rem; border-radius: 99px; }
.plan h3 { font-size: 1.5rem; }
.plan-price { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.02em; }
.plan-price small { font-size: 0.85rem; font-weight: 500; opacity: 0.65; }
.plan-desc { color: var(--muted); }
.plan.featured .plan-price { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.02em; }
.plan-price small { font-size: 0.85rem; font-weight: 500; opacity: 0.65; }
.plan-desc { color: rgba(255,255,255,.7); }
.plan ul { display: grid; gap: 0.6rem; flex: 1; margin: 0.4rem 0 0.8rem; }
.plan li::before { content: "✓"; color: var(--g500); font-weight: 800; margin-right: 0.6rem; }
.plan.featured li::before { color: var(--bronze); }
.note { text-align: center; color: var(--muted); font-size: 0.9rem; margin-top: 1.8rem; }

.faq { border-bottom: 1px solid rgba(20,26,23,.12); padding: 1.2rem 0; }
.faq summary { cursor: pointer; font-weight: 700; font-size: 1.05rem; list-style: none; display: flex; justify-content: space-between; gap: 1rem; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; font-size: 1.4rem; line-height: 1; color: var(--bronze-d); transition: transform 0.2s; }
.faq[open] summary::after { transform: rotate(45deg); }
.faq p { margin-top: 0.8rem; color: var(--muted); line-height: 1.6; }

.cta { padding: 5.5rem 0; color: #fff; text-align: center; background: linear-gradient(155deg, var(--g700), var(--g900)); }
.cta-inner { display: grid; justify-items: center; gap: 1rem; }
.cta h2 { font-size: clamp(1.8rem, 3.6vw, 2.5rem); font-weight: 800; letter-spacing: -0.02em; }
.cta p { color: rgba(255,255,255,.78); font-size: 1.1rem; margin-bottom: 0.6rem; }

.footer { background: var(--g900); color: rgba(255,255,255,.65); padding: 1.8rem 0; font-size: 0.9rem; }
.footer-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.8rem 1.5rem; }
.footer a { color: #fff; text-decoration: none; font-weight: 600; }
.nav-brand.dim { color: #fff; }

@media (max-width: 62rem) {
  .hero-grid, .roles { grid-template-columns: 1fr; }
  .hero-visual { margin-bottom: 2.5rem; }
  .features { grid-template-columns: repeat(2, 1fr); }
  .steps { grid-template-columns: 1fr; }
  .nav-links { display: none; }
}
@media (max-width: 40rem) {
  .hero { padding: 7rem 0 4rem; }
  .features, .plans, .stats-grid { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .section { padding: 4.2rem 0; }
  .ticket { right: 0; width: 12rem; }
  .nav-login { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .landing { scroll-behavior: auto; }
  .btn, .feature { transition: none; }
}
</style>
