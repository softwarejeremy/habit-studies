/* Habit Studies — SAT & TOEFL tracker. Vanilla JS, localStorage only. */
(() => {
  'use strict';

  const STORE_KEY = 'habitStudies.v1';
  const HEAT_WEEKS = 26;
  const MAX_MIN = 720;

  const CATS = [
    { id: 'sat',   name: 'SAT',          sub: 'Math · Reading & Writing' },
    { id: 'toefl', name: 'TOEFL/Inglés', sub: 'Reading · Listening · Speaking · Writing' },
    { id: 'other', name: 'Otro',         sub: 'Física · extracurriculares' },
  ];
  const QUICK = [15, 30, 45, 60, 90];

  const DEFAULT_SETTINGS = () => ({
    theme: 'dark',
    reminder: { enabled: false, time: '18:00' },
    milestones: [
      { id: 'diag',    label: 'Diagnóstico SAT',              date: '2026-10-17' },
      { id: 'sat',     label: 'SAT real',                     date: '2027-03-13' },
      { id: 'toefl',   label: 'TOEFL / IELTS real',           date: '2027-04-24' },
      { id: 'retake',  label: 'Repetición de examen',         date: '2027-06-05' },
      { id: 'ea',      label: 'Early Action MIT · REA Princeton/Yale', date: '2027-11-01' },
      { id: 'rd',      label: 'Regular Decision',             date: '2028-01-01' },
      { id: 'results', label: 'Resultados',                   date: '2028-03-14' },
    ],
    phases: [
      { id: 'pre',   name: 'Pre-diagnóstico', start: '2026-09-01', end: '2026-10-31', goals: { sat: 3, toefl: 2, other: 2 } },
      { id: 'base',  name: 'Fase base',       start: '2026-11-01', end: '2026-12-31', goals: { sat: 5, toefl: 4, other: 3 } },
      { id: 'int',   name: 'Fase intensiva',  start: '2027-01-01', end: '2027-03-31', goals: { sat: 9, toefl: 6, other: 2 } },
      { id: 'exam',  name: 'Exámenes',        start: '2027-04-01', end: '2027-06-30', goals: { sat: 6, toefl: 6, other: 3 } },
      { id: 'apps',  name: 'Aplicaciones',    start: '2027-07-01', end: '2027-11-01', goals: { sat: 3, toefl: 2, other: 4 } },
    ],
  });

  /* ---------------------------------------------------------------- dates */
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
  const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7)); // Monday
  const todayKey = () => keyOf(new Date());
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  const fmt = {
    long: new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }),
    dayShort: new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' }),
    date: new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }),
    dm: new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }),
    month: new Intl.DateTimeFormat('es', { month: 'short' }),
  };
  const clean = (s) => s.replace(/\./g, '');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtMin = (m) => {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  };
  const fmtH = (m) => { const h = m / 60; return (Math.round(h * 10) / 10).toLocaleString('es', { maximumFractionDigits: 1 }); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------------------------------------------------------- state */
  let state = load();
  let selectedDay = todayKey();
  let openCat = null;
  let heatSelected = null;
  let heatAnimated = false;

  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (_) { /* corrupt → defaults */ }
    return normalize(raw);
  }

  function normalize(raw) {
    const def = DEFAULT_SETTINGS();
    const s = (raw && raw.settings) || {};
    const entries = {};
    if (raw && raw.entries && typeof raw.entries === 'object') {
      for (const [k, v] of Object.entries(raw.entries)) {
        if (!DATE_RE.test(k) || !v || typeof v !== 'object') continue;
        const day = {};
        for (const c of CATS) {
          const b = v[c.id];
          const min = b && Math.min(MAX_MIN, Math.max(0, Math.round(Number(b.min) || 0)));
          if (min > 0) day[c.id] = { min, note: typeof b.note === 'string' ? b.note.slice(0, 140) : '' };
        }
        if (Object.keys(day).length) entries[k] = day;
      }
    }
    const milestones = Array.isArray(s.milestones) && s.milestones.length
      ? s.milestones.filter((m) => m && typeof m.label === 'string').map((m, i) => ({ id: m.id || `m${i}`, label: m.label, date: DATE_RE.test(m.date) ? m.date : '' }))
      : def.milestones;
    const phases = Array.isArray(s.phases) && s.phases.length
      ? s.phases.filter(Boolean).map((p, i) => ({
          id: p.id || `p${i}`, name: String(p.name || `Fase ${i + 1}`),
          start: DATE_RE.test(p.start) ? p.start : '', end: DATE_RE.test(p.end) ? p.end : '',
          goals: { sat: +p.goals?.sat || 0, toefl: +p.goals?.toefl || 0, other: +p.goals?.other || 0 },
        }))
      : def.phases;
    return {
      version: 1,
      entries,
      settings: {
        theme: s.theme === 'light' ? 'light' : 'dark',
        reminder: {
          enabled: !!s.reminder?.enabled,
          time: /^\d{2}:\d{2}$/.test(s.reminder?.time) ? s.reminder.time : def.reminder.time,
        },
        milestones, phases,
      },
    };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('No se pudo guardar (almacenamiento lleno o bloqueado).'); }
    syncReminderToSW();
  }

  const dayTotal = (k) => { const d = state.entries[k]; return d ? CATS.reduce((s, c) => s + (d[c.id]?.min || 0), 0) : 0; };
  const isDone = (k) => dayTotal(k) > 0;
  const currentPhase = (k = todayKey()) => state.settings.phases.find((p) => p.start && p.end && p.start <= k && k <= p.end) || null;

  function streaks() {
    const t = todayKey();
    let cur = 0;
    let d = isDone(t) ? parseKey(t) : addDays(parseKey(t), -1);
    while (isDone(keyOf(d))) { cur++; d = addDays(d, -1); }
    const days = Object.keys(state.entries).filter(isDone).sort();
    let best = 0, run = 0, prev = null;
    for (const k of days) {
      run = prev && diffDays(prev, k) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    }
    return { cur, best: Math.max(best, cur), todayDone: isDone(t) };
  }

  /* ---------------------------------------------------------------- dom */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function applyTheme() {
    const t = state.settings.theme;
    document.documentElement.dataset.theme = t;
    $('meta[name="theme-color"]').setAttribute('content', t === 'light' ? '#f4f6f5' : '#0b0f0e');
    $$('[data-theme-opt]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeOpt === t)));
  }

  /* ---------------------------------------------------------------- header + streak */
  function renderHeader() {
    const t = todayKey();
    $('#today-label').textContent = cap(fmt.long.format(parseKey(t)));
    const ph = currentPhase(t);
    $('#phase-label').textContent = ph ? ph.name : 'Sin fase activa';

    const { cur, best, todayDone } = streaks();
    $('#streak-current').textContent = cur;
    $('#streak-unit').textContent = cur === 1 ? 'día seguido' : 'días seguidos';
    $('#streak-best').textContent = best;
    $('#streak').classList.toggle('is-live', cur > 0);
    $('#streak-hint').textContent = cur === 0 ? 'Empieza hoy' : todayDone ? '' : 'Registra algo hoy para mantenerla';

    const next = state.settings.milestones.filter((m) => m.date && m.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nm = $('#next-milestone');
    if (next) {
      const n = diffDays(t, next.date);
      nm.innerHTML = `<svg aria-hidden="true"><use href="#i-flag"/></svg><span><strong>${esc(next.label)}</strong> · ${n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`}</span>`;
      nm.hidden = false;
    } else nm.hidden = true;
  }

  /* ---------------------------------------------------------------- checklist */
  function renderDayNav() {
    const t = todayKey();
    const n = diffDays(selectedDay, t);
    $('#day-label').textContent = n === 0 ? 'Hoy' : n === 1 ? 'Ayer' : cap(clean(fmt.dayShort.format(parseKey(selectedDay))));
    $('#day-next').disabled = n <= 0;
  }

  function renderBlocks() {
    renderDayNav();
    const day = state.entries[selectedDay] || {};
    $('#blocks').innerHTML = CATS.map((c) => {
      const b = day[c.id];
      const done = !!b;
      const open = openCat === c.id;
      const cur = b ? b.min : '';
      return `
      <article class="block${done ? ' done' : ''}${open ? ' open' : ''}" data-cat="${c.id}">
        <button class="block-head" aria-expanded="${open}" aria-controls="form-${c.id}">
          <span class="check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span>
          <span class="block-title"><b>${c.name}</b><small class="${b?.note ? 'block-note' : ''}">${esc(b?.note || c.sub)}</small></span>
          <span class="block-min${done ? '' : ' empty'}">${done ? fmtMin(b.min) : 'Sin registrar'}</span>
        </button>
        <div class="block-body"><div>
          <div class="block-form" id="form-${c.id}">
            <div class="chips" role="group" aria-label="Minutos rápidos">
              ${QUICK.map((q) => `<button type="button" class="chip${+cur === q ? ' on' : ''}" data-min="${q}">${q}</button>`).join('')}
            </div>
            <div class="form-row">
              <label class="min-field"><input class="input min-input" type="number" inputmode="numeric" min="1" max="${MAX_MIN}" step="5" placeholder="0" value="${cur}" aria-label="Minutos estudiados"><span>min</span></label>
              <input class="input note-input" type="text" maxlength="140" placeholder="Nota (opcional)" value="${esc(b?.note || '')}" aria-label="Nota opcional" enterkeyhint="done">
            </div>
            <div class="block-actions">
              ${done ? '<button type="button" class="btn ghost danger act-clear">Quitar</button>' : ''}
              <button type="button" class="btn save act-save">${done ? 'Actualizar' : 'Guardar'}</button>
            </div>
          </div>
        </div></div>
      </article>`;
    }).join('');
  }

  function setBlock(cat, min, note) {
    const k = selectedDay;
    const wasDoneToday = isDone(todayKey());
    const day = { ...(state.entries[k] || {}) };
    if (min > 0) day[cat] = { min, note: note.trim().slice(0, 140) };
    else delete day[cat];
    if (Object.keys(day).length) state.entries[k] = day; else delete state.entries[k];
    save();
    openCat = null;
    renderBlocks();
    if (min > 0) {
      const el = $(`.block[data-cat="${cat}"]`);
      el.classList.add('just-done');
      setTimeout(() => el.classList.remove('just-done'), 500);
    }
    renderHeader();
    if (!wasDoneToday && isDone(todayKey())) bumpStreak();
    renderWeek();
    renderHeatmap();
  }

  function bumpStreak() {
    const s = $('#streak');
    s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump');
  }

  function bindBlocks() {
    const root = $('#blocks');
    root.addEventListener('click', (e) => {
      const block = e.target.closest('.block');
      if (!block) return;
      const cat = block.dataset.cat;
      if (e.target.closest('.block-head')) {
        const wasOpen = openCat === cat;
        $$('.block.open', root).forEach((b) => { b.classList.remove('open'); $('.block-head', b).setAttribute('aria-expanded', 'false'); });
        openCat = wasOpen ? null : cat;
        if (!wasOpen) { block.classList.add('open'); $('.block-head', block).setAttribute('aria-expanded', 'true'); }
        return;
      }
      const chip = e.target.closest('.chip');
      if (chip) {
        $('.min-input', block).value = chip.dataset.min;
        $('.min-input', block).classList.remove('invalid');
        $$('.chip', block).forEach((c) => c.classList.toggle('on', c === chip));
        return;
      }
      if (e.target.closest('.act-save')) return submit(block);
      if (e.target.closest('.act-clear')) return setBlock(cat, 0, '');
    });
    root.addEventListener('input', (e) => {
      if (!e.target.classList.contains('min-input')) return;
      const block = e.target.closest('.block');
      e.target.classList.remove('invalid');
      $$('.chip', block).forEach((c) => c.classList.toggle('on', c.dataset.min === e.target.value));
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('input')) { e.preventDefault(); submit(e.target.closest('.block')); }
    });
  }

  function submit(block) {
    const inp = $('.min-input', block);
    const min = Math.round(Number(inp.value));
    if (!(min > 0)) {
      inp.classList.remove('invalid'); void inp.offsetWidth; inp.classList.add('invalid');
      inp.focus();
      return;
    }
    setBlock(block.dataset.cat, Math.min(MAX_MIN, min), $('.note-input', block).value);
  }

  /* ---------------------------------------------------------------- week */
  function renderWeek() {
    const t = parseKey(todayKey());
    const mon = startOfWeek(t);
    const sun = addDays(mon, 6);
    $('#week-range').textContent = `${clean(fmt.dm.format(mon))} – ${clean(fmt.dm.format(sun))}`;
    const totals = { sat: 0, toefl: 0, other: 0 };
    for (let i = 0; i < 7; i++) {
      const d = state.entries[keyOf(addDays(mon, i))];
      if (d) for (const c of CATS) totals[c.id] += d[c.id]?.min || 0;
    }
    const ph = currentPhase();
    const all = totals.sat + totals.toefl + totals.other;
    const goalAll = ph ? CATS.reduce((s, c) => s + (ph.goals[c.id] || 0), 0) : 0;
    const el = $('#week');
    el.innerHTML = CATS.map((c) => {
      const goal = ph ? ph.goals[c.id] || 0 : 0;
      const pct = goal ? Math.min(1, totals[c.id] / (goal * 60)) : (totals[c.id] ? 1 : 0);
      const met = goal && totals[c.id] >= goal * 60;
      return `
      <div class="week-row" style="--cat: var(--c-${c.id})">
        <div class="week-top">
          <span class="week-label"><i class="swatch"></i>${c.name}</span>
          <span class="week-val"><strong>${fmtH(totals[c.id])}</strong>${goal ? ` / ${goal} h` : ' h'}${met ? '<span class="met">✓ meta</span>' : ''}</span>
        </div>
        <div class="track" role="progressbar" aria-label="${c.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}"><div class="fill" data-pct="${pct}"></div></div>
      </div>`;
    }).join('') + `<div class="week-total"><span>${ph ? `Meta de ${esc(ph.name)}` : 'Sin fase activa (define una en Ajustes)'}</span><span><strong>${fmtH(all)}</strong>${goalAll ? ` / ${goalAll} h` : ' h'}</span></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('.fill', el).forEach((f) => { f.style.transform = `scaleX(${f.dataset.pct})`; });
    }));
  }

  /* ---------------------------------------------------------------- heatmap */
  const level = (m) => (m <= 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4);

  function renderHeatmap() {
    const tk = todayKey();
    const t = parseKey(tk);
    const first = addDays(startOfWeek(t), -(HEAT_WEEKS - 1) * 7);
    const parts = [];
    // month labels: at the first column whose Monday falls in a new month, spaced ≥3 cols apart
    let lastMonth = -1, lastCol = -9;
    for (let c = 0; c < HEAT_WEEKS; c++) {
      const d = addDays(first, c * 7);
      if (d.getMonth() !== lastMonth) {
        if (c - lastCol >= 3 && c <= HEAT_WEEKS - 2) {
          parts.push(`<span class="mlabel" style="grid-column:${c + 2} / span 3">${clean(fmt.month.format(d))}</span>`);
          lastCol = c;
        }
        lastMonth = d.getMonth();
      }
    }
    ['L', '', 'X', '', 'V', '', 'D'].forEach((l, r) => l && parts.push(`<span class="dlabel" style="grid-row:${r + 2}">${l}</span>`));
    let active = 0, totalMin = 0;
    for (let c = 0; c < HEAT_WEEKS; c++) {
      for (let r = 0; r < 7; r++) {
        const d = addDays(first, c * 7 + r);
        const k = keyOf(d);
        const pos = `grid-column:${c + 2};grid-row:${r + 2};--c:${c};--r:${r}`;
        if (k > tk) { parts.push(`<span class="cell future" style="${pos}"></span>`); continue; }
        const m = dayTotal(k);
        if (m) { active++; totalMin += m; }
        const label = `${clean(fmt.dayShort.format(d))}: ${m ? fmtMin(m) : 'sin registro'}`;
        parts.push(`<button class="cell l${level(m)}${k === tk ? ' today' : ''}${k === heatSelected ? ' sel' : ''}" data-k="${k}" style="${pos}" aria-label="${label}"></button>`);
      }
    }
    const heat = $('#heat');
    heat.innerHTML = parts.join('');
    if (!heatAnimated) { heat.classList.add('animate'); heatAnimated = true; setTimeout(() => heat.classList.remove('animate'), 1400); }
    $('#heat-summary').textContent = active ? `${active} días · ${fmtH(totalMin)} h` : '';
    const empty = Object.keys(state.entries).length === 0;
    $('#heat-empty').hidden = !empty;
    $('#heat-detail').hidden = empty;
    renderHeatDetail(heatSelected);
  }

  function renderHeatDetail(k, animate) {
    const box = $('#heat-detail');
    if (!k) { box.innerHTML = '<p class="hint">Toca un día para ver el detalle</p>'; return; }
    const d = state.entries[k] || {};
    const total = dayTotal(k);
    const rows = CATS.filter((c) => d[c.id]).map((c) => `
      <li style="--cat: var(--c-${c.id})"><i class="swatch"></i><span>${c.name}</span><b>${fmtMin(d[c.id].min)}</b>${d[c.id].note ? `<span class="n">“${esc(d[c.id].note)}”</span>` : ''}</li>`).join('');
    box.innerHTML = `
      <div class="hd-top"><span class="hd-date">${esc(cap(fmt.long.format(parseKey(k))))}</span><span class="hd-total">${total ? fmtMin(total) : 'Sin registro'}</span></div>
      ${rows ? `<ul>${rows}</ul>` : ''}
      <button class="btn ghost hd-edit" data-edit="${k}">${total ? 'Editar este día' : 'Registrar este día'}</button>`;
    if (animate) { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); }
  }

  function bindHeatmap() {
    const heat = $('#heat');
    let hoverK = null;
    heat.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell[data-k]');
      if (!cell) return;
      heatSelected = heatSelected === cell.dataset.k ? null : cell.dataset.k;
      $$('.cell.sel', heat).forEach((c) => c.classList.remove('sel'));
      if (heatSelected) cell.classList.add('sel');
      renderHeatDetail(heatSelected, true);
    });
    heat.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const cell = e.target.closest('.cell[data-k]');
      if (!cell || cell.dataset.k === hoverK) return;
      hoverK = cell.dataset.k;
      renderHeatDetail(hoverK);
    });
    heat.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      hoverK = null;
      renderHeatDetail(heatSelected);
    });
    $('#heat-detail').addEventListener('click', (e) => {
      const b = e.target.closest('[data-edit]');
      if (!b) return;
      selectedDay = b.dataset.edit;
      openCat = null;
      renderBlocks();
      $('#h-check').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------------------------------------------------------- countdowns */
  function renderCountdowns() {
    const t = todayKey();
    const ms = state.settings.milestones.filter((m) => m.date).sort((a, b) => a.date.localeCompare(b.date));
    const nextId = ms.find((m) => m.date >= t)?.id;
    // upcoming first, then past (most recent first)
    const upcoming = ms.filter((m) => m.date >= t);
    const past = ms.filter((m) => m.date < t).reverse();
    $('#countdowns').innerHTML = [...upcoming, ...past].map((m, i) => {
      const n = diffDays(t, m.date);
      const isPast = n < 0;
      const num = isPast ? 'Hecho' : n === 0 ? 'Hoy' : n;
      const unit = isPast ? `hace ${-n} ${n === -1 ? 'día' : 'días'}` : n === 0 ? '' : n === 1 ? 'día' : `días · ${Math.floor(n / 7)} sem`;
      return `
      <article class="cd${m.id === nextId ? ' next' : ''}${isPast ? ' past' : ''}" style="--i:${i}">
        ${m.id === nextId ? '<span class="cd-tag">Próximo</span>' : ''}
        <span class="cd-label">${esc(m.label)}</span>
        <span class="cd-num">${num}</span>
        <span class="cd-unit">${unit}</span>
        <span class="cd-date">${clean(fmt.date.format(parseKey(m.date)))}</span>
      </article>`;
    }).join('');
  }

  /* ---------------------------------------------------------------- settings */
  function renderSettings() {
    applyTheme();
    const r = state.settings.reminder;
    $('#rem-enabled').checked = r.enabled;
    $('#rem-time').value = r.time;
    renderReminderStatus();

    $('#milestones-form').innerHTML = state.settings.milestones.map((m, i) => `
      <div class="ms-row">
        <input class="input" data-ms="${i}" data-f="label" value="${esc(m.label)}" aria-label="Nombre del hito" maxlength="60">
        <input class="input" type="date" data-ms="${i}" data-f="date" value="${m.date}" aria-label="Fecha de ${esc(m.label)}">
      </div>`).join('');

    const cur = currentPhase();
    $('#phases-form').innerHTML = state.settings.phases.map((p, i) => `
      <div class="card phase${cur && cur.id === p.id ? ' current' : ''}">
        <div class="row-between">
          <input class="input" data-ph="${i}" data-f="name" value="${esc(p.name)}" aria-label="Nombre de la fase" maxlength="40">
          ${cur && cur.id === p.id ? '<span class="phase-tag">Actual</span>' : ''}
        </div>
        <div class="phase-dates">
          <label class="field"><span class="lbl">Inicio</span><input class="input" type="date" data-ph="${i}" data-f="start" value="${p.start}"></label>
          <label class="field"><span class="lbl">Fin</span><input class="input" type="date" data-ph="${i}" data-f="end" value="${p.end}"></label>
        </div>
        <div class="phase-goals">
          ${CATS.map((c) => `<label class="field" style="--cat: var(--c-${c.id})"><span class="lbl"><i class="swatch"></i>${c.id === 'toefl' ? 'TOEFL' : c.name} h/sem</span><input class="input" type="number" inputmode="decimal" min="0" max="80" step="0.5" data-ph="${i}" data-f="goal-${c.id}" value="${p.goals[c.id]}"></label>`).join('')}
        </div>
      </div>`).join('');

    $('#about').textContent = `Habit Studies · ${Object.keys(state.entries).length} días registrados`;
  }

  function bindSettings() {
    $('#theme-seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-theme-opt]');
      if (!b) return;
      state.settings.theme = b.dataset.themeOpt;
      save(); applyTheme();
    });

    $('#milestones-form').addEventListener('change', (e) => {
      const i = e.target.dataset.ms; if (i == null) return;
      const m = state.settings.milestones[i];
      const v = e.target.value.trim();
      if (e.target.dataset.f === 'label') m.label = v || m.label;
      else m.date = DATE_RE.test(v) ? v : m.date;
      e.target.value = e.target.dataset.f === 'label' ? m.label : m.date;
      save(); renderHeader(); renderCountdowns(); toast('Guardado');
    });

    $('#phases-form').addEventListener('change', (e) => {
      const i = e.target.dataset.ph; if (i == null) return;
      const p = state.settings.phases[i];
      const f = e.target.dataset.f, v = e.target.value.trim();
      if (f === 'name') p.name = v || p.name;
      else if (f === 'start' || f === 'end') { if (DATE_RE.test(v)) p[f] = v; }
      else if (f.startsWith('goal-')) p.goals[f.slice(5)] = Math.max(0, Math.min(80, Number(v) || 0));
      if (p.start && p.end && p.start > p.end) toast('Ojo: la fecha de inicio es posterior al fin.');
      else toast('Guardado');
      save(); renderHeader(); renderWeek();
    });

    $('#rem-enabled').addEventListener('change', async (e) => {
      if (e.target.checked) {
        const ok = await ensurePermission();
        if (!ok) { e.target.checked = false; renderReminderStatus(); return; }
      }
      state.settings.reminder.enabled = e.target.checked;
      save(); scheduleReminder(); await registerPeriodicSync(); renderReminderStatus();
    });
    $('#rem-time').addEventListener('change', (e) => {
      if (!/^\d{2}:\d{2}$/.test(e.target.value)) return;
      state.settings.reminder.time = e.target.value;
      save(); scheduleReminder(); renderReminderStatus(); toast('Guardado');
    });
    $('#rem-test').addEventListener('click', async () => {
      if (!(await ensurePermission())) return renderReminderStatus();
      const reg = await swReady();
      const opts = { body: 'Así se verá tu recordatorio diario.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'hs-test' };
      if (reg) reg.showNotification('Bloque de estudio', opts);
      else new Notification('Bloque de estudio', opts);
      renderReminderStatus();
    });

    $('#btn-export').addEventListener('click', exportData);
    $('#btn-import').addEventListener('click', () => $('#file-import').click());
    $('#file-import').addEventListener('change', importData);
    $('#btn-reset').addEventListener('click', async () => {
      const ok = await confirmDialog('Restablecer fechas y metas', 'Las fechas clave y las fases vuelven a los valores iniciales. Tu historial de estudio no se toca.', 'Restablecer');
      if (!ok) return;
      const d = DEFAULT_SETTINGS();
      state.settings.milestones = d.milestones;
      state.settings.phases = d.phases;
      save(); renderAll(); toast('Fechas y metas restablecidas');
    });
  }

  /* ---------------------------------------------------------------- export / import */
  function exportData() {
    const payload = { app: 'habit-studies', exportedAt: new Date().toISOString(), ...state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `habit-studies-${todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Respaldo exportado');
  }

  async function importData(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let raw;
    try { raw = JSON.parse(await file.text()); } catch (_) { return toast('Ese archivo no es un JSON válido.'); }
    if (!raw || typeof raw !== 'object' || typeof raw.entries !== 'object' || !raw.settings) return toast('El archivo no parece un respaldo de Habit Studies.');
    const next = normalize(raw);
    const nNew = Object.keys(next.entries).length, nOld = Object.keys(state.entries).length;
    const ok = await confirmDialog('Importar respaldo', `Esto reemplaza tus datos actuales (${nOld} días registrados) por los del respaldo (${nNew} días) y sus fechas y metas.`, 'Importar');
    if (!ok) return;
    state = next;
    save(); selectedDay = todayKey(); heatSelected = null; heatAnimated = false;
    renderAll(); toast(`Respaldo importado · ${nNew} días`);
  }

  /* ---------------------------------------------------------------- reminder */
  let remTimer = null;

  async function swReady() {
    if (!('serviceWorker' in navigator)) return null;
    try { return await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 3000))]); }
    catch (_) { return null; }
  }

  async function ensurePermission() {
    if (!('Notification' in window)) { toast('Este navegador no soporta notificaciones.'); return false; }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') { toast('Notificaciones bloqueadas: actívalas en los ajustes del sitio.'); return false; }
    return (await Notification.requestPermission()) === 'granted';
  }

  function renderReminderStatus() {
    const el = $('#rem-status');
    if (!('Notification' in window)) { el.textContent = 'Este navegador no soporta notificaciones.'; return; }
    const perm = Notification.permission;
    const r = state.settings.reminder;
    if (perm === 'denied') el.textContent = 'Permiso de notificaciones bloqueado en este navegador.';
    else if (!r.enabled) el.textContent = 'Desactivado.';
    else el.textContent = `Te avisaré a las ${r.time} si ese día aún no registraste nada.`;
  }

  function syncReminderToSW() {
    if (!navigator.serviceWorker?.controller) return;
    const t = todayKey();
    navigator.serviceWorker.controller.postMessage({
      type: 'reminder-config',
      reminder: state.settings.reminder,
      doneDay: isDone(t) ? t : null,
    });
  }

  function scheduleReminder() {
    clearTimeout(remTimer);
    const r = state.settings.reminder;
    if (!r.enabled) return;
    const [h, m] = r.time.split(':').map(Number);
    const now = new Date();
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    remTimer = setTimeout(async () => {
      syncReminderToSW();
      navigator.serviceWorker?.controller?.postMessage({ type: 'check-reminder' });
      scheduleReminder();
    }, Math.min(at - now, 2 ** 31 - 1));
  }

  async function registerPeriodicSync() {
    const reg = await swReady();
    if (!reg || !('periodicSync' in reg)) return;
    try {
      if (!state.settings.reminder.enabled) { await reg.periodicSync.unregister('hs-daily-reminder'); return; }
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state === 'granted') await reg.periodicSync.register('hs-daily-reminder', { minInterval: 12 * 60 * 60 * 1000 });
    } catch (_) { /* not installed / unsupported: foreground timer still works */ }
  }

  /* ---------------------------------------------------------------- ui helpers */
  let toastTimer = null;
  function toast(msg, action) {
    const el = $('#toast'), btn = $('#toast-action');
    $('#toast-msg').textContent = msg;
    btn.hidden = !action;
    if (action) { btn.textContent = action.label; btn.onclick = action.run; }
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(toastTimer);
    if (!action) toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function confirmDialog(title, body, okLabel) {
    const dlg = $('#dlg');
    $('#dlg-title').textContent = title;
    $('#dlg-body').textContent = body;
    $('#dlg-ok').textContent = okLabel || 'Aceptar';
    return new Promise((resolve) => {
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
      dlg.returnValue = '';
      dlg.showModal();
    });
  }

  /* ---------------------------------------------------------------- routing */
  function route() {
    const h = location.hash;
    const settings = h.startsWith('#/ajustes');
    $('#view-today').hidden = settings;
    $('#view-settings').hidden = !settings;
    if (settings) {
      renderSettings();
      if (h === '#/ajustes/fechas') requestAnimationFrame(() => $('#sec-fechas').scrollIntoView({ block: 'start' }));
      else window.scrollTo(0, 0);
    } else {
      renderAll();
      window.scrollTo(0, 0);
    }
  }

  function renderAll() {
    applyTheme();
    renderHeader();
    renderBlocks();
    renderWeek();
    renderHeatmap();
    renderCountdowns();
    if (!$('#view-settings').hidden) renderSettings();
  }

  /* ---------------------------------------------------------------- service worker */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Nueva versión disponible', { label: 'Recargar', run: () => nw.postMessage({ type: 'skip-waiting' }) });
          }
        });
      });
      registerPeriodicSync();
    }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.ready.then(() => setTimeout(syncReminderToSW, 300));
  }

  /* ---------------------------------------------------------------- boot */
  let lastDay = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const t = todayKey();
    if (t !== lastDay) { if (selectedDay === lastDay) selectedDay = t; lastDay = t; renderAll(); syncReminderToSW(); }
  });
  $('#day-prev').addEventListener('click', () => { selectedDay = keyOf(addDays(parseKey(selectedDay), -1)); openCat = null; renderBlocks(); });
  $('#day-next').addEventListener('click', () => {
    if (selectedDay >= todayKey()) return;
    selectedDay = keyOf(addDays(parseKey(selectedDay), 1)); openCat = null; renderBlocks();
  });
  window.addEventListener('hashchange', route);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // empty-state illustration: a faint grid with one lit cell (at col 6, row 2)
  $('.empty-grid').innerHTML = Array.from({ length: 50 }, (_, i) => {
    const c = i % 10, r = Math.floor(i / 10);
    if (c === 6 && r === 2) return '';
    const dist = Math.hypot(c - 6, r - 2);
    return `<rect x="${18 + c * 20}" y="${14 + r * 20}" width="16" height="16" rx="4" opacity="${Math.max(0.25, 1 - dist * 0.12).toFixed(2)}"/>`;
  }).join('');

  bindBlocks();
  bindHeatmap();
  bindSettings();
  route();
  scheduleReminder();
  registerSW();
})();
