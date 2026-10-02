/* Gambipool · calendario, inscripción, horario, avisos e Inicio (se carga después de app.js) */

/* ---------- Fechas (siempre hora de Madrid) ---------- */
const TZ = "Europe/Madrid";
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const hoyMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const fmtDia = (d) => cap(new Date(d + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "").replace(".", ""));
const fmtDiaLargo = (d) => cap(new Date(d + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }));
const partes = (ts) => Object.fromEntries(new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ts)).map((p) => [p.type, p.value]));
const fmtPlazo = (ts) => { if (!ts) return "—"; const p = partes(ts); return `${cap(p.weekday.replace(".", ""))} ${p.day} · ${String(+p.hour)}:${p.minute}`; };
const fmtAviso = (ts) => { const p = partes(ts); return `${p.day} ${p.month.replace(".", "")} · ${String(+p.hour)}:${p.minute}`; };
const toLocalInput = (ts) => { if (!ts) return ""; const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ts)).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`; };
// "YYYY-MM-DDTHH:mm" en hora de Madrid → ISO (da igual la zona horaria del móvil)
const fromLocalInput = (v) => {
  if (!v) return null;
  const g = new Date(v + ":00Z");
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(g).map((x) => [x.type, x.value]));
  const w = new Date(`${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}Z`);
  return new Date(g - (w - g)).toISOString();
};
const hm = (t) => (t ? String(t).slice(0, 5) : "");
const hmBonito = (t) => (t ? String(+t.slice(0, 2)) + ":" + t.slice(3, 5) : "");
const toMin = (t) => { const [h, m] = String(t).slice(0, 5).split(":").map(Number); return h * 60 + m; };
const toHM = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const HORAS10 = (() => { const a = []; for (let m = 8 * 60; m <= 17 * 60; m += 10) a.push(toHM(m)); return a; })();
const FRANJAS = ["08:00", "08:30", "09:00", "09:30", "10:00"];

/* ---------- Jornadas ---------- */
const etiquetaJ = (j) => (j.numero ? "J" + j.numero : j.tipo === "ryder" ? "R" : "—");
const nombreJ = (j) => (j.numero ? "J" + j.numero : j.tipo === "ryder" ? "Ryder Cup" : "Fecha de sustitución");
const fechaJ = (j) => (j.fecha_fin && j.fecha_fin !== j.fecha ? `${fmtDia(j.fecha)} ${j.tipo === "ryder" ? "y" : "o"} ${fmtDia(j.fecha_fin).toLowerCase()}` : fmtDia(j.fecha));
const fin = (j) => j.fecha_fin || j.fecha;
const inscribible = (j) => ["jornada", "major", "fuera"].includes(j.tipo);
const TIPOS = { jornada: "Jornada", major: "Major", fuera: "Fuera", ryder: "Ryder", sustitucion: "Sustitución" };
const Tag = ({ j }) => ({ major: html`<span class="tag maj">Major</span>`, fuera: html`<span class="tag out">Fuera</span>`, ryder: html`<span class="tag ryd">Ryder</span>`, sustitucion: html`<span class="tag gr">Sustitución</span>` }[j.tipo] || null);

function estadoJ(j) {
  const hoy = hoyMadrid(), now = new Date();
  if (j.estado === "suspendida") return { k: "susp", txt: "Suspendida" };
  if (j.tipo === "sustitucion") return { k: fin(j) < hoy ? "jugada" : "reserva", txt: fin(j) < hoy ? "Sin usar" : "Reserva" };
  if (fin(j) < hoy) return { k: "jugada", txt: "Jugada ✓" };
  if (j.fecha <= hoy) return { k: "hoy", txt: "Hoy" };
  if (!inscribible(j)) return { k: "pend", txt: "Pendiente" };
  if (now < new Date(j.abre)) return { k: "antes", txt: "Abre " + fmtPlazo(j.abre) };
  if (now < new Date(j.cierre)) return { k: "abierta", txt: "Cierra " + fmtPlazo(j.cierre) };
  return { k: "cerrada", txt: "Inscripción cerrada" };
}
const proxima = (js) => js.find((j) => j.tipo !== "sustitucion" && j.estado === "programada" && fin(j) >= hoyMadrid());

function hcpJuego(j, hi, barras) {
  if (hi === "" || hi == null || isNaN(hi)) return null;
  let cr = j.cr, sr = j.sr, par = j.par || 72;
  if (cr == null || sr == null) { const b = (barras || []).find((x) => x.campo === j.campo && x.nombre === j.barras); if (!b) return null; cr = +b.cr; sr = b.sr; par = b.par; }
  return Math.floor(Math.min(+hi, 54) * sr / 113 + (cr - par) + 0.5);
}
// Hándicap: siempre con un decimal ("2,0", "11,4")
const numES = (x) => (x == null || x === "" ? "—" : !isFinite(+x) ? String(x) : (+x < 0 ? "+" : "") + Math.abs(+x).toFixed(1).replace(".", ","));
const parseHcp = (s) => { const v = String(s).trim().replace(",", "."); if (v === "") return null; const n = v.startsWith("+") ? -parseFloat(v.slice(1)) : parseFloat(v); return isNaN(n) ? NaN : n; };

/* ---------- Horario automático ---------- */
// Partidas de una franja: el mínimo de partidas posible, con 3 o 4 jugadores (máx. 3 partidas).
// 6→3+3 · 7→3+4 · 8→4+4 · 9→3+3+3 · 10→3+3+4 · 11→3+4+4 · 12→4+4+4. Las de 3 van primero.
function repartir(n) {
  if (n <= 0) return [];
  if ([1, 2].includes(n)) return [n];
  if (n === 5) return [5];                      // solo si no hay otra franja: el comité lo ajusta
  const k = Math.ceil(n / 4), tres = 4 * k - n;
  return [...Array(tres).fill(3), ...Array(k - tres).fill(4)];
}
const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [b[i], b[k]] = [b[k], b[i]]; } return b; };
const franjaDe = (t) => { const m = toMin(t); return toHM(m - (m % 30)); };   // otra hora → su franja de 30 min
const MAX10 = 9 * 60 + 10;                     // nadie intenta por el tee 10 después de las 9:10

// Horas a intentar coger. ps: [{franja, n (jugadores), numero}] → añade t1 y t10 ("HH:MM").
// Cada franja tiene 4 salidas por el tee 1 (8:30, 8:40, 8:50, 9:00); siempre primero el tee 1.
//  · 1 partida: tantas salidas como jugadores, todas por el tee 1.
//  · 2 partidas: 2 salidas cada una, sin solaparse (8:30–8:40 y 8:50–9:00).
//  · 3 partidas: 2 salidas cada una, solapando (8:30–8:40, 8:40–8:50, 8:50–9:00).
//  · Tee 10: las mismas horas (la de 3 solo la primera), hasta las 9:10; las dos primeras
//    partidas de la franja de las 9:00 pueden intentar 9:00 y 9:10.
//  · Si la franja anterior ya usa la primera salida, con 1 o 2 partidas se corre: la partida sola
//    empieza tras la última salida usada; dos partidas empiezan 10 min más tarde.
function calcHoras(ps) {
  const porF = {};
  ps.forEach((p) => { if (p.franja) (porF[p.franja] = porF[p.franja] || []).push(p); });
  let ultimo = null;   // última salida por el tee 1 usada por la franja anterior
  Object.keys(porF).sort((a, b) => toMin(a) - toMin(b)).forEach((f) => {
    const S = toMin(f), lista = porF[f];
    const orden = [...lista].sort((a, b) => (a.n === 3 ? 0 : 1) - (b.n === 3 ? 0 : 1) || a.numero - b.numero);
    const pisada = ultimo != null && ultimo >= S;
    const W = pisada ? S + 10 : S;
    const activas = orden.filter((p) => p.n);
    orden.forEach((p) => { if (!p.n) { p.t1 = []; p.t10 = []; } });
    activas.forEach((p, i) => {
      if (activas.length === 1) {
        const ini = pisada ? ultimo + 10 : S;
        p.t1 = Array.from({ length: p.n }, (_, m) => ini + 10 * m); p.t10 = [];
      } else {
        p.t1 = activas.length === 2 ? [W + 20 * i, W + 20 * i + 10] : [S + 10 * i, S + 10 * (i + 1)];
        const quiere = Math.max(0, p.n - 2), libres = [S, S + 10].filter((m) => m <= MAX10);
        let t10 = p.t1.filter((m) => m <= MAX10);
        if (t10.length < quiere && i < 2) libres.forEach((m) => { if (t10.length < quiere && !t10.includes(m)) t10.push(m); });
        p.t10 = t10.slice(0, quiere).sort((a, b) => a - b);
      }
    });
    const usados = activas.flatMap((p) => p.t1);
    if (usados.length) ultimo = Math.max(...usados);
    activas.forEach((p) => { p.t1 = p.t1.map(toHM); p.t10 = p.t10.map(toHM); });
  });
  ps.forEach((p) => { p.t1 = p.t1 || []; p.t10 = p.t10 || []; });
  return ps;
}

function generarHorario(ins, j) {
  // 1) grupos por franja (jornada fuera: un único grupo sin horas)
  const fuera = j.tipo === "fuera";
  const grupos = {};
  ins.forEach((x) => { const k = fuera ? "—" : franjaDe(hm(x.franja) || "08:30"); (grupos[k] = grupos[k] || []).push(x); });
  const claves = Object.keys(grupos).sort((a, b) => (a === "—" ? 0 : toMin(a)) - (b === "—" ? 0 : toMin(b)));
  const movidos = {}, primeros = new Set();       // los que llegan de otra franja van a la primera partida
  const mover = (g, n, de, a) => {
    const cand = barajar(grupos[de].filter((x) => !movidos[x.jugador_id]));
    const sale = (cand.length >= n ? cand : barajar(grupos[de])).slice(0, n);
    sale.forEach((x) => { movidos[x.jugador_id] = de; primeros.add(x.jugador_id); });
    grupos[de] = grupos[de].filter((x) => !sale.includes(x)); grupos[a].push(...sale);
  };
  if (!fuera && claves.length > 1) {
    for (let vuelta = 0; vuelta < 40; vuelta++) {
      claves.slice().forEach((k) => { if (!grupos[k].length) { delete grupos[k]; claves.splice(claves.indexOf(k), 1); } });
      if (claves.length < 2) break;
      // 2) más de 12 (3 partidas de 4): los que sobran a la franja siguiente (la última, a la anterior)
      const llena = claves.find((k) => grupos[k].length > 12);
      if (llena) { const i = claves.indexOf(llena); mover(null, grupos[llena].length - 12, llena, claves[i + 1] || claves[i - 1]); continue; }
      // 3) franjas con 1, 2 o 5: se pasan jugadores a la franja más cercana (o se traen de ella)
      const mal = claves.find((k) => [1, 2, 5].includes(grupos[k].length));
      if (!mal) break;
      const i = claves.indexOf(mal), t = toMin(mal), len = grupos[mal].length;
      const vecinos = [claves[i - 1], claves[i + 1]].filter(Boolean).sort((a, b) => Math.abs(toMin(a) - t) - Math.abs(toMin(b) - t) || (toMin(b) - toMin(a)));
      const vale = (c) => c >= 3 && c !== 5 && c <= 12;
      const n = len === 5 ? 1 : len;
      const destino = vecinos.find((k) => vale(grupos[k].length + n));
      if (destino) { mover(null, n, mal, destino); continue; }
      const falta = len === 5 ? 1 : 3 - len, origen = vecinos.find((k) => vale(grupos[k].length - falta));
      if (origen) { mover(null, falta, origen, mal); continue; }
      mover(null, n, mal, vecinos[0]);
    }
    claves.slice().forEach((k) => { if (!grupos[k].length) { delete grupos[k]; claves.splice(claves.indexOf(k), 1); } });
  }
  // 4) partidas: las de 3 primero; los que llegan de otra franja, en la primera
  const partidas = [];
  claves.forEach((k) => {
    const g = barajar(grupos[k]).sort((a, b) => (primeros.has(b.jugador_id) ? 1 : 0) - (primeros.has(a.jugador_id) ? 1 : 0));
    let p = 0; repartir(g.length).forEach((tam) => { partidas.push({ franja: k === "—" ? null : k, jug: g.slice(p, p + tam), n: tam }); p += tam; });
  });
  partidas.forEach((p, i) => (p.numero = i + 1));
  if (fuera) { partidas.forEach((p) => { p.t1 = []; p.t10 = []; }); return { partidas, movidos }; }
  calcHoras(partidas);
  return { partidas, movidos };
}

// Franja de una partida: la guardada al generar el horario. Si todos sus jugadores son de otra
// misma franja (p. ej. una partida nueva o rehecha a mano), esa. Sin franja guardada: la más
// repetida entre sus jugadores (empate: la más tardía).
function franjaPartida(p, jug) {
  const c = {}; jug.forEach((x) => { if (x.franja) { const f = franjaDe(hm(x.franja)); c[f] = (c[f] || 0) + 1; } });
  const fs = Object.keys(c).sort((a, b) => c[b] - c[a] || toMin(b) - toMin(a));
  const guardada = p.franja ? franjaDe(hm(p.franja)) : null;
  if (guardada && !(fs.length === 1 && fs[0] !== guardada)) return guardada;
  return fs[0] || guardada;
}
// Horas que deberían tener las partidas según sus jugadores actuales (solo las que no tienen salida apuntada)
function horasEsperadas(parts, ins, j) {
  if (j.tipo === "fuera") return [];
  const ps = parts.map((p) => { const jug = ins.filter((x) => x.partida_id === p.id); return { id: p.id, numero: p.numero, franja: franjaPartida(p, jug), n: jug.length, fija: !!p.salida_hora, t1Act: p.t1 || [], t10Act: p.t10 || [] }; });
  calcHoras(ps);
  return ps.filter((p) => !p.fija && (p.t1.join() !== p.t1Act.join() || p.t10.join() !== p.t10Act.join()));
}
// Partidas cuyo NÚMERO de horas ya no cuadra con sus jugadores (un retoque a mano de qué horas no cuenta)
function horasDescuadradas(parts, ins, j) {
  return horasEsperadas(parts, ins, j).filter((p) => p.t1.length + p.t10.length !== p.t1Act.length + p.t10Act.length);
}

function avisosHorario(parts, nIns) {
  const out = [], c1 = {}, c10 = {};
  parts.forEach((p) => {
    const n = nIns[p.id] || 0;
    if (n > 0 && (n < 3 || n > 4)) out.push(`La partida ${p.numero} tiene ${n} jugador${n === 1 ? "" : "es"}.`);
    (p.t1 || []).forEach((h) => (c1[h] = (c1[h] || 0) + 1));
    (p.t10 || []).forEach((h) => { c10[h] = (c10[h] || 0) + 1; if (toMin(h) > 550) out.push(`La partida ${p.numero} tiene ${hmBonito(h)} por el tee 10 (después de las 9:10).`); });
  });
  Object.entries(c1).forEach(([h, n]) => n > 2 && out.push(`${n} partidas intentan ${hmBonito(h)} por el tee 1 (máximo 2).`));
  // Dos partidas con exactamente las mismas horas por el tee 1: una de ellas se ha quedado sin horas propias
  const vistas = {};
  parts.forEach((p) => { const k = (p.t1 || []).join(); if (!k || !(nIns[p.id] || 0)) return; if (vistas[k]) out.push(`Las partidas ${vistas[k]} y ${p.numero} intentan las mismas horas por el tee 1. Pulsa «Recalcular horas según las reglas».`); else vistas[k] = p.numero; });
  return out;
}

/* ---------- Datos ---------- */
async function cargarJornada(id, yo) {
  const [{ data: j }, { data: ins }, { data: parts }, { data: mia }] = await Promise.all([
    sb.from("jornadas").select("*").eq("id", id).single(),
    sb.rpc("inscritos", { p_jornada: id }),
    sb.from("partidas").select("*").eq("jornada_id", id).order("numero"),
    sb.from("inscripciones").select("*").eq("jornada_id", id).eq("jugador_id", yo.id).maybeSingle(),
  ]);
  return { j, ins: ins || [], parts: parts || [], mia: mia && mia.estado === "inscrito" ? mia : null };
}
// Igual, pero falla si falla algo (para la caché)
async function cargarJornadaQ(id, yo) {
  const [j, ins, parts, mia] = await Promise.all([
    q(sb.from("jornadas").select("*").eq("id", id).single()),
    q(sb.rpc("inscritos", { p_jornada: id })),
    q(sb.from("partidas").select("*").eq("jornada_id", id).order("numero")),
    q(sb.from("inscripciones").select("*").eq("jornada_id", id).eq("jugador_id", yo.id).maybeSingle()),
  ]);
  return { j, ins: ins || [], parts: parts || [], mia: mia && mia.estado === "inscrito" ? mia : null };
}

/* ---------- Componentes comunes ---------- */
function Plazos({ j }) {
  const now = new Date();
  const L = [["Abre la inscripción", j.abre], ["Cierre de inscripción", j.cierre], ["Se publica el horario", j.horario_at], ["Reserva en la web del club", j.reserva], ["Baja sin sanción hasta", j.baja_hasta]];
  return html`<div class="card"><h3>Plazos</h3>${L.map(([t, ts]) => html`<div class="plazo" key=${t}><span class=${"dot" + (ts && now >= new Date(ts) ? " full" : "")}></span><span>${t}</span><b class="num">${fmtPlazo(ts)}</b></div>`)}</div>`;
}

function Partida({ p, ins, yoId, onSalida }) {
  const mias = ins.filter((x) => x.partida_id === p.id);
  const soyYo = mias.some((x) => x.jugador_id === yoId);
  return html`<div class=${"pa" + (soyYo ? " me" : "")}>
    <div class="t"><b>Partida ${p.numero}</b><span class="num">${mias.length} jug.</span></div>
    <div class="names">${mias.map((x) => x.nombre_corto).join(", ") || "—"}</div>
    ${p.salida_hora ? html`<div class="times num"><b>Salida: ${hmBonito(hm(p.salida_hora))} · Tee ${p.salida_tee}</b></div>`
      : p.t1.length + p.t10.length > 0 && html`<div class="times num">${p.t1.length ? "T1 " + p.t1.map(hmBonito).join(" · ") : ""}${p.t10.length ? "  ·  T10 " + p.t10.map(hmBonito).join(" · ") : ""}</div>`}
    ${soyYo && onSalida && html`<button class="btn small" style=${{ marginTop: "8px" }} onClick=${() => onSalida(p)}>${p.salida_hora ? "Cambiar salida conseguida" : "Apuntar salida conseguida"}</button>`}
  </div>`;
}

function ModalSalida({ p, cerrar, hecho }) {
  const [hora, setHora] = useState(p.salida_hora ? hm(p.salida_hora) : (p.t1[0] || "08:30"));
  const [tee, setTee] = useState(p.salida_tee || 1);
  const [err, setErr] = useState("");
  const guardar = async () => { const { error } = await sb.rpc("apuntar_salida", { p_partida: p.id, p_hora: hora, p_tee: tee }); if (error) return setErr(errTxt(error)); hecho(); };
  return html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && cerrar()}><div class="sheet">
    <h3>Salida conseguida · Partida ${p.numero}</h3>
    <label class="l">Hora</label><select class="inp" value=${hora} onChange=${(e) => setHora(e.target.value)}>${HORAS10.map((h) => html`<option key=${h} value=${h}>${hmBonito(h)}</option>`)}</select>
    <label class="l">Tee</label><div class="seg">${[1, 10].map((t) => html`<button key=${t} type="button" class=${tee === t ? "on" : ""} onClick=${() => setTee(t)}>Tee ${t}</button>`)}</div>
    <p class="muted">La tarjeta de la partida empezará por el hoyo ${tee}.</p>
    ${err && html`<div class="err">${err}</div>`}
    <button class="btn" onClick=${guardar}>Guardar</button><button class="btn sec" onClick=${cerrar}>Cancelar</button>
  </div></div>`;
}

function ModalBaja({ j, cerrar, hecho }) {
  const tarde = new Date() > new Date(j.baja_hasta);
  const [err, setErr] = useState("");
  const confirmar = async () => { const { data, error } = await sb.rpc("darme_baja", { p_jornada: j.id }); if (error) return setErr(errTxt(error)); hecho(data); };
  return html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && cerrar()}><div class="sheet">
    <h3>¿Darte de baja?</h3><p class="muted">${nombreJ(j)} · ${fechaJ(j)}</p>
    ${tarde ? html`<div class="err">El plazo para darse de baja sin sanción terminó el ${fmtPlazo(j.baja_hasta)}. Si confirmas, se te pondrá una <b>tarjeta amarilla</b> (con 3, fuera de la pool) y se avisará en la app. Si hay causa justificada, habla con el comité para que la anule.</div>`
      : html`<div class="ok">Estás dentro de plazo: no hay sanción.</div>`}
    ${err && html`<div class="err">${err}</div>`}
    <button class=${"btn" + (tarde ? " warn" : "")} onClick=${confirmar}>Confirmar baja</button><button class="btn sec" onClick=${cerrar}>Cancelar</button>
  </div></div>`;
}

/* ---------- Pantalla de inscripción ---------- */
function Inscribir({ ctx, id }) {
  const { yo, barras, atras } = ctx;
  const [d, setD] = useState(null);
  const [hcp, setHcp] = useState("");
  const [franja, setFranja] = useState("");
  const [otra, setOtra] = useState(false);
  const [horaOtra, setHoraOtra] = useState("10:30");
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { cargarJornada(id, yo).then((r) => {
    setD(r);
    const m = r.mia;
    setHcp(numES(m ? m.hcp_exacto : yo.ultimo_hcp).replace("—", ""));
    if (m && m.franja) { if (m.otra_hora) { setOtra(true); setHoraOtra(hm(m.franja)); } else setFranja(hm(m.franja)); }
  }); }, [id]);
  if (!d) return html`<${Spinner}/>`;
  const j = d.j, fuera = j.tipo === "fuera";
  const hi = parseHcp(hcp), hj = hi != null && !isNaN(hi) ? hcpJuego(j, hi, barras) : null;
  const enviar = async () => {
    setErr("");
    if (hi == null || isNaN(hi) || hi < -10 || hi > 54) return setErr("Escribe tu hándicap exacto (por ejemplo 2,7).");
    const f = fuera ? null : otra ? horaOtra : franja;
    if (!fuera && !f) return setErr("Elige una franja.");
    setEnviando(true);
    const { error } = await sb.rpc("inscribirme", { p_jornada: j.id, p_franja: f, p_otra: otra, p_hcp: hi });
    setEnviando(false);
    if (error) return setErr(errTxt(error));
    atras();
  };
  return html`<div style=${{ padding: "0 16px 24px" }}>
    <p class="muted" style=${{ marginTop: "14px" }}>${fechaJ(j)} · ${j.campo} · ${cap(j.barras || "")}${j.tipo === "major" ? " · Major" : ""}. Cierra el ${fmtPlazo(j.cierre)}.</p>
    <label class="l">Tu hándicap exacto</label>
    <div style=${{ display: "flex", gap: "10px", alignItems: "center" }}>
      <input class="inp num" style=${{ flex: "0 0 110px" }} inputmode="decimal" value=${hcp} onInput=${(e) => setHcp(e.target.value)} />
      <a href="https://rfegolf.es/aprende-mejora/consulta-handicap" target="_blank" rel="noopener" style=${{ color: "var(--hd)", fontWeight: 700, fontSize: "14px" }}>Consulta tu hándicap</a>
    </div>
    <p class="muted">${hj != null ? html`Hándicap de juego en ${j.barras}: <b>${hj}</b>` : "Relleno con el de tu última inscripción. Cámbialo si ha variado."}</p>
    ${!fuera && html`<div>
      <label class="l">Franja para reservar</label>
      <div class="fr num">${FRANJAS.map((f) => html`<button type="button" key=${f} class=${!otra && franja === f ? "on" : ""} onClick=${() => { setOtra(false); setFranja(f); }}>${hmBonito(f)}</button>`)}
        <button type="button" class=${otra ? "on" : ""} onClick=${() => setOtra(true)}>Otra hora</button></div>
      ${otra && html`<div><label class="l">Hora que quieres</label><select class="inp" value=${horaOtra} onChange=${(e) => setHoraOtra(e.target.value)}>${HORAS10.map((h) => html`<option key=${h} value=${h}>${hmBonito(h)}</option>`)}</select></div>`}
      <p class="muted">Cada franja es de media hora. En "Otra hora" eliges la hora exacta, de 10 en 10 minutos.</p></div>`}
    ${fuera && html`<p class="muted">En las jornadas fuera no hay franja: el comité hace el horario.</p>`}
    ${err && html`<div class="err">${err}</div>`}
    <button class="btn" disabled=${enviando} onClick=${enviar}>${enviando ? "Guardando…" : d.mia ? "Guardar cambios" : "Confirmar inscripción"}</button>
  </div>`;
}

/* ---------- Calendario ---------- */
function Calendario({ ctx }) {
  const { jornadas, go } = ctx;
  const prox = proxima(jornadas);
  useEffect(() => { const el = prox && document.getElementById("j-" + prox.id); if (el) el.scrollIntoView({ block: "center" }); }, []);
  let mesAnt = "";
  return html`<div class="list">${jornadas.map((j) => {
    const mes = cap(new Date(j.fecha + "T12:00:00Z").toLocaleDateString("es-ES", { month: "long", timeZone: "UTC" }));
    const cab = mes !== mesAnt ? html`<div class="mes">${mes}</div>` : null; mesAnt = mes;
    const e = estadoJ(j);
    return html`<${React.Fragment} key=${j.id}>${cab}
      <button id=${"j-" + j.id} class=${"cal-row " + (e.k === "jugada" ? "done" : "") + (prox && prox.id === j.id ? " next" : "") + (e.k === "susp" ? " susp" : "")} onClick=${() => go("jornada", j.id)}>
        <span class="j">${etiquetaJ(j)}</span>
        <span class="t">${fechaJ(j)} <${Tag} j=${j}/><small>${j.tipo === "ryder" ? "Ryder Cup" : j.tipo === "sustitucion" ? "Fecha de sustitución" : (j.campo !== "Real Guadalhorce" ? j.campo + " · " : "") + cap(j.barras || "")}${e.k === "susp" && j.motivo ? " · " + j.motivo : ""}</small></span>
        <span class=${"st " + (e.k === "abierta" ? "op" : e.k === "jugada" ? "ok" : "pe")}>${e.txt}</span>
      </button></${React.Fragment}>`;
  })}</div>`;
}

function FichaJornada({ ctx, id }) {
  const { yo, go } = ctx;
  const [tab, setTab] = useState("info");
  const [d, setD] = useState(null);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState("");
  const cargar = useCallback(() => cargarJornada(id, yo).then(setD), [id]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return html`<${Spinner}/>`;
  const { j, ins, parts, mia } = d, e = estadoJ(j);
  if (!inscribible(j)) return html`<div class="card"><h3>${nombreJ(j)}</h3>
    <div class="kv"><span>Fecha</span><b>${fechaJ(j)}</b></div><div class="kv"><span>Campo</span><b>${j.campo}</b></div>
    ${j.nota && html`<p class="muted">${j.nota}</p>`}
    <p class="muted">${j.tipo === "ryder" ? "La Ryder tendrá su propio apartado en La Pool (equipos, partidos y marcador)." : "Fecha reservada por si hay que trasladar una jornada."}</p></div>`;
  const puedeIns = e.k === "abierta";
  const puedeBaja = mia && ["antes", "abierta", "cerrada", "hoy"].includes(e.k);
  const TABS = [["info", "Info"], ["inscritos", "Inscritos"], ["horario", "Horario"]];
  return html`<div>
    <div class="tabs">${TABS.map(([k, l]) => html`<button key=${k} class=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${l}</button>`)}</div>
    ${msg && html`<div class="ok" style=${{ margin: "12px" }}>${msg}</div>`}
    ${tab === "info" && html`<div>
      <div class="card"><span class=${"tag" + (e.k === "abierta" ? "" : " gr")}>${e.txt}</span>
        <div class="kv" style=${{ marginTop: "8px" }}><span>Campo</span><b>${j.campo}</b></div>
        <div class="kv"><span>Barras</span><b>${cap(j.barras || "—")}</b></div>
        <div class="kv"><span>Bola</span><b>${j.bola_colocada ? "Se coloca" : "No se coloca"}</b></div>
        <div class="kv"><span>Tipo</span><b>${TIPOS[j.tipo]} · ${j.doblar ? "puntos dobles" : "puntos normales"}</b></div>
        <div class="kv"><span>Inscritos</span><b class="num">${ins.length}</b></div>
        ${mia && html`<div class="kv"><span>Tu inscripción</span><b>${mia.franja ? (mia.otra_hora ? "Otra hora " : "Franja ") + hmBonito(hm(mia.franja)) : "Inscrito"} · HJ ${mia.hcp_juego ?? "—"}</b></div>`}
        ${j.nota && html`<p class="muted">${j.nota}</p>`}
        ${e.k === "susp" && j.motivo && html`<div class="err">Suspendida: ${j.motivo}</div>`}
      </div>
      <${Plazos} j=${j}/>
      <div style=${{ margin: "0 12px 20px" }}>
        ${puedeIns && html`<button class="btn" onClick=${() => go("inscribir", j.id)}>${mia ? "Modificar inscripción" : "Inscribirme"}</button>`}
        ${puedeBaja && html`<button class="btn warn sec" onClick=${() => setModal("baja")}>Darme de baja</button>`}
        ${e.k === "cerrada" && !mia && html`<p class="muted">Inscripción cerrada. Solo es posible entrar si hay hueco en una partida de 3 en el sistema de reservas del club: gestiónalo tú y avisa al comité.</p>`}
        ${yo.es_admin && html`<button class="btn sec" onClick=${() => go("gestion", j.id)}>Gestionar (comité)</button>`}
      </div></div>`}
    ${tab === "inscritos" && html`<${ListaInscritos} ins=${ins} j=${j} yoId=${yo.id}/>`}
    ${tab === "horario" && html`<div>
      ${!j.horario_publicado && !yo.es_admin && html`<div class="card"><p class="muted" style=${{ margin: 0 }}>El horario de reservas se publica el ${fmtPlazo(j.horario_at)}.</p></div>`}
      ${(j.horario_publicado || yo.es_admin) && html`<div>
        ${!j.horario_publicado && html`<div class="ok" style=${{ margin: "12px" }}>Borrador: solo lo ve el comité hasta que se publique.</div>`}
        ${j.horario_publicado && j.tipo !== "fuera" && html`<p class="muted" style=${{ margin: "12px 14px 0" }}>Reserva en la web del club el ${fmtPlazo(j.reserva)}. Os repartís en la partida quién intenta cada hora.</p>`}
        ${parts.length === 0 ? html`<div class="card"><p class="muted" style=${{ margin: 0 }}>Aún no hay partidas.</p></div>`
          : parts.map((p, i) => html`<${React.Fragment} key=${p.id}>${(i === 0 || parts[i - 1].franja !== p.franja) && p.franja && html`<div class="fh"><span>Franja ${hmBonito(hm(p.franja))}</span></div>`}
            <${Partida} p=${p} ins=${ins} yoId=${yo.id} onSalida=${j.horario_publicado && e.k !== "jugada" ? (pp) => setModal({ salida: pp }) : null}/></${React.Fragment}>`)}
      </div>`}
    </div>`}
    ${modal === "baja" && html`<${ModalBaja} j=${j} cerrar=${() => setModal(null)} hecho=${(r) => { setModal(null); setMsg(r === "amarilla" ? "Baja registrada con tarjeta amarilla." : "Baja registrada, sin sanción."); cargar(); }}/>`}
    ${modal && modal.salida && html`<${ModalSalida} p=${modal.salida} cerrar=${() => setModal(null)} hecho=${() => { setModal(null); cargar(); }}/>`}
  </div>`;
}

function ListaInscritos({ ins, j, yoId }) {
  if (!ins.length) return html`<div class="card"><p class="muted" style=${{ margin: 0 }}>Todavía no hay inscritos.</p></div>`;
  const grupos = {};
  ins.forEach((x) => { const k = j.tipo === "fuera" ? "Inscritos" : x.otra_hora ? "Otra hora · " + hmBonito(hm(x.franja)) : "Franja " + hmBonito(hm(x.franja)); (grupos[k] = grupos[k] || []).push(x); });
  const orden = Object.keys(grupos).sort((a, b) => toMin((grupos[a][0].franja || "00:00")) - toMin((grupos[b][0].franja || "00:00")));
  return html`<div>${orden.map((k) => html`<div key=${k}><div class="fh"><span>${k}</span><span>${grupos[k].length}</span></div>
    <div class="card" style=${{ marginTop: "6px", padding: "4px 12px" }}>${grupos[k].map((x) => html`<div key=${x.jugador_id} class=${"pl" + (x.jugador_id === yoId ? " me" : "")}>
      <span class="av">${iniciales(x.nombre_corto)}</span>${x.nombre_corto}<span class="h num">HJ ${x.hcp_juego ?? "—"}</span></div>`)}</div></div>`)}</div>`;
}

/* ---------- Inicio ---------- */
function Inicio2({ ctx }) {
  const { yo, jornadas, go } = ctx;
  const j = proxima(jornadas);
  const [modal, setModal] = useState(null);
  const [d, cargar] = useCache(j && inscribible(j) ? `jor_${j.id}` : null, () => cargarJornadaQ(j.id, yo), [j && j.id]);
  const [avisosC] = useCache("avisos", () => q(sb.from("avisos").select("*").gte("creado", new Date(Date.now() - 14 * 864e5).toISOString()).order("creado", { ascending: false }).limit(5)), []);
  const avisos = avisosC || [];

  let tarjeta;
  if (!j) tarjeta = html`<div class="card"><h3>Temporada terminada</h3><p class="muted">No quedan jornadas en el calendario.</p></div>`;
  else if (!inscribible(j)) tarjeta = html`<div class="card"><span class="tag ryd">${TIPOS[j.tipo]}</span><h3 style=${{ marginTop: "8px" }}>${nombreJ(j)} · ${fechaJ(j)}</h3>${j.nota && html`<p class="muted">${j.nota}</p>`}</div>`;
  else if (!d) tarjeta = html`<div class="card"><${Spinner}/></div>`;
  else {
    const { mia, parts, ins } = d, jj = d.j, e = estadoJ(jj);
    const miP = mia && parts.find((p) => p.id === mia.partida_id);
    const comp = miP ? ins.filter((x) => x.partida_id === miP.id) : [];
    const titulo = html`<h3 style=${{ marginTop: "8px" }}>${nombreJ(jj)} · ${fechaJ(jj)}</h3><p class="muted" style=${{ margin: "0 0 6px" }}>${jj.campo} · ${cap(jj.barras || "")}${jj.tipo === "major" ? " · Major" : ""}</p><p class="bola">${jj.bola_colocada ? "La bola se coloca" : "La bola no se coloca"}</p>`;
    const verIns = html`<button class="btn sec" onClick=${() => go("jornada", jj.id)}>Ver inscritos y plazos</button>`;
    if (e.k === "hoy") tarjeta = html`<div class="card"><span class="tag">Hoy se juega</span>${titulo}
      ${miP && miP.salida_hora ? html`<div class="kv"><span>Tu salida</span><b>${hmBonito(hm(miP.salida_hora))} · Tee ${miP.salida_tee}</b></div>` : null}
      ${miP && html`<div class="kv"><span>Marcador</span><b>${miP.marcador_id ? ((ins.find((x) => x.jugador_id === miP.marcador_id) || {}).nombre_corto || "Comité") : "Aún nadie"}</b></div>`}
      ${miP && comp.map((x) => html`<div key=${x.jugador_id} class=${"pl" + (x.jugador_id === yo.id ? " me" : "")}><span class="av">${iniciales(x.nombre_corto)}</span>${x.nombre_corto}<span class="h num">HJ ${x.hcp_juego ?? "—"}</span></div>`)}
      ${miP && !miP.marcador_id && html`<p class="muted" style=${{ margin: "8px 0 0" }}>El primero de la partida que abra la tarjeta será el marcador.</p>`}
      ${miP && html`<button class="btn" onClick=${() => ctx.setTab("tarjeta")}>Abrir tarjeta</button>`}
      <button class="btn sec" onClick=${() => ctx.setTab("clasificacion")}>Ver el directo</button></div>`;
    else if (!mia && e.k === "antes") tarjeta = html`<div class="card"><span class="tag gr">Próxima jornada</span>${titulo}<div class="kv"><span>Abre la inscripción</span><b>${fmtPlazo(jj.abre)}</b></div>${verIns}</div>`;
    else if (!mia && e.k === "abierta") tarjeta = html`<div class="card"><span class="tag">Inscripción abierta</span>${titulo}
      <div class="kv"><span>Cierra</span><b>${fmtPlazo(jj.cierre)}</b></div><div class="kv"><span>Inscritos</span><b class="num">${ins.length}</b></div>
      <button class="btn" onClick=${() => go("inscribir", jj.id)}>Inscribirme</button>${verIns}</div>`;
    else if (!mia) tarjeta = html`<div class="card"><span class="tag gr">Inscripción cerrada</span>${titulo}<p class="muted">Solo es posible entrar si hay hueco en una partida de 3 en el sistema del club: gestiónalo tú y avisa al comité.</p>${verIns}</div>`;
    else if (!jj.horario_publicado || !miP) tarjeta = html`<div class="card"><span class="tag gold">Estás inscrito</span>${titulo}
      ${mia.franja && html`<div class="kv"><span>${mia.otra_hora ? "Otra hora" : "Franja"}</span><b class="num">${hmBonito(hm(mia.franja))}${mia.otra_hora ? "" : " – " + hmBonito(toHM(toMin(mia.franja) + 30))}</b></div>`}
      <div class="kv"><span>Hándicap</span><b class="num">${numES(mia.hcp_exacto)} exacto · ${mia.hcp_juego ?? "—"} de juego</b></div>
      <div class="kv"><span>Horario</span><b>${jj.horario_publicado ? "Publicado (sin partida asignada)" : fmtPlazo(jj.horario_at)}</b></div>
      <div class="kv"><span>Baja sin sanción hasta</span><b>${fmtPlazo(jj.baja_hasta)}</b></div>
      <div class="btns">${e.k === "abierta" && html`<button class="btn sec" onClick=${() => go("inscribir", jj.id)}>Modificar</button>`}${verIns}</div>
      <button class="btn warn sec" onClick=${() => setModal("baja")}>Darme de baja</button></div>`;
    else if (!miP.salida_hora) tarjeta = html`<div class="card"><span class="tag">Horario publicado</span>${titulo}
      <p class="muted" style=${{ margin: "4px 0" }}>Partida ${miP.numero}. ${jj.tipo === "fuera" ? "" : `El ${fmtPlazo(jj.reserva)}, intentad reservar en la web del club:`}</p>
      ${jj.tipo !== "fuera" && html`<div class="slots num"><div class="slot"><small>Tee 1</small><b>${miP.t1.map(hmBonito).join(" · ") || "—"}</b></div><div class="slot"><small>Tee 10</small><b>${miP.t10.map(hmBonito).join(" · ") || "—"}</b></div></div>`}
      <div style=${{ marginTop: "8px" }}>${comp.map((x) => html`<div key=${x.jugador_id} class=${"pl" + (x.jugador_id === yo.id ? " me" : "")}><span class="av">${iniciales(x.nombre_corto)}</span>${x.nombre_corto}<span class="h num">HJ ${x.hcp_juego ?? "—"}</span></div>`)}</div>
      <button class="btn" onClick=${() => setModal({ salida: miP })}>Apuntar salida conseguida</button>
      <button class="btn sec" onClick=${() => go("jornada", jj.id)}>Ver todas las partidas</button></div>`;
    else tarjeta = html`<div class="card"><span class="tag gold">Salida confirmada</span>${titulo}
      <div class="kv"><span>Salida</span><b class="num">${hmBonito(hm(miP.salida_hora))} · Tee ${miP.salida_tee}</b></div>
      <div style=${{ marginTop: "8px" }}>${comp.map((x) => html`<div key=${x.jugador_id} class=${"pl" + (x.jugador_id === yo.id ? " me" : "")}><span class="av">${iniciales(x.nombre_corto)}</span>${x.nombre_corto}<span class="h num">HJ ${x.hcp_juego ?? "—"}</span></div>`)}</div>
      <button class="btn sec" onClick=${() => go("jornada", jj.id)}>Ver todas las salidas</button>
      <button class="btn warn sec" onClick=${() => setModal("baja")}>Darme de baja</button></div>`;
  }
  const verResultado = !(j && d && estadoJ(d.j).k === "hoy");
  return html`<div>${verResultado && html`<${TuResultado} ctx=${ctx}/>`}${tarjeta}
    ${avisos.length > 0 && html`<div class="card"><h3>Avisos</h3>${avisos.map((a) => html`<div key=${a.id} class="hist"><span>${a.texto}</span><span class="muted" style=${{ whiteSpace: "nowrap" }}>${fmtAviso(a.creado)}</span></div>`)}</div>`}
    ${modal === "baja" && d && html`<${ModalBaja} j=${d.j} cerrar=${() => setModal(null)} hecho=${() => { setModal(null); cargar(); }}/>`}
    ${modal && modal.salida && html`<${ModalSalida} p=${modal.salida} cerrar=${() => setModal(null)} hecho=${() => { setModal(null); cargar(); }}/>`}
  </div>`;
}

/* ---------- Comité ---------- */
function ComiteHub({ ctx }) {
  const items = [["comite-jugadores", "Jugadores", "Altas, fichas, pagos y amarillas"], ["comite-calendario", "Calendario", "Jornadas, plazos, inscritos y horarios"], ["comite-avisos", "Avisos", "Mensajes para todos en Inicio"], ["comite-temporadas", "Temporadas", "Reglas y nueva temporada"], ["comite-saludos", "Saludos", "Frases de Inicio por categoría"]];
  return html`<div class="list" style=${{ marginTop: "12px" }}>${items.map(([k, t, s]) => html`<button class="row" key=${k} onClick=${() => ctx.go(k)}><span class="n">${t}<small>${s}</small></span><span aria-hidden="true">›</span></button>`)}</div>`;
}

function ComiteCalendario({ ctx }) {
  const { jornadas, go } = ctx;
  const hoy = hoyMadrid();
  const prox = jornadas.filter((j) => fin(j) >= hoy), pas = jornadas.filter((j) => fin(j) < hoy).reverse();
  const fila = (j) => html`<div class="edrow" key=${j.id}><span>${fin(j) < hoy ? html`<span class="muted">${etiquetaJ(j)} · ${fechaJ(j)}</span>` : html`<span><b>${etiquetaJ(j)}</b> · ${fechaJ(j)} · ${TIPOS[j.tipo]}${j.estado === "suspendida" ? " · SUSPENDIDA" : ""}</span>`}</span>
    <span style=${{ display: "flex", gap: "14px" }}>${inscribible(j) && j.fecha <= hoy && html`<button class="link" onClick=${() => go("comite-tarjetas", j.id)}>Tarjetas</button>`}${inscribible(j) && html`<button class="link" onClick=${() => go("gestion", j.id)}>Gestionar</button>`}<button class="link" onClick=${() => go("editar-jornada", j.id)}>Editar</button></span></div>`;
  return html`<div><div style=${{ padding: "12px 12px 0" }}><button class="btn sec small" onClick=${() => go("editar-jornada", null)}>+ Añadir jornada</button></div>
    <div class="mes">Próximas</div>${prox.map(fila)}<div class="mes">Jugadas</div>${pas.map(fila)}</div>`;
}

function EditarJornada({ ctx, id }) {
  const { temporada, jornadas, recargar, atras } = ctx;
  const orig = id ? jornadas.find((x) => x.id === id) : null;
  const [j, setJ] = useState(orig ? { ...orig } : { tipo: "jornada", fecha: "", fecha_fin: "", campo: "Real Guadalhorce", barras: "blancas", doblar: false, bola_colocada: false, numero: "" });
  const [err, setErr] = useState(""); const [modal, setModal] = useState(null); const [motivo, setMotivo] = useState("");
  const set = (k, v) => setJ({ ...j, [k]: v });
  const guarda = async (cambios, avisoTxt) => {
    setErr("");
    const { error } = await sb.from("jornadas").update(cambios).eq("id", id);
    if (error) return setErr(errTxt(error));
    if (avisoTxt) await sb.from("avisos").insert({ temporada_id: temporada.id, jornada_id: id, tipo: "comite", texto: avisoTxt });
    await recargar(); atras();
  };
  const guardar = async () => {
    setErr("");
    if (!j.fecha) return setErr("Falta la fecha.");
    const d = { numero: j.numero === "" || j.numero == null ? null : +j.numero, tipo: j.tipo, fecha: j.fecha, fecha_fin: j.fecha_fin || null, campo: j.campo || "Real Guadalhorce",
      barras: ["ryder", "sustitucion"].includes(j.tipo) ? null : j.barras, doblar: !!j.doblar, bola_colocada: !!j.bola_colocada, cr: j.cr === "" ? null : j.cr ?? null, sr: j.sr === "" ? null : j.sr ?? null, par: j.par === "" ? null : j.par ?? null };
    ["abre", "cierre", "horario_at", "reserva", "baja_hasta"].forEach((k) => (d[k] = j[k] || null));
    if (orig && orig.fecha !== j.fecha) ["abre", "cierre", "horario_at", "reserva", "baja_hasta"].forEach((k) => (d[k] = null)); // la fecha cambió: plazos recalculados
    const q = id ? sb.from("jornadas").update(d).eq("id", id) : sb.from("jornadas").insert({ ...d, temporada_id: temporada.id });
    const { error } = await q; if (error) return setErr(errTxt(error));
    if (orig && !!orig.bola_colocada !== !!j.bola_colocada && inscribible(orig))
      await sb.from("avisos").insert({ temporada_id: temporada.id, jornada_id: id, tipo: "comite", texto: `${nombreJ(orig)}: ${j.bola_colocada ? "la bola se coloca" : "la bola no se coloca"}.` });
    await recargar(); atras();
  };
  const sust = jornadas.filter((x) => x.tipo === "sustitucion" && x.fecha >= hoyMadrid());
  const eliminar = async () => {
    setErr("");
    if (orig.cerrada) return setErr(`La ${nombreJ(orig)} está cerrada y tiene puntos en el ranking. Para eliminarla, reábrela antes desde Tarjetas.`);
    const { count } = await sb.from("inscripciones").select("id", { count: "exact", head: true }).eq("jornada_id", id).eq("estado", "inscrito");
    const txt = orig.cerrada ? `La ${nombreJ(orig)} tiene resultados y puntos. Si la eliminas, se borran y el ranking cambia. ¿Eliminarla?`
      : count ? `La ${nombreJ(orig)} tiene ${count} inscrito(s). Se borrarán sus inscripciones, partidas y tarjetas. ¿Eliminarla?` : `¿Eliminar ${inscribible(orig) ? "la " + nombreJ(orig) : "esta fecha"} del calendario?`;
    if (!confirm(txt)) return;
    if ((orig.cerrada || count) && !confirm("Esta acción no se puede deshacer. ¿Seguro?")) return;
    const { error } = await sb.from("jornadas").delete().eq("id", id);
    if (error) return setErr(errTxt(error));
    await recargar(); atras();
  };
  const mover = async (s) => {
    const { error } = await sb.from("jornadas").update({ fecha: s.fecha, fecha_fin: null, abre: null, cierre: null, horario_at: null, reserva: null, baja_hasta: null }).eq("id", id);
    if (error) return setErr(errTxt(error));
    await sb.from("jornadas").delete().eq("id", s.id);
    await sb.from("avisos").insert({ temporada_id: temporada.id, jornada_id: id, texto: `La ${nombreJ(orig)} se traslada al ${fmtDia(s.fecha).toLowerCase()}.` });
    await recargar(); atras();
  };
  const plazo = (k, t) => html`<div class="pz" key=${k}><span>${t}</span><input type="datetime-local" class="inp" style=${{ width: "200px", flex: "0 0 200px", margin: 0, padding: "6px 8px", fontSize: "16px" }} value=${toLocalInput(j[k])} onChange=${(e) => set(k, fromLocalInput(e.target.value))}/></div>`;
  return html`<div style=${{ padding: "0 16px 24px" }}>
    <label class="l">Número (J…)</label><input class="inp num" inputmode="numeric" value=${j.numero ?? ""} onInput=${(e) => set("numero", e.target.value.replace(/\D/g, ""))} />
    <label class="l">Fecha</label><input class="inp" type="date" value=${j.fecha} onChange=${(e) => set("fecha", e.target.value)} />
    <label class="l">Fecha fin (solo si dura dos días)</label><input class="inp" type="date" value=${j.fecha_fin || ""} onChange=${(e) => set("fecha_fin", e.target.value)} />
    <label class="l">Tipo</label><div class="seg">${Object.entries(TIPOS).map(([k, l]) => html`<button type="button" key=${k} class=${j.tipo === k ? "on" : ""} onClick=${() => setJ({ ...j, tipo: k, doblar: k === "major" || k === "fuera" })}>${l}</button>`)}</div>
    ${!["ryder", "sustitucion"].includes(j.tipo) && html`<div>
      <label class="l">Barras</label><div class="seg">${["blancas", "amarillas"].map((b) => html`<button type="button" key=${b} class=${j.barras === b ? "on" : ""} onClick=${() => set("barras", b)}>${cap(b)}</button>`)}</div>
      <label class="l">Campo</label><input class="inp" value=${j.campo} onInput=${(e) => set("campo", e.target.value)} />
      ${j.campo !== "Real Guadalhorce" && html`<div><p class="muted">Otro campo: pon su Course Rating, Slope y Par de esas barras para calcular el hándicap de juego.</p>
        <div class="btns"><input class="inp" placeholder="CR (72,1)" value=${j.cr ?? ""} onInput=${(e) => set("cr", e.target.value.replace(",", "."))}/><input class="inp" placeholder="Slope" value=${j.sr ?? ""} onInput=${(e) => set("sr", e.target.value)}/><input class="inp" placeholder="Par" value=${j.par ?? ""} onInput=${(e) => set("par", e.target.value)}/></div></div>`}
      <${Toggle} on=${!!j.doblar} onChange=${(v) => set("doblar", v)} label="Doblar puntos de clasificación" />
      <${Toggle} on=${!!j.bola_colocada} onChange=${(v) => set("bola_colocada", v)} label="La bola se coloca" />
      ${id && html`<div><label class="l">Plazos</label>
        ${plazo("abre", "Abre inscripción")}${plazo("cierre", "Cierre inscripción")}${plazo("horario_at", "Horario")}${plazo("reserva", "Reserva club")}${plazo("baja_hasta", "Baja sin sanción")}
        <button type="button" class="link" onClick=${() => setJ({ ...j, abre: null, cierre: null, horario_at: null, reserva: null, baja_hasta: null })}>Recalcular plazos según la fecha</button></div>`}
      ${!id && html`<p class="muted">Los plazos se calculan solos según la fecha. Luego puedes cambiarlos.</p>`}</div>`}
    ${err && html`<div class="err">${err}</div>`}
    <button class="btn" onClick=${guardar}>Guardar</button>
    ${id && inscribible(j) && html`<div class="btns">
      ${sust.length > 0 && html`<button class="btn sec" onClick=${() => setModal("mover")}>Mover a sustitución</button>`}
      ${j.estado === "suspendida" ? html`<button class="btn sec" onClick=${() => guarda({ estado: "programada", motivo: null }, `La ${nombreJ(orig)} vuelve a estar programada.`)}>Reactivar</button>`
        : html`<button class="btn warn sec" onClick=${() => setModal("susp")}>Suspender</button>`}</div>`}
    ${id && html`<button class="btn warn sec" onClick=${eliminar}>Eliminar del calendario</button>`}
    ${modal === "mover" && html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setModal(null)}><div class="sheet"><h3>Mover ${nombreJ(orig)} a una fecha de sustitución</h3>
      <p class="muted">Se mantienen tipo, barras e inscritos. Los plazos se recalculan con la nueva fecha y se avisa a todos.</p>
      ${sust.map((s) => html`<button key=${s.id} class="btn sec" onClick=${() => mover(s)}>${fmtDiaLargo(s.fecha)}</button>`)}
      <button class="btn sec" onClick=${() => setModal(null)}>Cancelar</button></div></div>`}
    ${modal === "susp" && html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setModal(null)}><div class="sheet"><h3>Suspender ${nombreJ(orig)}</h3>
      <label class="l">Motivo</label><input class="inp" value=${motivo} onInput=${(e) => setMotivo(e.target.value)} placeholder="p. ej. campo cerrado por lluvia"/>
      <button class="btn warn" onClick=${() => guarda({ estado: "suspendida", motivo: motivo || null }, `La ${nombreJ(orig)} queda suspendida${motivo ? ": " + motivo : ""}.`)}>Suspender</button>
      <button class="btn sec" onClick=${() => setModal(null)}>Cancelar</button></div></div>`}
  </div>`;
}

// Horas que se enseñan como botones: alrededor de la franja (tee 10 solo hasta las 9:10) y las ya marcadas
function ventanaHoras(fr, marcadas, tee10) {
  const set = new Set(marcadas || []);
  if (fr) { const S = toMin(fr); for (let m = S; m <= S + 30; m += 10) if (!tee10 || m <= MAX10) set.add(toHM(m)); }
  return [...set].sort((a, b) => toMin(a) - toMin(b));
}
const URL_APP = "https://gambipool.github.io/gambipool/";
// Abre WhatsApp directamente (sin pasar por Safari, que dejaba una pantalla en blanco al volver).
// Si en 2,5 s la app no ha pasado a segundo plano (no hay WhatsApp), usa el enlace web.
function compartirWa(t) {
  const txt = encodeURIComponent(t);
  if (!/iphone|ipad|ipod|android/i.test(navigator.userAgent)) return window.open("https://wa.me/?text=" + txt, "_blank");
  let salio = false;
  const vis = () => { if (document.hidden) salio = true; };
  document.addEventListener("visibilitychange", vis);
  window.location.href = "whatsapp://send?text=" + txt;
  setTimeout(() => { document.removeEventListener("visibilitychange", vis); if (!salio && !document.hidden) window.location.href = "https://wa.me/?text=" + txt; }, 2500);   // iPhone bloquea window.open tras una espera
}
function textoWa(tipo, j, parts, ins) {
  const cab = `Gambipool · ${nombreJ(j)} · ${fechaJ(j)}\n${j.campo}${j.barras ? " · barras " + j.barras : ""}${j.tipo === "major" ? " · Major" : ""}`;
  if (tipo === "abierta") return `${cab}\n\nAbierta la inscripción hasta el ${fmtPlazo(j.cierre)}.\nApúntate en la app: ${URL_APP}`;
  if (tipo === "cerrada") return `${cab}\n\nCerrada la inscripción: ${ins.length} inscritos.\nEl horario se publica el ${fmtPlazo(j.horario_at)}.\n${URL_APP}`;
  const verbo = tipo === "horario2" ? "Se ha actualizado el horario" : "Ya está publicado el horario";
  return `${cab}\n\n${verbo}. Mira tu partida y las horas a intentar en la app: ${URL_APP}${j.tipo !== "fuera" && j.reserva ? `\nReserva en la web del club el ${fmtPlazo(j.reserva)}.` : ""}`;
}

function GestionJornada({ ctx, id }) {
  const { yo, temporada, barras } = ctx;
  const [tab, setTab] = useState("horario");
  const [d, setD] = useState(null);
  const [todos, setTodos] = useState([]);
  const [err, setErr] = useState(""); const [trabajando, setTrabajando] = useState(false);
  const [alta, setAlta] = useState({ jugador: "", franja: "08:30", hcp: "" });
  const [avisoWa, setAvisoWa] = useState(false);
  const cargar = useCallback(() => cargarJornada(id, yo).then(setD), [id]);
  useEffect(() => { cargar(); sb.from("jugadores").select("id, nombre_corto, ultimo_hcp, jugador_temporada(temporada_id, estado)").order("nombre_corto").then(({ data }) => setTodos((data || []).filter((x) => (x.jugador_temporada || []).some((t) => t.temporada_id === temporada.id && t.estado === "activo")))); }, [cargar]);
  if (!d) return html`<${Spinner}/>`;
  const { j, ins, parts } = d;
  const nIns = {}; ins.forEach((x) => x.partida_id && (nIns[x.partida_id] = (nIns[x.partida_id] || 0) + 1));
  const sinPartida = ins.filter((x) => !x.partida_id || !parts.some((p) => p.id === x.partida_id));
  const avisos = avisosHorario(parts, nIns);

  const run = async (f) => { setErr(""); setTrabajando(true); try { await f(); } catch (e) { setErr(errTxt(e)); } setTrabajando(false); cargar(); };
  const chk = ({ error }) => { if (error) throw error; };
  // Partidas que ya no se pueden rehacer: tarjeta empezada o salida apuntada
  const empezadas = parts.filter((p) => p.marcador_id || p.validada_at || p.salida_hora);
  const generar = () => run(async () => {
    if (empezadas.length) throw new Error(`No se puede regenerar: ${empezadas.length === 1 ? "la partida " + empezadas[0].numero + " ya tiene" : empezadas.length + " partidas ya tienen"} salida apuntada o tarjeta empezada. Cambia a mano solo lo necesario.`);
    if (parts.length && !confirm("Se borrarán las partidas actuales y se harán de nuevo al azar. ¿Seguir?")) return;
    const { partidas, movidos } = generarHorario(ins, j);
    chk(await sb.from("partidas").delete().eq("jornada_id", j.id));
    for (const p of partidas) {
      const { data, error } = await sb.from("partidas").insert({ jornada_id: j.id, numero: p.numero, franja: p.franja, t1: p.t1, t10: p.t10 }).select("id").single(); if (error) throw error;
      chk(await sb.from("inscripciones").update({ partida_id: data.id }).in("id", p.jug.map((x) => x.inscripcion_id)));
    }
    const nm = Object.keys(movidos).length; if (nm) setErr(`${nm} jugador(es) movidos a una franja cercana para no dejar franjas de 1, 2 o 5. Revisa el horario.`);
  });
  // Horas que no cuadran con los jugadores actuales (partidas sin salida apuntada)
  const pend = horasDescuadradas(parts, ins, j);
  const guardarHoras = async (lista) => { for (const p of lista) chk(await sb.from("partidas").update({ t1: p.t1, t10: p.t10 }).eq("id", p.id)); };
  // Tras cambiar quién juega en cada partida: sin publicar se recalcula solo; publicado, se avisa al comité
  // Se recalculan las franjas afectadas (antes y después del cambio) y la siguiente, porque las horas de una
  // partida dependen de las demás de su franja. Las otras franjas conservan sus retoques a mano.
  const tras = async (ids) => {
    const nd = await cargarJornada(id, yo);
    if (nd.j.horario_publicado) return;
    const fr = new Set();
    const marca = (pp, ii) => ids.forEach((pid) => { const p = pp.find((x) => x.id === pid); if (p) { const f = franjaPartida(p, ii.filter((x) => x.partida_id === pid)); if (f) fr.add(f); } });
    marca(parts, ins); marca(nd.parts, nd.ins);
    [...fr].forEach((f) => { const k = FRANJAS.indexOf(f); if (k >= 0 && FRANJAS[k + 1]) fr.add(FRANJAS[k + 1]); });
    await guardarHoras(horasEsperadas(nd.parts, nd.ins, nd.j).filter((p) => fr.has(p.franja)));
  };
  const mover = (x, pid) => run(async () => {
    chk(await sb.from("inscripciones").update({ partida_id: pid ? +pid : null }).eq("id", x.inscripcion_id)); await tras([x.partida_id, pid ? +pid : null]);
  });
  const recalcular = () => run(async () => {
    const todas = horasEsperadas(parts.map((p) => ({ ...p, t1: ["x"] })), ins, j);   // fuerza todas las que no tienen salida
    if (!todas.length) return;
    if (j.horario_publicado && !confirm("El horario ya está publicado. ¿Recalcular las horas? Después avisa al grupo con el horario corregido.")) return;
    await guardarHoras(todas); if (j.horario_publicado) setAvisoWa(true);
  });
  const marcar = (p, campo, h) => run(async () => {
    const act = p[campo] || [], v = act.includes(h) ? act.filter((x) => x !== h) : [...act, h].sort((a, b) => toMin(a) - toMin(b));
    chk(await sb.from("partidas").update({ [campo]: v }).eq("id", p.id));
  });
  const nueva = () => run(async () => chk(await sb.from("partidas").insert({ jornada_id: j.id, numero: (parts.at(-1)?.numero || 0) + 1, franja: null })));
  const borrar = (p) => run(async () => {
    if (p.marcador_id || p.validada_at || p.salida_hora) throw new Error(`La partida ${p.numero} ya tiene salida apuntada o tarjeta empezada: no se puede borrar.`);
    chk(await sb.from("partidas").delete().eq("id", p.id));
  });
  const publicar = (v) => run(async () => {
    chk(await sb.from("jornadas").update({ horario_publicado: v }).eq("id", j.id));
    if (v) chk(await sb.from("avisos").insert({ temporada_id: temporada.id, jornada_id: j.id, tipo: "horario", texto: `Publicado el horario de reservas de la ${nombreJ(j)}.` }));
  });
  const quitar = (x) => run(async () => { if (!confirm(`¿Quitar a ${x.nombre_corto} de la jornada? (sin amarilla)`)) return; chk(await sb.from("inscripciones").update({ estado: "baja", partida_id: null, baja_at: new Date().toISOString() }).eq("id", x.inscripcion_id)); await tras([x.partida_id]); });
  const inscribir = () => run(async () => {
    const hi = parseHcp(alta.hcp); if (!alta.jugador) throw new Error("Elige un jugador."); if (hi == null || isNaN(hi)) throw new Error("Pon su hándicap exacto.");
    chk(await sb.rpc("inscribir_jugador", { p_jugador: alta.jugador, p_jornada: j.id, p_franja: j.tipo === "fuera" ? null : alta.franja, p_otra: !FRANJAS.includes(alta.franja), p_hcp: hi }));
    setAlta({ jugador: "", franja: "08:30", hcp: "" });
  });
  const libres = todos.filter((t) => !ins.some((x) => x.jugador_id === t.id));

  return html`<div>
    <div class="card wa"><b>Avisar al grupo por WhatsApp</b>
      <div class="btns"><button class="btn sec small" onClick=${() => compartirWa(textoWa("abierta", j, parts, ins))}>Inscripción abierta</button>
        <button class="btn sec small" onClick=${() => compartirWa(textoWa("cerrada", j, parts, ins))}>Inscripción cerrada</button>
        <button class="btn sec small" disabled=${!parts.length} onClick=${() => compartirWa(textoWa("horario", j, parts, ins))}>Horario</button></div></div>
    <div class="tabs">${[["horario", "Horario"], ["inscritos", "Inscritos"]].map(([k, l]) => html`<button key=${k} class=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${l}</button>`)}</div>
    ${err && html`<div class="err" style=${{ margin: "12px" }}>${err}</div>`}
    ${tab === "horario" && html`<div>
      <div class="btns" style=${{ margin: "12px" }}>
        <button class="btn sec small" disabled=${trabajando || !ins.length} onClick=${generar}>${parts.length ? "Regenerar al azar" : "Generar horario"}</button>
        <button class="btn sec small" disabled=${trabajando} onClick=${nueva}>+ Partida</button></div>
      <div style=${{ margin: "0 12px" }}>${j.horario_publicado ? html`<button class="btn sec" onClick=${() => publicar(false)}>Quitar publicación</button>`
        : html`<button class="btn" disabled=${!parts.length} onClick=${() => publicar(true)}>Publicar horario</button>`}
        <p class="muted">${j.horario_publicado ? "Publicado: lo ven todos." : `Borrador. Hora prevista de publicación: ${fmtPlazo(j.horario_at)}.`}</p></div>
      ${avisos.length > 0 && html`<div class="err" style=${{ margin: "0 12px" }}>${avisos.map((a) => html`<div key=${a}>${a}</div>`)}</div>`}
      ${pend.length > 0 && html`<div class="card warnc"><b>Las horas no cuadran con los jugadores</b>
        <p class="muted" style=${{ margin: "4px 0 0" }}>${pend.map((p) => "Partida " + p.numero).join(", ")}${j.horario_publicado ? ". El horario ya está publicado: si recalculas, avisa al grupo." : "."}</p>
        <button class="btn small" disabled=${trabajando} onClick=${recalcular}>Recalcular horas</button></div>`}
      ${avisoWa && html`<div class="card"><b>Horas recalculadas</b><p class="muted" style=${{ margin: "4px 0 0" }}>Manda el horario corregido al grupo.</p>
        <button class="btn small" onClick=${() => { compartirWa(textoWa("horario2", j, parts, ins)); setAvisoWa(false); }}>Compartir por WhatsApp</button></div>`}
      ${sinPartida.length > 0 && html`<div class="ed"><div class="t"><b>Sin partida</b><span>${sinPartida.length}</span></div>
        ${sinPartida.map((x) => html`<div class="chip" key=${x.jugador_id}>${x.nombre_corto} <span class="muted">${x.franja ? hmBonito(hm(x.franja)) : ""}</span>
          <select class="mv" value="" onChange=${(e) => mover(x, e.target.value)}><option value="">Mover a…</option>${parts.map((p) => html`<option key=${p.id} value=${p.id}>Partida ${p.numero}</option>`)}</select></div>`)}</div>`}
      ${parts.map((p) => { const js = ins.filter((x) => x.partida_id === p.id); const fr = franjaPartida(p, js); return html`<div class="ed" key=${p.id}>
        <div class="t"><b>Partida ${p.numero}</b><span class="num">${js.length} jug.${p.salida_hora ? " · Salida " + hmBonito(hm(p.salida_hora)) + " T" + p.salida_tee : ""}</span></div>
        ${js.map((x) => html`<div class="chip" key=${x.jugador_id}>${x.nombre_corto} <span class="muted">${x.franja ? (x.otra_hora ? "otra " : "") + hmBonito(hm(x.franja)) : ""}</span>
          <select class="mv" value=${p.id} onChange=${(e) => mover(x, e.target.value)}>${parts.map((q) => html`<option key=${q.id} value=${q.id}>Partida ${q.numero}</option>`)}<option value="">Sin partida</option></select></div>`)}
        ${j.tipo !== "fuera" && (fr || p.t1.length || p.t10.length) && html`<div class="edt">
          ${[["t1", "Tee 1", false], ["t10", "Tee 10", true]].map(([c, l, d10]) => { const vs = ventanaHoras(fr, p[c], d10); return html`<${React.Fragment} key=${c}>
            <div class="hl">${l}</div><div class="hrs">${vs.map((h) => html`<button key=${h} class=${p[c].includes(h) ? "on" : ""} disabled=${trabajando} onClick=${() => marcar(p, c, h)}>${hmBonito(h)}</button>`)}
              ${!vs.length && html`<span class="muted" style=${{ fontSize: "13px" }}>Sin horas (tee 10 solo hasta las 9:10)</span>`}
              <select class="otra" value="" disabled=${trabajando} onChange=${(e) => e.target.value && marcar(p, c, e.target.value)}><option value="">+ otra</option>${HORAS10.filter((h) => !vs.includes(h) && (!d10 || toMin(h) <= MAX10)).map((h) => html`<option key=${h} value=${h}>${hmBonito(h)}</option>`)}</select></div></${React.Fragment}>`; })}</div>`}
        ${js.length === 0 && html`<div class="edt"><button class="link" onClick=${() => borrar(p)}>Eliminar partida vacía</button></div>`}
      </div>`; })}
      ${parts.length > 0 && j.tipo !== "fuera" && html`<div style=${{ margin: "12px" }}><button class="btn sec small" disabled=${trabajando} onClick=${recalcular}>Recalcular horas según las reglas</button>
        <p class="muted">Pulsa una hora para marcarla o quitarla. Las partidas con salida apuntada no se recalculan.</p></div>`}
    </div>`}
    ${tab === "inscritos" && html`<div>
      <div class="card"><h3>Inscribir a un jugador</h3><p class="muted">Para altas fuera de plazo. No tiene límite de fechas.</p>
        <select class="inp" value=${alta.jugador} onChange=${(e) => { const t = todos.find((x) => x.id === e.target.value); setAlta({ ...alta, jugador: e.target.value, hcp: t && t.ultimo_hcp != null ? numES(t.ultimo_hcp) : "" }); }}>
          <option value="">Elige jugador…</option>${libres.map((t) => html`<option key=${t.id} value=${t.id}>${t.nombre_corto}</option>`)}</select>
        <div class="btns">${j.tipo !== "fuera" && html`<select class="inp" value=${alta.franja} onChange=${(e) => setAlta({ ...alta, franja: e.target.value })}>${HORAS10.map((h) => html`<option key=${h} value=${h}>${hmBonito(h)}${FRANJAS.includes(h) ? " (franja)" : ""}</option>`)}</select>`}
          <input class="inp num" placeholder="Hcp exacto" value=${alta.hcp} onInput=${(e) => setAlta({ ...alta, hcp: e.target.value })}/></div>
        <button class="btn" disabled=${trabajando} onClick=${inscribir}>Inscribir</button></div>
      <div class="list">${ins.map((x) => html`<div class="row" key=${x.jugador_id}><span class="av">${iniciales(x.nombre_corto)}</span>
        <span class="n">${x.nombre_corto}<small>${x.franja ? (x.otra_hora ? "Otra hora " : "Franja ") + hmBonito(hm(x.franja)) + " · " : ""}Hcp ${numES(x.hcp_exacto)} · HJ ${x.hcp_juego ?? "—"}</small></span>
        <button class="link" onClick=${() => quitar(x)}>Quitar</button></div>`)}</div>
    </div>`}
  </div>`;
}

function ComiteAvisos({ ctx }) {
  const { temporada } = ctx;
  const [lista, setLista] = useState([]); const [txt, setTxt] = useState(""); const [err, setErr] = useState("");
  const cargar = () => sb.from("avisos").select("*").order("creado", { ascending: false }).limit(50).then(({ data }) => setLista(data || []));
  useEffect(() => { cargar(); }, []);
  const publicar = async () => { if (!txt.trim()) return; const { error } = await sb.from("avisos").insert({ temporada_id: temporada.id, texto: txt.trim() }); if (error) return setErr(errTxt(error)); setTxt(""); cargar(); };
  const borrar = async (a) => { if (!confirm("¿Borrar este aviso?")) return; await sb.from("avisos").delete().eq("id", a.id); cargar(); };
  return html`<div><div class="card"><h3>Nuevo aviso</h3><textarea class="inp" rows="3" value=${txt} onInput=${(e) => setTxt(e.target.value)} placeholder="Aparecerá en Inicio para todos"></textarea>
    ${err && html`<div class="err">${err}</div>`}<button class="btn" onClick=${publicar}>Publicar</button></div>
    <div class="card"><h3>Publicados</h3>${lista.length === 0 ? html`<p class="muted">Ninguno.</p>` : lista.map((a) => html`<div class="hist" key=${a.id}><span>${a.texto}<br/><span class="muted">${fmtAviso(a.creado)}</span></span><button class="link" onClick=${() => borrar(a)}>Borrar</button></div>`)}</div></div>`;
}

/* ---------- Arranque ---------- */
ReactDOM.createRoot(document.getElementById("root")).render(html`<${App}/>`);
