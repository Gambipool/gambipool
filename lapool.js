/* Gambipool · La Pool: reglamento, contabilidad, estadísticas, palmarés, perfil y temporadas (se carga antes de jornadas.js) */

const euros = (n) => { n = +n || 0; const e = Number.isInteger(n); const [a, d] = Math.abs(n).toFixed(e ? 0 : 2).split("."); return (n < 0 ? "−" : "") + a.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (e ? "" : "," + d) + " €"; };
const Kv = ({ a, b, cls }) => html`<div class=${"kv " + (cls || "")}><span>${a}</span><b class="num">${b}</b></div>`;

function useTemporadas(ctx) {
  const [temps, setTemps] = useState([ctx.temporada]);
  const [tid, setTid] = useState(ctx.temporada.id);
  const cargar = useCallback(() => sb.from("temporadas").select("*").order("anio", { ascending: false }).then(({ data }) => data && data.length && setTemps(data)), []);
  useEffect(() => { cargar(); }, []);
  const T = temps.find((t) => t.id === tid) || ctx.temporada;
  const Sel = () => html`<div class="sels"><select class="inp" value=${tid} onChange=${(e) => setTid(+e.target.value)}>${temps.map((t) => html`<option key=${t.id} value=${t.id}>${t.anio}${t.activa ? "" : t.anio > ctx.temporada.anio ? " (en preparación)" : ""}</option>`)}</select></div>`;
  return { temps, T, Sel, recargarTemps: cargar };
}

/* ---------- Menú ---------- */
function Pool({ yo, go }) {
  const items = [["reglamento", "Reglamento", "Reglas de la temporada"], ["-", "Ryder Cup", "Próximamente"], ["directorio", "Jugadores", "Nombre y móvil de todos"],
    ["contabilidad", "Contabilidad", "Ingresos, gastos y saldo"], ["estadisticas", "Estadísticas", "Birdies, eagles, mejores vueltas…"], ["palmares", "Palmarés", "Ganadores de cada temporada"], ["perfil", "Mi perfil", "Tus datos y tarjetas amarillas"]];
  return html`<div class="list" style=${{ marginTop: "12px" }}>${items.map(([k, t, s]) => html`<button class="row" key=${t} disabled=${k === "-"} onClick=${() => k !== "-" && go(k)} style=${k === "-" ? { opacity: 0.55 } : null}>
      <span class="n">${t}<small>${s}</small></span><span aria-hidden="true">›</span></button>`)}</div>`;
}

/* ---------- Mi perfil ---------- */
function Perfil({ yo, temporada }) {
  const [am, setAm] = useState(null);
  useEffect(() => { temporada && sb.from("amarillas").select("*").eq("jugador_id", yo.id).eq("temporada_id", temporada.id).order("creada").then(({ data }) => setAm(data || [])); }, []);
  const vivas = (am || []).filter((a) => !a.anulada);
  return html`<div>
    <div class="card"><h3>${yo.nombre}</h3>
      <div class="kv"><span>Nombre corto</span><b>${yo.nombre_corto}</b></div>
      <div class="kv"><span>Email</span><b>${yo.email}</b></div>
      <div class="kv"><span>Móvil</span><b>${yo.movil || "—"}</b></div>
      <div class="kv"><span>Licencia</span><b>${yo.licencia || "—"}</b></div>
      <div class="kv"><span>Último hándicap</span><b class="num">${yo.ultimo_hcp != null ? String(yo.ultimo_hcp).replace(".", ",") : "—"}</b></div>
      <p class="muted" style=${{ marginBottom: "0" }}>Si algún dato no es correcto, díselo al comité.</p>
    </div>
    <div class="card"><h3>Tarjetas amarillas ${temporada ? temporada.anio : ""}</h3>
      ${am == null ? html`<${Spinner}/>` : !am.length ? html`<p class="muted" style=${{ margin: 0 }}>Ninguna.</p>`
        : am.map((a) => html`<div key=${a.id} class=${"hist" + (a.anulada ? " anulada" : "")}><span>${a.jornada ? a.jornada + " · " : ""}${a.motivo || "Amarilla"}</span><span class="muted">${fmtFecha(a.fecha)}</span></div>`)}
      ${am && am.length > 0 && html`<div class="kv" style=${{ marginTop: "4px" }}><span>En vigor</span><b class="num">${vivas.length} de 3</b></div>`}
    </div>
    <div style=${{ margin: "0 12px" }}><button class="btn sec" onClick=${() => sb.auth.signOut()}>Cerrar sesión</button></div>
  </div>`;
}

/* ---------- Reglamento ---------- */
function Reglamento({ ctx }) {
  const { yo } = ctx;
  const { T, Sel, recargarTemps } = useTemporadas(ctx);
  const [err, setErr] = useState(""); const [trab, setTrab] = useState(false);
  const abrir = async () => {
    setErr(""); const w = window.open("", "_blank");
    const { data, error } = await sb.storage.from("reglamentos").createSignedUrl(T.reglamento_path, 3600);
    if (error) { w && w.close(); return setErr(errTxt(error)); }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  };
  const subir = async (e) => {
    const f = e.target.files[0]; if (!f) return; setErr("");
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) return setErr("Tiene que ser un PDF.");
    setTrab(true);
    const path = `${T.anio}/reglamento-${Date.now()}.pdf`;
    const { error } = await sb.storage.from("reglamentos").upload(path, f, { contentType: "application/pdf", upsert: true });
    if (error) { setTrab(false); return setErr(errTxt(error)); }
    if (T.reglamento_path) await sb.storage.from("reglamentos").remove([T.reglamento_path]);
    const { error: e2 } = await sb.from("temporadas").update({ reglamento_path: path }).eq("id", T.id);
    setTrab(false); if (e2) return setErr(errTxt(e2)); recargarTemps();
  };
  const quitar = async () => {
    if (!confirm("¿Quitar el reglamento de esta temporada?")) return;
    await sb.storage.from("reglamentos").remove([T.reglamento_path]);
    await sb.from("temporadas").update({ reglamento_path: null }).eq("id", T.id); recargarTemps();
  };
  return html`<div><${Sel}/>
    <div class="card"><h3>Reglamento Gambipool ${T.anio}</h3>
      ${T.reglamento_path ? html`<button class="btn" onClick=${abrir}>Abrir reglamento</button>` : html`<p class="muted" style=${{ margin: 0 }}>Todavía no está subido.</p>`}
      ${err && html`<div class="err">${err}</div>`}</div>
    ${yo.es_admin && html`<div class="card"><h3>Comité</h3>
      <label class="btn sec" style=${{ display: "block", cursor: "pointer" }}>${trab ? "Subiendo…" : T.reglamento_path ? "Sustituir PDF" : "Subir PDF"}<input type="file" accept="application/pdf" style=${{ display: "none" }} onChange=${subir}/></label>
      ${T.reglamento_path && html`<button class="btn sec" style=${{ color: "var(--warn)", borderColor: "var(--warn)" }} onClick=${quitar}>Quitar</button>`}</div>`}
  </div>`;
}

/* ---------- Contabilidad ---------- */
function Contabilidad({ ctx }) {
  const { yo } = ctx;
  const { T, Sel } = useTemporadas(ctx);
  const [d, setD] = useState(null);
  const [nuevo, setNuevo] = useState({ tipo: "gasto", concepto: "", importe: "" });
  const [edit, setEdit] = useState(null); const [err, setErr] = useState("");
  const cargar = useCallback(async () => {
    const [{ data: n }, { data: mv }] = await Promise.all([sb.rpc("cuotas_cobradas", { p_temporada: T.id }), sb.from("movimientos").select("*").eq("temporada_id", T.id).order("creado")]);
    setD({ n: n || 0, mv: mv || [] });
  }, [T.id]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  if (!d) return html`<div><${Sel}/><${Spinner}/></div>`;
  const cuota = +((T.reglas || {}).cuota || 0);
  const ingresos = d.mv.filter((m) => m.tipo === "ingreso"), gastos = d.mv.filter((m) => m.tipo === "gasto");
  const ti = d.n * cuota + ingresos.reduce((s, m) => s + +m.importe, 0), tg = gastos.reduce((s, m) => s + +m.importe, 0);
  // "1.234,50" · "1234,5" · "12.50" · "1.250" → número (el punto solo es de miles si va seguido de 3 cifras)
  const imp = (s) => {
    let t = String(s).trim().replace(/\s|€/g, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    const v = Number(t); return !t || isNaN(v) || v < 0 ? null : Math.round(v * 100) / 100;
  };
  const anadir = async () => {
    setErr(""); const v = imp(nuevo.importe);
    if (!nuevo.concepto.trim()) return setErr("Falta el concepto."); if (v == null) return setErr("Importe no válido.");
    const { error } = await sb.from("movimientos").insert({ temporada_id: T.id, tipo: nuevo.tipo, concepto: nuevo.concepto.trim(), importe: v });
    if (error) return setErr(errTxt(error)); setNuevo({ ...nuevo, concepto: "", importe: "" }); cargar();
  };
  const guardar = async () => {
    setErr(""); const v = imp(edit.importe); if (!edit.concepto.trim() || v == null) return setErr("Revisa concepto e importe.");
    const { error } = await sb.from("movimientos").update({ concepto: edit.concepto.trim(), importe: v, tipo: edit.tipo }).eq("id", edit.id);
    if (error) return setErr(errTxt(error)); setEdit(null); cargar();
  };
  const borrar = async (m) => { if (!confirm(`¿Borrar "${m.concepto}"?`)) return; await sb.from("movimientos").delete().eq("id", m.id); setEdit(null); cargar(); };
  const linea = (m) => html`<div key=${m.id} class="kv">${yo.es_admin ? html`<button class="lnk" onClick=${() => setEdit({ ...m, importe: String(m.importe).replace(".", ",") })}>${m.concepto}</button>` : html`<span>${m.concepto}</span>`}<b class="num">${euros(m.importe)}</b></div>`;
  return html`<div><${Sel}/>
    <div class="saldo"><small>Saldo</small><b class="num">${euros(ti - tg)}</b><span class="num">Ingresos ${euros(ti)} · Gastos ${euros(tg)}</span></div>
    <div class="card"><h3>Ingresos</h3>
      <${Kv} a=${`Cuotas cobradas (${d.n} × ${euros(cuota)})`} b=${euros(d.n * cuota)}/>
      ${ingresos.map(linea)}<${Kv} a=${html`<b>Total</b>`} b=${euros(ti)}/></div>
    <div class="card"><h3>Gastos</h3>${gastos.length ? gastos.map(linea) : html`<p class="muted" style=${{ margin: 0 }}>Ninguno.</p>`}<${Kv} a=${html`<b>Total</b>`} b=${euros(tg)}/></div>
    ${yo.es_admin && html`<div class="card"><h3>Nuevo apunte</h3>
      <div class="seg2" style=${{ margin: 0 }}>${[["gasto", "Gasto"], ["ingreso", "Ingreso"]].map(([k, l]) => html`<button key=${k} class=${nuevo.tipo === k ? "on" : ""} onClick=${() => setNuevo({ ...nuevo, tipo: k })}>${l}</button>`)}</div>
      <label class="l">Concepto</label><input class="inp" value=${nuevo.concepto} onInput=${(e) => setNuevo({ ...nuevo, concepto: e.target.value })}/>
      <label class="l">Importe (€)</label><input class="inp num" inputmode="decimal" value=${nuevo.importe} onInput=${(e) => setNuevo({ ...nuevo, importe: e.target.value })}/>
      ${err && !edit && html`<div class="err">${err}</div>`}<button class="btn" onClick=${anadir}>Añadir</button>
      <p class="muted" style=${{ margin: "8px 0 0" }}>Para cambiar o borrar un apunte, tócalo en la lista. Las cuotas cobradas salen de los jugadores marcados como pagados.</p></div>`}
    ${edit && html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setEdit(null)}><div class="sheet"><h3>Editar apunte</h3>
      <div class="seg2" style=${{ margin: 0 }}>${[["gasto", "Gasto"], ["ingreso", "Ingreso"]].map(([k, l]) => html`<button key=${k} class=${edit.tipo === k ? "on" : ""} onClick=${() => setEdit({ ...edit, tipo: k })}>${l}</button>`)}</div>
      <label class="l">Concepto</label><input class="inp" value=${edit.concepto} onInput=${(e) => setEdit({ ...edit, concepto: e.target.value })}/>
      <label class="l">Importe (€)</label><input class="inp num" inputmode="decimal" value=${edit.importe} onInput=${(e) => setEdit({ ...edit, importe: e.target.value })}/>
      ${err && html`<div class="err">${err}</div>`}
      <button class="btn" onClick=${guardar}>Guardar</button><button class="btn sec" style=${{ color: "var(--warn)", borderColor: "var(--warn)" }} onClick=${() => borrar(edit)}>Borrar</button>
      <button class="btn sec" onClick=${() => setEdit(null)}>Cancelar</button></div></div>`}
  </div>`;
}

/* ---------- Palmarés ---------- */
function Palmares({ ctx }) {
  const { yo, temporada } = ctx;
  const [rows, setRows] = useState(null); const [edit, setEdit] = useState(null); const [err, setErr] = useState("");
  const cargar = () => sb.from("palmares").select("*").order("anio", { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { cargar(); }, []);
  if (!rows) return html`<${Spinner}/>`;
  const lista = rows.some((r) => r.anio === temporada.anio) ? rows : [{ anio: temporada.anio, enJuego: true }, ...rows];
  const guardar = async () => {
    setErr(""); const a = parseInt(edit.anio, 10); if (!(a > 1990 && a < 2100)) return setErr("Año no válido.");
    const { error } = await sb.from("palmares").upsert({ anio: a, scratch: edit.scratch.trim() || null, handicap: edit.handicap.trim() || null }, { onConflict: "anio" });
    if (error) return setErr(errTxt(error)); setEdit(null); cargar();
  };
  const borrar = async () => { if (!confirm(`¿Borrar ${edit.anio} del palmarés?`)) return; await sb.from("palmares").delete().eq("anio", +edit.anio); setEdit(null); cargar(); };
  return html`<div class="clw">
    <div class="cl h pal"><span>Año</span><span>Scratch</span><span>Hándicap</span></div>
    ${lista.map((r) => html`<button key=${r.anio} class="cl pal" disabled=${!yo.es_admin} style=${yo.es_admin ? null : { cursor: "default", color: "inherit" }} onClick=${() => yo.es_admin && setEdit({ anio: String(r.anio), scratch: r.scratch || "", handicap: r.handicap || "" })}>
      <span class="p">${r.anio}</span><span class=${r.enJuego || !r.scratch ? "mu" : ""}>${r.enJuego ? "En juego" : r.scratch || "—"}</span><span class=${r.enJuego || !r.handicap ? "mu" : ""}>${r.enJuego ? "En juego" : r.handicap || "—"}</span></button>`)}
    ${yo.es_admin && html`<div style=${{ margin: "12px" }}><button class="btn sec" onClick=${() => setEdit({ anio: "", scratch: "", handicap: "", nuevo: true })}>+ Añadir año</button></div>`}
    ${edit && html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setEdit(null)}><div class="sheet"><h3>${edit.nuevo ? "Añadir año" : "Palmarés " + edit.anio}</h3>
      ${edit.nuevo && html`<div><label class="l">Año</label><input class="inp num" inputmode="numeric" value=${edit.anio} onInput=${(e) => setEdit({ ...edit, anio: e.target.value })}/></div>`}
      <label class="l">Ganador scratch</label><input class="inp" value=${edit.scratch} onInput=${(e) => setEdit({ ...edit, scratch: e.target.value })}/>
      <label class="l">Ganador hándicap</label><input class="inp" value=${edit.handicap} onInput=${(e) => setEdit({ ...edit, handicap: e.target.value })}/>
      ${err && html`<div class="err">${err}</div>`}<button class="btn" onClick=${guardar}>Guardar</button>
      ${!edit.nuevo && html`<button class="btn sec" style=${{ color: "var(--warn)", borderColor: "var(--warn)" }} onClick=${borrar}>Borrar</button>`}
      <button class="btn sec" onClick=${() => setEdit(null)}>Cancelar</button></div></div>`}
  </div>`;
}

/* ---------- Estadísticas ---------- */
async function traerTodo(mk) { let out = [], from = 0; for (;;) { const { data, error } = await mk().range(from, from + 999); if (error) throw error; out = out.concat(data || []); if (!data || data.length < 1000) break; from += 1000; } return out; }
async function traerPorIds(mk, ids) { let out = []; for (let i = 0; i < ids.length; i += 150) out = out.concat(await traerTodo(() => mk(ids.slice(i, i + 150)))); return out; }
function madrid(fecha, hora) { // fecha 'YYYY-MM-DD' + hora 'HH:MM:SS' en Madrid → Date
  const g = new Date(`${fecha}T${hora}Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(g).map((x) => [x.type, x.value]));
  const w = new Date(`${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}Z`);
  return new Date(g - (w - g));
}
async function calcEstadisticas(T) {
  const { data: js } = await sb.from("jornadas").select("*").eq("temporada_id", T.id);
  const jor = (js || []).filter((j) => j.cerrada && inscribible(j)); const jid = jor.map((j) => j.id);
  if (!jid.length) return null;
  const res = await traerTodo(() => sb.from("resultados").select("jornada_id, categoria, jugador_id, nombre, resultado, retirado").in("jornada_id", jid));
  const nom = {}; res.forEach((r) => r.jugador_id && (nom[r.jugador_id] = r.nombre));
  const ins = await traerTodo(() => sb.from("inscripciones").select("id, jugador_id, jornada_id, partida_id, retirado").in("jornada_id", jid).eq("estado", "inscrito"));
  const parts = await traerTodo(() => sb.from("partidas").select("id, jornada_id, salida_hora, salida_tee").in("jornada_id", jid));
  const gs = ins.length ? await traerPorIds((ids) => sb.from("golpes").select("inscripcion_id, hoyo, golpes, at").in("inscripcion_id", ids), ins.map((x) => x.id)) : [];
  const J = {}; jor.forEach((j) => (J[j.id] = j)); const P = {}; parts.forEach((p) => (P[p.id] = p));
  const HO = {}; for (const j of jor) HO[j.campo] = HO[j.campo] || (await cargarHoyos(j.campo));
  const G = {}; gs.forEach((g) => (G[g.inscripcion_id] = G[g.inscripcion_id] || []).push(g));
  const cnt = { bir: {}, eag: {}, tri: {} }, ace = [], rachas = [];
  ins.forEach((x) => {
    const n = nom[x.jugador_id]; if (!n) return;
    const j = J[x.jornada_id], ho = HO[j.campo] || [], par = (h) => (ho.find((q) => q.hoyo === h) || {}).par;
    const mg = {}; (G[x.id] || []).forEach((g) => (mg[g.hoyo] = g.golpes));
    Object.entries(mg).forEach(([h, g]) => { const d = g - par(+h); if (isNaN(d)) return;
      if (g === 1) ace.push({ n, h: +h, j });
      if (d === -1) cnt.bir[n] = (cnt.bir[n] || 0) + 1;
      if (d <= -2) cnt.eag[n] = (cnt.eag[n] || 0) + 1;
      if (d >= 3) cnt.tri[n] = (cnt.tri[n] || 0) + 1; });
    const tee = (P[x.partida_id] || {}).salida_tee; let r = 0, ini = null;
    ordenHoyos(tee).forEach((h) => { const g = mg[h]; if (g && g - par(h) <= 0) { if (!r) ini = h; r++; if (r >= 2) rachas.push({ n, v: r, j, a: ini, b: h }); } else r = 0; });
  });
  const top = (o, k) => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k);
  const maxR = rachas.reduce((m, x) => Math.max(m, x.v), 0);
  const racha = rachas.filter((x) => x.v === maxR).filter((x, i, a) => a.findIndex((y) => y.n === x.n && y.j.id === x.j.id) === i);
  const extremo = (cat, f) => { const v = res.filter((r) => r.categoria === cat && !r.retirado && r.resultado != null); if (!v.length) return []; const m = f(...v.map((r) => r.resultado)); return v.filter((r) => r.resultado === m).map((r) => ({ n: r.nombre, v: m, j: J[r.jornada_id] })); };
  const mejor = (cat) => extremo(cat, Math.min), peor = (cat) => extremo(cat, Math.max);
  // Lentos: salida → último hoyo anotado, media por jugador, mínimo 3 partidas
  const dur = {};
  parts.forEach((p) => {
    if (!p.salida_hora) return; const xs = ins.filter((x) => x.partida_id === p.id && !x.retirado); if (!xs.length) return;
    const fin = Math.max(...xs.flatMap((x) => (G[x.id] || []).map((g) => +new Date(g.at)))); if (!isFinite(fin)) return;
    const min = (fin - madrid(J[p.jornada_id].fecha, p.salida_hora)) / 60000; if (min < 90 || min > 480) return;
    xs.forEach((x) => { const n = nom[x.jugador_id]; if (n) (dur[n] = dur[n] || []).push(min); });
  });
  const lentos = Object.entries(dur).filter(([, v]) => v.length >= 3).map(([n, v]) => [n, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { bir: top(cnt.bir, 3), tri: top(cnt.tri, 3), eag: top(cnt.eag, 1).filter(([, v]) => v > 0), racha, ace, ms: mejor("scratch"), mh: mejor("handicap"), ps: peor("scratch"), ph: peor("handicap"), lentos };
}
function Estadisticas({ ctx }) {
  const { yo } = ctx;
  const { T, Sel } = useTemporadas(ctx);
  const [err, setErr] = useState("");
  const [d, setD] = useState(() => cacheLeer(`est_${T.id}`));
  useEffect(() => { setD(cacheLeer(`est_${T.id}`)); calcEstadisticas(T).then((v) => { cacheGuardar(`est_${T.id}`, v); setD(v); setErr(""); }).catch((e) => { if (cacheLeer(`est_${T.id}`) === undefined) setErr(errTxt(e)); }); }, [T.id]);
  const hm2 = (m) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}`;
  const Caja = ({ t, filas, rank }) => html`<div class="card stc"><h3>${t}</h3>${filas.length ? filas.map(([n, v, e], i) => html`<div key=${n + i} class=${"kv" + (n === yo.nombre_corto ? " mek" : "")}><span>${rank && html`<b class="pp">${filas.findIndex((f) => f[1] === v) + 1}</b>`}${n}${e ? html`<small class="muted"> · ${e}</small>` : ""}</span><b class="num">${v}</b></div>`) : html`<p class="muted" style=${{ margin: "4px 0" }}>—</p>`}</div>`;
  return html`<div><${Sel}/>
    ${err ? html`<div class="err" style=${{ margin: "12px" }}>${err}</div>` : d === undefined ? html`<${Spinner}/>` : !d ? html`<div class="card"><p class="muted" style=${{ margin: 0 }}>Todavía no hay jornadas cerradas.</p></div>` : html`<div>
      <${Caja} t="Más birdies" rank filas=${d.bir}/>
      <${Caja} t="Más eagles" filas=${d.eag}/>
      <${Caja} t="Más pares seguidos" filas=${d.racha.map((x) => [x.n, x.v, `${nombreJ(x.j)} · hoyos ${x.a}–${x.b}`])}/>
      <${Caja} t="Hoyos en uno" filas=${d.ace.map((x) => [x.n, "Hoyo " + x.h, nombreJ(x.j)])}/>
      <${Caja} t="Más triple bogeys" rank filas=${d.tri}/>
      <${Caja} t="Mejor vuelta scratch" filas=${d.ms.map((x) => [x.n, x.v, nombreJ(x.j)])}/>
      <${Caja} t="Mejor vuelta hándicap" filas=${d.mh.map((x) => [x.n, x.v, nombreJ(x.j)])}/>
      <${Caja} t="Peor vuelta scratch" filas=${d.ps.map((x) => [x.n, x.v, nombreJ(x.j)])}/>
      <${Caja} t="Peor vuelta hándicap" filas=${d.ph.map((x) => [x.n, x.v, nombreJ(x.j)])}/>
      <${Caja} t="Los más lentos" rank filas=${d.lentos.map(([n, m]) => [n, hm2(m)])}/>
    </div>`}
  </div>`;
}

/* ---------- Comité: temporadas ---------- */
const reglasForm = (r) => ({ cuota: String(r.cuota ?? 150), mejores: String(r.mejores_resultados ?? 10), puntos: (r.puntos_normal || []).join(", "), part: String(r.puntos_participacion ?? 10), mult: String(r.multiplicador_major ?? 2) });
function reglasDe(f, base) {
  const puntos = f.puntos.split(/[\s,;]+/).filter(Boolean).map(Number); const mult = parseFloat(f.mult.replace(",", "."));
  const cuota = parseFloat(f.cuota.replace(",", ".")), mejores = parseInt(f.mejores, 10), part = parseFloat(f.part.replace(",", "."));
  if (!puntos.length || puntos.some(isNaN)) throw new Error("Puntos por puesto: números separados por comas.");
  if ([cuota, mejores, part, mult].some((x) => isNaN(x) || x < 0)) throw new Error("Revisa los valores.");
  return { ...base, cuota, mejores_resultados: mejores, puntos_normal: puntos, puntos_participacion: part, multiplicador_major: mult, puntos_major: puntos.map((p) => Math.round(p * mult * 10) / 10) };
}
function FormReglas({ f, setF }) {
  const c = (k, l, extra) => html`<div><label class="l">${l}</label><input class="inp num" inputmode=${k === "puntos" ? "text" : "decimal"} value=${f[k]} onInput=${(e) => setF({ ...f, [k]: e.target.value })} ...${extra || {}}/></div>`;
  return html`<div>${c("cuota", "Cuota (€)")}${c("mejores", "Resultados que cuentan")}${c("puntos", "Puntos por puesto (1º, 2º, 3º…)")}${c("part", "Puntos por participación")}${c("mult", "Majors: multiplicar los puntos por puesto por")}</div>`;
}
function ComiteTemporadas({ ctx }) {
  const { temporada } = ctx;
  const [temps, setTemps] = useState(null); const [modo, setModo] = useState(null); const [f, setF] = useState(null); const [err, setErr] = useState(""); const [trab, setTrab] = useState(false);
  const cargar = () => sb.from("temporadas").select("*").order("anio", { ascending: false }).then(({ data }) => setTemps(data || []));
  useEffect(() => { cargar(); }, []);
  if (!temps) return html`<${Spinner}/>`;
  const sig = Math.max(...temps.map((t) => t.anio)) + 1;
  const prep = temps.filter((t) => !t.activa && t.anio > temporada.anio);
  const abrirEditar = (t) => { setErr(""); setModo({ editar: t }); setF(reglasForm(t.reglas || {})); };
  const abrirNueva = () => { setErr(""); setModo({ nueva: true }); setF(reglasForm(temporada.reglas || {})); };
  const guardar = async () => {
    setErr(""); setTrab(true);
    try {
      if (modo.nueva) { const { error } = await sb.rpc("nueva_temporada", { p_anio: sig, p_reglas: reglasDe(f, temporada.reglas || {}) }); if (error) throw error; }
      else { const { error } = await sb.from("temporadas").update({ reglas: reglasDe(f, modo.editar.reglas || {}) }).eq("id", modo.editar.id); if (error) throw error; }
      setModo(null); cargar(); ctx.recargar();
    } catch (e) { setErr(errTxt(e)); }
    setTrab(false);
  };
  const activar = async (t) => {
    if (!confirm(`¿Activar ${t.anio}? Todos pasarán a ver ${t.anio}, solo podrán entrar los jugadores activos de ${t.anio} y ${temporada.anio} quedará en el histórico (sus ganadores se guardan en el palmarés).`)) return;
    const { error } = await sb.rpc("activar_temporada", { p_temporada: t.id }); if (error) return setErr(errTxt(error));
    window.location.reload();
  };
  const est = (t) => (t.activa ? "activa" : t.anio > temporada.anio ? "en preparación" : "histórico");
  return html`<div>
    ${err && !modo && html`<div class="err" style=${{ margin: "12px" }}>${err}</div>`}
    ${temps.map((t) => { const r = t.reglas || {}; return html`<div class="card" key=${t.id}><h3>${t.anio} · ${est(t)}</h3>
      <${Kv} a="Cuota" b=${euros(r.cuota || 0)}/><${Kv} a="Resultados que cuentan" b=${r.mejores_resultados ?? "—"}/>
      <${Kv} a="Puntos por puesto" b=${(r.puntos_normal || []).slice(0, 5).join(" · ") + " …"}/><${Kv} a="Participación" b=${r.puntos_participacion ?? "—"}/><${Kv} a="Majors" b=${"× " + (r.multiplicador_major ?? 2)}/>
      <button class="btn sec" onClick=${() => abrirEditar(t)}>Editar reglas</button>
      ${!t.activa && t.anio > temporada.anio && html`<button class="btn" onClick=${() => activar(t)}>Activar ${t.anio}</button>`}</div>`; })}
    ${!prep.length && html`<div style=${{ margin: "0 12px 20px" }}><button class="btn" onClick=${abrirNueva}>Nueva temporada ${sig}</button></div>`}
    ${modo && html`<div class="modal"><div class="sheet"><h3>${modo.nueva ? `Nueva temporada ${sig}` : `Reglas ${modo.editar.anio}`}</h3>
      ${modo.nueva && html`<p class="muted">Pasan todos los activos de ${temporada.anio}, sin pagar. Ranking, estadísticas, amarillas y contabilidad empiezan de cero. ${temporada.anio} sigue activa hasta que actives ${sig}; las jornadas de ${sig} se crean después de activarla.</p>`}
      <${FormReglas} f=${f} setF=${setF}/>
      ${err && html`<div class="err">${err}</div>`}
      <button class="btn" disabled=${trab} onClick=${guardar}>${modo.nueva ? "Crear temporada " + sig : "Guardar"}</button><button class="btn sec" onClick=${() => setModo(null)}>Cancelar</button></div></div>`}
  </div>`;
}

/* ---------- Saludos de Inicio ---------- */
function CatsSaludo({ sel, onChange }) {
  const [cats, setCats] = useState(null);
  useEffect(() => { sb.from("saludos").select("categoria").then(({ data }) => setCats([...new Set((data || []).map((x) => x.categoria))].sort((a, b) => a.localeCompare(b)))); }, []);
  if (!cats) return html`<${Spinner}/>`;
  if (!cats.length) return html`<p class="muted">No hay categorías de saludos.</p>`;
  const tog = (c) => onChange(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c]);
  return html`<div class="chips">${cats.map((c) => html`<button type="button" key=${c} class=${sel.includes(c) ? "on" : ""} onClick=${() => tog(c)}>${c}</button>`)}</div>`;
}

function ComiteSaludos() {
  const [ls, setLs] = useState(null); const [edit, setEdit] = useState(null); const [err, setErr] = useState("");
  const cargar = () => sb.from("saludos").select("*").order("categoria").order("id").then(({ data }) => setLs(data || []));
  useEffect(() => { cargar(); }, []);
  if (!ls) return html`<${Spinner}/>`;
  const cats = [...new Set(ls.map((x) => x.categoria))];
  const guardar = async () => {
    setErr(""); const d = { categoria: edit.categoria.trim(), frase: edit.frase.trim() };
    if (!d.categoria || !d.frase) return setErr("Falta la categoría o la frase.");
    const { error } = edit.id ? await sb.from("saludos").update(d).eq("id", edit.id) : await sb.from("saludos").insert(d);
    if (error) return setErr(errTxt(error)); setEdit(null); cargar();
  };
  const borrar = async () => { if (!confirm("¿Borrar esta frase?")) return; await sb.from("saludos").delete().eq("id", edit.id); setEdit(null); cargar(); };
  return html`<div>
    <p class="muted" style=${{ margin: "12px 14px 0" }}>{nombre} se cambia por el nombre del jugador. Las categorías de cada jugador se eligen en su ficha.</p>
    ${cats.map((c) => html`<div class="card" key=${c}><h3>${c}</h3>
      ${ls.filter((x) => x.categoria === c).map((x) => html`<div class="kv" key=${x.id}><button class="lnk" onClick=${() => setEdit({ ...x })}>${x.frase}</button></div>`)}
      <button class="btn sec small" style=${{ marginTop: "8px" }} onClick=${() => setEdit({ categoria: c, frase: "" })}>+ Frase</button></div>`)}
    <div style=${{ margin: "0 12px 20px" }}><button class="btn" onClick=${() => setEdit({ categoria: "", frase: "", nueva: true })}>+ Nueva categoría</button></div>
    ${edit && html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setEdit(null)}><div class="sheet"><h3>${edit.id ? "Editar frase" : edit.nueva ? "Nueva categoría" : "Nueva frase"}</h3>
      <label class="l">Categoría</label><input class="inp" value=${edit.categoria} disabled=${!edit.nueva && !edit.id} onInput=${(e) => setEdit({ ...edit, categoria: e.target.value })}/>
      <label class="l">Frase</label><textarea class="inp" rows="3" value=${edit.frase} onInput=${(e) => setEdit({ ...edit, frase: e.target.value })}></textarea>
      ${err && html`<div class="err">${err}</div>`}<button class="btn" onClick=${guardar}>Guardar</button>
      ${edit.id && html`<button class="btn sec" style=${{ color: "var(--warn)", borderColor: "var(--warn)" }} onClick=${borrar}>Borrar</button>`}
      <button class="btn sec" onClick=${() => setEdit(null)}>Cancelar</button></div></div>`}
  </div>`;
}
