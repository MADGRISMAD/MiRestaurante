<template>
  <div class="landing">
    <header class="nav" :class="{ scrolled }">
      <a href="#top" class="brand">
        <img src="/logo.svg" alt="" />
        <span>MiRestaurante</span>
      </a>
      <nav class="nav-links" aria-label="Principal">
        <a href="#flujo">Cómo funciona</a>
        <a href="#funciones">Funciones</a>
        <a href="#equipo">Equipo</a>
        <a href="#planes">Planes</a>
      </nav>
      <div class="nav-cta">
        <span class="live" aria-hidden="true"><i></i>En servicio · {{ clock }}</span>
        <router-link v-if="logged" :to="{ name: home }" class="btn btn-primary btn-sm">Ir a mi salón</router-link>
        <template v-else>
          <router-link to="/login" class="nav-login">Ingresar</router-link>
          <router-link to="/register" class="btn btn-primary btn-sm">Empezar gratis</router-link>
        </template>
      </div>
    </header>

    <main id="top">
      <!-- HERO: el pase de cocina en vivo -->
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <p class="kicker load" style="--i: 0"><span class="pulse"></span>Sistema de comandas para restaurantes</p>
            <h1 class="h1" aria-label="Cada comanda, en su lugar.">
              <span
                v-for="(w, i) in heroWords"
                :key="i"
                class="word"
                :class="{ accent: i === 1 }"
                :style="{ '--i': i + 1 }"
                aria-hidden="true"
              >{{ w }}<svg v-if="i === 1" class="scribble" viewBox="0 0 200 14" preserveAspectRatio="none"><path d="M3 9c40-6 90-8 194-3" /></svg></span>
            </h1>
            <p class="lead load" style="--i: 6">
              Del mesero a la cocina y de la cocina a la caja. Toma pedidos desde el celular y
              míralos llegar al instante, sin papelitos ni gritos.
            </p>
            <div class="actions load" style="--i: 7">
              <router-link to="/register" class="btn btn-primary">Abrir mi restaurante</router-link>
              <a href="#flujo" class="btn btn-ghost">Ver una comanda en acción</a>
            </div>
            <ul class="checks load" style="--i: 8">
              <li>Prueba gratis 14 días</li>
              <li>Sin instalar nada</li>
              <li>Celular, tablet o PC</li>
            </ul>
          </div>

          <div class="pass load" style="--i: 3" aria-hidden="true">
            <div class="pass-head">
              <span>Pase · Cocina</span>
              <span class="pass-count"><b :key="activeCount" class="bump">{{ activeCount }}</b> en curso</span>
            </div>
            <div class="rail-wrap">
              <div class="rail"></div>
              <TransitionGroup tag="div" name="tk" class="tickets">
                <article
                  v-for="t in tickets"
                  :key="t.id"
                  class="tk"
                  :class="'is-' + t.state"
                  :style="{ '--r': t.tilt + 'deg', '--sway': (t.id % 3) * -0.7 + 's' }"
                >
                  <div class="tk-paper">
                    <header class="tk-head"><b>#{{ t.num }}</b><span>Mesa {{ t.mesa }}</span></header>
                    <ul class="tk-items">
                      <li v-for="it in t.items" :key="it">{{ it }}</li>
                    </ul>
                    <footer class="tk-foot">
                      <span class="tk-state">{{ stateLabel[t.state] }}</span>
                      <span class="tk-time">{{ elapsed(t) }}</span>
                    </footer>
                    <span class="tk-stamp">Listo</span>
                  </div>
                </article>
              </TransitionGroup>
            </div>
            <div class="floor">
              <div v-for="m in 8" :key="m" class="mesa" :class="['m-' + mesaState(m), m % 3 === 0 ? 'round' : '']">
                <span>{{ m }}</span>
              </div>
            </div>
            <div class="legend">
              <span class="lg libre">Libre</span>
              <span class="lg pedido">Pidiendo</span>
              <span class="lg listo">Listo</span>
              <span class="lg comiendo">Comiendo</span>
            </div>
          </div>
        </div>
      </section>

      <!-- TICKER -->
      <div class="ticker" aria-hidden="true">
        <div class="ticker-track">
          <span v-for="(e, i) in [...events, ...events]" :key="i"><i :class="e.tone"></i>{{ e.text }}</span>
        </div>
      </div>

      <!-- FLUJO -->
      <section id="flujo" ref="flow" class="section">
        <div class="wrap">
          <header class="sec-head" v-reveal>
            <span class="sec-num">01 — Flujo</span>
            <h2>Una comanda, <span class="hl">cuatro paradas.</span></h2>
            <p>Así viaja cada pedido por tu restaurante. Toca una parada o deja que avance sola.</p>
          </header>

          <div class="stations" role="tablist" aria-label="Paradas de la comanda" v-reveal="80">
            <button
              v-for="(s, i) in flow"
              :key="s.who"
              role="tab"
              :aria-selected="i === step"
              class="station"
              :class="{ on: i === step, done: i < step }"
              @click="step = i"
            >
              <span class="st-n">{{ i + 1 }}</span>
              <span class="st-who">{{ s.who }}</span>
              <span class="st-what">{{ s.what }}</span>
              <span class="st-bar">
                <i
                  v-if="i === step"
                  :key="step"
                  :class="{ paused: !flowVisible || flowHover }"
                  @animationend="step = (step + 1) % flow.length"
                ></i>
              </span>
            </button>
          </div>

          <div class="flow-stage" v-reveal="160" @mouseenter="flowHover = true" @mouseleave="flowHover = false">
            <Transition name="swap" mode="out-in">
              <div :key="step" class="flow-panel" role="tabpanel">
                <div class="flow-copy">
                  <h3>{{ flow[step].title }}</h3>
                  <p>{{ flow[step].text }}</p>
                </div>
                <div class="screen">
                  <div class="screen-top">
                    <span>{{ flow[step].who }}</span><span class="mono">{{ clock }}</span>
                  </div>
                  <ul class="screen-rows">
                    <li v-for="(r, j) in flow[step].rows" :key="j" :class="r.tone" :style="{ '--j': j }">
                      <span>{{ r.label }}</span><b>{{ r.value }}</b>
                    </li>
                  </ul>
                  <span class="screen-btn" :style="{ '--j': flow[step].rows.length }">{{ flow[step].action }}</span>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- FUNCIONES -->
      <section id="funciones" class="section section-paper">
        <div class="wrap">
          <header class="sec-head" v-reveal>
            <span class="sec-num">02 — Funciones</span>
            <h2>Todo el servicio, <span class="hl">en una pantalla.</span></h2>
          </header>
          <div class="features">
            <article v-for="(f, i) in features" :key="f.title" class="feature" v-reveal="i * 70">
              <div class="viz" :class="'viz-' + f.viz">
                <template v-if="f.viz === 'mesas'"><i v-for="n in 6" :key="n" :style="{ '--n': n }"></i></template>
                <template v-else-if="f.viz === 'cocina'">
                  <p v-for="(d, n) in ['Tacos', 'Pozole', 'Flan']" :key="d" :style="{ '--n': n }"><span>{{ d }}</span><i></i></p>
                </template>
                <div v-else-if="f.viz === 'espera'" class="queue">
                  <p v-for="(n, k) in [...waitlist, ...waitlist]" :key="k"><b>{{ n.name }}</b><span>{{ n.size }} pers.</span></p>
                </div>
                <div v-else-if="f.viz === 'caja'" class="receipt">
                  <p><span>Mesa 4</span><b>$225</b></p>
                  <p><span>Mesa 7</span><b>$480</b></p>
                  <p><span>Mesa 2</span><b>$135</b></p>
                  <p class="sum"><span>Cierre</span><b>$840</b></p>
                </div>
                <div v-else-if="f.viz === 'celular'" class="phone">
                  <span class="badge">+1 enviado</span>
                  <span class="tap">Enviar a cocina</span>
                </div>
                <div v-else class="toggle"><span class="knob"></span></div>
              </div>
              <h3><span class="mono">0{{ i + 1 }}</span>{{ f.title }}</h3>
              <p>{{ f.text }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- EQUIPO -->
      <section id="equipo" class="section section-board">
        <div class="wrap team">
          <header class="sec-head light" v-reveal>
            <span class="sec-num">03 — Equipo</span>
            <h2>Cada quien ve <span class="hl">solo lo suyo.</span></h2>
            <p>Menos ruido, menos errores, servicio más rápido.</p>
          </header>
          <div class="roles" v-reveal="100">
            <div class="role-tabs" role="tablist" aria-label="Roles" :style="{ '--idx': role }">
              <span class="role-ind" aria-hidden="true"></span>
              <button
                v-for="(r, i) in roles"
                :key="r.name"
                role="tab"
                :aria-selected="i === role"
                :class="{ on: i === role }"
                @click="role = i"
              >{{ r.name }}</button>
            </div>
            <Transition name="swap" mode="out-in">
              <div :key="role" class="role-card" role="tabpanel">
                <h3>{{ roles[role].title }}</h3>
                <p>{{ roles[role].text }}</p>
                <ul>
                  <li v-for="(s, j) in roles[role].sees" :key="s" :style="{ '--j': j }">{{ s }}</li>
                </ul>
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- PLANES -->
      <section id="planes" class="section">
        <div class="wrap">
          <header class="sec-head" v-reveal>
            <span class="sec-num">04 — Planes</span>
            <h2>Precio claro, <span class="hl">sin letra chica.</span></h2>
            <p>14 días gratis. Cobros con Mercado Pago dentro de la plataforma.</p>
          </header>
          <div class="plans">
            <article v-for="(p, i) in plans" :key="p.name" class="plan" :class="{ featured: p.featured }" v-reveal="i * 100">
              <div class="plan-body">
                <p class="plan-top"><span class="mono">Plan</span><span v-if="p.featured" class="plan-tag">Más popular</span></p>
                <h3>{{ p.name }}</h3>
                <p class="plan-price">{{ p.price }}<small> MXN / mes</small></p>
                <p class="plan-desc">{{ p.desc }}</p>
                <ul>
                  <li v-for="it in p.items" :key="it">{{ it }}</li>
                </ul>
              </div>
              <div class="plan-foot">
                <router-link to="/register" class="btn" :class="p.featured ? 'btn-primary' : 'btn-ink'">Empezar con {{ p.name }}</router-link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section id="preguntas" class="section section-paper">
        <div class="wrap faq-grid">
          <header class="sec-head" v-reveal>
            <span class="sec-num">05 — Dudas</span>
            <h2>Lo que nos <span class="hl">preguntan.</span></h2>
          </header>
          <div v-reveal="100">
            <details v-for="q in faqs" :key="q.q" class="faq">
              <summary>{{ q.q }}<span class="faq-x" aria-hidden="true"></span></summary>
              <p>{{ q.a }}</p>
            </details>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta">
        <div class="wrap cta-grid">
          <div v-reveal>
            <h2>Tu primera comanda, <span class="hl">hoy.</span></h2>
            <p>Crea tu cuenta, configura tus mesas y menú, y empieza a servir.</p>
            <router-link to="/register" class="btn btn-primary btn-lg">Abrir mi restaurante</router-link>
          </div>
          <div class="print" v-reveal="150" aria-hidden="true">
            <div class="print-slot"></div>
            <div class="print-paper">
              <p class="mono"><b>#0001</b><span>Tu restaurante</span></p>
              <p><span>1× Cuenta nueva</span><b>✓</b></p>
              <p><span>1× Mesas y menú</span><b>✓</b></p>
              <p><span>1× Equipo invitado</span><b>✓</b></p>
              <p class="sum"><span>Servicio</span><b>Abierto</b></p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="wrap footer-inner">
        <span class="brand"><img src="/logo.svg" alt="" /> MiRestaurante</span>
        <span>© {{ year }} MiRestaurante</span>
        <router-link to="/login">Ingresar</router-link>
      </div>
    </footer>
  </div>
</template>

<script>
import { isAuthenticated, homeForRole } from "../authStore";

const MENU = [
  ["2× Tacos al pastor", "1× Agua de jamaica"],
  ["1× Pozole rojo", "1× Tostadas"],
  ["3× Enchiladas verdes"],
  ["1× Chilaquiles", "2× Café de olla"],
  ["2× Quesadillas", "1× Guacamole"],
  ["1× Mole poblano", "1× Arroz"],
  ["4× Tacos de suadero", "2× Horchata"],
  ["1× Sopa azteca", "1× Flan"],
];

let seq = 0;
const makeTicket = (state, ageSec) => {
  seq++;
  return {
    id: seq,
    num: String(140 + seq).padStart(4, "0"),
    mesa: ((seq * 3) % 8) + 1,
    items: MENU[seq % MENU.length],
    state,
    start: Date.now() - ageSec * 1000,
    tilt: (((seq * 7) % 5) - 2) * 0.7,
  };
};

// Reveal-on-scroll: one shared observer, adds .in once.
let io;
const reveal = {
  mounted(el, { value }) {
    el.classList.add("rv");
    if (value) el.style.setProperty("--d", value + "ms");
    if (!("IntersectionObserver" in window)) return el.classList.add("in");
    io ??= new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
  },
  unmounted(el) {
    io?.unobserve(el);
  },
};

export default {
  name: "LandingView",
  directives: { reveal },
  data() {
    return {
      scrolled: false,
      year: new Date().getFullYear(),
      logged: isAuthenticated(),
      home: isAuthenticated() ? homeForRole() : "login",
      now: Date.now(),
      half: 1,
      tickets: [makeTicket("cocina", 412), makeTicket("cocina", 236), makeTicket("nuevo", 38)],
      served: [2, 5],
      step: 0,
      flowVisible: false,
      flowHover: false,
      role: 0,
      heroWords: ["Cada", "comanda,", "en", "su", "lugar."],
      stateLabel: { nuevo: "Nuevo", cocina: "Cocina", listo: "Listo" },
      events: [
        { tone: "red", text: "Mesa 7 pidió 2× Tacos al pastor" },
        { tone: "amber", text: "Cocina tomó la #0148" },
        { tone: "green", text: "Mesa 3 · listo para servir" },
        { tone: "ink", text: "Caja cobró $640 a Mesa 5" },
        { tone: "red", text: "Mesa 1 pidió 1× Pozole rojo" },
        { tone: "amber", text: "Familia Ruiz · 4 en lista de espera" },
        { tone: "green", text: "Mesa 6 · listo para servir" },
        { tone: "ink", text: "Cierre de caja enviado" },
      ],
      flow: [
        {
          who: "Mesero",
          what: "Toma el pedido",
          title: "En la mesa, desde el celular.",
          text: "El mesero elige platillos del menú con fotos y precios, agrega notas como “sin cebolla” y lo envía con un toque.",
          rows: [
            { label: "Mesa 7 · 4 personas", value: "", tone: "head" },
            { label: "2× Tacos al pastor", value: "$180" },
            { label: "1× Agua de jamaica", value: "$40" },
            { label: "Nota: sin cebolla", value: "", tone: "note" },
          ],
          action: "Enviar a cocina",
        },
        {
          who: "Cocina",
          what: "Lo ve al instante",
          title: "La cocina lo recibe en segundos.",
          text: "Cada comanda llega a la pantalla de cocina con su mesa y un reloj corriendo. Nada se pierde entre papeles.",
          rows: [
            { label: "#0148 · Mesa 7", value: "00:12", tone: "head" },
            { label: "2× Tacos al pastor", value: "" },
            { label: "1× Agua de jamaica", value: "" },
            { label: "Estado", value: "En cocina", tone: "amber" },
          ],
          action: "Marcar listo",
        },
        {
          who: "Mesa",
          what: "Sale a tiempo",
          title: "El salón sabe qué está listo.",
          text: "El mapa de mesas cambia de color cuando un plato está listo, así el mesero sale de la cocina sin preguntar.",
          rows: [
            { label: "Mesa 7", value: "Listo", tone: "green" },
            { label: "Mesa 3", value: "Pidiendo", tone: "amber" },
            { label: "Mesa 5", value: "Comiendo" },
            { label: "Mesa 2", value: "Libre" },
          ],
          action: "Llevar a Mesa 7",
        },
        {
          who: "Caja",
          what: "Cobra y cierra",
          title: "Cuenta exacta, cierre sin sustos.",
          text: "La cuenta ya está armada. Cobra, imprime y al final del día haz el cierre de caja con todo el detalle.",
          rows: [
            { label: "Subtotal", value: "$220" },
            { label: "Propina 15%", value: "$33" },
            { label: "Total Mesa 7", value: "$253", tone: "head" },
            { label: "Método", value: "Tarjeta" },
          ],
          action: "Cobrar $253",
        },
      ],
      features: [
        { viz: "mesas", title: "Mapa de mesas", text: "Acomoda tu salón y ve de un vistazo qué mesa está libre, pidiendo o lista." },
        { viz: "cocina", title: "Cocina en tiempo real", text: "Las comandas llegan solas y se marcan al salir. El reloj dice cuál va tarde." },
        { viz: "espera", title: "Lista de espera", text: "Anota a quien espera y asígnale mesa en cuanto se libere una." },
        { viz: "caja", title: "Caja y cierre", text: "Cobra, imprime cuentas y cierra el día con el detalle de cada mesa." },
        { viz: "celular", title: "Pedidos desde el celular", text: "Sin terminales caras: cualquier celular o tablet es un punto de venta." },
        { viz: "marca", title: "Tu marca, día y noche", text: "Tu nombre y logo en todo. Modo claro y oscuro para cualquier turno." },
      ],
      waitlist: [
        { name: "Familia Ruiz", size: 4 },
        { name: "Andrea M.", size: 2 },
        { name: "Grupo Soto", size: 6 },
      ],
      roles: [
        { name: "Admin", title: "Administrador", text: "Controla el negocio completo, de la carta a la facturación.", sees: ["Panel del día", "Menú y precios", "Personal e invitaciones", "Ajustes y facturación"] },
        { name: "Mesero", title: "Mesero", text: "Todo lo que necesita para atender rápido, nada más.", sees: ["Mapa de mesas", "Tomar pedidos", "Platos listos"] },
        { name: "Cocina", title: "Cocina", text: "Una cola clara de comandas por preparar, en orden.", sees: ["Comandas nuevas", "Tiempo por pedido", "Marcar listo"] },
        { name: "Caja", title: "Caja", text: "Cuentas armadas al momento y un cierre sin sorpresas.", sees: ["Cobros", "Impresión de cuentas", "Cierre del día"] },
        { name: "Anfitrión", title: "Anfitrión", text: "La puerta en orden, incluso en hora pico.", sees: ["Lista de espera", "Mesas libres", "Asignar mesa"] },
      ],
      plans: [
        { name: "Básico", price: "$799", desc: "Para negocios que están empezando.", items: ["1 local", "Mesas, pedidos y menú", "Cocina y caja", "Impresión de cuentas"], featured: false },
        { name: "Pro", price: "$1,499", desc: "Para operaciones con más volumen.", items: ["Todo lo del plan Básico", "Prioridad de soporte", "Reportes (próximamente)"], featured: true },
      ],
      faqs: [
        { q: "¿Necesito instalar algo?", a: "No. MiRestaurante funciona desde el navegador en celular, tablet o computadora." },
        { q: "¿Puedo usarlo con mi equipo?", a: "Sí. Invita a meseros, cocina, caja y anfitriones; cada rol ve solo sus herramientas." },
        { q: "¿Puedo personalizarlo con mi marca?", a: "Sí. En el asistente inicial configuras el nombre y logo de tu negocio." },
        { q: "¿Cómo pago?", a: "La suscripción se gestiona dentro de la plataforma, en la sección de facturación, con Mercado Pago." },
      ],
    };
  },
  computed: {
    clock() {
      return new Date(this.now).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    },
    activeCount() {
      return this.tickets.filter((t) => t.state !== "listo").length;
    },
  },
  mounted() {
    this.onScroll();
    window.addEventListener("scroll", this.onScroll, { passive: true });
    this.clockTimer = setInterval(() => (this.now = Date.now()), 1000);
    this.simTimer = setInterval(this.tick, 1900);
    this.flowIO = new IntersectionObserver(([e]) => (this.flowVisible = e.isIntersecting), { threshold: 0.35 });
    this.flowIO.observe(this.$refs.flow);
  },
  beforeUnmount() {
    window.removeEventListener("scroll", this.onScroll);
    clearInterval(this.clockTimer);
    clearInterval(this.simTimer);
    this.flowIO.disconnect();
  },
  methods: {
    onScroll() {
      this.scrolled = window.scrollY > 8;
    },
    // Alternates: (A) ready tickets leave + a new one arrives, (B) everything advances one state.
    tick() {
      if (document.hidden) return;
      if (this.half++ % 2 === 0) {
        const done = this.tickets.filter((t) => t.state === "listo").map((t) => t.mesa);
        this.served = [...done, ...this.served].slice(0, 3);
        this.tickets = [...this.tickets.filter((t) => t.state !== "listo"), makeTicket("nuevo", 0)];
      } else {
        const c = this.tickets.find((t) => t.state === "cocina");
        if (c) c.state = "listo";
        const n = this.tickets.find((t) => t.state === "nuevo");
        if (n) n.state = "cocina";
      }
    },
    elapsed(t) {
      const s = Math.max(0, Math.floor((this.now - t.start) / 1000));
      return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    },
    mesaState(m) {
      const t = this.tickets.find((x) => x.mesa === m);
      if (t) return t.state === "listo" ? "listo" : "pedido";
      return this.served.includes(m) ? "comiendo" : "libre";
    },
  },
};
</script>

<style scoped>
.landing {
  --paper: #f4efe6;
  --paper-2: #ebe3d5;
  --card: #fffdf8;
  --ink: #1b1814;
  --ink-2: #4d463c;
  --line: rgba(27, 24, 20, 0.12);
  --board: #1c1a17;
  --board-2: #272420;
  --tomato: #d0371f;
  --tomato-l: #ff6a4d;
  --amber: #e8a020;
  --basil: #2f8f4e;
  --basil-l: #4cc274;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-io: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
  --display: "Bricolage Grotesque", var(--font-sans);
  --mono: "JetBrains Mono", ui-monospace, monospace;
  font-family: var(--font-sans);
  font-size: 1.0625rem;
  line-height: 1.6;
  color: var(--ink);
  background: var(--paper);
  overflow-x: clip;
  interpolate-size: allow-keywords;
}
.landing :where(h1, h2, h3, p, ul) { margin: 0; }
.landing :where(ul) { padding: 0; list-style: none; }
.wrap { width: min(74rem, 100% - 2.5rem); margin-inline: auto; }
.mono { font-family: var(--mono); }
.landing :focus-visible { outline: 3px solid var(--tomato); outline-offset: 3px; border-radius: 0.4rem; }

/* ---------- NAV ---------- */
.nav {
  position: fixed; inset: 0 0 auto; z-index: 30;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.9rem clamp(1rem, 4vw, 2.5rem);
  transition: background-color 0.25s ease, box-shadow 0.25s ease, padding 0.25s var(--ease-out);
}
.nav.scrolled {
  padding-block: 0.6rem;
  background: rgba(244, 239, 230, 0.86);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow: 0 1px 0 var(--line);
}
.brand { display: inline-flex; align-items: center; gap: 0.6rem; font-family: var(--display); font-weight: 700; font-size: 1.1rem; color: inherit; text-decoration: none; }
.brand img { width: 2rem; height: 2rem; border-radius: 0.55rem; }
.nav-links { display: flex; gap: 0.25rem; }
.nav-links a, .nav-login {
  color: var(--ink-2); text-decoration: none; font-weight: 600; font-size: 0.95rem;
  padding: 0.4rem 0.75rem; border-radius: 99px; transition: background-color 0.2s ease, color 0.2s ease;
}
.nav-cta { display: flex; align-items: center; gap: 0.6rem; }
.live {
  display: inline-flex; align-items: center; gap: 0.45rem; font-family: var(--mono); font-size: 0.78rem; font-weight: 500;
  color: var(--ink-2); padding: 0.35rem 0.7rem; border: 1px solid var(--line); border-radius: 99px; margin-right: 0.3rem;
}
.live i, .pulse { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--basil-l); position: relative; }
.live i::after, .pulse::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: inherit; animation: ping 1.8s var(--ease-out) infinite; }
@keyframes ping { to { transform: scale(3); opacity: 0; } }

/* ---------- BUTTONS ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.9rem 1.5rem; border-radius: 0.85rem; font-weight: 700; font-size: 1rem;
  text-decoration: none; border: 1.5px solid transparent; cursor: pointer; user-select: none;
  transition: transform 0.16s var(--ease-out), background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.btn:active { transform: scale(0.97); }
.btn-sm { padding: 0.55rem 1rem; font-size: 0.92rem; border-radius: 0.7rem; }
.btn-lg { padding: 1.1rem 1.9rem; font-size: 1.1rem; }
.btn-primary { background: var(--tomato); color: #fff; box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 6px 18px -6px rgba(208,55,31,.6); }
.btn-ghost { color: var(--ink); border-color: var(--line); background: rgba(255,255,255,.4); }
.btn-ink { background: var(--ink); color: var(--paper); }

@media (hover: hover) and (pointer: fine) {
  .nav-links a:hover, .nav-login:hover { background: rgba(27,24,20,.07); color: var(--ink); }
  .btn-primary:hover { background: #bb2f19; box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 10px 24px -8px rgba(208,55,31,.7); }
  .btn-ghost:hover { border-color: var(--ink); }
  .btn-ink:hover { background: #000; }
}

/* ---------- LOAD SEQUENCE (hero, once) ---------- */
.load, .word {
  animation: rise 0.8s var(--ease-out) both;
  animation-delay: calc(var(--i) * 70ms + 80ms);
}
@keyframes rise {
  from { opacity: 0; transform: translateY(0.6em); filter: blur(6px); }
}

/* ---------- HERO ---------- */
.hero { padding: 8.5rem 0 4.5rem; position: relative; }
.hero::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(27,24,20,.09) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(to bottom, #000 40%, transparent);
}
.hero-grid > *, .team > *, .faq-grid > *, .cta-grid > * { min-width: 0; }
.hero-grid { position: relative; display: grid; grid-template-columns: 1fr 1.05fr; gap: clamp(2rem, 5vw, 4.5rem); align-items: center; }
.kicker { display: inline-flex; align-items: center; gap: 0.6rem; font-weight: 700; font-size: 0.9rem; color: var(--ink-2); margin-bottom: 1.25rem; }
.h1 { font-family: var(--display); font-size: clamp(2.9rem, 7vw, 5.4rem); line-height: 0.98; letter-spacing: -0.035em; font-weight: 800; }
.word { display: inline-block; margin-right: 0.22em; position: relative; }
.word.accent { color: var(--tomato); }
.scribble { position: absolute; left: 0; right: 0.2em; bottom: -0.12em; width: calc(100% - 0.2em); height: 0.22em; overflow: visible; }
.scribble path { fill: none; stroke: var(--tomato); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 210; stroke-dashoffset: 210; animation: draw 0.9s var(--ease-out) 1.05s forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
.lead { margin-top: 1.6rem; font-size: 1.2rem; line-height: 1.6; color: var(--ink-2); max-width: 31rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2rem; }
.checks { display: flex; flex-wrap: wrap; gap: 0.5rem 1.4rem; margin-top: 1.75rem; font-size: 0.95rem; font-weight: 600; color: var(--ink-2); }
.checks li::before { content: "✓"; color: var(--basil); font-weight: 800; margin-right: 0.4rem; }

/* the pass */
.pass {
  background: var(--board); color: #f4efe6; border-radius: 1.5rem; padding: 1.1rem 1.1rem 1.25rem;
  box-shadow: 0 40px 80px -30px rgba(27,24,20,.55), 0 0 0 1px rgba(255,255,255,.04) inset;
}
.pass-head { display: flex; justify-content: space-between; align-items: center; font-family: var(--mono); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(244,239,230,.6); padding: 0 0.3rem 0.7rem; }
.pass-count b { display: inline-block; color: var(--amber); font-size: 0.95rem; }
.bump { animation: bump 0.4s var(--ease-pop); }
@keyframes bump { from { transform: scale(1.5); } }

.rail-wrap { position: relative; height: 12.5rem; overflow: hidden; margin: 0 -1.1rem; padding: 0 1.1rem; }
.rail {
  position: absolute; left: 0.6rem; right: 0.6rem; top: 0.4rem; height: 0.7rem; border-radius: 99px; z-index: 2;
  background: linear-gradient(#cfcac2, #8d877e 55%, #b7b1a7);
  box-shadow: 0 3px 6px rgba(0,0,0,.5);
}
.tickets { position: relative; display: flex; gap: 0.75rem; padding-top: 0.5rem; }
.tk {
  flex: 0 0 9.6rem; transform-origin: 50% 0;
  rotate: var(--r); /* separate from transform so FLIP moves keep the tilt */
  filter: drop-shadow(0 8px 10px rgba(0,0,0,.45));
}
.tk-paper {
  position: relative; transform-origin: 50% 0;
  background: #fbf7ef; color: var(--ink); font-family: var(--mono); font-size: 0.74rem; line-height: 1.45;
  padding: 1rem 0.8rem 0.75rem; border-radius: 0.2rem 0.2rem 0 0;
  animation: sway 3.6s ease-in-out var(--sway) infinite alternate;
  --zig: linear-gradient(#000 0 0) top / 100% calc(100% - 4px) no-repeat, radial-gradient(circle at 50% 100%, transparent 3px, #000 3.5px) bottom / 9px 4px repeat-x;
  -webkit-mask: var(--zig); mask: var(--zig);
  padding-bottom: 1rem;
}
@keyframes sway { from { transform: rotate(-0.8deg); } to { transform: rotate(0.8deg); } }
.tk-head { display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(27,24,20,.3); padding-bottom: 0.45rem; margin-bottom: 0.45rem; font-size: 0.8rem; }
.tk-items { min-height: 2.3rem; }
.tk-items li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 0.6rem; }
.tk-state { white-space: nowrap; padding: 0.12rem 0.45rem; border-radius: 0.3rem; font-weight: 700; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; transition: background-color 0.3s ease, color 0.3s ease; }
.tk-time { font-weight: 700; font-variant-numeric: tabular-nums; }
.is-nuevo .tk-state { background: var(--tomato); color: #fff; }
.is-cocina .tk-state { background: var(--amber); color: #2a1d05; }
.is-listo .tk-state { background: var(--basil); color: #fff; }
.tk-stamp {
  position: absolute; left: 50%; top: 46%; translate: -50% -50%;
  font-family: var(--display); font-weight: 800; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--basil); border: 3px solid currentColor; border-radius: 0.4rem; padding: 0 0.5rem;
  opacity: 0; transform: rotate(-14deg) scale(1.8);
  transition: opacity 0.12s ease, transform 0.35s var(--ease-pop);
  pointer-events: none; mix-blend-mode: multiply;
}
.is-listo .tk-stamp { opacity: 0.9; transform: rotate(-14deg) scale(1); }

/* ticket list transitions — interruptible transitions, not keyframes */
.tk-move { transition: transform 0.6s var(--ease-io); }
.tk-enter-active { transition: transform 0.6s var(--ease-out), opacity 0.4s ease; }
.tk-leave-active { transition: transform 0.4s cubic-bezier(0.5, 0, 0.75, 0), opacity 0.3s ease 0.1s; position: absolute; top: 0.5rem; left: 0; width: 9.6rem; }
.tk-enter-from { opacity: 0; transform: translate(3rem, -1.5rem) rotate(6deg); }
.tk-leave-to { opacity: 0; transform: translateY(9rem) rotate(-10deg); }

.floor { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.5rem; margin-top: 0.4rem; padding: 0.9rem; background: var(--board-2); border-radius: 1rem; }
.mesa {
  position: relative; aspect-ratio: 1; display: grid; place-items: center; border-radius: 0.55rem;
  font-family: var(--mono); font-weight: 700; font-size: 0.8rem;
  border: 1.5px dashed rgba(244,239,230,.25); color: rgba(244,239,230,.55);
  transition: background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease, transform 0.4s var(--ease-pop);
}
.mesa.round { border-radius: 50%; }
.m-pedido { background: var(--amber); border: 1.5px solid var(--amber); color: #2a1d05; }
.m-listo { background: var(--basil-l); border: 1.5px solid var(--basil-l); color: #08210f; transform: scale(1.08); }
.m-listo::after { content: ""; position: absolute; inset: -1.5px; border-radius: inherit; border: 2px solid var(--basil-l); animation: ring 1.2s var(--ease-out) infinite; }
@keyframes ring { to { transform: scale(1.6); opacity: 0; } }
.m-comiendo { background: rgba(244,239,230,.14); border: 1.5px solid rgba(244,239,230,.2); color: #f4efe6; }
.legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin-top: 0.8rem; padding: 0 0.3rem; font-size: 0.78rem; font-weight: 600; color: rgba(244,239,230,.7); }
.lg::before { content: ""; display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 0.2rem; margin-right: 0.4rem; vertical-align: -0.05em; }
.lg.libre::before { border: 1.5px dashed rgba(244,239,230,.4); }
.lg.pedido::before { background: var(--amber); }
.lg.listo::before { background: var(--basil-l); }
.lg.comiendo::before { background: rgba(244,239,230,.3); }

/* ---------- TICKER ---------- */
.ticker { background: var(--ink); color: var(--paper); overflow: hidden; padding: 0.95rem 0; font-family: var(--mono); font-size: 0.88rem; }
.ticker-track { display: flex; width: max-content; animation: marquee 48s linear infinite; }
.ticker:hover .ticker-track { animation-play-state: paused; }
.ticker span { display: inline-flex; align-items: center; gap: 0.6rem; padding-right: 2.75rem; white-space: nowrap; }
.ticker i { width: 0.55rem; height: 0.55rem; border-radius: 50%; }
.ticker .red { background: var(--tomato-l); }
.ticker .amber { background: var(--amber); }
.ticker .green { background: var(--basil-l); }
.ticker .ink { background: var(--paper); }
@keyframes marquee { to { transform: translateX(-50%); } }

/* ---------- SCROLL REVEAL ---------- */
.rv { opacity: 0; transform: translateY(24px); filter: blur(4px); transition: opacity 0.7s var(--ease-out), transform 0.7s var(--ease-out), filter 0.7s var(--ease-out); transition-delay: var(--d, 0ms); }
.rv.in { opacity: 1; transform: none; filter: none; }

/* ---------- SECTIONS ---------- */
.section { padding: clamp(4.5rem, 10vw, 7.5rem) 0; }
.section-paper { background: var(--paper-2); }
.section-board { background: var(--board); color: var(--paper); }
.sec-head { max-width: 44rem; margin-bottom: clamp(2.2rem, 5vw, 3.5rem); }
.sec-num { display: inline-block; font-family: var(--mono); font-size: 0.82rem; font-weight: 500; color: var(--tomato); margin-bottom: 0.9rem; }
.sec-head h2 { font-family: var(--display); font-size: clamp(2.2rem, 5vw, 3.6rem); line-height: 1.02; letter-spacing: -0.03em; font-weight: 800; }
.sec-head p { margin-top: 1rem; color: var(--ink-2); font-size: 1.15rem; max-width: 34rem; }
.sec-head.light p { color: rgba(244,239,230,.72); }
.sec-head.light .sec-num { color: var(--tomato-l); }
.hl { color: var(--ink-2); }
.section-board .hl { color: rgba(244,239,230,.5); }

/* flow */
.stations { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-bottom: 1rem; }
.station {
  position: relative; display: grid; grid-template-columns: auto 1fr; column-gap: 0.75rem; align-items: center; text-align: left;
  padding: 1rem 1.1rem 1.3rem; border-radius: 1rem; border: 1.5px solid var(--line); background: var(--card); color: var(--ink);
  cursor: pointer; overflow: hidden;
  transition: transform 0.16s var(--ease-out), border-color 0.25s ease, background-color 0.25s ease, color 0.25s ease;
}
.station:active { transform: scale(0.97); }
.st-n {
  grid-row: span 2; display: grid; place-items: center; width: 2.3rem; height: 2.3rem; border-radius: 50%;
  font-family: var(--mono); font-weight: 700; background: var(--paper-2);
  transition: background-color 0.25s ease, color 0.25s ease;
}
.st-who { font-weight: 800; font-size: 1.05rem; }
.st-what { font-size: 0.88rem; color: var(--ink-2); transition: color 0.25s ease; }
.station.on { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.station.on .st-n { background: var(--tomato); color: #fff; }
.station.on .st-what { color: rgba(244,239,230,.7); }
.station.done .st-n { background: var(--basil); color: #fff; }
.st-bar { position: absolute; left: 1.1rem; right: 1.1rem; bottom: 0.6rem; height: 3px; border-radius: 99px; background: rgba(127,127,127,.18); overflow: hidden; }
.st-bar i { display: block; height: 100%; background: var(--tomato-l); transform-origin: left; animation: fill 4.5s linear forwards; }
.st-bar i.paused { animation-play-state: paused; }
@keyframes fill { from { transform: scaleX(0); } }
@media (hover: hover) and (pointer: fine) {
  .station:not(.on):hover { border-color: var(--ink); }
}

.flow-stage { background: var(--card); border: 1.5px solid var(--line); border-radius: 1.5rem; padding: clamp(1.5rem, 4vw, 3rem); min-height: 22rem; }
.flow-panel { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(1.5rem, 4vw, 3.5rem); align-items: center; }
.flow-copy h3 { font-family: var(--display); font-size: clamp(1.6rem, 3vw, 2.3rem); line-height: 1.08; letter-spacing: -0.02em; margin-bottom: 1rem; }
.flow-copy p { color: var(--ink-2); font-size: 1.12rem; max-width: 28rem; }
.screen { background: var(--board); color: var(--paper); border-radius: 1.2rem; padding: 1.1rem; box-shadow: 0 30px 60px -30px rgba(27,24,20,.6); }
.screen-top { display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(244,239,230,.55); padding: 0 0.3rem 0.8rem; }
.screen-rows { display: grid; gap: 0.4rem; }
.screen-rows li, .screen-btn { animation: rise 0.5s var(--ease-out) both; animation-delay: calc(var(--j) * 60ms + 120ms); }
.screen-rows li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.7rem 0.9rem; border-radius: 0.65rem; background: var(--board-2); font-size: 0.98rem; }
.screen-rows .head { background: transparent; font-weight: 800; font-size: 1.05rem; padding-inline: 0.3rem; }
.screen-rows .note { background: transparent; color: var(--amber); font-style: italic; font-size: 0.9rem; padding-block: 0.2rem; }
.screen-rows .amber b { color: var(--amber); }
.screen-rows .green { background: rgba(76,194,116,.16); }
.screen-rows .green b { color: var(--basil-l); }
.screen-btn { display: block; margin-top: 0.8rem; padding: 0.85rem; border-radius: 0.75rem; text-align: center; font-weight: 800; background: var(--tomato); color: #fff; }

/* swap: blur crossfade masks the content change */
.swap-enter-active { transition: opacity 0.3s var(--ease-out), transform 0.3s var(--ease-out), filter 0.3s var(--ease-out); }
.swap-leave-active { transition: opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease; }
.swap-enter-from { opacity: 0; transform: translateY(10px); filter: blur(4px); }
.swap-leave-to { opacity: 0; transform: translateY(-6px); filter: blur(4px); }

/* features */
.features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.feature { background: var(--card); border-radius: 1.25rem; padding: 1.25rem 1.25rem 1.6rem; border: 1.5px solid var(--line); transition: opacity 0.7s var(--ease-out) var(--d, 0ms), transform 0.7s var(--ease-out) var(--d, 0ms), filter 0.7s var(--ease-out) var(--d, 0ms), border-color 0.25s ease; }
.feature h3 { display: flex; align-items: baseline; gap: 0.6rem; font-size: 1.2rem; margin: 1.2rem 0 0.4rem; }
.feature h3 .mono { font-size: 0.78rem; color: var(--tomato); font-weight: 500; }
.feature p { color: var(--ink-2); }
@media (hover: hover) and (pointer: fine) {
  .feature.in:hover { border-color: var(--ink); }
}
.viz { position: relative; height: 9.5rem; border-radius: 0.9rem; background: var(--board); color: var(--paper); overflow: hidden; display: grid; place-items: center; }
.rv:not(.in) .viz *, .rv:not(.in) .viz { animation-play-state: paused !important; }

.viz-mesas { grid-template-columns: repeat(3, 2.6rem); gap: 0.8rem; place-content: center; }
.viz-mesas i { width: 2.6rem; height: 2.6rem; border-radius: 0.5rem; border: 1.5px dashed rgba(244,239,230,.3); animation: seat 6s steps(1) infinite; animation-delay: calc(var(--n) * -1.1s); }
.viz-mesas i:nth-child(odd) { border-radius: 50%; }
@keyframes seat {
  0% { background: transparent; }
  25% { background: var(--amber); border-color: var(--amber); }
  50% { background: var(--basil-l); border-color: var(--basil-l); }
  75% { background: rgba(244,239,230,.18); border-color: transparent; }
}

.viz-cocina { align-content: center; justify-items: stretch; gap: 0.7rem; padding: 0 1.5rem; }
.viz-cocina p { display: grid; grid-template-columns: 4rem 1fr; align-items: center; gap: 0.6rem; font-family: var(--mono); font-size: 0.8rem; }
.viz-cocina i { height: 0.5rem; border-radius: 99px; background: rgba(244,239,230,.12); position: relative; overflow: hidden; }
.viz-cocina i::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: var(--amber); transform-origin: left; animation: cook 3.6s var(--ease-io) infinite; animation-delay: calc(var(--n) * -1.2s); }
@keyframes cook {
  0% { transform: scaleX(0); background: var(--amber); }
  70% { transform: scaleX(1); background: var(--amber); }
  72%, 100% { transform: scaleX(1); background: var(--basil-l); }
}

.queue { width: 75%; height: 6.6rem; overflow: hidden; mask-image: linear-gradient(transparent, #000 20%, #000 80%, transparent); }
.queue p { display: flex; justify-content: space-between; align-items: center; height: 2.2rem; padding: 0 0.8rem; font-size: 0.88rem; animation: queue 7.5s var(--ease-io) infinite; }
.queue p span { font-family: var(--mono); font-size: 0.75rem; color: var(--amber); }
@keyframes queue {
  0%, 28% { transform: translateY(0); }
  33%, 61% { transform: translateY(-2.2rem); }
  66%, 95% { transform: translateY(-4.4rem); }
  100% { transform: translateY(-6.6rem); }
}

.receipt { width: 68%; background: #fbf7ef; color: var(--ink); font-family: var(--mono); font-size: 0.74rem; padding: 0.8rem 0.9rem; border-radius: 0.2rem; align-self: start; margin-top: -0.2rem; animation: print 4.5s var(--ease-out) infinite; }
.receipt p { display: flex; justify-content: space-between; }
.receipt .sum { border-top: 1px dashed rgba(27,24,20,.35); margin-top: 0.35rem; padding-top: 0.35rem; font-weight: 700; }
@keyframes print {
  0% { clip-path: inset(0 0 100% 0); transform: translateY(-1rem); }
  45%, 85% { clip-path: inset(0 0 0 0); transform: translateY(0.6rem); }
  100% { clip-path: inset(0 0 0 0); transform: translateY(0.6rem); opacity: 0; }
}

.phone { width: 8.5rem; height: 12rem; margin-top: 4rem; border: 2px solid rgba(244,239,230,.35); border-radius: 1.4rem; display: grid; place-items: center; align-content: start; padding-top: 1.6rem; gap: 0.6rem; }
.tap { padding: 0.5rem 0.8rem; border-radius: 0.6rem; background: var(--tomato); font-weight: 700; font-size: 0.78rem; animation: tap 2.4s var(--ease-out) infinite; }
.badge { font-family: var(--mono); font-size: 0.72rem; color: var(--basil-l); animation: badge 2.4s var(--ease-out) infinite; }
@keyframes tap { 0%, 30%, 100% { transform: scale(1); } 35% { transform: scale(0.92); } 45% { transform: scale(1); } }
@keyframes badge { 0%, 38% { opacity: 0; transform: translateY(0.5rem); } 50%, 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-0.4rem); } }

.toggle { width: 5.5rem; height: 3rem; border-radius: 99px; padding: 0.3rem; animation: theme 4s var(--ease-io) infinite; }
.knob { display: block; width: 2.4rem; height: 2.4rem; border-radius: 50%; animation: knob 4s var(--ease-io) infinite; }
@keyframes theme { 0%, 40% { background: #f4efe6; } 50%, 90% { background: #3a362f; } 100% { background: #f4efe6; } }
@keyframes knob {
  0%, 40% { transform: translateX(0); background: var(--amber); box-shadow: 0 0 0 0.35rem rgba(232,160,32,.25); }
  50%, 90% { transform: translateX(2.5rem); background: #c8c2b8; box-shadow: inset -0.6rem -0.2rem 0 #8f887d; }
  100% { transform: translateX(0); background: var(--amber); }
}

/* team */
.team { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: clamp(2rem, 5vw, 4rem); align-items: start; }
.role-tabs { position: relative; display: grid; grid-template-columns: repeat(5, 1fr); padding: 0.3rem; border-radius: 1rem; background: var(--board-2); }
.role-ind { position: absolute; top: 0.3rem; bottom: 0.3rem; left: 0.3rem; width: calc((100% - 0.6rem) / 5); border-radius: 0.75rem; background: var(--paper); transform: translateX(calc(var(--idx) * 100%)); transition: transform 0.4s var(--ease-io); }
.role-tabs button { position: relative; z-index: 1; padding: 0.75rem 0.25rem; border: 0; background: none; color: rgba(244,239,230,.7); font-weight: 700; font-size: 0.92rem; cursor: pointer; border-radius: 0.75rem; transition: color 0.3s ease, transform 0.16s var(--ease-out); }
.role-tabs button:active { transform: scale(0.95); }
.role-tabs button.on { color: var(--ink); }
.role-card { margin-top: 1rem; padding: clamp(1.4rem, 3vw, 2rem); border-radius: 1.25rem; border: 1.5px solid rgba(244,239,230,.12); min-height: 16rem; }
.role-card h3 { font-family: var(--display); font-size: 1.8rem; letter-spacing: -0.02em; }
.role-card > p { margin-top: 0.4rem; color: rgba(244,239,230,.72); font-size: 1.1rem; }
.role-card ul { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.4rem; }
.role-card li { padding: 0.5rem 0.9rem; border-radius: 99px; background: var(--board-2); font-weight: 600; font-size: 0.95rem; animation: rise 0.45s var(--ease-out) both; animation-delay: calc(var(--j) * 50ms + 100ms); }
.role-card li::before { content: "●"; color: var(--basil-l); font-size: 0.6rem; margin-right: 0.5rem; vertical-align: 0.15em; }

/* plans — ticket stubs with side notches */
.plans { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; max-width: 52rem; }
.plan {
  --notch: radial-gradient(circle at 0 calc(100% - 5.5rem), transparent 0.8rem, #000 calc(0.8rem + 0.5px)) left / 51% 100% no-repeat,
           radial-gradient(circle at 100% calc(100% - 5.5rem), transparent 0.8rem, #000 calc(0.8rem + 0.5px)) right / 51% 100% no-repeat;
  display: flex; flex-direction: column; background: var(--card); border-radius: 1.4rem;
  -webkit-mask: var(--notch); mask: var(--notch);
}
.plan.featured { background: var(--ink); color: var(--paper); }
.plan-body { flex: 1; padding: 2rem 2rem 1.6rem; }
.plan-top { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--tomato); text-transform: uppercase; letter-spacing: 0.08em; }
.plan-tag { background: var(--tomato); color: #fff; font-weight: 800; padding: 0.25rem 0.7rem; border-radius: 99px; letter-spacing: 0.04em; animation: wiggle 3s ease-in-out infinite; }
@keyframes wiggle { 0%, 88%, 100% { transform: rotate(0); } 92% { transform: rotate(-4deg); } 96% { transform: rotate(3deg); } }
.plan h3 { font-family: var(--display); font-size: 1.8rem; margin-top: 0.6rem; }
.plan-price { font-family: var(--display); font-size: 3rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; margin-top: 0.4rem; }
.plan-price small { font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500; letter-spacing: 0; opacity: 0.65; }
.plan-desc { color: var(--ink-2); margin-top: 0.3rem; }
.featured .plan-desc { color: rgba(244,239,230,.7); }
.plan ul { display: grid; gap: 0.55rem; margin-top: 1.4rem; }
.plan li::before { content: "✓"; color: var(--basil); font-weight: 800; margin-right: 0.6rem; }
.featured li::before { color: var(--basil-l); }
.plan-foot { height: 5.5rem; display: grid; align-items: center; padding: 0 2rem; border-top: 2px dashed var(--line); }
.featured .plan-foot { border-color: rgba(244,239,230,.18); }
.plan-foot .btn { width: 100%; }
.featured .btn-primary { box-shadow: none; }

/* faq */
.faq-grid { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: clamp(1.5rem, 5vw, 4rem); align-items: start; }
.faq { border-bottom: 1.5px solid var(--line); }
.faq summary { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.3rem 0; cursor: pointer; font-weight: 700; font-size: 1.15rem; list-style: none; }
.faq summary::-webkit-details-marker { display: none; }
.faq-x { position: relative; flex: none; width: 2rem; height: 2rem; border-radius: 50%; background: var(--card); transition: background-color 0.25s ease, transform 0.3s var(--ease-out); }
.faq-x::before, .faq-x::after { content: ""; position: absolute; left: 50%; top: 50%; width: 0.8rem; height: 2px; background: currentColor; translate: -50% -50%; border-radius: 2px; }
.faq-x::after { transform: rotate(90deg); }
.faq[open] .faq-x { transform: rotate(135deg); background: var(--tomato); color: #fff; }
.faq::details-content { block-size: 0; overflow: hidden; transition: block-size 0.35s var(--ease-out), content-visibility 0.35s allow-discrete; }
.faq[open]::details-content { block-size: auto; }
.faq p { padding-bottom: 1.4rem; color: var(--ink-2); font-size: 1.05rem; max-width: 36rem; }

/* cta */
.cta { background: var(--tomato); color: #fff; padding: clamp(4.5rem, 10vw, 7rem) 0; overflow: hidden; }
.cta-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 3rem; align-items: center; }
.cta h2 { font-family: var(--display); font-size: clamp(2.4rem, 6vw, 4.4rem); line-height: 1; letter-spacing: -0.035em; font-weight: 800; }
.cta .hl { color: var(--ink); }
.cta h2 + p { margin: 1.2rem 0 2rem; font-size: 1.2rem; color: rgba(255,255,255,.88); max-width: 30rem; }
.cta .btn-primary { background: var(--ink); box-shadow: 0 10px 30px -10px rgba(0,0,0,.6); }
@media (hover: hover) and (pointer: fine) {
  .cta .btn-primary:hover { background: #000; }
}
.print { position: relative; justify-self: center; width: min(20rem, 100%); padding-top: 0.6rem; }
.print.rv, .print.rv.in { transform: none; filter: drop-shadow(0 24px 24px rgba(60, 10, 0, 0.35)); }
.print-slot { height: 1rem; border-radius: 99px; background: var(--ink); box-shadow: inset 0 3px 4px rgba(0,0,0,.6); position: relative; z-index: 1; }
.print-paper {
  --zig: linear-gradient(#000 0 0) top / 100% calc(100% - 6px) no-repeat, radial-gradient(circle at 50% 100%, transparent 4px, #000 4.5px) bottom / 12px 6px repeat-x;
  -webkit-mask: var(--zig); mask: var(--zig);
  margin: -0.5rem 0.9rem 0; padding: 1.5rem 1.3rem 1.8rem; background: #fbf7ef; color: var(--ink); font-family: var(--mono); font-size: 0.95rem; line-height: 1.75;
  clip-path: inset(0 0 100% 0); transform: translateY(-40%);
  transition: clip-path 1.6s var(--ease-out) 0.3s, transform 1.6s var(--ease-out) 0.3s;
}
.print.in .print-paper { clip-path: inset(0 0 -2rem 0); transform: none; }
.print-paper p { display: flex; justify-content: space-between; gap: 1rem; }
.print-paper p:first-child { border-bottom: 1px dashed rgba(27,24,20,.35); padding-bottom: 0.4rem; margin-bottom: 0.4rem; }
.print-paper b { color: var(--basil); }
.print-paper p:first-child b { color: var(--ink); }
.print-paper .sum { border-top: 1px dashed rgba(27,24,20,.35); margin-top: 0.4rem; padding-top: 0.4rem; font-weight: 700; }

/* footer */
.footer { background: var(--ink); color: rgba(244,239,230,.65); padding: 1.8rem 0; font-size: 0.92rem; }
.footer-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.8rem 1.5rem; }
.footer .brand { color: var(--paper); }
.footer a { color: var(--paper); text-decoration: none; font-weight: 700; }

/* ---------- RESPONSIVE ---------- */
@media (max-width: 64rem) {
  .hero-grid, .team, .faq-grid, .cta-grid { grid-template-columns: 1fr; }
  .features { grid-template-columns: repeat(2, 1fr); }
  .nav-links, .live { display: none; }
  .print { justify-self: start; }
}
@media (max-width: 44rem) {
  .hero { padding: 6.5rem 0 3rem; }
  .stations { grid-template-columns: repeat(2, 1fr); }
  .st-what { display: none; }
  .flow-panel { grid-template-columns: 1fr; }
  .features, .plans { grid-template-columns: 1fr; }
  .floor { gap: 0.35rem; padding: 0.6rem; }
  .tk, .tk-leave-active { flex-basis: 8.6rem; width: 8.6rem; }
  .role-tabs button { font-size: 0.8rem; }
  .nav-login { display: none; }
  .plan-body { padding: 1.6rem 1.4rem 1.3rem; }
  .plan-foot { padding: 0 1.4rem; }
}

/* ---------- REDUCED MOTION: keep fades, drop movement ---------- */
@media (prefers-reduced-motion: reduce) {
  .load, .word, .screen-rows li, .screen-btn, .role-card li { animation-name: fade; }
  .rv { transform: none; filter: none; }
  .tk-paper, .ticker-track, .plan-tag, .viz *, .viz, .m-listo::after, .live i::after, .pulse::after { animation: none !important; }
  .tk-enter-from, .tk-leave-to, .swap-enter-from, .swap-leave-to { transform: none; filter: none; }
  .tk-move, .role-ind { transition: none; }
  .print-paper { transform: none; transition: clip-path 0.01s; }
  .ticker { overflow-x: auto; }
}
@keyframes fade { from { opacity: 0; } }
</style>
