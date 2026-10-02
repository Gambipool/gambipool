/* Gambipool · app (React 18 + htm, sin compilación) */
const { useState, useEffect, useMemo, useCallback } = React;
const html = htm.bind(React.createElement);

/* ---------- Configuración ---------- */
const SB_URL = "https://jrdmqkpqmgbjgypbhypu.supabase.co";
const SB_KEY = "sb_publishable_EbuD9gsbgVyedG4fB42xaA_fKlpaZF3";
const sb = supabase.createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/* ---------- Utilidades ---------- */
const iniciales = (n = "") => n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const norm = (s = "") => s.toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "");
const ESTADOS = { activo: "Activo", espera: "Lista de espera", baja: "Baja" };
const errTxt = (e) => {
  const m = (e && (e.message || e.error_description || String(e))) || "Error desconocido";
  return /failed to fetch|networkerror|load failed|network request failed/i.test(m) ? "Sin conexión. Comprueba la señal." : m;
};

/* ---------- Caché: se enseña lo último visto al momento y se actualiza por detrás ---------- */
const CK = "gp_c1_";
const cacheMem = {};
function cacheLeer(k) {
  if (k in cacheMem) return cacheMem[k];
  try { const v = localStorage.getItem(CK + k); if (v != null) return (cacheMem[k] = JSON.parse(v)); } catch (e) { /* sin almacenamiento */ }
  return undefined;
}
function cacheGuardar(k, v, persistir = true) {
  cacheMem[k] = v;
  if (persistir) try { localStorage.setItem(CK + k, JSON.stringify(v)); } catch (e) { /* lleno o bloqueado */ }
}
function cacheBorrar(prefijo) {
  Object.keys(cacheMem).filter((k) => k.startsWith(prefijo)).forEach((k) => delete cacheMem[k]);
  try { Object.keys(localStorage).filter((k) => k.startsWith(CK + prefijo)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* nada */ }
}
function cacheBorrarTodo() {
  Object.keys(cacheMem).forEach((k) => delete cacheMem[k]);
  try { Object.keys(localStorage).filter((k) => k.startsWith(CK)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* nada */ }
}
// Lanza el error de Supabase en vez de devolver datos vacíos (así no se guarda en caché un fallo)
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
// Hook: [datos, recargar]. Con clave null no carga nada.
function useCache(clave, cargar, deps = [], persistir = true) {
  const [d, setD] = useState(() => (clave ? cacheLeer(clave) : undefined));
  const actual = React.useRef(clave); actual.current = clave;
  const recargar = useCallback(async () => {
    if (!clave) return;
    try { const v = await cargar(); if (v !== undefined) { cacheGuardar(clave, v, persistir); if (actual.current === clave) setD(v); } } catch (e) { /* sin red: se queda lo que había */ }
  }, [clave, ...deps]);
  useEffect(() => { setD(clave ? cacheLeer(clave) : undefined); recargar(); }, [recargar]);
  return [d, recargar];
}

/* ---------- Librería de Excel: solo se descarga cuando el comité importa o exporta ---------- */
let xlsxPromesa = null;
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxPromesa) xlsxPromesa = new Promise((ok, ko) => {
    const s = document.createElement("script"); s.src = "vendor/xlsx.full.min.js";
    s.onload = () => ok(window.XLSX); s.onerror = () => { xlsxPromesa = null; ko(new Error("No se pudo cargar el módulo de Excel. Revisa la conexión.")); };
    document.head.appendChild(s);
  });
  return xlsxPromesa;
}

const I = {
  home: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  cal: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  card: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
  list: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/></svg>`,
  flag: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 21V4M6 4h11l-2 4 2 4H6"/></svg>`,
  lock: html`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  phone: html`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>`,
};

/* ---------- Componentes base ---------- */
function Cabecera({ sub, titulo, onBack, backTxt = "Volver", admin, onComite }) {
  return html`<header class="hd">
    ${onBack && html`<button class="back" onClick=${onBack}>‹ ${backTxt}</button>`}
    ${sub && html`<small>${sub}</small>`}<h1 class=${String(titulo || "").length > 44 ? "largo" : String(titulo || "").length > 28 ? "medio" : ""}>${titulo}</h1>
    ${admin && html`<button class="lock" aria-label="Panel del comité" onClick=${onComite}>${I.lock}</button>`}
  </header>`;
}

function Nav({ tab, setTab }) {
  const items = [["inicio", "Inicio", I.home], ["calendario", "Calendario", I.cal], ["tarjeta", "Tarjeta", I.card], ["clasificacion", "Clasificación", I.list], ["pool", "La Pool", I.flag]];
  return html`<nav class="nav">${items.map(([k, l, ic]) => html`<button key=${k} class=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${ic}${l}</button>`)}</nav>`;
}

const Spinner = () => html`<div class="spinner" aria-label="Cargando"></div>`;
const Toggle = ({ on, onChange, label }) =>
  html`<div class="sw" onClick=${() => onChange(!on)}><span>${label}</span><button type="button" class=${"tg" + (on ? " on" : "")} aria-pressed=${on} aria-label=${label}></button></div>`;

/* ---------- Acceso ---------- */
function Login() {
  const [paso, setPaso] = useState("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e && e.preventDefault();
    const em = email.trim().toLowerCase();
    setErr("");
    if (!emailValido(em)) return setErr("Escribe un email válido.");
    setCargando(true);
    try {
      const { data: ok, error: e1 } = await sb.rpc("email_autorizado", { p_email: em });
      if (e1) throw e1;
      if (!ok) { setErr("Este email no está dado de alta en la pool. Habla con el comité."); return; }
      const { error } = await sb.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true } });
      if (error) throw error;
      setEmail(em); setPaso("codigo");
    } catch (e2) { setErr(errTxt(e2)); } finally { setCargando(false); }
  };

  const verificar = async (e) => {
    e.preventDefault(); setErr("");
    const c = codigo.replace(/\D/g, "");
    if (c.length < 6) return setErr("El código tiene 6 cifras.");
    setCargando(true);
    const { error } = await sb.auth.verifyOtp({ email, token: c, type: "email" });
    setCargando(false);
    if (error) setErr("Código incorrecto o caducado. Pide uno nuevo.");
  };

  return html`<div class="login">
    <div class="logo">Gambipool<small>Real Guadalhorce Club de Golf</small></div>
    ${paso === "email" ? html`<form onSubmit=${enviar}>
        <p class="muted center" style=${{"marginTop": "34px"}}>Acceso solo para miembros de la pool</p>
        <label class="l" for="em">Tu email</label>
        <input id="em" class="inp" type="email" inputmode="email" autocomplete="email" autocapitalize="off" value=${email} onInput=${(e) => setEmail(e.target.value)} />
        <button class="btn" disabled=${cargando}>${cargando ? "Enviando…" : "Enviarme el código"}</button>
        ${err && html`<div class="err">${err}</div>`}
        <p class="muted">Te llegará un código por email. Solo se pide la primera vez: después la sesión queda abierta en este móvil.</p>
      </form>`
    : html`<form onSubmit=${verificar}>
        <p class="center" style=${{"marginTop": "30px"}}>Hemos enviado un código a<br/><b>${email}</b></p>
        <label class="l" for="cod">Código</label>
        <input id="cod" class="inp code num" inputmode="numeric" autocomplete="one-time-code" maxlength="10" value=${codigo} onInput=${(e) => setCodigo(e.target.value)} />
        <button class="btn" disabled=${cargando}>${cargando ? "Comprobando…" : "Entrar"}</button>
        ${err && html`<div class="err">${err}</div>`}
        <p class="center"><button type="button" class="link" onClick=${() => enviar()}>Reenviar código</button> · <button type="button" class="link" onClick=${() => { setPaso("email"); setCodigo(""); setErr(""); }}>Cambiar email</button></p>
        <p class="muted center">Si no lo ves, mira en la carpeta de spam.</p>
      </form>`}
  </div>`;
}

function Privacidad({ yo, onOk }) {
  const [acepta, setAcepta] = useState(false);
  const [err, setErr] = useState("");
  const seguir = async () => {
    const { error } = await sb.rpc("aceptar_privacidad");
    if (error) return setErr(errTxt(error));
    onOk();
  };
  return html`<div class="login">
    <div class="logo" style=${{"fontSize": "28px"}}>Bienvenido, ${yo.nombre_corto.split(" ")[0]}</div>
    <div class="card" style=${{"margin": "24px 0 0"}}>
      <h3>Protección de datos</h3>
      <div class="muted" style=${{"lineHeight":"1.45"}}>
        <p><b>Responsable:</b> Gambipool. Contacto: gambipoolguadalhorce@gmail.com</p>
        <p><b>Finalidad:</b> gestionar la Gambipool: inscripciones, horarios, resultados, clasificaciones, comunicaciones del comité y régimen disciplinario previsto en el reglamento.</p>
        <p><b>Datos:</b> nombre y apellidos, email, móvil, número de licencia, hándicap y resultados deportivos.</p>
        <p><b>Quién los ve:</b> los demás jugadores ven tu nombre, tu móvil y tus resultados. El comité ve todos tus datos. No se ceden a terceros. Se alojan en Supabase (servidores en la Unión Europea), que actúa como proveedor técnico.</p>
        <p><b>Base:</b> tu consentimiento y tu participación en la pool.</p>
        <p><b>Conservación:</b> mientras seas miembro de la pool. Los resultados se conservan en el histórico de temporadas.</p>
        <p><b>Derechos:</b> puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a gambipoolguadalhorce@gmail.com, y reclamar ante la Agencia Española de Protección de Datos.</p>
      </div>
    </div>
    <${Toggle} on=${acepta} onChange=${setAcepta} label="He leído y acepto" />
    <button class="btn" disabled=${!acepta} onClick=${seguir}>Continuar</button>
    ${err && html`<div class="err">${err}</div>`}
  </div>`;
}

/* ---------- Pantallas de jugador ---------- */
function Inicio({ yo, temporada }) {
  return html`<div>
    <div class="card"><span class="tag">${temporada ? temporada.nombre : "Sin temporada activa"}</span>
      <h3 style=${{"marginTop": "8px"}}>Próxima jornada</h3>
      <p class="muted">La inscripción a las jornadas llega en el siguiente apartado de la app.</p></div>
    <div class="card"><h3>Tu ficha</h3>
      <div class="kv"><span>Nombre</span><b>${yo.nombre}</b></div>
      <div class="kv"><span>Email</span><b>${yo.email}</b></div>
      ${yo.es_admin && html`<p class="muted" style=${{"marginBottom": "0"}}>Eres del comité: el candado de arriba abre el panel.</p>`}
    </div>
  </div>`;
}

const Proximamente = ({ que }) => html`<div class="card"><h3>${que}</h3><p class="muted">Este apartado se construye en las próximas fases.</p></div>`;

function Directorio() {
  const [lista, setLista] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { sb.rpc("directorio").then(({ data, error }) => (error ? setErr(errTxt(error)) : setLista(data || []))); }, []);
  const vis = (lista || []).filter((j) => norm(j.nombre_corto + " " + j.nombre).includes(norm(q)));
  return html`<div>
    <div class="search"><input class="inp" placeholder="Buscar jugador…" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    ${err && html`<div class="err" style=${{"margin": "12px"}}>${err}</div>`}
    ${!lista && !err ? html`<${Spinner}/>` : html`<div class="list">${vis.map((j) => html`<div class="row" key=${j.nombre_corto}>
        <span class="av">${iniciales(j.nombre_corto)}</span>
        <span class="n">${j.nombre_corto}<small>${j.movil || "Sin móvil"}</small></span>
        ${j.movil && html`<a href=${"tel:" + j.movil.replace(/\s/g, "")} aria-label=${"Llamar a " + j.nombre_corto} style=${{"color": "var(--hd)", "padding": "6px"}}>${I.phone}</a>`}
      </div>`)}</div>`}
  </div>`;
}

/* ---------- Comité: jugadores ---------- */
function useJugadoresComite(temporada) {
  const [lista, setLista] = useState(null);
  const [err, setErr] = useState("");
  const cargar = useCallback(async () => {
    if (!temporada) return;
    const { data, error } = await sb.from("jugadores")
      .select("*, jugador_temporada(temporada_id, estado, pagado), amarillas(id, temporada_id, fecha, jornada, motivo, anulada, anulada_motivo)")
      .order("nombre_corto");
    if (error) return setErr(errTxt(error));
    setLista((data || []).map((j) => {
      const jt = (j.jugador_temporada || []).find((x) => x.temporada_id === temporada.id);
      const am = (j.amarillas || []).filter((a) => a.temporada_id === temporada.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      return { ...j, estado: jt ? jt.estado : null, pagado: jt ? jt.pagado : false, amarillasT: am, nAm: am.filter((a) => !a.anulada).length };
    }));
  }, [temporada]);
  useEffect(() => { cargar(); }, [cargar]);
  return { lista, err, recargar: cargar };
}

function Badges({ j }) {
  return html`<span class="badges">
    ${j.es_admin && html`<span class="b ad">COMITÉ</span>`}
    ${j.estado === "espera" && html`<span class="b gr">ESPERA</span>`}
    ${j.estado === "baja" && html`<span class="b gr">BAJA</span>`}
    ${!j.estado && html`<span class="b gr">SIN TEMPORADA</span>`}
    ${j.estado === "activo" && (j.pagado ? html`<span class="b ok">PAGADO</span>` : html`<span class="b no">PENDIENTE</span>`)}
    ${j.nAm > 0 && html`<span class="b am">${j.nAm} AM</span>`}
  </span>`;
}

function ComiteJugadores({ temporada, go }) {
  const { lista, err, recargar } = useJugadoresComite(temporada);
  const [q, setQ] = useState("");
  const [f, setF] = useState("activo");
  const cuenta = useMemo(() => {
    const L = lista || [];
    return { activo: L.filter((j) => j.estado === "activo").length, espera: L.filter((j) => j.estado === "espera").length, baja: L.filter((j) => j.estado === "baja" || !j.estado).length, pend: L.filter((j) => j.estado === "activo" && !j.pagado).length, todos: L.length };
  }, [lista]);
  const vis = (lista || []).filter((j) => {
    if (f === "activo" && j.estado !== "activo") return false;
    if (f === "espera" && j.estado !== "espera") return false;
    if (f === "baja" && !(j.estado === "baja" || !j.estado)) return false;
    if (f === "pend" && !(j.estado === "activo" && !j.pagado)) return false;
    return norm(`${j.nombre} ${j.nombre_corto} ${j.email} ${j.licencia || ""}`).includes(norm(q));
  });
  const F = [["activo", "Activos"], ["espera", "Lista de espera"], ["baja", "Bajas"], ["pend", "Pago pendiente"], ["todos", "Todos"]];
  return html`<div>
    <div class="search"><input class="inp" placeholder="Buscar por nombre, email o licencia…" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    <div class="filt">${F.map(([k, l]) => html`<button key=${k} class=${f === k ? "on" : ""} onClick=${() => setF(k)}>${l} ${lista ? cuenta[k] : ""}</button>`)}</div>
    <div class="btns" style=${{"margin": "0 12px 10px"}}><button class="btn sec small" onClick=${() => go("importar")}>Importar Excel</button><button class="btn sec small" onClick=${() => exportarExcel(lista || [], temporada)}>Exportar Excel</button></div>
    ${err && html`<div class="err" style=${{"margin": "12px"}}>${err}</div>`}
    ${!lista && !err ? html`<${Spinner}/>` : html`<div class="list">${vis.length === 0 ? html`<p class="muted center">No hay jugadores en este filtro.</p>` : vis.map((j) => html`<button class="row" key=${j.id} onClick=${() => go("ficha", j.id)}>
        <span class="av">${iniciales(j.nombre_corto)}</span>
        <span class="n">${j.nombre_corto}<small>${j.licencia ? "Lic. " + j.licencia : j.email}</small></span>
        <${Badges} j=${j} /></button>`)}</div>`}
    <button class="fab" onClick=${() => go("editar", null)}>+ Alta</button>
  </div>`;
}

function EditarJugador({ temporada, id, volver, yo }) {
  const [j, setJ] = useState(null);
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    (async () => {
      if (!id) return setJ({ nombre: "", nombre_corto: "", email: "", movil: "", licencia: "", cats: [], es_admin: false, estado: "activo", pagado: false });
      const { data, error } = await sb.from("jugadores").select("*, jugador_temporada(temporada_id, estado, pagado)").eq("id", id).single();
      if (error) return setErr(errTxt(error));
      const jt = (data.jugador_temporada || []).find((x) => x.temporada_id === temporada.id);
      setJ({ ...data, movil: data.movil || "", licencia: data.licencia || "", cats: data.saludo_cats || [], estado: jt ? jt.estado : "activo", pagado: jt ? jt.pagado : false });
    })();
  }, [id]);
  if (!j) return err ? html`<div class="err" style=${{"margin": "12px"}}>${err}</div>` : html`<${Spinner}/>`;
  const set = (k) => (e) => setJ({ ...j, [k]: e && e.target ? e.target.value : e });
  const guardar = async () => {
    setErr("");
    const d = { nombre: j.nombre.trim(), nombre_corto: j.nombre_corto.trim() || j.nombre.trim(), email: j.email.trim().toLowerCase(), movil: j.movil.trim() || null, licencia: j.licencia.trim() || null, es_admin: !!j.es_admin, saludo_cats: j.cats || [] };
    if (!d.nombre) return setErr("Falta el nombre y apellidos.");
    if (!emailValido(d.email)) return setErr("El email no es válido.");
    setGuardando(true);
    try {
      let jid = id;
      if (id) { const { error } = await sb.from("jugadores").update(d).eq("id", id); if (error) throw error; }
      else { const { data, error } = await sb.from("jugadores").insert(d).select("id").single(); if (error) throw error; jid = data.id; }
      const { error: e2 } = await sb.from("jugador_temporada").upsert({ jugador_id: jid, temporada_id: temporada.id, estado: j.estado, pagado: !!j.pagado }, { onConflict: "jugador_id,temporada_id" });
      if (e2) throw e2;
      volver(true);
    } catch (e) {
      setErr(/duplicate|unique/i.test(errTxt(e)) ? "Ya hay un jugador con ese email." : errTxt(e));
    } finally { setGuardando(false); }
  };
  return html`<div style=${{"padding": "0 16px 20px"}}>
    <label class="l">Nombre y apellidos</label><input class="inp" value=${j.nombre} onInput=${set("nombre")} />
    <label class="l">Nombre corto (listados y horarios)</label><input class="inp" placeholder="p. ej. Gon Pineda" value=${j.nombre_corto} onInput=${set("nombre_corto")} />
    <label class="l">Email</label><input class="inp" type="email" autocapitalize="off" value=${j.email} onInput=${set("email")} />
    <label class="l">Móvil</label><input class="inp" type="tel" value=${j.movil} onInput=${set("movil")} />
    <label class="l">Nº de licencia</label><input class="inp" value=${j.licencia} onInput=${set("licencia")} />
    <label class="l">Saludos en Inicio</label><${CatsSaludo} sel=${j.cats || []} onChange=${(c) => setJ({ ...j, cats: c })}/>
    <label class="l">Estado en ${temporada.nombre}</label>
    <div class="seg">${Object.entries(ESTADOS).map(([k, l]) => html`<button type="button" key=${k} class=${j.estado === k ? "on" : ""} onClick=${() => setJ({ ...j, estado: k })}>${l}</button>`)}</div>
    <${Toggle} on=${j.pagado} onChange=${(v) => setJ({ ...j, pagado: v })} label=${`Inscripción pagada (${(temporada.reglas && temporada.reglas.cuota) || 150} €)`} />
    ${j.email === yo.email ? html`<div class="sw"><span>Administrador (comité)</span><span class="muted">Sí · no puedes quitártelo tú</span></div>`
      : html`<${Toggle} on=${j.es_admin} onChange=${(v) => setJ({ ...j, es_admin: v })} label="Administrador (comité)" />`}
    <button class="btn" disabled=${guardando} onClick=${guardar}>${guardando ? "Guardando…" : id ? "Guardar cambios" : "Guardar y dar acceso"}</button>
    ${err && html`<div class="err">${err}</div>`}
  </div>`;
}

function Ficha({ temporada, id, go, volver }) {
  const [j, setJ] = useState(null);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null);
  const cargar = useCallback(async () => {
    const { data, error } = await sb.from("jugadores").select("*, jugador_temporada(temporada_id, estado, pagado), amarillas(*)").eq("id", id).single();
    if (error) return setErr(errTxt(error));
    const jt = (data.jugador_temporada || []).find((x) => x.temporada_id === temporada.id);
    const am = (data.amarillas || []).filter((a) => a.temporada_id === temporada.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    setJ({ ...data, estado: jt ? jt.estado : null, pagado: jt ? jt.pagado : false, am, nAm: am.filter((a) => !a.anulada).length });
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!j) return err ? html`<div class="err" style=${{"margin": "12px"}}>${err}</div>` : html`<${Spinner}/>`;

  const ponerAmarilla = async (jornada, motivo) => {
    const { error } = await sb.from("amarillas").insert({ jugador_id: j.id, temporada_id: temporada.id, jornada: jornada || null, motivo: motivo || null });
    if (error) return alert(errTxt(error));
    setModal(null); cargar();
  };
  const anular = async (a, motivo) => {
    const { error } = await sb.from("amarillas").update({ anulada: true, anulada_motivo: motivo || null }).eq("id", a.id);
    if (error) return alert(errTxt(error));
    setModal(null); cargar();
  };
  const darBaja = async () => {
    const { error } = await sb.from("jugador_temporada").upsert({ jugador_id: j.id, temporada_id: temporada.id, estado: "baja", pagado: j.pagado }, { onConflict: "jugador_id,temporada_id" });
    if (error) return alert(errTxt(error));
    setModal(null); cargar();
  };

  return html`<div>
    <div class="card">
      <div class="kv"><span>Nombre corto</span><b>${j.nombre_corto}</b></div>
      <div class="kv"><span>Email</span><b>${j.email}</b></div>
      <div class="kv"><span>Móvil</span><b>${j.movil || "—"}</b></div>
      <div class="kv"><span>Licencia</span><b>${j.licencia || "—"}</b></div>
      <div class="kv"><span>Último hándicap</span><b class="num">${numES(j.ultimo_hcp)}</b></div>
      <div class="kv"><span>Estado</span><b>${j.estado ? ESTADOS[j.estado] : "Sin alta en la temporada"}</b></div>
      <div class="kv"><span>Inscripción</span><b>${j.pagado ? "Pagada" : "Pendiente"}</b></div>
      <div class="kv"><span>Comité</span><b>${j.es_admin ? "Sí" : "No"}</b></div>
      <div class="kv"><span>Protección de datos</span><b>${j.acepta_privacidad ? "Aceptada " + fmtFecha(j.acepta_privacidad) : "Aún no ha entrado"}</b></div>
    </div>
    <div class="card"><h3>Tarjetas amarillas · ${j.nAm}</h3>
      ${j.am.length === 0 ? html`<p class="muted">Ninguna en esta temporada.</p>` : j.am.map((a) => html`<div key=${a.id} class=${"hist" + (a.anulada ? " anulada" : "")}>
          <span>${a.jornada ? a.jornada + " · " : ""}${a.motivo || "Sin motivo"} · ${fmtFecha(a.fecha)}${a.anulada && a.anulada_motivo ? " (anulada: " + a.anulada_motivo + ")" : ""}</span>
          ${!a.anulada && html`<button class="link" onClick=${() => setModal({ tipo: "anular", a })}>Anular</button>`}</div>`)}
      <p class="muted">Con 3 amarillas, expulsión de la pool.</p>
      <button class="btn sec small" onClick=${() => setModal({ tipo: "amarilla" })}>+ Poner amarilla</button>
    </div>
    <div class="btns" style=${{"margin": "0 12px 20px"}}>
      <button class="btn sec" onClick=${() => go("editar", j.id)}>Editar</button>
      ${j.estado !== "baja" && html`<button class="btn warn sec" onClick=${() => setModal({ tipo: "baja" })}>Dar de baja</button>`}
    </div>
    ${modal && html`<${Modal} modal=${modal} j=${j} cerrar=${() => setModal(null)} ponerAmarilla=${ponerAmarilla} anular=${anular} darBaja=${darBaja} />`}
  </div>`;
}

function Modal({ modal, j, cerrar, ponerAmarilla, anular, darBaja }) {
  const [a, setA] = useState(""); const [b, setB] = useState("");
  return html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && cerrar()}><div class="sheet">
    ${modal.tipo === "amarilla" && html`<div><h3>Amarilla a ${j.nombre_corto}</h3>
      <label class="l">Jornada</label><input class="inp" placeholder="p. ej. J14" value=${a} onInput=${(e) => setA(e.target.value)} />
      <label class="l">Motivo</label><input class="inp" placeholder="p. ej. baja fuera de plazo" value=${b} onInput=${(e) => setB(e.target.value)} />
      ${j.nAm >= 2 && html`<div class="err">Será su tercera amarilla: supone la expulsión de la pool.</div>`}
      <button class="btn" onClick=${() => ponerAmarilla(a, b)}>Poner amarilla</button></div>`}
    ${modal.tipo === "anular" && html`<div><h3>Anular amarilla</h3>
      <label class="l">Motivo (causa justificada)</label><input class="inp" value=${b} onInput=${(e) => setB(e.target.value)} />
      <button class="btn" onClick=${() => anular(modal.a, b)}>Anular</button></div>`}
    ${modal.tipo === "baja" && html`<div><h3>¿Dar de baja a ${j.nombre_corto}?</h3>
      <p class="muted">Dejará de poder entrar en la app. Sus resultados se conservan. Puedes volver a activarlo desde Editar.</p>
      <button class="btn warn" onClick=${darBaja}>Dar de baja</button></div>`}
    <button class="btn sec" onClick=${cerrar}>Cancelar</button>
  </div></div>`;
}

/* ---------- Comité: Excel ---------- */
const COLS = ["Nombre y apellidos", "Nombre corto", "Email", "Móvil", "Nº licencia", "Estado", "Inscripción pagada", "Administrador", "Amarillas"];

async function exportarExcel(lista, temporada) {
  try { await cargarXLSX(); } catch (e) { return alert(errTxt(e)); }
  const filas = lista.map((j) => [j.nombre, j.nombre_corto, j.email, j.movil || "", j.licencia || "", j.estado ? ESTADOS[j.estado] : "", j.pagado ? "Sí" : "No", j.es_admin ? "Sí" : "No", j.nAm]);
  const ws = XLSX.utils.aoa_to_sheet([COLS, ...filas]);
  ws["!cols"] = [32, 26, 30, 16, 16, 16, 18, 14, 11].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jugadores");
  XLSX.writeFile(wb, `Gambipool_jugadores_${temporada.anio}.xlsx`);
}

const siNo = (v) => /^(s[ií]|si|yes|x|1|true)$/i.test(String(v || "").trim());
const estadoDe = (v) => { const s = norm(v || ""); if (s.startsWith("lista") || s.startsWith("espera")) return "espera"; if (s.startsWith("baja")) return "baja"; return "activo"; };

function Importar({ temporada, volver, yo }) {
  const [filas, setFilas] = useState(null);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const leer = async (e) => {
    setErr(""); setRes(null);
    const f = e.target.files[0]; if (!f) return;
    try {
      await cargarXLSX();
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets["Jugadores"] || wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
      const col = (r, n) => { const k = Object.keys(r).find((x) => norm(x).startsWith(norm(n))); return k ? String(r[k]).trim() : ""; };
      const out = raw.map((r) => ({
        nombre: col(r, "Nombre y apellidos"), nombre_corto: col(r, "Nombre corto"), email: col(r, "Email").toLowerCase(),
        movil: col(r, "Móvil") || col(r, "Movil"), licencia: col(r, "Nº licencia") || col(r, "licencia"),
        estado: estadoDe(col(r, "Estado")), pagado: siNo(col(r, "Inscripción pagada") || col(r, "Inscripcion pagada")),
        adminTxt: col(r, "Administrador"), amarillas: parseInt(col(r, "Amarillas"), 10) || 0,
      })).filter((r) => r.nombre || r.nombre_corto || r.email);
      out.forEach((r) => { r.problema = !emailValido(r.email) ? "Sin email válido" : !(r.nombre || r.nombre_corto) ? "Sin nombre" : ""; });
      setFilas(out);
    } catch (e2) { setErr("No he podido leer el archivo: " + errTxt(e2)); }
  };

  const importar = async () => {
    setTrabajando(true); setErr("");
    const validas = filas.filter((r) => !r.problema);
    let ok = 0; const fallos = [];
    for (const r of validas) {
      try {
        const d = { nombre: r.nombre || r.nombre_corto, nombre_corto: r.nombre_corto || r.nombre, email: r.email, movil: r.movil || null, licencia: r.licencia || null };
        // Administrador: solo se cambia si la celda tiene valor, y nunca se quita al propio usuario
        if (r.adminTxt && !(r.email === yo.email && !siNo(r.adminTxt))) d.es_admin = siNo(r.adminTxt);
        const { data, error } = await sb.from("jugadores").upsert(d, { onConflict: "email" }).select("id").single();
        if (error) throw error;
        const { error: e2 } = await sb.from("jugador_temporada").upsert({ jugador_id: data.id, temporada_id: temporada.id, estado: r.estado, pagado: r.pagado }, { onConflict: "jugador_id,temporada_id" });
        if (e2) throw e2;
        if (r.amarillas > 0) {
          const { count } = await sb.from("amarillas").select("id", { count: "exact", head: true }).eq("jugador_id", data.id).eq("temporada_id", temporada.id).eq("anulada", false);
          const faltan = r.amarillas - (count || 0);
          for (let i = 0; i < faltan; i++) await sb.from("amarillas").insert({ jugador_id: data.id, temporada_id: temporada.id, motivo: "Cargada desde Excel" });
        }
        ok++;
      } catch (e3) { fallos.push(`${r.nombre_corto || r.email}: ${errTxt(e3)}`); }
    }
    setTrabajando(false); setRes({ ok, fallos, omitidas: filas.length - validas.length });
  };

  return html`<div style=${{"padding": "0 16px 20px"}}>
    <p class="muted">Usa la plantilla "Gambipool_plantilla_jugadores.xlsx". Si un email ya existe, se actualizan sus datos; si no, se da de alta. Los jugadores sin email se saltan.</p>
    <input class="inp" type="file" accept=".xlsx,.xls,.csv" onChange=${leer} />
    ${err && html`<div class="err">${err}</div>`}
    ${filas && !res && html`<div>
      <p><b>${filas.filter((r) => !r.problema).length}</b> jugadores listos para importar${filas.some((r) => r.problema) ? html`, <b>${filas.filter((r) => r.problema).length}</b> se saltarán` : ""}.</p>
      <div style=${{"overflowX": "auto"}}><table class="prev"><thead><tr><th>Nombre corto</th><th>Email</th><th>Estado</th><th></th></tr></thead><tbody>
        ${filas.map((r, i) => html`<tr key=${i} style=${r.problema ? { color: "var(--warn)" } : null}><td>${r.nombre_corto || r.nombre}</td><td>${r.email || "—"}</td><td>${ESTADOS[r.estado]}</td><td>${r.problema}</td></tr>`)}
      </tbody></table></div>
      <button class="btn" disabled=${trabajando || !filas.some((r) => !r.problema)} onClick=${importar}>${trabajando ? "Importando…" : "Importar"}</button></div>`}
    ${res && html`<div><div class="ok">Importados o actualizados: <b>${res.ok}</b>${res.omitidas ? ` · Saltados: ${res.omitidas}` : ""}</div>
      ${res.fallos.length > 0 && html`<div class="err">${res.fallos.map((f) => html`<div key=${f}>${f}</div>`)}</div>`}
      <button class="btn sec" onClick=${() => volver(true)}>Volver al listado</button></div>`}
  </div>`;
}

/* ---------- App ---------- */
let saludoElegido = null;
const saludoDe = (yo) => (saludoElegido || "Hola, " + yo.nombre_corto.split(" ")[0]);
function elegirSaludo(yo, frases) {
  saludoElegido = null;
  if (frases && frases.length) saludoElegido = frases[Math.floor(Math.random() * frases.length)].frase.replace(/\{nombre\}/g, yo.nombre_corto.split(" ")[0]);
}
function App() {
  const [session, setSession] = useState(undefined);
  // Arranque instantáneo: lo último guardado en el móvil se enseña mientras llega lo nuevo
  const [yo, setYo] = useState(() => { const y = cacheLeer("yo"); if (y && y.id) elegirSaludo(y, cacheLeer("frases")); return y; });
  const [temporada, setTemporada] = useState(() => cacheLeer("temporada") || null);
  const [jornadas, setJornadas] = useState(() => cacheLeer("jornadas") || []);
  const [barras, setBarras] = useState(() => cacheLeer("barras") || []);
  const [tab, setTab] = useState("inicio");
  const [pila, setPila] = useState([]); // pantallas apiladas [{v, p}]
  const [errGlobal, setErrGlobal] = useState("");
  const uid = session ? (session.user.id || session.user.email) : session;

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const cargarJornadas = useCallback(async (t) => {
    const tt = t || temporada; if (!tt) return;
    try { const js = await q(sb.from("jornadas").select("*").eq("temporada_id", tt.id).order("fecha")); cacheGuardar("jornadas", js); setJornadas(js); } catch (e) { /* sin red */ }
  }, [temporada]);

  const cargarYo = useCallback(async () => {
    setErrGlobal("");
    try {
      const [yd, t, bs] = await Promise.all([q(sb.rpc("mi_jugador")), q(sb.from("temporadas").select("*").eq("activa", true).maybeSingle()), q(sb.from("barras").select("*"))]);
      const y = Array.isArray(yd) ? yd[0] : yd;
      if (!y || !y.id) { cacheBorrarTodo(); setYo(null); return; }
      const [js, frases] = await Promise.all([
        t ? q(sb.from("jornadas").select("*").eq("temporada_id", t.id).order("fecha")) : [],
        (y.saludo_cats || []).length ? q(sb.from("saludos").select("frase").in("categoria", y.saludo_cats)) : [],
      ]);
      if (saludoElegido == null || !cacheLeer("yo")) elegirSaludo(y, frases);
      cacheGuardar("yo", y); cacheGuardar("temporada", t || null); cacheGuardar("jornadas", js); cacheGuardar("barras", bs); cacheGuardar("frases", frases);
      setTemporada(t || null); setJornadas(js); setBarras(bs); setYo(y);
    } catch (e) {
      // sin red o fallo puntual: si ya teníamos datos, seguimos con ellos
      if (!cacheLeer("yo")) { setErrGlobal(errTxt(e)); setYo(null); }
    }
  }, []);

  // Solo al entrar, al salir o si cambia el usuario (no en cada renovación del token)
  useEffect(() => {
    if (uid) { cargarYo(); enviarCola(); }
    else if (uid === null) { cacheBorrarTodo(); setYo(undefined); setPila([]); }
  }, [uid]);

  // Volver atrás: botón atrás de Android / gesto del navegador (historial) y, en iPhone con la app
  // instalada, deslizar desde el borde izquierdo hacia la derecha
  const pilaRef = React.useRef(pila); pilaRef.current = pila;
  const recargaRef = React.useRef(null);
  useEffect(() => {
    let pops = 0;   // si el iPhone ya ha vuelto atrás con su propio gesto, el nuestro no hace nada
    const pop = () => { pops++; if (!pilaRef.current.length) return; cacheBorrar("jor_"); setPila((p) => p.slice(0, -1)); recargaRef.current && recargaRef.current(); };
    window.addEventListener("popstate", pop);
    let x0 = null, y0 = 0, p0 = 0;
    const ini = (e) => { const t = e.touches[0]; x0 = t.clientX < 24 && pilaRef.current.length ? t.clientX : null; y0 = t.clientY; p0 = pops; };
    const finT = (e) => { if (x0 == null) return; const t = e.changedTouches[0]; if (t.clientX - x0 > 70 && Math.abs(t.clientY - y0) < 60) { const desde = p0; setTimeout(() => { if (pops === desde) history.back(); }, 450); } x0 = null; };
    const ios = window.navigator.standalone === true;   // en el navegador ya existe el gesto propio
    if (ios) { document.addEventListener("touchstart", ini, { passive: true }); document.addEventListener("touchend", finT, { passive: true }); }
    return () => { window.removeEventListener("popstate", pop); if (ios) { document.removeEventListener("touchstart", ini); document.removeEventListener("touchend", finT); } };
  }, []);

  // Pantalla de bienvenida: se ve 1,5 s desde que la foto está pintada y luego se funde con la app
  const listo = session !== undefined && (session === null || yo !== undefined);
  useEffect(() => {
    if (!listo) return;
    const el = document.getElementById("splash"); if (!el || el.classList.contains("fuera")) return;
    let vivo = true, t = null;
    (window.__bv || Promise.resolve(false)).then((pintada) => {
      if (!vivo) return;
      t = setTimeout(() => { el.classList.add("fuera"); setTimeout(() => el.remove(), 700); }, pintada ? 1500 : 0);
    });
    return () => { vivo = false; t && clearTimeout(t); };
  }, [listo]);

  // iPhone (app instalada): al cerrarse el teclado, a veces el menú y la cabecera se quedan descolocados.
  // Se obliga a recolocar la pantalla. Y el hueco final de cada pantalla = altura real del menú.
  useEffect(() => {
    const recolocar = () => setTimeout(() => window.scrollTo(window.scrollX, window.scrollY), 120);
    const fuera = (e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) recolocar(); };
    document.addEventListener("focusout", fuera);
    const vv = window.visualViewport; let h0 = vv ? vv.height : 0;
    const rs = () => { if (vv.height > h0 + 80) recolocar(); h0 = vv.height; };
    if (vv) vv.addEventListener("resize", rs);
    let ro = null, mo = null;
    // Altura real del menú inferior (hueco final) y de la cabecera (para que las pestañas se queden fijas debajo)
    const medir = () => { const n = document.querySelector("#root > .nav"), h = document.querySelector("#root > .hd"), st = document.documentElement.style;
      if (n) st.setProperty("--navh", n.offsetHeight + "px"); if (h) st.setProperty("--hdh", h.offsetHeight + "px"); };
    if (window.ResizeObserver) { ro = new ResizeObserver(medir); mo = new MutationObserver(() => { ro.disconnect(); ["#root > .nav", "#root > .hd"].forEach((q) => { const e = document.querySelector(q); if (e) ro.observe(e); }); medir(); }); mo.observe(document.getElementById("root"), { childList: true }); }
    return () => { document.removeEventListener("focusout", fuera); if (vv) vv.removeEventListener("resize", rs); ro && ro.disconnect(); mo && mo.disconnect(); };
  }, []);

  // Golpes pendientes: se envían al abrir la app y al volver a ella
  useEffect(() => {
    // Al volver a la app: se envían los golpes pendientes y se refresca el calendario (por si el comité cerró la jornada)
    let ult = Date.now();
    const f = () => { if (document.hidden) return; enviarCola(); if (Date.now() - ult > 30000) { ult = Date.now(); recargaRef.current && recargaRef.current(); } };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  if (session === undefined) return html`<${Spinner}/>`;
  if (!session) return html`<${Login}/>`;
  if (yo === undefined) return html`<${Spinner}/>`;
  if (!yo) return html`<div class="login"><div class="logo">Gambipool</div>
      <div class="err">${errGlobal ? "No se ha podido conectar. Revisa la cobertura y vuelve a intentarlo." : "Tu email ya no tiene acceso a la pool. Habla con el comité."}</div>
      ${errGlobal && html`<button class="btn" onClick=${() => { setYo(undefined); cargarYo(); }}>Reintentar</button>`}
      <button class="btn sec" onClick=${() => sb.auth.signOut()}>Salir</button></div>`;
  if (!yo.acepta_privacidad) return html`<${Privacidad} yo=${yo} onOk=${cargarYo}/>`;

  recargaRef.current = () => cargarJornadas();
  const go = (v, p) => { try { history.pushState({ gp: pila.length + 1 }, ""); } catch (e) { /* nada */ } setPila([...pila, { v, p }]); window.scrollTo(0, 0); };
  // Al volver de una pantalla (donde quizá te inscribiste o diste de baja) no se enseña la jornada guardada
  const atras = () => { if (history.state && history.state.gp) history.back(); else { cacheBorrar("jor_"); setPila(pila.slice(0, -1)); cargarJornadas(); } };
  const top = pila[pila.length - 1];
  const ctx = { yo, temporada, jornadas, barras, go, atras, tab, setTab, recargar: () => cargarJornadas() };
  const jTit = (id) => { const j = jornadas.find((x) => x.id === id); return j ? `${nombreJ(j)} · ${fechaJ(j)}` : "Jornada"; };

  let cab, cuerpo, conNav = true;
  if (top) {
    conNav = false;
    const T = { directorio: "Jugadores", perfil: "Mi perfil", comite: "Jugadores", "comite-jugadores": "Jugadores", "comite-hub": "Panel del comité",
      "comite-calendario": "Calendario", "comite-avisos": "Avisos", "editar-jornada": top.p ? "Editar " + (jornadas.find((x) => x.id === top.p) ? etiquetaJ(jornadas.find((x) => x.id === top.p)) : "jornada") : "Nueva jornada",
      gestion: top.p ? jTit(top.p) : "", jornada: top.p ? jTit(top.p) : "", inscribir: "Inscripción",
      editar: top.p ? "Editar jugador" : "Alta de jugador", ficha: "Ficha", importar: "Importar Excel",
      "tarjeta-comite": "Tarjeta", "comite-tarjetas": top.p ? jTit(top.p) : "", "tarjeta-jugador": "Tarjeta",
      "ranking-jugador": typeof top.p === "string" ? top.p.split("|")[2] : "", reglamento: "Reglamento", contabilidad: "Contabilidad", estadisticas: "Estadísticas", palmares: "Palmarés", "comite-temporadas": "Temporadas", "comite-saludos": "Saludos" };
    const sub = ["comite", "comite-jugadores", "comite-calendario", "comite-avisos", "editar-jornada", "gestion", "editar", "ficha", "importar", "tarjeta-comite", "comite-tarjetas", "comite-temporadas", "comite-saludos"].includes(top.v) ? "Comité" : top.v === "inscribir" ? jTit(top.p) : "";
    cab = html`<${Cabecera} sub=${sub} titulo=${T[top.v]} onBack=${atras} />`;
    const volverRecargando = () => atras();
    if (top.v === "directorio") cuerpo = html`<${Directorio}/>`;
    else if (top.v === "perfil") cuerpo = html`<${Perfil} yo=${yo} temporada=${temporada}/>`;
    else if (!temporada) cuerpo = html`<div class="err" style=${{ margin: "12px" }}>No hay temporada activa.</div>`;
    else if (top.v === "jornada") cuerpo = html`<${FichaJornada} key=${top.p} ctx=${ctx} id=${top.p}/>`;
    else if (top.v === "inscribir") cuerpo = html`<${Inscribir} ctx=${ctx} id=${top.p}/>`;
    else if (top.v === "reglamento") cuerpo = html`<${Reglamento} ctx=${ctx}/>`;
    else if (top.v === "contabilidad") cuerpo = html`<${Contabilidad} ctx=${ctx}/>`;
    else if (top.v === "estadisticas") cuerpo = html`<${Estadisticas} ctx=${ctx}/>`;
    else if (top.v === "palmares") cuerpo = html`<${Palmares} ctx=${ctx}/>`;
    else if (top.v === "tarjeta-jugador") cuerpo = html`<${TarjetaJugador} ctx=${ctx} p=${top.p}/>`;
    else if (top.v === "ranking-jugador") cuerpo = html`<${RankingJugador} ctx=${ctx} p=${top.p}/>`;
    else if (!yo.es_admin) cuerpo = html`<div class="err" style=${{ margin: "12px" }}>Solo para el comité.</div>`;
    else if (top.v === "comite-hub") cuerpo = html`<${ComiteHub} ctx=${ctx}/>`;
    else if (top.v === "comite" || top.v === "comite-jugadores") cuerpo = html`<${ComiteJugadores} temporada=${temporada} go=${go}/>`;
    else if (top.v === "comite-calendario") cuerpo = html`<${ComiteCalendario} ctx=${ctx}/>`;
    else if (top.v === "comite-avisos") cuerpo = html`<${ComiteAvisos} ctx=${ctx}/>`;
    else if (top.v === "editar-jornada") cuerpo = html`<${EditarJornada} ctx=${ctx} id=${top.p}/>`;
    else if (top.v === "gestion") cuerpo = html`<${GestionJornada} ctx=${ctx} id=${top.p}/>`;
    else if (top.v === "comite-saludos") cuerpo = html`<${ComiteSaludos}/>`;
    else if (top.v === "comite-temporadas") cuerpo = html`<${ComiteTemporadas} ctx=${ctx}/>`;
    else if (top.v === "comite-tarjetas") cuerpo = html`<${ComiteTarjetas} ctx=${ctx} id=${top.p}/>`;
    else if (top.v === "tarjeta-comite") cuerpo = html`<${Tarjeta} ctx=${ctx} pid=${top.p} comite=${true}/>`;
    else if (top.v === "editar") cuerpo = html`<${EditarJugador} temporada=${temporada} id=${top.p} yo=${yo} volver=${volverRecargando}/>`;
    else if (top.v === "ficha") cuerpo = html`<${Ficha} key=${top.p + pila.length} temporada=${temporada} id=${top.p} go=${go} volver=${volverRecargando}/>`;
    else if (top.v === "importar") cuerpo = html`<${Importar} temporada=${temporada} yo=${yo} volver=${volverRecargando}/>`;
  } else {
    const T = { inicio: saludoDe(yo), calendario: "Calendario", tarjeta: "Tarjeta", clasificacion: "Clasificación", pool: "La Pool" };
    cab = html`<${Cabecera} sub="" titulo=${T[tab]} admin=${yo.es_admin} onComite=${() => go("comite-hub")} />`;
    if (!temporada) cuerpo = html`<div class="card"><p class="muted">No hay temporada activa.</p></div>`;
    else if (tab === "inicio") cuerpo = html`<${Inicio2} ctx=${ctx}/>`;
    else if (tab === "calendario") cuerpo = html`<${Calendario} ctx=${ctx}/>`;
    else if (tab === "pool") cuerpo = html`<${Pool} yo=${yo} go=${go}/>`;
    else if (tab === "tarjeta") cuerpo = html`<${TarjetaTab} ctx=${ctx}/>`;
    else if (tab === "clasificacion") cuerpo = html`<${Clasificacion} ctx=${ctx}/>`;
    else cuerpo = html`<${Proximamente} que=${T[tab]}/>`;
  }
  return html`<${React.Fragment}>${cab}<main key=${pila.length + tab + (top ? top.v + top.p : "")}>${cuerpo}</main>${conNav && html`<${Nav} tab=${tab} setTab=${setTab}/>`}</${React.Fragment}>`;
}
