/* Habit Studies — módulo OSF (Olimpiada Salvadoreña de Física).
   El plan vive en data/osf-plan.json (si lo reemplazas, sube VERSION en sw.js).
   El avance se guarda aparte, en su propia clave, y solo referencia ids del plan. */
window.OSF = (() => {
  'use strict';

  const C = window.OSFCore;
  const STORE_KEY = 'habitStudies.osf.v1';
  const PLAN_URL = 'data/osf-plan.json';
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TABS = [
    { id: 'hoy', name: 'Hoy' }, { id: 'plan', name: 'Plan' }, { id: 'temario', name: 'Temario' },
    { id: 'errores', name: 'Errores' }, { id: 'simulacros', name: 'Simulacros' }, { id: 'fechas', name: 'Fechas' },
  ];
  const ESTADOS = { hecha: 'Hecha', hoy: 'Hoy', pendiente: 'Pendiente', atrasada: 'Atrasada' };
  const TIPOS_SIM = [['mini', 'Mini'], ['parcial', 'Parcial'], ['completo', 'Completo']];
  const CONFIRMA = { inscripcion: 'Ya me inscribí', 'fase1-envio': 'Ya envié la prueba' };
  const MAX_MIN = 720;
  const MAX_ATRASADAS = 8;

  let H = null;          // helpers de app.js
  let plan = null, planFail = false;
  let items = [], itemById = new Map(), temaById = new Map();
  let av = load();
  let tab = 'hoy';
  let lastDay = null;
  const ui = { open: null, weeks: new Set(), errForm: false, simForm: null, fContenido: '', fCausa: '' };

  /* ---------------------------------------------------------------- state */
  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (_) { /* corrupt → vacío */ }
    return normalize(raw);
  }

  function normalize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
    const date = (v) => (DATE_RE.test(v) ? v : null);
    const num = (v) => (Number.isFinite(+v) && +v >= 0 ? +v : 0);
    const sesiones = {};
    for (const [id, v] of Object.entries(obj(r.sesiones))) {
      if (!v || !date(v.hechaEl)) continue;
      const min = Math.min(MAX_MIN, Math.round(num(v.min)));
      sesiones[id] = { hechaEl: v.hechaEl, min: min > 0 ? min : null, nota: str(v.nota, 140) };
    }
    const temario = {};
    for (const [id, v] of Object.entries(obj(r.temario))) {
      if (v && (v.visto || v.profundizado)) temario[id] = { visto: !!v.visto, profundizado: !!v.profundizado };
    }
    const errores = (Array.isArray(r.errores) ? r.errores : []).filter((e) => e && date(e.fecha)).map((e) => ({
      id: str(e.id, 40) || uid(), fecha: e.fecha, temaId: str(e.temaId, 20), causa: str(e.causa, 60),
      descripcion: str(e.descripcion, 240), origen: str(e.origen, 120), resueltoEl: date(e.resueltoEl),
    }));
    const simulacros = (Array.isArray(r.simulacros) ? r.simulacros : []).filter((s) => s && date(s.fecha)).map((s) => ({
      id: str(s.id, 40) || uid(), fecha: s.fecha, tipo: TIPOS_SIM.some(([t]) => t === s.tipo) ? s.tipo : 'mini', tema: str(s.tema, 160),
      problemas: (Array.isArray(s.problemas) ? s.problemas : []).map((p) => ({ obtenido: num(p && p.obtenido), max: num(p && p.max) })),
      minutos: Math.min(MAX_MIN, Math.round(num(s.minutos))) || null, notas: str(s.notas, 400),
      programado: Number.isInteger(s.programado) ? s.programado : null,
    }));
    const hitos = {};
    for (const [id, v] of Object.entries(obj(r.hitos))) if (v) hitos[id] = true;
    return { version: 1, sesiones, temario, errores, simulacros, hitos };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(av)); }
    catch (e) { H.toast('No se pudo guardar (almacenamiento lleno o bloqueado).'); }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------------------------------------------------------------- dates */
  const simulada = () => { const v = new URLSearchParams(location.search).get('hoy'); return DATE_RE.test(v) ? v : null; };
  const hoy = () => simulada() || H.todayKey();
  const dia = (k) => H.cap(H.clean(H.fmt.dayShort.format(H.parseKey(k))));
  const dm = (k) => H.clean(H.fmt.dm.format(H.parseKey(k)));
  const fecha = (k) => H.clean(H.fmt.date.format(H.parseKey(k)));
  const rango = (a, b) => (a === b ? dia(a) : `${dm(a)} – ${dm(b)}`);
  const enDias = (n) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`);
  const tag = (st) => `<span class="osf-tag ${st}">${ESTADOS[st]}</span>`;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const bar = (label, a, b) => `<div class="track" role="progressbar" aria-label="${H.esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct(a, b)}"><div class="fill" style="transform:scaleX(${b > 0 ? Math.min(1, a / b) : 0})"></div></div>`;

  /* ---------------------------------------------------------------- session card */
  function sesCard(it) {
    const esc = H.esc;
    const t = hoy();
    const st = C.estadoDe(it, av, t);
    const rec = av.sesiones[it.id];
    const open = ui.open === it.id;
    const right = rec ? (rec.min ? H.fmtMin(rec.min) : 'Hecha') : it.minutos ? H.fmtMin(it.minutos) : 'Tramo';
    const sub = (it.titulo ? `${it.titulo} · ` : '') + it.texto;
    const body = !open ? '' : `
      <div class="block-body"><div>
        <div class="block-form">
          <p class="osf-text">${it.titulo ? `<strong>${esc(it.titulo)}.</strong> ` : ''}${esc(it.texto)}</p>
          ${it.partes.length ? `<ul class="osf-partes">${it.partes.map((p) => `<li><b>${p.minutos} min</b>${esc(p.texto)}</li>`).join('')}</ul>` : ''}
          ${rec ? `<p class="muted small">Marcada el ${fecha(rec.hechaEl)}.</p>` : ''}
          <div class="form-row">
            <label class="min-field"><input class="input min-input" type="number" inputmode="numeric" min="1" max="${MAX_MIN}" step="5" placeholder="${it.minutos || 0}" value="${rec && rec.min ? rec.min : ''}" aria-label="Minutos reales (opcional)"><span>min</span></label>
            <input class="input note-input" type="text" maxlength="140" placeholder="Nota (opcional)" value="${esc(rec ? rec.nota : '')}" aria-label="Nota opcional" enterkeyhint="done">
          </div>
          <div class="block-actions">
            ${rec ? '<button type="button" class="btn ghost danger" data-act="ses-clear">Quitar</button>' : ''}
            <button type="button" class="btn save" data-act="ses-save">${rec ? 'Actualizar' : 'Marcar hecha'}</button>
          </div>
        </div>
      </div></div>`;
    return `
      <article class="block osf-ses${rec ? ' done' : ''}${open ? ' open' : ''}${it.inicio <= t && t <= it.fin ? ' is-today' : ''}" data-ses="${esc(it.id)}">
        <button class="block-head" data-act="ses-toggle" aria-expanded="${open}">
          <span class="check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span>
          <span class="block-title"><b>${rango(it.inicio, it.fin)} ${tag(st)}</b><small>${esc(sub)}</small></span>
          <span class="block-min${rec ? '' : ' empty'}">${right}</span>
        </button>${body}
      </article>`;
  }

  const plainRow = (k, text, isToday) => `<div class="osf-row${isToday ? ' is-today' : ''}"><b>${dia(k)}</b><span>${H.esc(text)}</span></div>`;

  /* ---------------------------------------------------------------- Hoy */
  function hitoLine(x) {
    if (x.estado === 'abierto') return x.dias === 0 ? 'cierra hoy' : x.dias === 1 ? 'cierra mañana' : `cierra en ${x.dias} días`;
    if (x.periodo) return x.dias === 1 ? 'abre mañana' : `abre en ${x.dias} días`;
    return enDias(x.dias);
  }

  function viewHoy() {
    const esc = H.esc, t = hoy();
    const s = C.sesionDe(plan, t);
    const parts = [];

    const urg = C.hitosUrgentes(plan, av, t);
    if (urg.length) {
      parts.push(`<section class="card osf-alert stack">${urg.map((x) => `
        <label class="row-between">
          <span><strong>${esc(x.hito.titulo)}</strong><br><span class="small">${x.dias < 0 ? `La fecha pasó hace ${-x.dias} ${x.dias === -1 ? 'día' : 'días'}` : `Fecha límite ${enDias(x.dias)}`} · ${esc(CONFIRMA[x.hito.id] || 'Hecho')}</span></span>
          <input type="checkbox" class="switch" data-hito="${esc(x.hito.id)}" aria-label="${esc(CONFIRMA[x.hito.id] || 'Hecho')}">
        </label>`).join('')}</section>`);
    }

    let main;
    if (s.tipo === 'sesion' || s.tipo === 'tramo') {
      const it = itemById.get(s.id);
      const head = s.semana ? `Semana ${s.semana.n} · ${s.semana.area}` : s.bloque ? `${s.bloque.nombre} · ${s.bloque.tema}` : `Tramo del ${rango(s.inicio, s.fin)}`;
      main = `<p class="muted small osf-sub">${esc(head)}${s.minutos ? ` · objetivo ${H.fmtMin(s.minutos)}` : ''}</p><div class="blocks">${sesCard(it)}</div>`;
    } else {
      const msg = {
        fuera: s.antes
          ? ['El plan todavía no empieza', `Arranca el ${fecha(plan.meta.inicio)}. Hoy no hay sesión.`]
          : ['El plan ya terminó', `Cerró el ${fecha(plan.meta.fin)}. Hoy no hay sesión.`],
        fase2: ['Hoy es la Fase 2', `${s.hito ? s.hito.detalle : ''} No hay sesión de estudio.`],
        libre: ['Día libre', s.semana ? `Semana ${s.semana.n} · ${s.semana.area}. Hoy no se estudia.` : s.texto],
        descanso: ['Día de descanso', s.texto],
      }[s.tipo];
      main = `<div class="card osf-empty"><strong>${esc(msg[0])}</strong><span class="muted">${esc(msg[1])}</span></div>`;
    }
    parts.push(`<section class="section" aria-labelledby="osf-h-hoy"><div class="section-head"><h2 id="osf-h-hoy">Qué toca hoy</h2><span class="muted small">${dia(t)}</span></div>${main}</section>`);

    const nx = C.siguienteHito(plan, t);
    parts.push(`<section class="section"><div class="section-head"><h2>Siguiente hito</h2><a class="link small" href="#/osf/fechas">Ver fechas</a></div>
      <div class="card osf-next">${nx
        ? `<svg aria-hidden="true"><use href="#i-flag"/></svg><span><strong>${esc(nx.hito.titulo)}</strong> · ${hitoLine(nx)}<br><span class="muted small">${fecha(nx.objetivo)}</span></span>`
        : '<span class="muted">No quedan hitos por delante.</span>'}</div></section>`);

    const late = C.atrasadas(plan, av, t);
    if (late.length) {
      parts.push(`<section class="section"><div class="section-head"><h2>Atrasadas</h2><span class="muted small">${late.length}</span></div>
        <div class="blocks">${late.slice(0, MAX_ATRASADAS).map(sesCard).join('')}</div>
        ${late.length > MAX_ATRASADAS ? `<p class="muted small osf-more">Y ${late.length - MAX_ATRASADAS} más. <a class="link" href="#/osf/plan">Verlas en Plan</a></p>` : ''}</section>`);
    }

    const m = C.minutosSemana(plan, av, t);
    parts.push(`<section class="section"><div class="section-head"><h2>Esta semana</h2><span class="muted small">${dm(m.inicio)} – ${dm(m.fin)}</span></div>
      <div class="card week"><div class="week-row">
        <div class="week-top"><span class="week-label"><i class="swatch"></i>Minutos estudiados</span><span class="week-val"><strong>${m.total}</strong> / ${m.objetivo} min${m.total >= m.objetivo ? '<span class="met">✓ meta</span>' : ''}</span></div>
        ${bar('Minutos de la semana', m.total, m.objetivo)}
      </div></div></section>`);
    return parts.join('');
  }

  /* ---------------------------------------------------------------- Plan */
  function weekState(w, t) {
    const its = items.filter((i) => i.semana && i.semana.id === w.id);
    const done = its.filter((i) => av.sesiones[i.id]).length;
    const st = t >= w.inicio && t <= w.fin ? 'hoy'
      : its.length && done === its.length ? 'hecha'
      : its.some((i) => C.estadoDe(i, av, t) === 'atrasada') ? 'atrasada' : 'pendiente';
    return { st, done, total: its.length };
  }

  function viewPlan() {
    const esc = H.esc, t = hoy();
    const head = (e, i) => `<div class="section-head"><h2>Etapa ${i + 1} · ${esc(e.nombre)}</h2><span class="muted small">${dm(e.inicio)} – ${dm(e.fin)}</span></div>`;
    const parts = plan.etapas.map((e, i) => {
      let body = '';
      if (e.bloques) {
        body = e.bloques.map((b) => `<p class="muted small osf-sub">${esc(b.nombre)} · ${esc(b.tema)}</p><div class="blocks">${b.sesiones.map((s) => sesCard(itemById.get(s.id))).join('')}</div>`).join('');
      } else if (e.tramos) {
        body = `<div class="blocks">${e.tramos.map((tr) => (tr.descanso
          ? plainRow(tr.inicio, tr.texto, t >= tr.inicio && t <= tr.fin)
          : sesCard(itemById.get(tr.id)))).join('')}</div>`;
      } else {
        body = `<div class="blocks">${e.semanas.map((w) => {
          const ws = weekState(w, t);
          const open = ui.weeks.has(w.id);
          let days = '';
          if (open) {
            for (let k = w.inicio; k <= w.fin; k = C.addDays(k, 1)) {
              const s = C.sesionDe(plan, k);
              days += s.tipo === 'sesion' ? sesCard(itemById.get(s.id)) : plainRow(k, s.tipo === 'fase2' ? 'Fase 2. Sin sesión.' : 'Día libre', k === t);
            }
          }
          return `
          <details class="card osf-week${ws.st === 'hoy' ? ' is-today' : ''}" data-week="${w.id}"${open ? ' open' : ''}>
            <summary>
              <span class="osf-week-t"><b>S${w.n} · ${esc(w.area)} ${tag(ws.st)}</b><small>${dm(w.inicio)} – ${dm(w.fin)}${w.nota ? ` · ${esc(w.nota)}` : ''}</small></span>
              <span class="osf-week-n">${ws.done}/${ws.total}</span>
            </summary>
            <p class="osf-text">${esc(w.texto)}</p>
            ${w.dias_libres.length ? `<p class="muted small">Días libres: ${w.dias_libres.map(dm).join(', ')}</p>` : ''}
            <div class="blocks">${days}</div>
          </details>`;
        }).join('')}</div>`;
      }
      return `<section class="section">${head(e, i)}${body}</section>`;
    });
    if (plan.meta.supuestos && plan.meta.supuestos.length) {
      parts.push(`<section class="section"><details class="note"><summary>Supuestos del plan</summary>${plan.meta.supuestos.map((x) => `<p>${esc(x)}</p>`).join('')}</details></section>`);
    }
    return parts.join('');
  }

  /* ---------------------------------------------------------------- Temario */
  function viewTemario() {
    const esc = H.esc;
    const all = C.avanceTemario(plan.temario, av);
    const soloF1 = plan.temario.filter((x) => !x.etapa3_semanas).length;
    const toggle = (id, f, label, on) => `<button type="button" class="chip${on ? ' on' : ''}" data-act="tema" data-id="${id}" data-f="${f}" aria-pressed="${on}">${label}</button>`;
    const grupos = C.gruposTemario(plan).map((g) => {
      const a = C.avanceTemario(g.temas, av);
      return `<section class="section">
        <div class="section-head"><h2>${esc(g.contenido)}</h2><span class="muted small">${a.hechas}/${a.total}</span></div>
        <div class="card stack">
          ${bar(g.contenido, a.hechas, a.total)}
          ${g.temas.map((x) => {
            const m = av.temario[x.id] || {};
            const cuando = [`Octubre: ${x.octubre.map(dm).join(', ')}`];
            if (x.etapa3_semanas) cuando.push(`Etapa 3: ${x.etapa3_semanas.map((n) => `S${n}`).join(', ')}`);
            return `<div class="osf-item">
              <div class="osf-item-main"><b>${esc(x.subcontenido)}</b><small class="muted">${cuando.join(' · ')}</small></div>
              <div class="chips">${toggle(x.id, 'visto', 'Visto', !!m.visto)}${x.etapa3_semanas ? toggle(x.id, 'profundizado', 'Profundizado', !!m.profundizado) : '<span class="osf-tag solo">solo Fase 1</span>'}</div>
            </div>`;
          }).join('')}
        </div></section>`;
    }).join('');
    return `<section class="section"><div class="section-head"><h2>Avance total</h2><span class="muted small">${plan.temario.length} subcontenidos · ${soloF1} solo Fase 1</span></div>
      <div class="card week"><div class="week-row">
        <div class="week-top"><span class="week-label"><i class="swatch"></i>Marcas completadas</span><span class="week-val"><strong>${all.hechas}</strong> / ${all.total} · ${pct(all.hechas, all.total)}%</span></div>
        ${bar('Avance total del temario', all.hechas, all.total)}
      </div></div></section>${grupos}`;
  }

  /* ---------------------------------------------------------------- Errores */
  const temaOptions = (sel) => C.gruposTemario(plan).map((g) => `<optgroup label="${H.esc(g.contenido)}">${g.temas.map((x) => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${H.esc(x.subcontenido)}</option>`).join('')}</optgroup>`).join('');
  const contenidoDe = (e) => (temaById.get(e.temaId) || {}).contenido || 'Sin tema';

  function viewErrores() {
    const esc = H.esc;
    const form = !ui.errForm ? '<button type="button" class="btn primary osf-wide" data-act="err-new">Registrar un error</button>' : `
      <form class="card stack" data-form="err">
        <label class="field"><span class="lbl">Fecha</span><input class="input" type="date" name="fecha" value="${hoy()}" required></label>
        <label class="field"><span class="lbl">Subcontenido</span><select class="input" name="temaId" required>${temaOptions('')}</select></label>
        <label class="field"><span class="lbl">Causa</span><select class="input" name="causa" required>${plan.causas_de_error.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label class="field"><span class="lbl">Descripción breve</span><input class="input" type="text" name="descripcion" maxlength="240" required></label>
        <label class="field"><span class="lbl">De dónde salió (opcional)</span><input class="input" type="text" name="origen" maxlength="120"></label>
        <div class="btn-row end"><button type="button" class="btn ghost" data-act="err-cancel">Cancelar</button><button class="btn primary">Guardar</button></div>
      </form>`;

    const count = (keyFn, keys) => {
      const n = new Map(keys.map((k) => [k, 0]));
      for (const e of av.errores) n.set(keyFn(e), (n.get(keyFn(e)) || 0) + 1);
      const max = Math.max(1, ...n.values());
      return [...n].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="week-row"><div class="week-top"><span class="week-label">${esc(k)}</span><span class="week-val"><strong>${v}</strong></span></div>${bar(k, v, max)}</div>`).join('');
    };
    const contenidos = C.gruposTemario(plan).map((g) => g.contenido);
    const stats = !av.errores.length ? '' : `
      <section class="section"><h2>Dónde fallo más</h2>
        <div class="card stack"><p class="muted small">Por causa</p>${count((e) => e.causa, plan.causas_de_error)}</div>
        <div class="card stack osf-gap"><p class="muted small">Por contenido</p>${count(contenidoDe, contenidos)}</div>
      </section>`;

    const pasa = (e) => (!ui.fContenido || contenidoDe(e) === ui.fContenido) && (!ui.fCausa || e.causa === ui.fCausa);
    const row = (e) => {
      const tema = temaById.get(e.temaId);
      return `<article class="card osf-entry" data-id="${esc(e.id)}">
        <div class="osf-entry-top"><b>${esc(tema ? tema.subcontenido : 'Tema eliminado del plan')}</b><span class="osf-tag causa">${esc(e.causa)}</span></div>
        <p class="osf-text">${esc(e.descripcion)}</p>
        <p class="muted small">${fecha(e.fecha)} · ${esc(contenidoDe(e))}${e.origen ? ` · ${esc(e.origen)}` : ''}${e.resueltoEl ? ` · reintento el ${fecha(e.resueltoEl)}` : ''}</p>
        <div class="btn-row end">
          <button type="button" class="btn ghost danger sm" data-act="err-del">Eliminar</button>
          <button type="button" class="btn ${e.resueltoEl ? 'ghost' : 'primary'} sm" data-act="err-toggle">${e.resueltoEl ? 'Reabrir' : 'Resuelto'}</button>
        </div>
      </article>`;
    };
    const byDate = (a, b) => a.fecha.localeCompare(b.fecha);
    const pend = av.errores.filter((e) => !e.resueltoEl && pasa(e)).sort(byDate);
    const res = av.errores.filter((e) => e.resueltoEl && pasa(e)).sort(byDate);
    const nPend = av.errores.filter((e) => !e.resueltoEl).length;
    const filtros = !av.errores.length ? '' : `<div class="osf-filters">
      <select class="input" data-filter="fContenido" aria-label="Filtrar por contenido"><option value="">Todos los contenidos</option>${contenidos.map((c) => `<option${c === ui.fContenido ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select class="input" data-filter="fCausa" aria-label="Filtrar por causa"><option value="">Todas las causas</option>${plan.causas_de_error.map((c) => `<option${c === ui.fCausa ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
    </div>`;

    return `<section class="section">${form}</section>
      <section class="section"><div class="section-head"><h2>Pendientes</h2><span class="muted small">${pend.length === nPend ? nPend : `${pend.length} de ${nPend}`}</span></div>
        ${filtros}
        <div class="blocks">${pend.map(row).join('') || `<div class="card osf-empty"><span class="muted">${av.errores.length ? 'No hay errores pendientes con ese filtro.' : 'Todavía no registras errores. Cada problema fallado va aquí para reintentarlo el domingo.'}</span></div>`}</div>
      </section>
      ${res.length ? `<section class="section"><details class="note"><summary>Resueltos (${res.length})</summary><div class="blocks osf-gap">${res.map(row).join('')}</div></details></section>` : ''}
      ${stats}`;
  }

  /* ---------------------------------------------------------------- Simulacros */
  const simTotal = (s) => s.problemas.reduce((a, p) => ({ o: a.o + p.obtenido, m: a.m + p.max }), { o: 0, m: 0 });
  const probRow = (i, p) => `<div class="osf-prob"><span class="muted small">P${i + 1}</span><input class="input" type="number" inputmode="decimal" min="0" step="any" data-p="obtenido" value="${p ? p.obtenido : ''}" placeholder="Obtenido" aria-label="Puntaje obtenido del problema ${i + 1}"><span class="muted">/</span><input class="input" type="number" inputmode="decimal" min="0" step="any" data-p="max" value="${p ? p.max : ''}" placeholder="Máximo" aria-label="Puntaje máximo del problema ${i + 1}"><button type="button" class="icon-btn sm" data-act="prob-del" aria-label="Quitar problema ${i + 1}">✕</button></div>`;

  function viewSimulacros() {
    const esc = H.esc, t = hoy();
    const prog = (C.etapa(plan, 'e3').simulacros_completos || []).filter((x) => !av.simulacros.some((s) => s.programado === x.n));
    const f = ui.simForm;
    const form = !f ? '<button type="button" class="btn primary osf-wide" data-act="sim-new">Registrar un simulacro</button>' : `
      <form class="card stack" data-form="sim">
        <div class="phase-dates">
          <label class="field"><span class="lbl">Fecha</span><input class="input" type="date" name="fecha" value="${f.fecha}" required></label>
          <label class="field"><span class="lbl">Tipo</span><select class="input" name="tipo">${TIPOS_SIM.map(([v, l]) => `<option value="${v}"${v === f.tipo ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span class="lbl">Tema</span><input class="input" type="text" name="tema" maxlength="160" value="${esc(f.tema)}" required></label>
        <div class="field"><span class="lbl">Puntaje por problema</span>
          <div class="stack osf-probs" id="osf-probs">${Array.from({ length: f.n }, (_, i) => probRow(i)).join('')}</div>
          <button type="button" class="btn ghost sm" data-act="prob-add">Agregar problema</button>
        </div>
        <label class="field"><span class="lbl">Minutos usados</span><input class="input" type="number" inputmode="numeric" min="1" max="${MAX_MIN}" name="minutos"></label>
        <label class="field"><span class="lbl">Notas</span><textarea class="input" name="notas" maxlength="400" rows="3"></textarea></label>
        <div class="btn-row end"><button type="button" class="btn ghost" data-act="sim-cancel">Cancelar</button><button class="btn primary">Guardar</button></div>
      </form>`;

    const hist = [...av.simulacros].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((s) => {
      const tt = simTotal(s);
      return `<article class="card osf-entry" data-id="${esc(s.id)}">
        <div class="osf-entry-top"><b>${esc(s.tema)}</b><span class="osf-pct">${pct(tt.o, tt.m)}%</span></div>
        <p class="muted small">${fecha(s.fecha)} · ${esc((TIPOS_SIM.find(([v]) => v === s.tipo) || [])[1] || s.tipo)} · ${tt.o}/${tt.m} pts${s.minutos ? ` · ${H.fmtMin(s.minutos)}` : ''}</p>
        <p class="small osf-scores">${s.problemas.map((p, i) => `<span>P${i + 1} ${p.obtenido}/${p.max}</span>`).join('')}</p>
        ${s.notas ? `<p class="osf-text">${esc(s.notas)}</p>` : ''}
        <div class="btn-row end"><button type="button" class="btn ghost danger sm" data-act="sim-del">Eliminar</button></div>
      </article>`;
    }).join('');

    return `${prog.length ? `<section class="section"><h2>Programados</h2><div class="blocks">${prog.map((x) => `
        <article class="card osf-entry">
          <div class="osf-entry-top"><b>Simulacro ${x.n} completo</b>${tag(x.fecha === t ? 'hoy' : x.fecha < t ? 'atrasada' : 'pendiente')}</div>
          <p class="osf-text">${esc(x.texto)}</p>
          <div class="row-between"><span class="muted small">${dia(x.fecha)} · ${fecha(x.fecha)}</span><button type="button" class="btn ghost sm" data-act="sim-prog" data-n="${x.n}">Registrar</button></div>
        </article>`).join('')}</div></section>` : ''}
      <section class="section">${form}</section>
      <section class="section"><div class="section-head"><h2>Historial</h2><span class="muted small">${av.simulacros.length}</span></div>
        <div class="blocks">${hist || '<div class="card osf-empty"><span class="muted">Todavía no registras simulacros.</span></div>'}</div></section>`;
  }

  /* ---------------------------------------------------------------- Fechas */
  function viewFechas() {
    const esc = H.esc, t = hoy();
    const nextId = (C.siguienteHito(plan, t) || { hito: {} }).hito.id;
    return `<section class="section"><h2>Hitos</h2><div class="blocks">${plan.hitos.map((h) => {
      const x = C.hitoInfo(h, t);
      const num = x.estado === 'paso' ? 'Pasó' : x.estado === 'abierto' ? 'Abierto' : x.dias === 0 ? 'Hoy' : x.dias;
      const unit = x.estado === 'paso' ? '' : x.estado === 'abierto' ? hitoLine(x) : x.dias === 0 ? '' : x.periodo ? (x.dias === 1 ? 'día para que abra' : 'días para que abra') : x.dias === 1 ? 'día' : 'días';
      const label = CONFIRMA[h.id] || 'Hecho';
      return `<article class="card osf-hito${h.id === nextId ? ' next' : ''}${x.estado === 'paso' ? ' past' : ''}">
        <div class="osf-hito-top">
          <div class="osf-item-main"><b>${esc(h.titulo)}</b><small class="muted">${x.periodo ? `${fecha(h.inicio)} – ${fecha(h.fin)}` : `${dia(h.fecha)} · ${fecha(h.fecha)}`}</small></div>
          <div class="osf-hito-cd"><span class="cd-num">${num}</span><span class="cd-unit">${unit}</span></div>
        </div>
        ${h.detalle ? `<p class="osf-text muted">${esc(h.detalle)}</p>` : ''}
        ${h.requiere_confirmacion ? `<label class="row-between osf-confirm"><span>${esc(label)}</span><input type="checkbox" class="switch" data-hito="${esc(h.id)}"${av.hitos[h.id] ? ' checked' : ''}></label>` : ''}
      </article>`;
    }).join('')}</div></section>`;
  }

  /* ---------------------------------------------------------------- render */
  const VIEWS = { hoy: viewHoy, plan: viewPlan, temario: viewTemario, errores: viewErrores, simulacros: viewSimulacros, fechas: viewFechas };
  const visible = () => !H.$('#view-osf').hidden;

  function render() {
    const t = hoy();
    lastDay = t;
    H.$('#osf-today-label').textContent = H.cap(H.fmt.long.format(H.parseKey(t)));
    const sim = H.$('#osf-sim');
    sim.hidden = !simulada();
    sim.textContent = simulada() ? `Fecha simulada: ${fecha(t)}. Quita ?hoy= de la dirección para volver a la fecha real.` : '';
    H.$('#osf-tabs').innerHTML = TABS.map((x) => `<a class="chip${x.id === tab ? ' on' : ''}" href="#/osf${x.id === 'hoy' ? '' : `/${x.id}`}"${x.id === tab ? ' aria-current="page"' : ''}>${x.name}</a>`).join('');
    const body = H.$('#osf-body');
    if (!plan) {
      H.$('#osf-stage-label').textContent = 'Olimpiada de Física';
      body.innerHTML = `<div class="card osf-empty"><span class="muted">${planFail ? 'No se pudo cargar el plan (data/osf-plan.json). Revisa la conexión y recarga.' : 'Cargando el plan…'}</span></div>`;
      return;
    }
    const e = C.etapaDe(plan, t);
    H.$('#osf-stage-label').textContent = e ? `Etapa ${plan.etapas.indexOf(e) + 1} · ${e.nombre}` : `${plan.meta.nombre} · fuera del plan`;
    body.innerHTML = VIEWS[tab]();
  }

  /* Llamado por el router de app.js cada vez que la ruta es #/osf… */
  function show(hash) {
    const next = TABS.some((x) => x.id === hash.split('/')[2]) ? hash.split('/')[2] : 'hoy';
    tab = next;
    ui.errForm = false; ui.simForm = null; ui.open = null;
    if (plan) enterTab();
    render();
    if (tab === 'plan' && plan) {
      requestAnimationFrame(() => { const el = H.$('#osf-body .is-today'); if (el) el.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0); });
    } else window.scrollTo(0, 0);
    const on = H.$('#osf-tabs [aria-current]');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function enterTab() {
    const t = hoy();
    const s = C.sesionDe(plan, t);
    if (tab === 'hoy' && s.id && itemById.has(s.id) && !av.sesiones[s.id]) ui.open = s.id;
    if (tab === 'plan') {
      const w = (C.etapa(plan, 'e3').semanas || []).find((x) => t >= x.inicio && t <= x.fin);
      if (w) ui.weeks.add(w.id);
    }
  }

  /* ---------------------------------------------------------------- actions */
  function saveSession(card) {
    const id = card.dataset.ses;
    const inp = H.$('.min-input', card);
    const raw = inp.value.trim();
    const min = Math.round(Number(raw));
    if (raw && !(min > 0)) { inp.classList.remove('invalid'); void inp.offsetWidth; inp.classList.add('invalid'); inp.focus(); return; }
    const prev = av.sesiones[id];
    av.sesiones[id] = { hechaEl: prev ? prev.hechaEl : hoy(), min: raw ? Math.min(MAX_MIN, min) : null, nota: H.$('.note-input', card).value.trim().slice(0, 140) };
    save(); ui.open = null; render();
    H.toast(prev ? 'Sesión actualizada' : 'Sesión hecha');
  }

  function renumberProbs() {
    H.$$('#osf-probs .osf-prob').forEach((r, i) => { H.$('span', r).textContent = `P${i + 1}`; });
  }

  async function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const card = b.closest('[data-ses]');
    const entry = b.closest('[data-id]');
    if (act === 'ses-toggle') { ui.open = ui.open === card.dataset.ses ? null : card.dataset.ses; return render(); }
    if (act === 'ses-save') return saveSession(card);
    if (act === 'ses-clear') { delete av.sesiones[card.dataset.ses]; save(); ui.open = null; return render(); }
    if (act === 'tema') {
      const m = { visto: false, profundizado: false, ...(av.temario[b.dataset.id] || {}) };
      m[b.dataset.f] = !m[b.dataset.f];
      if (m.visto || m.profundizado) av.temario[b.dataset.id] = m; else delete av.temario[b.dataset.id];
      save(); return render();
    }
    if (act === 'err-new') { ui.errForm = true; return render(); }
    if (act === 'err-cancel') { ui.errForm = false; return render(); }
    if (act === 'err-toggle') {
      const x = av.errores.find((r) => r.id === entry.dataset.id);
      x.resueltoEl = x.resueltoEl ? null : hoy();
      save(); render(); return H.toast(x.resueltoEl ? 'Error resuelto' : 'Error reabierto');
    }
    if (act === 'err-del') {
      if (!(await H.confirmDialog('Eliminar error', 'Se borra este registro de la lista de errores.', 'Eliminar'))) return;
      av.errores = av.errores.filter((r) => r.id !== entry.dataset.id); save(); return render();
    }
    if (act === 'sim-new') { ui.simForm = { fecha: hoy(), tipo: 'parcial', tema: '', n: 3, programado: null }; return render(); }
    if (act === 'sim-prog') {
      const x = C.etapa(plan, 'e3').simulacros_completos.find((s) => s.n === Number(b.dataset.n));
      ui.simForm = { fecha: x.fecha, tipo: 'completo', tema: `Simulacro ${x.n} completo`, n: 6, programado: x.n };
      render(); return H.$('[data-form="sim"]').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    if (act === 'sim-cancel') { ui.simForm = null; return render(); }
    if (act === 'sim-del') {
      if (!(await H.confirmDialog('Eliminar simulacro', 'Se borra este simulacro del historial.', 'Eliminar'))) return;
      av.simulacros = av.simulacros.filter((r) => r.id !== entry.dataset.id); save(); return render();
    }
    if (act === 'prob-add') {
      const box = H.$('#osf-probs');
      box.insertAdjacentHTML('beforeend', probRow(box.children.length));
      return H.$('input', box.lastElementChild).focus();
    }
    if (act === 'prob-del') {
      if (H.$$('#osf-probs .osf-prob').length <= 1) return H.toast('Un simulacro necesita al menos un problema.');
      b.closest('.osf-prob').remove(); return renumberProbs();
    }
  }

  function onSubmit(e) {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(form));
    if (!DATE_RE.test(v.fecha)) return H.toast('Elige una fecha válida.');
    if (form.dataset.form === 'err') {
      av.errores.push({ id: uid(), fecha: v.fecha, temaId: v.temaId, causa: v.causa, descripcion: v.descripcion.trim().slice(0, 240), origen: (v.origen || '').trim().slice(0, 120), resueltoEl: null });
      save(); ui.errForm = false; render(); return H.toast('Error registrado');
    }
    const problemas = H.$$('.osf-prob', form).map((r) => ({ obtenido: Number(H.$('[data-p="obtenido"]', r).value), max: Number(H.$('[data-p="max"]', r).value) }));
    if (problemas.some((p) => !(p.max > 0) || !(p.obtenido >= 0) || p.obtenido > p.max)) return H.toast('Revisa los puntajes: el máximo debe ser mayor que 0 y el obtenido no puede pasarlo.');
    const min = Math.round(Number(v.minutos));
    av.simulacros.push({ id: uid(), fecha: v.fecha, tipo: v.tipo, tema: v.tema.trim().slice(0, 160), problemas, minutos: min > 0 ? Math.min(MAX_MIN, min) : null, notas: (v.notas || '').trim().slice(0, 400), programado: ui.simForm ? ui.simForm.programado : null });
    save(); ui.simForm = null; render(); H.toast('Simulacro registrado');
  }

  function onChange(e) {
    const el = e.target;
    if (el.dataset.hito) {
      if (el.checked) av.hitos[el.dataset.hito] = true; else delete av.hitos[el.dataset.hito];
      save(); H.syncSW(); render();
      return H.toast(el.checked ? 'Confirmado' : 'Marca quitada');
    }
    if (el.dataset.filter) { ui[el.dataset.filter] = el.value; render(); }
  }

  /* ---------------------------------------------------------------- service worker / respaldo */
  /* Hitos que todavía merecen aviso, para el recordatorio del service worker. */
  function hitosAviso() {
    if (!plan) return null;
    return plan.hitos.filter((h) => !(h.requiere_confirmacion && av.hitos[h.id]))
      .map((h) => ({ id: h.id, titulo: h.fin ? `${h.titulo} (cierre)` : h.titulo, fecha: h.fin || h.fecha }));
  }

  const exportState = () => av;
  function importState(raw) { av = normalize(raw); save(); if (H) H.syncSW(); if (H && visible()) render(); }

  /* ---------------------------------------------------------------- boot */
  function init(helpers) {
    H = helpers;
    const body = H.$('#osf-body');
    body.addEventListener('click', onClick);
    body.addEventListener('submit', onSubmit);
    body.addEventListener('change', onChange);
    body.addEventListener('keydown', (e) => {
      const card = e.target.closest('.osf-ses');
      if (e.key === 'Enter' && card && e.target.classList.contains('input')) { e.preventDefault(); saveSession(card); }
    });
    body.addEventListener('toggle', (e) => {
      const d = e.target;
      if (!d.dataset || !d.dataset.week || d.open === ui.weeks.has(d.dataset.week)) return;
      if (d.open) ui.weeks.add(d.dataset.week); else ui.weeks.delete(d.dataset.week);
      render();
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && visible() && hoy() !== lastDay) render();
    });

    fetch(PLAN_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((p) => {
      plan = p;
      items = C.sesionesDelPlan(plan);
      itemById = new Map(items.map((i) => [i.id, i]));
      temaById = new Map(plan.temario.map((x) => [x.id, x]));
      H.syncSW();
      if (visible()) show(location.hash);
    }).catch(() => { planFail = true; if (visible()) render(); });
  }

  return { init, show, exportState, importState, hitosAviso };
})();
