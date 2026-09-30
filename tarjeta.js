/* Gambipool · tarjeta de juego, resumen, cola sin cobertura y panel de tarjetas del comité
   (se carga antes de jornadas.js; usa sus utilidades solo dentro de las funciones) */

/* ---------- Campo ---------- */
const cacheHoyos = {};
async function cargarHoyos(campo) {
  if (cacheHoyos[campo]) return cacheHoyos[campo];
  const { data } = await sb.from("hoyos").select("*").eq("campo", campo).order("hoyo");
  cacheHoyos[campo] = data || [];
  return cacheHoyos[campo];
}
const recibe = (hj, hcpHoyo) => (hj == null || hj <= 0 ? 0 : Math.floor(hj / 18) + (hcpHoyo <= hj % 18 ? 1 : 0));
const relPar = (n) => (n === 0 ? "PAR" : n > 0 ? "+" + n : String(n));
const claseGolpe = (g, par) => { const d = g - par; return d <= -2 ? "eag" : d === -1 ? "bir" : d === 1 ? "bog" : d >= 2 ? "dbl" : ""; };
const ordenHoyos = (tee) => (tee === 10 ? [10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
const golpeRaro = (g, par) => g > 2 * par || (g === 1 && par >= 4);

// Iniciales sin repetir dentro de la partida (JM → JMa / JMo)
function inicialesUnicas(nombres) {
  const base = nombres.map((n) => iniciales(n));
  return nombres.map((n, i) => {
    if (base.filter((b) => b === base[i]).length < 2) return base[i];
    const w = n.trim().split(/\s+/); return base[i] + (w[1] ? w[1].slice(1, 2) : "");
  });
}

/* ---------- Cola de golpes sin cobertura (se guarda en el móvil) ---------- */
const COLA = "gp_cola_golpes";
const leerCola = () => { try { return JSON.parse(localStorage.getItem(COLA) || "[]"); } catch (e) { return []; } };
const guardarCola = (c) => { try { localStorage.setItem(COLA, JSON.stringify(c)); } catch (e) { /* sin almacenamiento */ } };
const esErrorRed = (e) => !navigator.onLine || /fetch|network|load failed|timeout/i.test(errTxt(e));
let enviando = false;
async function enviarCola() {
  if (enviando) return { pendientes: leerCola().length, errores: [] };
  enviando = true; const errores = [];
  try {
    let c = leerCola();
    while (c.length) {
      const x = c[0];
      let error;
      try { ({ error } = await sb.rpc(x.t === "g" ? "anotar_golpe" : "retirar_jugador", x.t === "g" ? { p_inscripcion: x.i, p_hoyo: x.h, p_golpes: x.g } : { p_inscripcion: x.i, p_retirado: x.r })); }
      catch (e) { error = e; }
      if (error && esErrorRed(error)) break;         // sin señal: se queda en la cola
      if (error) errores.push(errTxt(error));        // rechazado por el servidor: se descarta
      c = leerCola().slice(1); guardarCola(c);
    }
  } finally { enviando = false; window.dispatchEvent(new Event("gp-cola")); }
  return { pendientes: leerCola().length, errores };
}
window.addEventListener("online", () => enviarCola());

/* ---------- Carga de una partida ---------- */
async function cargarPartida(pid) {
  const { data: p } = await sb.from("partidas").select("*").eq("id", pid).single();
  const [{ data: j }, { data: ins }, { data: est }] = await Promise.all([
    sb.from("jornadas").select("*").eq("id", p.jornada_id).single(),
    sb.rpc("inscritos", { p_jornada: p.jornada_id }),
    sb.from("inscripciones").select("id, retirado, bruto_manual").eq("partida_id", pid),
  ]);
  const jug = (ins || []).filter((x) => x.partida_id === pid).map((x) => ({ ...x, ...((est || []).find((e) => e.id === x.inscripcion_id) || {}) }));
  const ids = jug.map((x) => x.inscripcion_id);
  const { data: gs } = ids.length ? await sb.from("golpes").select("inscripcion_id, hoyo, golpes").in("inscripcion_id", ids) : { data: [] };
  const golpes = {}; (gs || []).forEach((g) => { (golpes[g.inscripcion_id] = golpes[g.inscripcion_id] || {})[g.hoyo] = g.golpes; });
  // lo pendiente de enviar manda sobre lo del servidor
  leerCola().forEach((x) => { if (!ids.includes(x.i)) return; if (x.t === "g") { golpes[x.i] = golpes[x.i] || {}; if (x.g == null) delete golpes[x.i][x.h]; else golpes[x.i][x.h] = x.g; } else { const q = jug.find((y) => y.inscripcion_id === x.i); if (q) q.retirado = x.r; } });
  const hoyos = await cargarHoyos(j.campo);
  const ini = inicialesUnicas(jug.map((x) => x.nombre_corto));
  jug.forEach((x, i) => (x.ini = ini[i]));
  return { p, j, jug, golpes, hoyos };
}

/* ---------- Pestaña Tarjeta ---------- */
function TarjetaTab({ ctx }) {
  const { yo, jornadas } = ctx;
  const hoy = hoyMadrid();
  const j = jornadas.find((x) => inscribible(x) && x.estado === "programada" && x.fecha <= hoy && fin(x) >= hoy);
  const [mia, setMia] = useState(undefined);
  useEffect(() => { if (!j) return; sb.from("inscripciones").select("id, partida_id, estado").eq("jornada_id", j.id).eq("jugador_id", yo.id).maybeSingle().then(({ data }) => setMia(data && data.estado === "inscrito" ? data : null)); }, [j && j.id]);
  if (!j) { const p = proxima(jornadas); return html`<div class="card"><h3>Hoy no hay jornada</h3><p class="muted" style=${{ margin: 0 }}>${p ? `La próxima es la ${nombreJ(p)}, el ${fmtDiaLargo(p.fecha).toLowerCase()}.` : "No quedan jornadas en el calendario."}</p></div>`; }
  if (mia === undefined) return html`<${Spinner}/>`;
  if (!mia) return html`<div class="card"><h3>${nombreJ(j)} · hoy</h3><p class="muted" style=${{ margin: 0 }}>No estás inscrito en esta jornada.</p><button class="btn sec" style=${{ marginTop: "12px" }} onClick=${() => ctx.setTab("clasificacion")}>Ver el directo</button></div>`;
  if (!mia.partida_id) return html`<div class="card"><h3>${nombreJ(j)} · hoy</h3><p class="muted" style=${{ margin: 0 }}>Todavía no estás en ninguna partida. Habla con el comité.</p></div>`;
  return html`<${Tarjeta} key=${mia.partida_id} ctx=${ctx} pid=${mia.partida_id}/>`;
}

/* ---------- Tarjeta de una partida (jugador o comité) ---------- */
function Tarjeta({ ctx, pid, comite }) {
  const { yo } = ctx;
  const [d, setD] = useState(null);
  const [marcador, setMarcador] = useState(null);
  const [idx, setIdx] = useState(null);           // posición en el orden de hoyos
  const [vista, setVista] = useState("hoyo");     // hoyo | resumen
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState("");
  const [cola, setCola] = useState(leerCola().length);

  const cargar = useCallback(async (primera) => {
    try {
      const r = await cargarPartida(pid);
      setD(r); setMarcador(r.p.marcador_id);
      if (primera) {
        const orden = ordenHoyos(r.p.salida_tee);
        const activos = r.jug.filter((x) => !x.retirado);
        const k = orden.findIndex((h) => activos.some((x) => !(r.golpes[x.inscripcion_id] || {})[h]));
        setIdx(k < 0 ? 17 : k);
        if (r.p.validada_at || r.j.cerrada || k < 0) setVista("resumen");
      }
    } catch (e) { setErr(errTxt(e)); }
  }, [pid]);

  useEffect(() => {
    (async () => {
      if (!comite) { const { data } = await sb.rpc("abrir_tarjeta", { p_partida: pid }); if (data) setMarcador(data); }
      await cargar(true);
    })();
    const t = setInterval(async () => { if (document.hidden) return; const r = await enviarCola(); setCola(r.pendientes); if (r.errores.length) setErr(r.errores[0]); cargar(false); }, 20000);
    const upd = () => setCola(leerCola().length);
    window.addEventListener("gp-cola", upd);
    return () => { clearInterval(t); window.removeEventListener("gp-cola", upd); };
  }, [pid]);

  if (err && !d) return html`<div class="err" style=${{ margin: "12px" }}>${err}</div>`;
  if (!d || idx == null) return html`<${Spinner}/>`;
  const { p, j, jug, golpes, hoyos } = d;
  if (!hoyos.length) return html`<div class="card"><h3>Sin tarjeta en la app</h3><p class="muted" style=${{ margin: 0 }}>El campo de esta jornada no tiene los hoyos cargados. El comité meterá los resultados.</p></div>`;
  const orden = ordenHoyos(p.salida_tee);
  const H = (n) => hoyos.find((x) => x.hoyo === n);
  const hoyo = orden[idx], hh = H(hoyo);
  const soyMarcador = marcador === yo.id;
  const validada = !!p.validada_at;
  const puedeEditar = !j.cerrada && (comite || (soyMarcador && !validada));
  const enPartida = jug.some((x) => x.jugador_id === yo.id);
  const nomMarc = (jug.find((x) => x.jugador_id === marcador) || {}).nombre_corto || (marcador ? "el comité" : null);
  const g = (x, h) => (golpes[x.inscripcion_id] || {})[h];
  const completo = (h) => jug.every((x) => x.retirado || g(x, h));
  const va = (x) => orden.reduce((s, h) => (g(x, h) ? s + g(x, h) - H(h).par : s), 0);

  const encolar = (item) => { const c = leerCola(); c.push(item); guardarCola(c); setCola(c.length); enviarCola().then((r) => { setCola(r.pendientes); if (r.errores.length) { setErr(r.errores[0]); cargar(false); } }); };
  const poner = (x, h, v) => {
    const ng = { ...golpes, [x.inscripcion_id]: { ...(golpes[x.inscripcion_id] || {}) } };
    if (v == null) delete ng[x.inscripcion_id][h]; else ng[x.inscripcion_id][h] = v;
    setD({ ...d, golpes: ng }); setErr("");
    encolar({ t: "g", i: x.inscripcion_id, h, g: v });
  };
  const siguienteSinGolpe = (x) => { const k0 = jug.indexOf(x); const rot = [...jug.slice(k0 + 1), ...jug.slice(0, k0)]; return rot.find((y) => !y.retirado && !g(y, hoyo)); };
  const elegir = (x, v) => {
    if (golpeRaro(v, hh.par)) return setModal({ raro: { x, v } });
    poner(x, hoyo, v);
    const sig = siguienteSinGolpe(x);
    setModal(sig ? { teclado: sig } : null);
  };
  const retirar = (x, r) => { setD({ ...d, jug: jug.map((y) => (y === x ? { ...y, retirado: r } : y)) }); encolar({ t: "r", i: x.inscripcion_id, r }); setModal(null); };
  const relevo = async () => { const { error } = await sb.rpc("tomar_relevo", { p_partida: p.id }); setModal(null); if (error) return setErr(errTxt(error)); setMarcador(yo.id); };
  const validar = async () => { setModal(null); await enviarCola(); const { error } = await sb.rpc("validar_tarjeta", { p_partida: p.id }); if (error) return setErr(errTxt(error)); cargar(false); };
  const reabrir = async () => { const { error } = await sb.rpc("reabrir_tarjeta", { p_partida: p.id }); if (error) return setErr(errTxt(error)); cargar(false); };

  const cabecera = html`<div class="tband"><small>${nombreJ(j)} · Partida ${p.numero} · Tee ${p.salida_tee || 1}</small>
    <div class="tira">${orden.map((h, k) => html`<button key=${h} class=${k === idx && vista === "hoyo" ? "on" : completo(h) ? "ok" : ""} onClick=${() => { setIdx(k); setVista("hoyo"); }}>${h}</button>`)}</div></div>`;
  const avisos = html`${cola > 0 && html`<div class="offl">Sin cobertura · ${cola} ${cola === 1 ? "golpe guardado" : "golpes guardados"} en el móvil. Se envían solos al recuperar señal.</div>`}
    ${err && html`<div class="err" style=${{ margin: "10px 12px 0" }}>${err}</div>`}
    ${validada && html`<div class="aviso">Tarjeta validada${comite ? "" : ". Si hay un error, avisad al comité"}.</div>`}
    ${!validada && !j.cerrada && !comite && !soyMarcador && html`<div class="aviso">${nomMarc ? html`Anota <b>${nomMarc}</b>. Tú solo ves la tarjeta.` : "Todavía no anota nadie."}</div>`}`;

  let cuerpo;
  if (vista === "resumen") {
    cuerpo = html`<div><${ResumenTarjeta} jug=${jug} golpes=${golpes} hoyos=${hoyos}/>
      <div style=${{ margin: "0 12px 20px" }}>
        ${puedeEditar && !validada && html`<button class="btn" onClick=${() => setModal("validar")}>Validar tarjeta</button>`}
        ${comite && validada && !j.cerrada && html`<button class="btn sec" onClick=${reabrir}>Reabrir tarjeta</button>`}
        ${!validada && html`<button class="btn sec" onClick=${() => setVista("hoyo")}>Volver a la tarjeta</button>`}
      </div></div>`;
  } else {
    cuerpo = html`<div>
      <div class="hoyo"><div><small>Hoyo</small><b>${hoyo}</b></div><div><small>Par</small><b>${hh.par}</b></div><div><small>Hcp</small><b>${hh.hcp}</b></div><div><small>Metros</small><b>${(j.barras === "amarillas" ? hh.m_amarillas : hh.m_blancas) || "—"}</b></div></div>
      <div class="card" style=${{ padding: "2px 12px" }}>${jug.map((x) => { const v = g(x, hoyo), rc = recibe(x.hcp_juego, hh.hcp);
        return html`<div class="sc-row" key=${x.inscripcion_id}>
          <span class="av">${x.ini}</span>
          <button class="sc-n" disabled=${!puedeEditar} onClick=${() => setModal({ retirar: x })}>${x.nombre_corto}${x.jugador_id === marcador && html` <span class="mk">marca</span>`}<small>HJ ${x.hcp_juego ?? "—"} ${rc > 0 ? html`<i class="rc">${"•".repeat(rc)}</i>` : ""}</small></button>
          ${x.retirado ? html`<span class="retx">Retirado</span>` : html`<button class=${"cell num" + (puedeEditar ? " ed" : "") + (!v ? " vac" : "")} disabled=${!puedeEditar} onClick=${() => setModal({ teclado: x })}>${v || ""}</button>`}
          <span class="sc-t num">${x.retirado ? "" : relPar(va(x))}</span></div>`; })}</div>
      <div class="btns" style=${{ margin: "0 12px" }}>
        ${idx > 0 ? html`<button class="btn sec" onClick=${() => setIdx(idx - 1)}>‹ Hoyo ${orden[idx - 1]}</button>` : html`<span style=${{ flex: 1 }}></span>`}
        ${idx < 17 ? html`<button class="btn" onClick=${() => setIdx(idx + 1)}>Hoyo ${orden[idx + 1]} ›</button>` : html`<button class="btn" onClick=${() => setVista("resumen")}>Ver resumen</button>`}
      </div>
      <div style=${{ margin: "0 12px 20px" }}>
        ${idx < 17 && html`<button class="btn sec" onClick=${() => setVista("resumen")}>Ver resumen</button>`}
        ${!comite && enPartida && !soyMarcador && !validada && !j.cerrada && html`<button class="btn sec" onClick=${() => setModal("relevo")}>Tomar el relevo como marcador</button>`}
      </div></div>`;
  }

  let hoja = null;
  if (modal && modal.teclado) {
    const x = modal.teclado, v = g(x, hoyo);
    hoja = html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setModal(null)}><div class="sheet">
      <h3>${x.nombre_corto}</h3><div class="muted">Hoyo ${hoyo} · Par ${hh.par}</div>
      <div class="kp num">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => html`<button key=${n} class=${(n === hh.par ? "par " : "") + (n === v ? "sel" : "")} onClick=${() => elegir(x, n)}>${n}</button>`)}
        <button class="mas" onClick=${() => setModal({ mas10: x })}>+10</button><button class="del" onClick=${() => { poner(x, hoyo, null); setModal(null); }}>Borrar</button></div>
    </div></div>`;
  } else if (modal && modal.mas10) {
    const x = modal.mas10;
    hoja = html`<${MasDiez} x=${x} hoyo=${hoyo} par=${hh.par} volver=${() => setModal({ teclado: x })} guardar=${(n) => { poner(x, hoyo, n); const sig = siguienteSinGolpe(x); setModal(sig ? { teclado: sig } : null); }}/>`;
  } else if (modal && modal.raro) {
    const { x, v } = modal.raro;
    hoja = html`<div class="modal"><div class="sheet"><h3>¿Seguro?</h3>
      <p class="muted">${x.nombre_corto}: <b>${v} ${v === 1 ? "golpe" : "golpes"}</b> en el hoyo ${hoyo} (par ${hh.par}). Es un resultado poco habitual.</p>
      <button class="btn" onClick=${() => { poner(x, hoyo, v); const sig = siguienteSinGolpe(x); setModal(sig ? { teclado: sig } : null); }}>Sí, ${v === 1 ? "es 1" : "son " + v}</button>
      <button class="btn sec" onClick=${() => setModal({ teclado: x })}>Corregir</button></div></div>`;
  } else if (modal && modal.retirar) {
    const x = modal.retirar;
    hoja = html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setModal(null)}><div class="sheet"><h3>${x.nombre_corto}</h3>
      ${x.retirado ? html`<p class="muted">Está marcado como retirado.</p><button class="btn" onClick=${() => retirar(x, false)}>Quitar "retirado"</button>`
        : html`<p class="muted">Si se retira, no aparece en el resultado de la jornada ni recibe puntos, pero cuenta como inscrito. Sus hoyos ya anotados se conservan.</p><button class="btn warn" onClick=${() => retirar(x, true)}>Marcar como retirado</button>`}
      <button class="btn sec" onClick=${() => setModal(null)}>Cancelar</button></div></div>`;
  } else if (modal === "relevo") {
    hoja = html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setModal(null)}><div class="sheet"><h3>¿Tomar el relevo?</h3>
      <p class="muted">Pasarás a anotar tú los golpes de toda la partida${nomMarc ? `. ${nomMarc} dejará de poder anotar` : ""}. Lo ya anotado se conserva.</p>
      <button class="btn" onClick=${relevo}>Tomar el relevo</button><button class="btn sec" onClick=${() => setModal(null)}>Cancelar</button></div></div>`;
  } else if (modal === "validar") {
    hoja = html`<div class="modal" onClick=${(e) => e.target === e.currentTarget && setModal(null)}><div class="sheet"><h3>Validar la tarjeta</h3>
      <p class="muted">Revisad los golpes entre todos. Una vez validada, solo el comité podrá cambiarla.</p>
      ${jug.map((x) => { const b = sumaGolpes(golpes, x); return html`<div class="kv" key=${x.inscripcion_id}><span>${x.nombre_corto}</span><b class="num">${x.retirado ? "Retirado" : b.n < 18 ? `Faltan ${18 - b.n} hoyos` : `${b.t} bruto · ${b.t - (x.hcp_juego || 0)} neto`}</b></div>`; })}
      ${jug.some((x) => !x.retirado && sumaGolpes(golpes, x).n < 18) && html`<div class="err">Faltan hoyos por anotar. Medal play: hay que anotar todos los hoyos (o marcar al jugador como retirado).</div>`}
      <button class="btn" disabled=${jug.some((x) => !x.retirado && sumaGolpes(golpes, x).n < 18)} onClick=${validar}>Validar</button><button class="btn sec" onClick=${() => setModal(null)}>Volver</button></div></div>`;
  }
  return html`<div>${cabecera}${avisos}${cuerpo}${hoja}</div>`;
}

function MasDiez({ x, hoyo, par, volver, guardar }) {
  const [v, setV] = useState("");
  const n = parseInt(v, 10);
  return html`<div class="modal"><div class="sheet"><h3>${x.nombre_corto}</h3><div class="muted">Hoyo ${hoyo} · Par ${par} · más de 10 golpes</div>
    <input class="inp inpbig num" inputmode="numeric" autofocus value=${v} onInput=${(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 2))}/>
    <button class="btn" disabled=${!(n >= 11 && n <= 30)} onClick=${() => guardar(n)}>Guardar</button><button class="btn sec" onClick=${volver}>Volver al teclado</button></div></div>`;
}

const sumaGolpes = (golpes, x) => { const o = golpes[x.inscripcion_id] || {}; const v = Object.values(o); return { n: v.length, t: v.reduce((a, b) => a + b, 0) }; };

/* ---------- Resumen en vertical (colores GameBook) ---------- */
function ResumenTarjeta({ jug, golpes, hoyos, titulo }) {
  const H = (n) => hoyos.find((x) => x.hoyo === n);
  const celda = (x, h) => { const v = (golpes[x.inscripcion_id] || {})[h]; return v ? html`<span class=${claseGolpe(v, H(h).par)}>${v}</span>` : html`<span class="mu">·</span>`; };
  const sub = (x, a, b) => { const o = golpes[x.inscripcion_id] || {}; let s = 0, n = 0; for (let h = a; h <= b; h++) if (o[h]) { s += o[h]; n++; } return n === b - a + 1 ? s : "—"; };
  const filas = [];
  for (let h = 1; h <= 18; h++) {
    filas.push(html`<tr key=${"h" + h}><td class="hn">${h}</td><td class="mu">${H(h).par}</td><td class="mu">${H(h).hcp}</td>${jug.map((x) => html`<td key=${x.inscripcion_id}>${celda(x, h)}</td>`)}</tr>`);
    if (h === 9 || h === 18) { const a = h === 9 ? 1 : 10; filas.push(html`<tr class="sub2" key=${"s" + h}><td>${h === 9 ? "Ida" : "Vuelta"}</td><td>${hoyos.filter((x) => x.hoyo >= a && x.hoyo <= h).reduce((s, x) => s + x.par, 0)}</td><td></td>${jug.map((x) => html`<td key=${x.inscripcion_id}>${sub(x, a, h)}</td>`)}</tr>`); }
  }
  const tot = (x) => sumaGolpes(golpes, x);
  return html`<div class="gbw"><table class="gv num">
    <thead><tr class="gh"><td>Hoyo</td><td>Par</td><td>Hcp</td>${jug.map((x) => html`<td key=${x.inscripcion_id}>${titulo || x.ini}</td>`)}</tr></thead>
    <tbody>${filas}
      <tr class="tt2"><td colspan="3">Bruto</td>${jug.map((x) => html`<td key=${x.inscripcion_id}>${x.retirado ? "Ret." : tot(x).n === 18 ? tot(x).t : "—"}</td>`)}</tr>
      <tr class="sub2"><td colspan="3">Hcp juego</td>${jug.map((x) => html`<td key=${x.inscripcion_id}>${x.hcp_juego ?? "—"}</td>`)}</tr>
      <tr class="tt2"><td colspan="3">Neto</td>${jug.map((x) => html`<td key=${x.inscripcion_id}>${x.retirado ? "Ret." : tot(x).n === 18 ? tot(x).t - (x.hcp_juego || 0) : "—"}</td>`)}</tr>
    </tbody></table></div>`;
}

/* ---------- Comité: tarjetas de una jornada y cierre ---------- */
function ComiteTarjetas({ ctx, id }) {
  const { go, recargar } = ctx;
  const [d, setD] = useState(null);
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const cargar = useCallback(async () => {
    const [{ data: j }, { data: parts }, { data: ins }, { data: est }] = await Promise.all([
      sb.from("jornadas").select("*").eq("id", id).single(),
      sb.from("partidas").select("*").eq("jornada_id", id).order("numero"),
      sb.rpc("inscritos", { p_jornada: id }),
      sb.from("inscripciones").select("id, retirado, bruto_manual, partida_id").eq("jornada_id", id).eq("estado", "inscrito"),
    ]);
    const ids = (est || []).map((x) => x.id);
    const { data: gs } = ids.length ? await sb.from("golpes").select("inscripcion_id, hoyo").in("inscripcion_id", ids) : { data: [] };
    const n = {}; (gs || []).forEach((g) => (n[g.inscripcion_id] = (n[g.inscripcion_id] || 0) + 1));
    setD({ j, parts: parts || [], ins: ins || [], est: est || [], n });
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return html`<${Spinner}/>`;
  const { j, parts, ins, est, n } = d;
  const hoyosDe = (p) => { const ids = est.filter((x) => x.partida_id === p.id && !x.retirado).map((x) => x.id); return ids.length ? Math.min(...ids.map((i) => n[i] || 0)) : 0; };
  const nombre = (jid) => (ins.find((x) => x.jugador_id === jid) || {}).nombre_corto || "el comité";
  const estado = (p) => (p.validada_at ? "Validada" : p.marcador_id ? `${hoyosDe(p)} hoyos completos · marca ${nombre(p.marcador_id)}` : "Sin empezar · nadie ha abierto la tarjeta");
  const listoJug = (x) => x.retirado || x.bruto_manual != null || (n[x.id] || 0) >= 18;
  const faltan = est.filter((x) => !listoJug(x)).length;
  const sinPartida = est.filter((x) => !x.partida_id).length;
  const cerrar = async () => { setErr(""); if (!confirm(`¿Cerrar la ${nombreJ(j)}? Se calculan los puntos y se publican los resultados.`)) return; const { error } = await sb.rpc("cerrar_jornada", { p_jornada: id }); if (error) return setErr(errTxt(error)); setOk("Jornada cerrada. Resultados publicados."); recargar(); cargar(); };
  const reabrir = async () => { setErr(""); if (!confirm("¿Reabrir la jornada? Se borran sus puntos hasta que se vuelva a cerrar.")) return; const { error } = await sb.rpc("reabrir_jornada", { p_jornada: id }); if (error) return setErr(errTxt(error)); setOk(""); recargar(); cargar(); };
  return html`<div>
    ${err && html`<div class="err" style=${{ margin: "12px" }}>${err}</div>`}${ok && html`<div class="ok" style=${{ margin: "12px" }}>${ok}</div>`}
    ${parts.length === 0 && html`<div class="card"><p class="muted" style=${{ margin: 0 }}>Esta jornada no tiene partidas.</p></div>`}
    <div class="list">${parts.map((p) => html`<button class="row" key=${p.id} onClick=${() => go("tarjeta-comite", p.id)}>
      <span class="n"><b>Partida ${p.numero}</b>${p.salida_hora ? ` · ${hmBonito(hm(p.salida_hora))} · Tee ${p.salida_tee}` : ""}<small>${estado(p)}</small></span><span class="x">${p.validada_at ? "Editar" : "Ver"} ›</span></button>`)}</div>
    <div class="card"><h3>Resultados a mano</h3><p class="muted" style=${{ margin: "0 0 4px" }}>Para majors o jornadas sin tarjeta en la app: el bruto de cada jugador.</p>
      <button class="btn sec" onClick=${() => go("brutos", id)}>Meter brutos a mano</button></div>
    <div class="card"><h3>Cerrar la jornada</h3>
      ${j.cerrada ? html`<p class="muted" style=${{ margin: 0 }}>Cerrada: los resultados y los puntos están publicados.</p><button class="btn sec" onClick=${reabrir}>Reabrir jornada</button>`
        : html`<p class="muted" style=${{ margin: 0 }}>Calcula los puntos y publica el resultado. ${sinPartida ? `Hay ${sinPartida} inscrito(s) sin partida. ` : ""}</p>
          <button class="btn" disabled=${faltan > 0} onClick=${cerrar}>${faltan > 0 ? `Cerrar jornada (faltan ${faltan} ${faltan === 1 ? "jugador" : "jugadores"})` : "Cerrar jornada"}</button>`}</div>
  </div>`;
}

function BrutosManual({ ctx, id }) {
  const [d, setD] = useState(null); const [err, setErr] = useState(""); const [guardado, setGuardado] = useState("");
  const cargar = useCallback(async () => {
    const [{ data: ins }, { data: est }] = await Promise.all([sb.rpc("inscritos", { p_jornada: id }), sb.from("inscripciones").select("id, retirado, bruto_manual").eq("jornada_id", id).eq("estado", "inscrito")]);
    setD((ins || []).map((x) => ({ ...x, ...((est || []).find((e) => e.id === x.inscripcion_id) || {}) })).sort((a, b) => a.nombre_corto.localeCompare(b.nombre_corto)));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return html`<${Spinner}/>`;
  const poner = async (x, txt) => {
    setErr(""); const v = txt.trim() === "" ? null : parseInt(txt, 10);
    if (v != null && (isNaN(v) || v < 50 || v > 200)) return setErr(`Bruto no válido para ${x.nombre_corto}.`);
    const { error } = await sb.rpc("poner_bruto", { p_inscripcion: x.inscripcion_id, p_bruto: v }); if (error) return setErr(errTxt(error));
    setGuardado(x.nombre_corto); cargar();
  };
  return html`<div>
    <p class="muted" style=${{ margin: "12px 14px 0" }}>Se guarda al salir de cada casilla. Si un jugador tiene tarjeta en la app, manda el bruto que pongas aquí.</p>
    ${err && html`<div class="err" style=${{ margin: "10px 12px" }}>${err}</div>`}${guardado && !err && html`<div class="ok" style=${{ margin: "10px 12px" }}>Guardado: ${guardado}</div>`}
    <div class="card" style=${{ padding: "2px 12px" }}>${d.map((x) => html`<div class="sc-row" key=${x.inscripcion_id}>
      <span class="av">${iniciales(x.nombre_corto)}</span><span class="sc-n">${x.nombre_corto}<small>HJ ${x.hcp_juego ?? "—"}${x.retirado ? " · retirado" : ""}</small></span>
      <input class="inp num" style=${{ width: "64px", margin: 0, textAlign: "center" }} inputmode="numeric" defaultValue=${x.bruto_manual ?? ""} onBlur=${(e) => String(x.bruto_manual ?? "") !== e.target.value.trim() && poner(x, e.target.value)}/>
      <span class="sc-t num">${x.bruto_manual != null ? x.bruto_manual - (x.hcp_juego || 0) : ""}</span></div>`)}</div>
  </div>`;
}
