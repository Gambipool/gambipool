/* Gambipool · clasificación de la jornada, directo y ranking (se carga antes de jornadas.js) */

const recordar = (k, v) => { try { if (v === undefined) return sessionStorage.getItem("gp_" + k); sessionStorage.setItem("gp_" + k, v); } catch (e) { return null; } };
const numPts = (x) => { const n = +x; return Number.isInteger(n) ? String(n) : String(n).replace(".", ","); };
const posiciones = (arr, val) => arr.map((p) => { const v = val(p); const first = arr.findIndex((q) => val(q) === v); const tie = arr.filter((q) => val(q) === v).length > 1; return { t: tie, n: first + 1 }; });
// Puesto en una jornada cerrada: si empata del todo (mismo resultado y mismo hcp exacto) con otros, "T" + el mejor puesto del grupo
function puestoJ(rs, r) {
  if (!r || r.retirado || r.posicion == null) return "";
  const g = rs.filter((x) => !x.retirado && x.categoria === r.categoria && x.resultado === r.resultado && +x.hcp_exacto === +r.hcp_exacto);
  return g.length > 1 ? "T" + Math.min(...g.map((x) => x.posicion)) : String(r.posicion);
}
const Flecha = ({ m }) => (m > 0 ? html`<small class="up">▲${m}</small>` : m < 0 ? html`<small class="dn">▼${-m}</small>` : null);
const SegCat = ({ cat, setCat }) => html`<div class="seg2">${[["scratch", "Scratch"], ["handicap", "Hándicap"]].map(([k, l]) => html`<button key=${k} class=${cat === k ? "on" : ""} onClick=${() => { setCat(k); recordar("cat", k); }}>${l}</button>`)}</div>`;

/* ---------- Ranking (10 mejores) ---------- */
function calcRanking(res, cat, miembros, mejores, excluir) {
  const por = {};
  res.filter((r) => r.categoria === cat && r.jornada_id !== excluir).forEach((r) => {
    const o = (por[r.nombre] = por[r.nombre] || { n: r.nombre, jid: null, pts: {}, jug: 0, ret: {} });
    o.pts[r.jornada_id] = +r.total; if (r.retirado) o.ret[r.jornada_id] = true; else o.jug++;
    if (r.jugador_id) o.jid = r.jugador_id;
  });
  (miembros || []).forEach((n) => { if (!por[n]) por[n] = { n, jid: null, pts: {}, jug: 0, ret: {} }; });
  const arr = Object.values(por);
  arr.forEach((o) => { const v = Object.values(o.pts).sort((a, b) => b - a); o.total = v.slice(0, mejores).reduce((a, b) => a + b, 0); o.cuentan = v.slice(0, mejores); });
  arr.sort((a, b) => b.total - a.total || a.n.localeCompare(b.n));
  const pos = posiciones(arr, (o) => o.total);
  arr.forEach((o, i) => { o.pos = pos[i].n; o.tie = pos[i].t; });
  return arr;
}
async function cargarRanking(temporada, jornadas, conMiembros) {
  const ids = jornadas.map((j) => j.id);
  const [res, dirData] = await Promise.all([
    ids.length ? q(sb.from("resultados").select("jornada_id, categoria, jugador_id, nombre, total, retirado").in("jornada_id", ids)) : [],
    conMiembros ? q(sb.rpc("directorio")) : [],
  ]);
  const dir = { data: dirData };
  const mejores = (temporada.reglas && temporada.reglas.mejores_resultados) || 10;
  const cerradas = jornadas.filter((j) => (res || []).some((r) => r.jornada_id === j.id)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultima = cerradas.length >= 2 ? cerradas[cerradas.length - 1] : null;
  const miembros = (dir.data || []).map((x) => x.nombre_corto);
  const R = {};
  ["scratch", "handicap"].forEach((cat) => {
    const act = calcRanking(res || [], cat, miembros, mejores);
    if (ultima) { const prev = calcRanking(res || [], cat, miembros, mejores, ultima.id); const pp = {}; prev.forEach((o) => (pp[o.n] = o.pos)); act.forEach((o) => (o.mv = pp[o.n] ? pp[o.n] - o.pos : 0)); }
    R[cat] = act;
  });
  return { R, res: res || [], mejores, ultima: cerradas[cerradas.length - 1] || null };
}
const claveRanking = (temporada, jornadas, conMiembros) => `rk_${temporada.id}_${conMiembros ? 1 : 0}_${jornadas.filter((j) => j.cerrada).length}`;

const SIN_JORNADAS = [];
/* ---------- Pestaña Clasificación ---------- */
function Clasificacion({ ctx }) {
  const { temporada } = ctx;
  const [sub, setSub] = useState(recordar("sub") || "jornada");
  const [cat, setCat] = useState(recordar("cat") || "scratch");
  const [temps, setTemps] = useState([temporada]);
  const [tid, setTid] = useState(temporada.id);
  const [jsT, setJsT] = useState({ tid: temporada.id, js: ctx.jornadas });   // jornadas y de qué temporada son
  const [jid, setJid] = useState(null);
  useEffect(() => { sb.from("temporadas").select("*").order("anio", { ascending: false }).then(({ data }) => data && data.length && setTemps(data)); }, []);
  useEffect(() => {
    let vivo = true;
    if (tid === temporada.id) setJsT({ tid, js: ctx.jornadas });
    else sb.from("jornadas").select("*").eq("temporada_id", tid).order("fecha").then(({ data, error }) => { if (vivo && !error) setJsT({ tid, js: data || [] }); });
    return () => { vivo = false; };   // si se cambia de temporada antes de que llegue, se descarta
  }, [tid, ctx.jornadas]);
  const listo = jsT.tid === tid;
  const js = listo ? jsT.js : SIN_JORNADAS;
  const T = temps.find((t) => t.id === tid) || temporada;
  const conPuntos = js.filter((j) => inscribible(j) && j.numero);
  const hoy = hoyMadrid();
  useEffect(() => {
    if (jid && conPuntos.some((j) => j.id === jid)) return;
    const vivo = conPuntos.find((j) => j.fecha <= hoy && fin(j) >= hoy && !j.cerrada && j.estado === "programada");
    const ult = [...conPuntos].reverse().find((j) => j.cerrada);
    setJid((vivo || ult || conPuntos[0] || {}).id || null);
  }, [js]);
  const j = conPuntos.find((x) => x.id === jid);
  const cambiaSub = (k) => { setSub(k); recordar("sub", k); };
  return html`<div>
    <div class="tabs">${[["jornada", "Jornada"], ["ranking", "Ranking"]].map(([k, l]) => html`<button key=${k} class=${sub === k ? "on" : ""} onClick=${() => cambiaSub(k)}>${l}</button>`)}</div>
    <div class="sels">
      <select class="inp" value=${tid} onChange=${(e) => { setTid(+e.target.value); setJid(null); }}>${temps.map((t) => html`<option key=${t.id} value=${t.id}>${t.anio}</option>`)}</select>
      ${sub === "jornada" && html`<select class="inp" value=${jid || ""} onChange=${(e) => setJid(+e.target.value)}>${[...conPuntos].reverse().map((x) => html`<option key=${x.id} value=${x.id}>${nombreJ(x)} · ${fmtDia(x.fecha)}${x.tipo === "major" ? " · Major" : ""}</option>`)}</select>`}
    </div>
    <${SegCat} cat=${cat} setCat=${setCat}/>
    ${!listo ? html`<${Spinner}/>` : sub === "jornada" ? (j ? html`<${ClasJornada} key=${j.id + cat} ctx=${ctx} j=${j} cat=${cat}/>` : html`<div class="card"><p class="muted" style=${{ margin: 0 }}>No hay jornadas.</p></div>`)
      : html`<${Ranking} key=${tid + cat} ctx=${ctx} temporada=${T} jornadas=${conPuntos} cat=${cat}/>`}
  </div>`;
}

/* ---------- Clasificación de una jornada (resultado o directo) ---------- */
function ClasJornada({ ctx, j, cat }) {
  const hoy = hoyMadrid();
  if (j.cerrada) return html`<${ResultadoJornada} ctx=${ctx} j=${j} cat=${cat}/>`;
  if (j.estado === "suspendida") return html`<div class="card"><p class="muted" style=${{ margin: 0 }}>Jornada suspendida.</p></div>`;
  if (j.fecha <= hoy) return html`<${Directo} ctx=${ctx} j=${j} cat=${cat}/>`;
  return html`<div class="card"><p class="muted" style=${{ margin: 0 }}>Todavía no se ha jugado. Se juega el ${fmtDiaLargo(j.fecha).toLowerCase()}.</p></div>`;
}

function ResultadoJornada({ ctx, j, cat }) {
  const { yo, go } = ctx;
  const [rs] = useCache(`res_${j.id}_${cat}`, () => q(sb.from("resultados").select("*").eq("jornada_id", j.id).eq("categoria", cat)), [j.id, cat]);
  if (!rs) return html`<${Spinner}/>`;
  if (!rs.length) return html`<div class="card"><p class="muted" style=${{ margin: 0 }}>Sin resultados.</p></div>`;
  const ok = rs.filter((r) => !r.retirado).sort((a, b) => a.posicion - b.posicion), ret = rs.filter((r) => r.retirado);
  const empate = (r) => ok.filter((x) => x.resultado === r.resultado).length > 1;
  const me = (r) => r.jugador_id === yo.id || r.nombre === yo.nombre_corto;
  return html`<div class="clw">
    <div class="cl p5 h"><span>#</span><span>Jugador</span><span>Hcp</span><span>${cat === "scratch" ? "Bruto" : "Neto"}</span><span>Pts</span></div>
    ${ok.map((r) => html`<button key=${r.id} class=${"cl p5" + (me(r) ? " me" : "")} onClick=${() => r.jugador_id && go("tarjeta-jugador", `${j.id}|${r.jugador_id}|${cat}`)}>
      <span class="p">${puestoJ(ok, r)}</span><span class="nm">${r.nombre}</span><span class=${"mu" + (empate(r) ? " de" : "")}>${numES(r.hcp_exacto)}</span><span>${r.resultado ?? "—"}</span><span><b>${numPts(r.total)}</b></span></button>`)}
    ${ret.map((r) => html`<div key=${r.id} class="cl p5 ret"><span class="p">—</span><span class="nm">${r.nombre}</span><span class="mu">${numES(r.hcp_exacto)}</span><span>Ret.</span><span>${numPts(r.total)}</span></div>`)}
  </div>`;
}

async function cargarDirecto(j) {
  const [ins, est, dir] = await Promise.all([
    q(sb.rpc("inscritos", { p_jornada: j.id })),
    q(sb.from("inscripciones").select("id, retirado, bruto_manual, partida_id").eq("jornada_id", j.id).eq("estado", "inscrito")),
    q(sb.rpc("directo", { p_jornada: j.id })),
  ]);
  const parTot = ((await cargarHoyos(j.campo)) || []).reduce((s, h) => s + h.par, 0) || 72;
  return (ins || []).map((x) => {
    const e = (est || []).find((y) => y.id === x.inscripcion_id) || {};
    const d = (dir || []).find((y) => y.inscripcion_id === x.inscripcion_id) || {};
    let thru = d.hoyos || 0, rb = d.rel_bruto || 0, rn = d.rel_neto || 0;
    if (e.bruto_manual != null) { thru = 18; rb = e.bruto_manual - parTot; rn = e.bruto_manual - (x.hcp_juego || 0) - parTot; }
    return { ...x, retirado: e.retirado, thru, rb, rn };
  });
}

function Directo({ ctx, j, cat }) {
  const { yo, go } = ctx;
  const [ls, setLs] = useState(() => cacheLeer(`dir_${j.id}`) || null);
  useEffect(() => {
    const f = () => !document.hidden && cargarDirecto(j).then((v) => { cacheGuardar(`dir_${j.id}`, v, false); setLs(v); }).catch(() => {});
    f(); const t = setInterval(f, 30000); return () => clearInterval(t);
  }, [j.id]);
  if (!ls) return html`<${Spinner}/>`;
  const k = cat === "scratch" ? "rb" : "rn";
  const jugando = ls.filter((x) => !x.retirado && x.thru > 0).sort((a, b) => a[k] - b[k] || b.thru - a.thru || a.nombre_corto.localeCompare(b.nombre_corto));
  const pos = posiciones(jugando, (x) => x[k]);
  const sin = ls.filter((x) => !x.retirado && x.thru === 0), ret = ls.filter((x) => x.retirado);
  const mia = (ls.find((x) => x.jugador_id === yo.id) || {}).partida_id;
  const me = (x) => x.jugador_id === yo.id || (mia != null && x.partida_id === mia);
  return html`<div class="clw">
    ${!j.cerrada && j.fecha <= hoyMadrid() && fin(j) >= hoyMadrid() && ls.some((x) => x.jugador_id === yo.id && x.partida_id) && html`<div style=${{ margin: "10px 12px 0" }}><button class="btn sec" onClick=${() => { ctx.setTab("tarjeta"); window.scrollTo(0, 0); }}>Volver a mi tarjeta</button></div>`}
    <div class="live"><span class="dotl"></span>En directo</div>
    <div class="cl h"><span>#</span><span>Jugador</span><span>Hoyos</span><span>${cat === "scratch" ? "Bruto" : "Neto"}</span></div>
    ${jugando.map((x, i) => html`<button key=${x.inscripcion_id} class=${"cl" + (me(x) ? " me" : "")} onClick=${() => go("tarjeta-jugador", `${j.id}|${x.jugador_id}|${cat}`)}>
      <span class="p">${pos[i].t ? "T" : ""}${pos[i].n}</span><span class="nm">${x.nombre_corto}</span><span class="mu">${x.thru === 18 ? "F" : x.thru}</span><span><b>${relPar(x[k])}</b></span></button>`)}
    ${sin.map((x) => html`<div key=${x.inscripcion_id} class=${"cl sinj" + (me(x) ? " me" : "")}><span class="p"></span><span class="nm">${x.nombre_corto}</span><span class="mu">0</span><span>—</span></div>`)}
    ${ret.map((x) => html`<div key=${x.inscripcion_id} class="cl ret"><span class="p">—</span><span class="nm">${x.nombre_corto}</span><span class="mu"></span><span>Ret.</span></div>`)}
  </div>`;
}

/* ---------- Tarjeta de un jugador (desde la clasificación) ---------- */
function TarjetaJugador({ ctx, p }) {
  const [jid, uid, cat] = p.split("|");
  const [d, setD] = useState(null);
  useEffect(() => { let t = null, vivo = true; const cargar = async () => {
    const { data: j } = await sb.from("jornadas").select("*").eq("id", +jid).single();
    const [{ data: ins }, { data: rs }, hoyos] = await Promise.all([
      sb.rpc("inscritos", { p_jornada: +jid }),
      sb.from("resultados").select("*").eq("jornada_id", +jid).eq("categoria", cat),
      cargarHoyos(j.campo),
    ]);
    const x = (ins || []).find((y) => y.jugador_id === uid);
    let golpes = {}, est = {};
    if (x) {
      const [{ data: gs }, { data: e }] = await Promise.all([sb.from("golpes").select("hoyo, golpes").eq("inscripcion_id", x.inscripcion_id), sb.from("inscripciones").select("retirado, bruto_manual").eq("id", x.inscripcion_id).single()]);
      golpes = { [x.inscripcion_id]: Object.fromEntries((gs || []).map((g) => [g.hoyo, g.golpes])) }; est = e || {};
    }
    if (!vivo) return;
    const r = (rs || []).find((y) => y.jugador_id === uid);
    setD({ j, x: x ? { ...x, ...est, ini: "Golpes" } : null, r: r ? { ...r, pt: puestoJ(rs, r) } : undefined, golpes, hoyos });
    // jornada en juego: se actualiza sola cada 30 s, como el directo
    if (!j.cerrada && !t) t = setInterval(() => !document.hidden && cargar(), 30000);
  }; cargar(); return () => { vivo = false; t && clearInterval(t); }; }, [p]);
  if (!d) return html`<${Spinner}/>`;
  const { j, x, r, golpes, hoyos } = d;
  const nombre = (x && x.nombre_corto) || (r && r.nombre) || "";
  const o = x ? golpes[x.inscripcion_id] || {} : {};
  const n = Object.keys(o).length, bruto = Object.values(o).reduce((a, b) => a + b, 0);
  const parJug = Object.keys(o).reduce((s, h) => s + ((hoyos.find((q) => q.hoyo === +h) || {}).par || 0), 0);
  const tieneTarjeta = x && n > 0 && hoyos.length;
  return html`<div>
    <div class="gbh"><span class="num">${r && r.pt ? r.pt + "." : ""}</span><b>${nombre}</b>
      <span class="num">${n === 18 ? bruto : x && x.bruto_manual != null ? x.bruto_manual : ""}</span>
      <span class=${"num rl" + (bruto - parJug < 0 ? " neg" : "")}>${n ? relPar(bruto - parJug) : ""}</span><span>${n === 18 ? "F" : n || ""}</span></div>
    ${tieneTarjeta ? html`<${ResumenTarjeta} jug=${[x]} golpes=${golpes} hoyos=${hoyos}/>`
      : html`<div class="card"><p class="muted" style=${{ margin: 0 }}>${r && !x ? "Resultado cargado del Excel: no hay tarjeta hoyo a hoyo." : "No hay golpes anotados en la app."}</p>
        ${r && html`<div class="kv"><span>${cat === "scratch" ? "Bruto" : "Neto"}</span><b class="num">${r.retirado ? "Retirado" : r.resultado}</b></div><div class="kv"><span>Hcp exacto · de juego</span><b class="num">${numES(r.hcp_exacto)} · ${r.hcp_juego ?? "—"}</b></div>`}</div>`}
    ${tieneTarjeta && html`<div class="card" style=${{ padding: "4px 12px" }}><div class="kv"><span>Hcp exacto · de juego</span><b class="num">${numES(x.hcp_exacto)} · ${x.hcp_juego ?? "—"}</b></div></div>`}
  </div>`;
}

/* ---------- Ranking de la temporada ---------- */
function Ranking({ ctx, temporada, jornadas, cat }) {
  const { yo, go } = ctx;
  const con = temporada.id === ctx.temporada.id;
  const [d] = useCache(claveRanking(temporada, jornadas, con), () => cargarRanking(temporada, jornadas, con), [temporada.id, jornadas.length]);
  if (!d) return html`<${Spinner}/>`;
  const L = d.R[cat];
  if (!L.length) return html`<div class="card"><p class="muted" style=${{ margin: 0 }}>Todavía no hay puntos.</p></div>`;
  const me = (o) => o.jid === yo.id || o.n === yo.nombre_corto;
  return html`<div class="clw">
    <div class="cl h"><span>#</span><span>Jugador</span><span>Jug.</span><span>Pts</span></div>
    ${L.map((o) => html`<button key=${o.n} class=${"cl" + (me(o) ? " me" : "") + (o.jug ? "" : " sinj")} onClick=${() => go("ranking-jugador", `${temporada.id}|${cat}|${o.n}`)}>
      <span class="p">${o.tie ? "T" : ""}${o.pos}</span><span class="nmx"><i>${o.n}</i><${Flecha} m=${o.mv}/></span><span class="mu">${o.jug}</span><span><b>${numPts(o.total)}</b></span></button>`)}
  </div>`;
}

function RankingJugador({ ctx, p }) {
  const { yo } = ctx;
  const [tid, cat, nombre] = p.split("|");
  const [d, setD] = useState(null);
  const [jugs, setJugs] = useState([]); const [msg, setMsg] = useState("");
  const cargar = useCallback(async () => {
    const [{ data: t }, { data: js }] = await Promise.all([sb.from("temporadas").select("*").eq("id", +tid).single(), sb.from("jornadas").select("*").eq("temporada_id", +tid).order("fecha")]);
    const lista = (js || []).filter((j) => inscribible(j) && j.numero);
    const { data: rs } = await sb.from("resultados").select("*").eq("categoria", cat).eq("nombre", nombre).in("jornada_id", lista.map((j) => j.id));
    setD({ t, lista, rs: rs || [] });
  }, [p]);
  useEffect(() => { cargar(); if (yo.es_admin) sb.from("jugadores").select("id, nombre_corto").order("nombre_corto").then(({ data }) => setJugs(data || [])); }, [cargar]);
  if (!d) return html`<${Spinner}/>`;
  const { t, lista, rs } = d;
  const mejores = (t.reglas && t.reglas.mejores_resultados) || 10;
  const jugadas = lista.filter((j) => j.cerrada);
  const pts = (j) => rs.find((r) => r.jornada_id === j.id);
  const orden = jugadas.map((j) => ({ j, v: pts(j) ? +pts(j).total : 0 })).sort((a, b) => b.v - a.v);
  const cuentan = new Set(orden.slice(0, mejores).filter((x) => pts(x.j)).map((x) => x.j.id));
  const total = orden.slice(0, mejores).reduce((s, x) => s + x.v, 0);
  const sinEnlace = yo.es_admin && rs.length > 0 && !rs.some((r) => r.jugador_id);
  const enlazar = async (id) => {
    const jg = jugs.find((x) => x.id === id); if (!jg || !confirm(`¿Unir los resultados de "${nombre}" con ${jg.nombre_corto}?`)) return;
    const { error } = await sb.from("resultados").update({ jugador_id: jg.id, nombre: jg.nombre_corto }).eq("nombre", nombre).is("jugador_id", null);
    setMsg(error ? errTxt(error) : `Unido con ${jg.nombre_corto}. Vuelve al ranking.`);
  };
  return html`<div>
    <p class="muted" style=${{ margin: "12px 14px 0" }}>Ranking ${cat === "scratch" ? "scratch" : "hándicap"} · ${t.anio}</p>
    <div class="card" style=${{ padding: "4px 12px" }}>
      ${jugadas.map((j) => { const r = pts(j); return html`<div key=${j.id} class=${"kv" + (cuentan.has(j.id) ? "" : " nocuenta")}>
        <span>${nombreJ(j)}${j.tipo === "major" ? html` <small class="x2">MAJOR</small>` : ""}${!r ? html` <small class="muted">no jugó</small>` : r.retirado ? html` <small class="muted">retirado</small>` : ""}</span>
        <b class="num">${r ? numPts(r.total) : 0}</b></div>`; })}
      <div class="kv"><span><b>Total (${mejores} mejores)</b></span><b class="num">${numPts(total)}</b></div></div>
    ${sinEnlace && html`<div class="card"><h3>Comité</h3><p class="muted" style=${{ margin: "0 0 6px" }}>Estos resultados no están unidos a ningún jugador de la app. Si es uno de ellos con otro nombre, únelos:</p>
      <select class="inp" value="" onChange=${(e) => enlazar(e.target.value)}><option value="">Elegir jugador…</option>${jugs.map((x) => html`<option key=${x.id} value=${x.id}>${x.nombre_corto}</option>`)}</select>
      ${msg && html`<div class="ok">${msg}</div>`}</div>`}
  </div>`;
}

/* ---------- Inicio: tu resultado tras la última jornada ---------- */
function TuResultado({ ctx }) {
  const { yo, temporada, jornadas, setTab } = ctx;
  const ult = [...jornadas].filter((j) => j.cerrada && inscribible(j)).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop();
  const lista = jornadas.filter((j) => inscribible(j) && j.numero);
  const [rk] = useCache(ult ? claveRanking(temporada, lista, true) : null, () => cargarRanking(temporada, lista, true), [ult && ult.id]);
  const [mis] = useCache(ult ? `mires_${ult.id}` : null, async () => { const todos = await q(sb.from("resultados").select("*").eq("jornada_id", ult.id)); return todos.filter((r) => r.jugador_id === yo.id || r.nombre === yo.nombre_corto).map((r) => ({ ...r, pt: puestoJ(todos, r) })); }, [ult && ult.id]);
  const d = useMemo(() => {
    if (!rk || !mis) return null;
    const pos = (cat) => (rk.R[cat].find((o) => o.jid === yo.id || o.n === yo.nombre_corto) || null);
    return { s: mis.find((r) => r.categoria === "scratch"), h: mis.find((r) => r.categoria === "handicap"), rs: pos("scratch"), rh: pos("handicap") };
  }, [rk, mis]);
  if (!ult || !d || (!d.rs && !d.s)) return null;
  const cel = (r, t) => html`<div><b>${r ? (r.retirado ? "Ret." : (r.pt || r.posicion) + "º") : "—"}</b><span>${t}${r && !r.retirado ? " · " + r.resultado : ""}</span></div>`;
  return html`<div class="card"><span class="tag gold">Tu resultado · ${nombreJ(ult)}</span>
    ${(d.s || d.h) ? html`<div class="count">${cel(d.s, "Scratch")}${cel(d.h, "Hándicap")}</div>` : html`<p class="muted">No jugaste la ${nombreJ(ult)}.</p>`}
    ${d.rs && html`<div class="kv" style=${{ marginTop: "8px" }}><span>Ranking scratch</span><b>${d.rs.tie ? "T" : ""}${d.rs.pos}º <${Flecha} m=${d.rs.mv}/></b></div>`}
    ${d.rh && html`<div class="kv"><span>Ranking hándicap</span><b>${d.rh.tie ? "T" : ""}${d.rh.pos}º <${Flecha} m=${d.rh.mv}/></b></div>`}
    <button class="btn sec" onClick=${() => setTab("clasificacion")}>Ver clasificación</button></div>`;
}
