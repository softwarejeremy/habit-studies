/* Pruebas de "qué toca hoy" del módulo OSF.  Ejecutar: node --test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../osf-core.js');
const plan = require('../data/osf-plan.json');

const s = (k) => C.sesionDe(plan, k);

test('fuera del plan antes y después', () => {
  assert.equal(s('2026-10-02').tipo, 'fuera');
  assert.equal(s('2027-02-07').tipo, 'fuera');
});

test('etapa 1: la sesión cuya fecha es hoy', () => {
  let x = s('2026-10-03');
  assert.equal(x.tipo, 'sesion'); assert.equal(x.minutos, 180);
  assert.ok(x.texto.startsWith('Inscribirte en jovenestalento.edu.sv/registro'));
  assert.deepEqual(x.partes.map((p) => p.minutos), [60, 90, 30]);

  x = s('2026-10-07');
  assert.equal(x.minutos, 105);
  assert.equal(x.texto, 'Hidrodinámica: caudal, ecuación de continuidad, principio de Bernoulli.');
  assert.deepEqual(x.partes.map((p) => p.minutos), [30, 60, 15]);

  x = s('2026-10-24');
  assert.equal(x.minutos, 180);
  assert.ok(x.texto.startsWith('Interferencia, difracción y polarización'));
});

test('etapa 2: el tramo que contiene hoy', () => {
  let x = s('2026-10-25');
  assert.deepEqual([x.tipo, x.inicio, x.fin], ['tramo', '2026-10-25', '2026-10-25']);
  assert.ok(x.texto.startsWith('Descargar la prueba y leerla completa'));

  x = s('2026-10-30');
  assert.deepEqual([x.tipo, x.inicio, x.fin], ['tramo', '2026-10-29', '2026-11-01']);
  assert.ok(x.texto.startsWith('Sección de problemas'));

  x = s('2026-11-05');
  assert.deepEqual([x.tipo, x.inicio, x.fin], ['tramo', '2026-11-05', '2026-11-05']);
  assert.ok(x.texto.startsWith('Enviar la prueba y guardar el comprobante'));

  assert.equal(s('2026-11-08').tipo, 'descanso');
});

test('etapa 3: regla diaria', () => {
  let x = s('2026-11-11');
  assert.deepEqual([x.tipo, x.subtipo, x.minutos, x.semana.n, x.semana.area], ['sesion', 'tema', 105, 1, 'Mecánica']);
  assert.equal(x.texto, plan.etapas[2].semanas[0].texto);

  x = s('2026-11-14');
  assert.deepEqual([x.subtipo, x.minutos, x.semana.n, x.semana.area], ['simulacro_parcial', 180, 1, 'Mecánica']);

  x = s('2026-11-15');
  assert.deepEqual([x.subtipo, x.minutos, x.semana.n, x.semana.area], ['correccion', 180, 1, 'Mecánica']);
});

test('etapa 3: días libres', () => {
  let x = s('2026-12-24');
  assert.deepEqual([x.tipo, x.semana.n], ['libre', 7]);
  x = s('2027-01-01');
  assert.deepEqual([x.tipo, x.semana.n], ['libre', 8]);
  x = s('2027-02-05');
  assert.deepEqual([x.tipo, x.semana.n], ['libre', 13]);
});

test('etapa 3: simulacros completos ganan a sábado y domingo', () => {
  let x = s('2027-01-23');
  assert.deepEqual([x.subtipo, x.minutos, x.simulacro.n, x.semana.n], ['simulacro_completo', 180, 1, 11]);
  x = s('2027-01-24');
  assert.deepEqual([x.subtipo, x.minutos, x.semana.n, x.semana.area], ['correccion', 180, 11, 'Magnitudes y simulacro']);
  x = s('2027-01-31');
  assert.deepEqual([x.subtipo, x.minutos, x.simulacro.n, x.semana.n], ['simulacro_completo', 180, 3, 12]);
});

test('6 de febrero: Fase 2, sin sesión', () => {
  const x = s('2027-02-06');
  assert.equal(x.tipo, 'fase2');
  assert.equal(x.hito.id, 'fase2');
  assert.equal(x.id, undefined);
});

test('conteos del plan', () => {
  assert.equal(plan.temario.length, 43);
  assert.equal(plan.temario.filter((t) => t.etapa3_semanas === null).length, 7);
  const items = C.sesionesDelPlan(plan);
  assert.equal(items.filter((i) => i.etapa === 'e1').length, 22);
  assert.equal(plan.etapas[2].semanas.length, 13);
  assert.equal(items.filter((i) => i.etapa === 'e2').length, 7); // 8 tramos menos el descanso
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
});

test('a las 23:30 hora local sigue siendo el mismo día', () => {
  assert.equal(C.keyOf(new Date(2026, 9, 7, 23, 30)), '2026-10-07');
  assert.equal(C.keyOf(C.parseKey('2026-10-07')), '2026-10-07');
});

test('atrasos: un tramo cuenta una sola vez; libres y descansos no cuentan', () => {
  const vacio = { sesiones: {} };
  assert.equal(C.atrasadas(plan, vacio, '2026-10-03').length, 0);
  assert.equal(C.atrasadas(plan, vacio, '2026-10-05').length, 2);
  // 22 sesiones de etapa 1 + 7 tramos, sin el descanso del 8 de noviembre
  assert.equal(C.atrasadas(plan, vacio, '2026-11-09').length, 29);
  // dentro de un tramo abierto (29 oct – 1 nov) todavía no hay atraso por ese tramo
  const dentro = C.atrasadas(plan, vacio, '2026-10-31').map((x) => x.id);
  assert.ok(!dentro.includes('e2-2026-10-29'));
  // semana 7 de etapa 3: 24 y 25 de diciembre no generan atraso
  const ids = C.atrasadas(plan, vacio, '2026-12-28').map((x) => x.id);
  assert.ok(ids.includes('e3-s7:2026-12-23'));
  assert.ok(!ids.includes('e3-s7:2026-12-24') && !ids.includes('e3-s7:2026-12-25'));
  const hecho = { sesiones: { 'e1-2026-10-03': { hechaEl: '2026-10-03', min: null, nota: '' } } };
  assert.equal(C.atrasadas(plan, hecho, '2026-10-05').length, 1);
});

test('minutos de la semana', () => {
  const av = { sesiones: {
    'e1-2026-10-05': { hechaEl: '2026-10-05', min: null, nota: '' },  // objetivo 105
    'e1-2026-10-06': { hechaEl: '2026-10-06', min: 90, nota: '' },
    'e1-2026-10-03': { hechaEl: '2026-10-03', min: 180, nota: '' },   // semana anterior
  } };
  const m = C.minutosSemana(plan, av, '2026-10-07');
  assert.deepEqual([m.total, m.objetivo, m.inicio, m.fin], [195, 885, '2026-10-05', '2026-10-11']);
});

test('hitos: periodos y siguiente hito', () => {
  const ins = plan.hitos[0];
  assert.deepEqual(C.hitoInfo(ins, '2026-09-29'), { periodo: true, estado: 'futuro', objetivo: '2026-10-01', dias: 2 });
  assert.deepEqual(C.hitoInfo(ins, '2026-10-03'), { periodo: true, estado: 'abierto', objetivo: '2026-10-31', dias: 28 });
  assert.equal(C.hitoInfo(ins, '2026-11-01').estado, 'paso');
  assert.equal(C.siguienteHito(plan, '2026-10-03').hito.id, 'fin-clases');
  assert.equal(C.siguienteHito(plan, '2026-10-25').hito.id, 'fase1-abre');
  assert.equal(C.siguienteHito(plan, '2027-02-06').hito.id, 'fase2');
  assert.equal(C.siguienteHito(plan, '2027-02-07'), null);
  assert.deepEqual(C.hitosUrgentes(plan, { hitos: {} }, '2026-10-03').map((x) => x.hito.id), []);
  assert.deepEqual(C.hitosUrgentes(plan, { hitos: {} }, '2026-10-24').map((x) => x.hito.id), ['inscripcion']);
  assert.deepEqual(C.hitosUrgentes(plan, { hitos: { inscripcion: true } }, '2026-10-30').map((x) => x.hito.id), ['fase1-envio']);
});
