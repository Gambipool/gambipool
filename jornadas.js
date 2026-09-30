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
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const hm = (t) => (t ? String(t).slice(0, 5) : "");
const hmBonito = (t) => (t ? String(+t.slice(0, 2)) + ":" + t.slice(3, 5) : "");
const toMin = (t) => { const [h, m] = String(t).slice(0, 5).split(":").map(Number); return h * 60 + m; };
const toHM = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const HORAS10 = (() => { const a = []; for (let m = 7 * 60; m <= 15 * 60; m += 10) a.push(toHM(m)); return a; })();
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
const numES = (x) => (x == null ? "—" : String(x).replace(".", ","));
const parseHcp = (s) => { const v = String(s).trim().replace(",", "."); if (v === "") return null; const n = v.startsWith("+") ? -parseFloat(v.slice(1)) : parseFloat(v); return isNaN(n) ? NaN : n; };

/* ---------- Horario automático ---------- */
function repartir(n) {
  const q = Math.floor(n / 4), r = n % 4;
  if (r === 0) return Array(q).fill(4);
  if (r === 3) return [...Array(q).fill(4), 3];
  if (r === 2) return q >= 1 ? [...Array(q - 1).fill(4), 3, 3] : [2];
  return q >= 2 ? [...Array(q - 2).fill(4), 3, 3, 3] : q === 1 ? [5] : [1]; // 5, 2 y 1 solo si no hay otra franja: el comité lo ajusta
}
const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [b[i], b[k]] = [b[k], b[i]]; } return b; };

function generarHorario(ins, j) {
  // 1) grupos por franja (jornada fuera: un único grupo sin horas)
  const grupos = {};
  ins.forEach((x) => { const k = j.tipo === "fuera" ? "—" : hm(x.franja); (grupos[k] = grupos[k] || []).push(x); });
  const claves = Object.keys(grupos).sort((a, b) => (a === "—" ? 0 : toMin(a)) - (b === "—" ? 0 : toMin(b)));
  // 2) franjas con 1, 2 o 5 jugadores: se pasan jugadores a la franja más cercana (una sola vez cada uno)
  const movidos = {};
  if (j.tipo !== "fuera") {
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const mal = claves.find((k) => [1, 2, 5].includes(grupos[k].length));
      if (!mal || claves.length < 2) break;
      const i = claves.indexOf(mal), t = toMin(mal);
      const vecinos = [claves[i - 1], claves[i + 1]].filter(Boolean).sort((a, b) => Math.abs(toMin(a) - t) - Math.abs(toMin(b) - t) || (toMin(b) - toMin(a)));
      const destino = vecinos.find((k) => ![1, 2, 5].includes(grupos[k].length + (grupos[mal].length === 5 ? 1 : grupos[mal].length))) || vecinos[0];
      const g = grupos[mal], candidatos = barajar(g.filter((x) => !movidos[x.jugador_id]));
      const n = g.length === 5 ? 1 : g.length;
      const sale = (candidatos.length >= n ? candidatos : barajar(g)).slice(0, n);
      sale.forEach((x) => (movidos[x.jugador_id] = mal));
      grupos[mal] = g.filter((x) => !sale.includes(x)); grupos[destino].push(...sale);
    }
    claves.slice().forEach((k) => { if (!grupos[k].length) { delete grupos[k]; claves.splice(claves.indexOf(k), 1); } });
  }
  // 3) partidas
  const partidas = [];
  claves.forEach((k) => {
    const g = barajar(grupos[k]); if (!g.length) return;
    let p = 0; repartir(g.length).forEach((tam) => { partidas.push({ franja: k === "—" ? null : k, jug: g.slice(p, p + tam), t1: [], t10: [] }); p += tam; });
  });
  partidas.forEach((p, i) => (p.numero = i + 1));
  if (j.tipo === "fuera") return { partidas, movidos };
  // 4) horas por el tee 1
  let ultimo = null;
  claves.forEach((k) => {
    const ps = partidas.filter((p) => p.franja === k); if (!ps.length) return;
    const S = toMin(k), tarde = S >= 570, sat = ps.length >= 3;
    const base = ultimo == null ? S : sat ? Math.max(S, ultimo) : Math.max(S, ultimo + 10);
    ps.forEach((p, i) => {
      if (sat) p.t1 = [base + 10 * i, base + 10 * (i + 1)];
      else { const n = tarde && ps.length === 1 ? 3 : 2; p.t1 = Array.from({ length: n }, (_, m) => base + (i * n + m) * 10); }
      ultimo = Math.max(ultimo ?? 0, ...p.t1);
    });
  });
  // 5) tee 10 (8:00–9:10, nunca dos partidas en la misma hora)
  const MAX10 = 550, usado = new Set();
  partidas.forEach((p) => { const c = p.t1.find((m) => m <= MAX10 && !usado.has(m)); if (c != null) { p.t10.push(c); usado.add(c); } });
  partidas.forEach((p) => { if (p.jug.length >= 4 && p.t10.length === 1) { const c = p.t1[1]; if (c != null && c <= MAX10 && !usado.has(c)) { p.t10.push(c); usado.add(c); } } });
  if (usado.size) {
    const lo = Math.min(...usado), hi = Math.min(MAX10, Math.max(...usado) + 20);
    for (let m = lo; m <= hi; m += 10) {
      if (usado.has(m)) continue;
      const cands = partidas.filter((p) => p.jug.length >= 4 && p.t10.length === 1 && p.t1.length).sort((a, b) => Math.abs(a.t1[0] - m) - Math.abs(b.t1[0] - m));
      if (cands[0]) { cands[0].t10.push(m); cands[0].t10.sort((a, b) => a - b); usado.add(m); }
    }
  }
  partidas.forEach((p) => { p.t1 = p.t1.map(toHM); p.t10 = p.t10.map(toHM); });
  return { partidas, movidos };
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
  Object.entries(c10).forEach(([h, n]) => n > 1 && out.push(`${n} partidas intentan ${hmBonito(h)} por el tee 10 (no pueden pisarse).`));
  return out;
}

/* ---------- Datos ---------- */
async function cargarJornada(id, yo) {
  const [{ data: j }, { data: ins }, { data: parts }] = await Promise.all([
    sb.from("jornadas").select("*").eq("id", id).single(),
    sb.rpc("inscritos", { p_jornada: id }),
    sb.from("partidas").select("*").eq("jornada_id", id).order("numero"),
  ]);
  const { data: mia } = await sb.from("inscripciones").select("*").eq("jornada_id", id).eq("jugador_id", yo.id).maybeSingle();
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
      : (p.t1.length || p.t10.length) && html`<div class="times num">${p.t1.length ? "T1 " + p.t1.map(hmBonito).join(" · ") : ""}${p.t10.length ? "  ·  T10 " + p.t10.map(hmBonito).join(" · ") : ""}</div>`}
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
      <a href="https://rfegolf.es/en/aprende-mejora/consulta-handicap" target="_blank" rel="noopener" style=${{ color: "var(--hd)", fontWeight: 700, fontSize: "14px" }}>Consulta tu hándicap</a>
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
  const TABS = [["info", "Info"], ["inscritos", `Inscritos (${ins.length})`], ["horario", "Horario"]];
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
  const [d, setD] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [modal, setModal] = useState(null);
  const cargar = useCallback(() => { if (j && inscribible(j)) cargarJornada(j.id, yo).then(setD); }, [j && j.id]);
  useEffect(() => { cargar(); sb.from("avisos").select("*").order("creado", { ascending: false }).limit(5).then(({ data }) => setAvisos(data || [])); }, [cargar]);

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
  const plazo = (k, t) => html`<div class="pz" key=${k}><span>${t}</span><input type="datetime-local" class="inp" style=${{ width: "200px", flex: "0 0 200px", margin: 0, padding: "6px 8px", fontSize: "14px" }} value=${toLocalInput(j[k])} onChange=${(e) => set(k, fromLocalInput(e.target.value))}/></div>`;
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

function GestionJornada({ ctx, id }) {
  const { yo, temporada, barras } = ctx;
  const [tab, setTab] = useState("horario");
  const [d, setD] = useState(null);
  const [todos, setTodos] = useState([]);
  const [err, setErr] = useState(""); const [trabajando, setTrabajando] = useState(false);
  const [alta, setAlta] = useState({ jugador: "", franja: "08:30", hcp: "" });
  const cargar = useCallback(() => cargarJornada(id, yo).then(setD), [id]);
  useEffect(() => { cargar(); sb.from("jugadores").select("id, nombre_corto, ultimo_hcp, jugador_temporada(temporada_id, estado)").order("nombre_corto").then(({ data }) => setTodos((data || []).filter((x) => (x.jugador_temporada || []).some((t) => t.temporada_id === temporada.id && t.estado === "activo")))); }, [cargar]);
  if (!d) return html`<${Spinner}/>`;
  const { j, ins, parts } = d;
  const nIns = {}; ins.forEach((x) => x.partida_id && (nIns[x.partida_id] = (nIns[x.partida_id] || 0) + 1));
  const sinPartida = ins.filter((x) => !x.partida_id || !parts.some((p) => p.id === x.partida_id));
  const avisos = avisosHorario(parts, nIns);

  const run = async (f) => { setErr(""); setTrabajando(true); try { await f(); } catch (e) { setErr(errTxt(e)); } setTrabajando(false); cargar(); };
  const chk = ({ error }) => { if (error) throw error; };
  const generar = () => run(async () => {
    if (parts.length && !confirm("Se borrarán las partidas actuales y se harán de nuevo al azar. ¿Seguir?")) return;
    const { partidas, movidos } = generarHorario(ins, j);
    chk(await sb.from("partidas").delete().eq("jornada_id", j.id));
    for (const p of partidas) {
      const { data, error } = await sb.from("partidas").insert({ jornada_id: j.id, numero: p.numero, franja: p.franja, t1: p.t1, t10: p.t10 }).select("id").single(); if (error) throw error;
      chk(await sb.from("inscripciones").update({ partida_id: data.id }).in("id", p.jug.map((x) => x.inscripcion_id)));
    }
    const nm = Object.keys(movidos).length; if (nm) setErr(`${nm} jugador(es) movidos a una franja cercana para no dejar franjas de 1, 2 o 5. Revisa el horario.`);
  });
  const mover = (x, pid) => run(async () => chk(await sb.from("inscripciones").update({ partida_id: pid ? +pid : null }).eq("id", x.inscripcion_id)));
  const horas = (p, campo, txt) => run(async () => {
    const v = txt.split(/[\s,;·]+/).filter(Boolean).map((h) => { const m = h.replace(".", ":").match(/^(\d{1,2}):?(\d{2})$/); if (!m) throw new Error(`Hora no válida: ${h}`); return toHM(+m[1] * 60 + +m[2]); });
    chk(await sb.from("partidas").update({ [campo]: v }).eq("id", p.id));
  });
  const nueva = () => run(async () => chk(await sb.from("partidas").insert({ jornada_id: j.id, numero: (parts.at(-1)?.numero || 0) + 1, franja: parts.at(-1)?.franja || null })));
  const borrar = (p) => run(async () => chk(await sb.from("partidas").delete().eq("id", p.id)));
  const publicar = (v) => run(async () => {
    chk(await sb.from("jornadas").update({ horario_publicado: v }).eq("id", j.id));
    if (v) chk(await sb.from("avisos").insert({ temporada_id: temporada.id, jornada_id: j.id, tipo: "horario", texto: `Publicado el horario de reservas de la ${nombreJ(j)}.` }));
  });
  const quitar = (x) => run(async () => { if (!confirm(`¿Quitar a ${x.nombre_corto} de la jornada? (sin amarilla)`)) return; chk(await sb.from("inscripciones").update({ estado: "baja", partida_id: null, baja_at: new Date().toISOString() }).eq("id", x.inscripcion_id)); });
  const inscribir = () => run(async () => {
    const hi = parseHcp(alta.hcp); if (!alta.jugador) throw new Error("Elige un jugador."); if (hi == null || isNaN(hi)) throw new Error("Pon su hándicap exacto.");
    chk(await sb.rpc("inscribir_jugador", { p_jugador: alta.jugador, p_jornada: j.id, p_franja: j.tipo === "fuera" ? null : alta.franja, p_otra: !FRANJAS.includes(alta.franja), p_hcp: hi }));
    setAlta({ jugador: "", franja: "08:30", hcp: "" });
  });
  const libres = todos.filter((t) => !ins.some((x) => x.jugador_id === t.id));

  return html`<div>
    <div class="tabs">${[["horario", "Horario"], ["inscritos", `Inscritos (${ins.length})`]].map(([k, l]) => html`<button key=${k} class=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${l}</button>`)}</div>
    ${err && html`<div class="err" style=${{ margin: "12px" }}>${err}</div>`}
    ${tab === "horario" && html`<div>
      <div class="btns" style=${{ margin: "12px" }}>
        <button class="btn sec small" disabled=${trabajando || !ins.length} onClick=${generar}>${parts.length ? "Regenerar al azar" : "Generar horario"}</button>
        <button class="btn sec small" disabled=${trabajando} onClick=${nueva}>+ Partida</button></div>
      <div style=${{ margin: "0 12px" }}>${j.horario_publicado ? html`<button class="btn sec" onClick=${() => publicar(false)}>Quitar publicación</button>`
        : html`<button class="btn" disabled=${!parts.length} onClick=${() => publicar(true)}>Publicar horario</button>`}
        <p class="muted">${j.horario_publicado ? "Publicado: lo ven todos." : `Borrador. Hora prevista de publicación: ${fmtPlazo(j.horario_at)}.`}</p></div>
      ${avisos.length > 0 && html`<div class="err" style=${{ margin: "0 12px" }}>${avisos.map((a) => html`<div key=${a}>${a}</div>`)}</div>`}
      ${sinPartida.length > 0 && html`<div class="ed"><div class="t"><b>Sin partida</b><span>${sinPartida.length}</span></div>
        ${sinPartida.map((x) => html`<div class="chip" key=${x.jugador_id}>${x.nombre_corto} <span class="muted">${x.franja ? hmBonito(hm(x.franja)) : ""}</span>
          <select class="mv" value="" onChange=${(e) => mover(x, e.target.value)}><option value="">Mover a…</option>${parts.map((p) => html`<option key=${p.id} value=${p.id}>Partida ${p.numero}</option>`)}</select></div>`)}</div>`}
      ${parts.map((p) => { const js = ins.filter((x) => x.partida_id === p.id); return html`<div class="ed" key=${p.id}>
        <div class="t"><b>Partida ${p.numero}${p.franja ? " · " + hmBonito(hm(p.franja)) : ""}</b><span class="num">${js.length} jug.${p.salida_hora ? " · Salida " + hmBonito(hm(p.salida_hora)) + " T" + p.salida_tee : ""}</span></div>
        ${js.map((x) => html`<div class="chip" key=${x.jugador_id}>${x.nombre_corto} <span class="muted">${x.franja ? (x.otra_hora ? "otra " : "") + hmBonito(hm(x.franja)) : ""}</span>
          <select class="mv" value=${p.id} onChange=${(e) => mover(x, e.target.value)}>${parts.map((q) => html`<option key=${q.id} value=${q.id}>Partida ${q.numero}</option>`)}<option value="">Sin partida</option></select></div>`)}
        ${j.tipo !== "fuera" && html`<div class="edt">
          <label>Tee 1 <input class="inp num" style=${{ margin: "2px 0 6px", padding: "6px 8px", fontSize: "14px" }} defaultValue=${p.t1.join(", ")} onBlur=${(e) => e.target.value !== p.t1.join(", ") && horas(p, "t1", e.target.value)}/></label>
          <label>Tee 10 <input class="inp num" style=${{ margin: "2px 0 6px", padding: "6px 8px", fontSize: "14px" }} defaultValue=${p.t10.join(", ")} onBlur=${(e) => e.target.value !== p.t10.join(", ") && horas(p, "t10", e.target.value)}/></label></div>`}
        ${js.length === 0 && html`<div class="edt"><button class="link" onClick=${() => borrar(p)}>Eliminar partida vacía</button></div>`}
      </div>`; })}
      <p class="muted" style=${{ margin: "12px" }}>Horas separadas por comas (08:30, 08:40). Se guardan al salir de la casilla.</p>
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
