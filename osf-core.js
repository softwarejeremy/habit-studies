/* Habit Studies — módulo OSF: lógica pura (sin DOM ni almacenamiento).
   Se carga en el navegador (window.OSFCore) y en Node (module.exports) para las pruebas.
   Todas las fechas son claves "YYYY-MM-DD" de calendario local; nunca se parsean como UTC. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OSFCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- dates */
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
  const dow = (k) => parseKey(k).getDay(); // 0 = domingo
  const mondayOf = (k) => addDays(k, -((dow(k) + 6) % 7));
  const within = (k, a, b) => a <= k && k <= b;

  /* ---------------------------------------------------------------- plan lookups */
  const etapa = (plan, id) => plan.etapas.find((e) => e.id === id);
  const etapaDe = (plan, k) => plan.etapas.find((e) => within(k, e.inicio, e.fin)) || null;

  function tipoPorMinutos(plan, min) {
    const t = plan.tipos_de_sesion;
    return Object.keys(t).find((id) => t[id].minutos === min) || null;
  }
  const partesDe = (plan, tipo) => (tipo && plan.tipos_de_sesion[tipo] ? plan.tipos_de_sesion[tipo].partes : []);

  /* ---------------------------------------------------------------- qué toca hoy */
  function sesionDe(plan, k) {
    if (k < plan.meta.inicio || k > plan.meta.fin) return { tipo: 'fuera', fecha: k, antes: k < plan.meta.inicio };
    const e = etapaDe(plan, k);
    if (!e) return { tipo: 'libre', fecha: k, texto: 'Sin sesión programada.' };

    if (e.bloques) {
      for (const b of e.bloques) {
        const s = b.sesiones.find((x) => x.fecha === k);
        if (!s) continue;
        const clase = tipoPorMinutos(plan, s.minutos);
        return {
          tipo: 'sesion', subtipo: 'tema', etapa: e.id, id: s.id, fecha: k, inicio: k, fin: k,
          minutos: s.minutos, titulo: '', texto: s.texto, clase, partes: partesDe(plan, clase), bloque: b,
        };
      }
      return { tipo: 'libre', etapa: e.id, fecha: k, texto: 'Sin sesión programada.' };
    }

    if (e.tramos) {
      const t = e.tramos.find((x) => within(k, x.inicio, x.fin));
      if (!t) return { tipo: 'libre', etapa: e.id, fecha: k, texto: 'Sin sesión programada.' };
      return {
        tipo: t.descanso ? 'descanso' : 'tramo', etapa: e.id, id: t.id, fecha: k, inicio: t.inicio, fin: t.fin,
        minutos: null, titulo: '', texto: t.texto, partes: [],
      };
    }

    const w = e.semanas.find((x) => within(k, x.inicio, x.fin));
    if (!w) return { tipo: 'libre', etapa: e.id, fecha: k, texto: 'Sin sesión programada.' };
    const fase2 = plan.hitos.find((h) => h.id === 'fase2');
    if (k === (fase2 ? fase2.fecha : plan.meta.fin)) return { tipo: 'fase2', etapa: e.id, fecha: k, semana: w, hito: fase2 || null };
    if (w.dias_libres.includes(k)) return { tipo: 'libre', etapa: e.id, fecha: k, semana: w, texto: 'Día libre.' };

    const base = { tipo: 'sesion', etapa: e.id, id: `${w.id}:${k}`, fecha: k, inicio: k, fin: k, semana: w };
    const fin = plan.tipos_de_sesion.fin_de_semana, sem = plan.tipos_de_sesion.entre_semana;
    const sim = (e.simulacros_completos || []).find((x) => x.fecha === k);
    if (sim) return { ...base, subtipo: 'simulacro_completo', simulacro: sim, minutos: fin.minutos, titulo: `Simulacro ${sim.n} completo`, texto: sim.texto, clase: 'fin_de_semana', partes: [] };
    const d = dow(k);
    if (d === 6) return { ...base, subtipo: 'simulacro_parcial', minutos: fin.minutos, titulo: 'Simulacro parcial', texto: w.texto, clase: 'fin_de_semana', partes: fin.partes };
    if (d === 0) return { ...base, subtipo: 'correccion', minutos: fin.minutos, titulo: 'Corrección y reintentos', texto: 'Corrección del simulacro y reintento de los errores pendientes.', clase: 'fin_de_semana', partes: fin.partes };
    return { ...base, subtipo: 'tema', minutos: sem.minutos, titulo: '', texto: w.texto, clase: 'entre_semana', partes: sem.partes };
  }

  /* Todo lo que se puede marcar como hecho, en orden cronológico.
     Un tramo de varios días es un solo elemento; libres y descansos no aparecen. */
  function sesionesDelPlan(plan) {
    const out = [];
    for (const e of plan.etapas) {
      if (e.bloques) {
        for (const b of e.bloques) for (const s of b.sesiones) out.push(sesionDe(plan, s.fecha));
      } else if (e.tramos) {
        for (const t of e.tramos) if (!t.descanso) out.push(sesionDe(plan, t.inicio));
      } else if (e.semanas) {
        for (const w of e.semanas) {
          for (let k = w.inicio; k <= w.fin; k = addDays(k, 1)) {
            const s = sesionDe(plan, k);
            if (s.tipo === 'sesion') out.push(s);
          }
        }
      }
    }
    return out;
  }

  const hechas = (avance) => (avance && avance.sesiones) || {};

  function estadoDe(item, avance, hoy) {
    if (hechas(avance)[item.id]) return 'hecha';
    if (within(hoy, item.inicio, item.fin)) return 'hoy';
    return item.fin < hoy ? 'atrasada' : 'pendiente';
  }

  const atrasadas = (plan, avance, hoy) => sesionesDelPlan(plan).filter((s) => estadoDe(s, avance, hoy) === 'atrasada');

  /* Minutos de la semana (lunes a domingo) que contiene `hoy`, contados en el día en que se marcó.
     Sin minutos reales cuenta el objetivo de la sesión; un tramo sin minutos no suma. */
  function minutosSemana(plan, avance, hoy) {
    const lun = mondayOf(hoy), dom = addDays(lun, 6);
    const objetivo = new Map(sesionesDelPlan(plan).map((s) => [s.id, s.minutos || 0]));
    let total = 0;
    for (const [id, r] of Object.entries(hechas(avance))) {
      if (!r || !within(r.hechaEl, lun, dom)) continue;
      total += r.min > 0 ? r.min : objetivo.get(id) || 0;
    }
    return { total, objetivo: plan.meta.minutos_semana_objetivo, inicio: lun, fin: dom };
  }

  /* ---------------------------------------------------------------- hitos */
  function hitoInfo(h, hoy) {
    if (h.inicio && h.fin) {
      if (hoy < h.inicio) return { periodo: true, estado: 'futuro', objetivo: h.inicio, dias: diffDays(hoy, h.inicio) };
      if (hoy <= h.fin) return { periodo: true, estado: 'abierto', objetivo: h.fin, dias: diffDays(hoy, h.fin) };
      return { periodo: true, estado: 'paso', objetivo: h.fin, dias: diffDays(hoy, h.fin) };
    }
    const dias = diffDays(hoy, h.fecha);
    return { periodo: false, estado: dias < 0 ? 'paso' : 'futuro', objetivo: h.fecha, dias };
  }

  function siguienteHito(plan, hoy) {
    const vivos = plan.hitos.map((h) => ({ hito: h, ...hitoInfo(h, hoy) })).filter((x) => x.estado !== 'paso');
    vivos.sort((a, b) => a.objetivo.localeCompare(b.objetivo));
    return vivos[0] || null;
  }

  /* Hitos con confirmación pendiente cuya fecha límite está a 7 días o menos (o ya pasó). */
  function hitosUrgentes(plan, avance, hoy) {
    const ok = (avance && avance.hitos) || {};
    return plan.hitos
      .filter((h) => h.requiere_confirmacion && !ok[h.id])
      .map((h) => ({ hito: h, limite: h.fin || h.fecha, dias: diffDays(hoy, h.fin || h.fecha) }))
      .filter((x) => x.dias <= 7 && (!x.hito.inicio || hoy >= x.hito.inicio));
  }

  /* ---------------------------------------------------------------- temario */
  function gruposTemario(plan) {
    const grupos = [];
    for (const t of plan.temario) {
      let g = grupos.find((x) => x.contenido === t.contenido);
      if (!g) grupos.push(g = { contenido: t.contenido, temas: [] });
      g.temas.push(t);
    }
    return grupos;
  }

  function avanceTemario(temas, avance) {
    const m = (avance && avance.temario) || {};
    let hechas = 0, total = 0;
    for (const t of temas) {
      total += 1; if (m[t.id] && m[t.id].visto) hechas += 1;
      if (t.etapa3_semanas) { total += 1; if (m[t.id] && m[t.id].profundizado) hechas += 1; }
    }
    return { hechas, total };
  }

  return {
    pad, keyOf, parseKey, addDays, diffDays, dow, mondayOf,
    etapa, etapaDe, sesionDe, sesionesDelPlan, estadoDe, atrasadas, minutosSemana,
    hitoInfo, siguienteHito, hitosUrgentes, gruposTemario, avanceTemario,
  };
});
