# Módulo nuevo: Olimpiada de Física (OSF)

Quiero añadir un módulo nuevo a esta app: el seguimiento de mi plan de estudio para la Olimpiada Salvadoreña de Física (OSF). La app ya tiene un módulo para mi plan de la beca. El módulo nuevo convive con ese y debe sentirse parte de la misma app: misma navegación, mismos componentes, mismo estilo.

El plan ya está decidido y viene completo en el JSON del final. Tu trabajo es construir el módulo que lo muestra y registra mi avance, no rediseñar el plan.

## Antes de escribir código

1. Lee el repo. Identifica el stack, la navegación, y cómo el módulo de la beca define sus datos, guarda el progreso y arma sus pantallas.
2. Dame un resumen corto: qué encontraste, qué archivos vas a crear o tocar, y dónde entra el módulo en la navegación. Espera mi confirmación antes de implementar.
3. Si algo de lo que pido no encaja con cómo está hecha la app, dilo en ese resumen y propón la alternativa. No lo fuerces.

## Reglas

- Reutiliza los componentes, estilos, manejo de estado y persistencia del módulo de la beca. No agregues dependencias salvo que no haya alternativa; si propones una, explica por qué.
- No cambies el comportamiento del módulo de la beca ni sus datos guardados. Si la persistencia tiene esquema o versión, la migración solo agrega.
- Guarda el JSON del final como archivo de datos del módulo, tal cual. No resumas ni reescribas sus textos. El avance del usuario se guarda aparte y referencia los `id` del JSON, para que yo pueda reemplazar el JSON sin perder mi avance.
- Las fechas del plan son días de calendario en America/El_Salvador (UTC−6, sin horario de verano). Calcula "hoy" con la fecha local del teléfono. No conviertas `"YYYY-MM-DD"` con un parser que lo interprete como UTC: eso corre el día.
- La interfaz va en español y se usa sobre todo en el teléfono.
- Si la app ya tiene notificaciones locales, úsalas para los hitos. Si no las tiene, no las agregues: avísame y lo decidimos.

## Qué toca hoy

Esta función es el centro del módulo. Escríbela pura (recibe una fecha, devuelve la sesión) para poder probarla.

- **Etapa 1** (3 – 24 oct): la sesión cuya `fecha` es hoy.
- **Etapa 2** (25 oct – 8 nov): el tramo cuyo rango `inicio`–`fin` contiene hoy. Si `descanso` es true, se muestra como día de descanso.
- **Etapa 3** (9 nov – 6 feb): la semana cuyo rango contiene hoy, y dentro de ella, en este orden:
  1. Si hoy es el 6 de febrero: es la Fase 2, no hay sesión.
  2. Si hoy está en `dias_libres`: día libre.
  3. Si hoy aparece en `simulacros_completos`: ese simulacro, 180 min.
  4. Sábado: simulacro parcial del tema de la semana, 180 min.
  5. Domingo: corrección y reintento de errores pendientes, 180 min.
  6. Lunes a viernes: el `texto` de la semana, 105 min.
- **Fuera del plan**: antes del 3 de octubre de 2026 o después del 6 de febrero de 2027 no hay sesión; muestra un estado vacío que lo diga.

Una sesión pasada que no marqué como hecha cuenta como atrasada. Los días libres, los descansos y los tramos de varios días de la Etapa 2 no generan atrasos por cada día: un tramo se marca hecho una sola vez.

## Pantallas

### Hoy
- La sesión de hoy: texto, duración objetivo y las partes de la sesión según `tipos_de_sesion` (entre semana 30/60/15, fin de semana 60/90/30).
- Acción para marcarla hecha, con minutos reales opcionales y una nota opcional.
- Cuenta regresiva al siguiente hito que aún no ha pasado.
- Sesiones atrasadas, si hay, con acceso directo para marcarlas.
- Minutos estudiados esta semana (lunes a domingo) frente al objetivo `minutos_semana_objetivo`.

### Plan
- Las tres etapas en orden. Etapa 1 por bloques y días, Etapa 2 por tramos, Etapa 3 por semanas con su `nota` y sus días libres.
- Cada elemento muestra su estado: hecha, hoy, pendiente o atrasada.
- Al abrir, la vista queda posicionada en lo de hoy.

### Temario
- Los 43 subcontenidos agrupados por `contenido`, en el orden del JSON.
- Cada uno tiene dos marcas independientes: **visto** (octubre) y **profundizado** (Etapa 3). Los 7 que tienen `etapa3_semanas: null` solo llevan la marca de visto y la etiqueta "solo Fase 1".
- Cada subcontenido indica cuándo le toca: los días de `octubre` y las semanas de `etapa3_semanas`.
- Avance por contenido y avance total.

### Errores
- Registrar un problema fallado: fecha (hoy por defecto), subcontenido del temario, causa (una de `causas_de_error`), descripción breve y de dónde salió el problema (opcional).
- Cada error está pendiente o resuelto. Resolverlo guarda la fecha del reintento.
- Lista de pendientes ordenada del más antiguo al más reciente, con filtro por contenido y por causa.
- Conteo de errores por causa y por contenido, para ver dónde fallo más.

### Simulacros
- Registrar un simulacro: fecha, tipo (mini, parcial o completo), tema, puntaje por problema (cantidad de problemas variable, puntaje obtenido y máximo), minutos usados y notas.
- Historial ordenado por fecha con el porcentaje total de cada uno.
- Los tres de `simulacros_completos` aparecen ya programados en su fecha, pendientes de registrar.

### Fechas
- Los hitos del JSON en orden, con los días que faltan o "pasó". Un hito con `inicio` y `fin` es un periodo: mientras está abierto se muestra como "abierto" y su cuenta regresiva va hacia `fin`.
- Los que tienen `requiere_confirmacion` llevan una casilla: "ya me inscribí" y "ya envié la prueba". Mientras no estén marcadas y la fecha se acerque (7 días o menos), se destacan en Hoy.

## Pruebas

Si el repo ya tiene pruebas, agrega pruebas para la función de "qué toca hoy" con estos casos. Si no tiene, verifícalos a mano o con un script temporal y dime el resultado.

| Fecha | Debe devolver |
|---|---|
| 2026-10-02 (vie) | fuera del plan |
| 2026-10-03 (sáb) | 180 min · "Inscribirte en jovenestalento.edu.sv/registro…" |
| 2026-10-07 (mié) | 105 min · "Hidrodinámica: caudal, ecuación de continuidad, principio de Bernoulli" |
| 2026-10-24 (sáb) | 180 min · "Interferencia, difracción y polarización…" |
| 2026-10-25 (dom) | tramo 2026-10-25 a 2026-10-25 · "Descargar la prueba y leerla completa…" |
| 2026-10-30 (vie) | tramo 2026-10-29 a 2026-11-01 · "Sección de problemas…" |
| 2026-11-05 (jue) | tramo 2026-11-05 a 2026-11-05 · "Enviar la prueba y guardar el comprobante…" |
| 2026-11-08 (dom) | día de descanso |
| 2026-11-11 (mié) | 105 min · S1 Mecánica |
| 2026-11-14 (sáb) | 180 min · simulacro parcial · S1 Mecánica |
| 2026-11-15 (dom) | 180 min · corrección y reintentos · S1 Mecánica |
| 2026-12-24 (jue) | día libre · S7 |
| 2027-01-01 (vie) | día libre · S8 |
| 2027-01-23 (sáb) | 180 min · Simulacro 1 completo · S11 |
| 2027-01-24 (dom) | 180 min · corrección y reintentos · S11 Magnitudes y simulacro |
| 2027-01-31 (dom) | 180 min · Simulacro 3 completo · S12 |
| 2027-02-05 (vie) | día libre · S13 |
| 2027-02-06 (sáb) | Fase 2 (hito), sin sesión |
| 2027-02-07 (dom) | fuera del plan |

Además:
- El temario muestra 43 subcontenidos, 7 de ellos marcados "solo Fase 1".
- La Etapa 1 tiene 22 sesiones y la Etapa 3 tiene 13 semanas.
- Con el teléfono en El Salvador a las 23:30, "hoy" sigue siendo el mismo día de calendario.
- El módulo de la beca abre y conserva sus datos igual que antes.
- El build y el lint del proyecto pasan.

## Al terminar

Dime qué archivos creaste o cambiaste, cómo abrir el módulo y cómo cambiar la fecha simulada para probar otros días. Si dejaste algo sin hacer, dilo.

## Datos del plan

```json
{
  "meta": {
    "nombre": "Plan OSF 2026",
    "zona_horaria": "America/El_Salvador",
    "inicio": "2026-10-03",
    "fin": "2027-02-06",
    "minutos_semana_objetivo": 885,
    "supuestos": [
      "En la Fase 2 se asume la Prueba A; el temario no dice qué grado corresponde a cada prueba.",
      "Las horas de noviembre a febrero usan el mismo horario que octubre."
    ]
  },
  "hitos": [
    {
      "id": "inscripcion",
      "inicio": "2026-10-01",
      "fin": "2026-10-31",
      "titulo": "Inscripción",
      "detalle": "jovenestalento.edu.sv/registro. La página oficial también menciona el 7 de noviembre como cierre; se usa el 31 de octubre por seguridad.",
      "requiere_confirmacion": true
    },
    {
      "id": "fin-clases",
      "fecha": "2026-10-24",
      "titulo": "Terminan mis clases",
      "detalle": ""
    },
    {
      "id": "fase1-abre",
      "fecha": "2026-10-25",
      "titulo": "Abre la Fase 1",
      "detalle": "Virtual y asincrónica: sección teórica y sección de problemas."
    },
    {
      "id": "fase1-envio",
      "fecha": "2026-11-05",
      "titulo": "Enviar la prueba de la Fase 1",
      "detalle": "Fecha propia del plan, dos días antes del cierre oficial.",
      "requiere_confirmacion": true
    },
    {
      "id": "fase1-cierra",
      "fecha": "2026-11-07",
      "titulo": "Cierre oficial de la Fase 1",
      "detalle": "Último día para enviar la prueba."
    },
    {
      "id": "convocatoria",
      "fecha": "2027-01-23",
      "titulo": "Convocatoria a la Fase 2",
      "detalle": "Llega por correo electrónico. Revisar también spam."
    },
    {
      "id": "fase2",
      "fecha": "2027-02-06",
      "titulo": "Fase 2",
      "detalle": "Presencial, seis problemas. Se asume Prueba A (bachillerato)."
    }
  ],
  "tipos_de_sesion": {
    "entre_semana": {
      "minutos": 105,
      "partes": [
        {
          "minutos": 30,
          "texto": "Teoría"
        },
        {
          "minutos": 60,
          "texto": "Problemas"
        },
        {
          "minutos": 15,
          "texto": "Errores y fórmulas"
        }
      ]
    },
    "fin_de_semana": {
      "minutos": 180,
      "partes": [
        {
          "minutos": 60,
          "texto": "Cerrar el tema"
        },
        {
          "minutos": 90,
          "texto": "Set con reloj"
        },
        {
          "minutos": 30,
          "texto": "Corrección"
        }
      ]
    }
  },
  "etapas": [
    {
      "id": "e1",
      "nombre": "Cubrir todo el temario de bachillerato",
      "inicio": "2026-10-03",
      "fin": "2026-10-24",
      "bloques": [
        {
          "nombre": "Arranque",
          "tema": "Magnitudes y diagnóstico",
          "sesiones": [
            {
              "id": "e1-2026-10-03",
              "fecha": "2026-10-03",
              "minutos": 180,
              "texto": "Inscribirte en jovenestalento.edu.sv/registro. Magnitudes físicas: Sistema Internacional, cifras y conversiones, error en la medida (absoluto, relativo, propagación), instrumentos de medición."
            },
            {
              "id": "e1-2026-10-04",
              "fecha": "2026-10-04",
              "minutos": 180,
              "texto": "Diagnóstico de mecánica con reloj: 8 problemas de vectores, movimiento en 1 y 2 dimensiones, rotación, fuerza y torque, momento lineal, energía y potencia. Lo que falle pasa a la lista de repaso de los domingos."
            }
          ]
        },
        {
          "nombre": "Semana 1",
          "tema": "Fluidos y calor",
          "sesiones": [
            {
              "id": "e1-2026-10-05",
              "fecha": "2026-10-05",
              "minutos": 105,
              "texto": "Densidad, presión y teorema fundamental de la hidrostática."
            },
            {
              "id": "e1-2026-10-06",
              "fecha": "2026-10-06",
              "minutos": 105,
              "texto": "Principio de Pascal (prensa hidráulica) y principio de Arquímedes (empuje, flotación)."
            },
            {
              "id": "e1-2026-10-07",
              "fecha": "2026-10-07",
              "minutos": 105,
              "texto": "Hidrodinámica: caudal, ecuación de continuidad, principio de Bernoulli."
            },
            {
              "id": "e1-2026-10-08",
              "fecha": "2026-10-08",
              "minutos": 105,
              "texto": "Teorema de Torricelli. Set mixto de fluidos."
            },
            {
              "id": "e1-2026-10-09",
              "fecha": "2026-10-09",
              "minutos": 105,
              "texto": "Temperatura y escalas. Propiedades térmicas de los materiales: dilatación y conducción."
            },
            {
              "id": "e1-2026-10-10",
              "fecha": "2026-10-10",
              "minutos": 180,
              "texto": "Cambios de temperatura y fase: calor específico, calor latente, calorimetría. Set de problemas con reloj."
            },
            {
              "id": "e1-2026-10-11",
              "fecha": "2026-10-11",
              "minutos": 180,
              "texto": "Ley cero, procesos termodinámicos (isobárico, isocórico, isotérmico, adiabático) y primera ley. Mini simulacro de fluidos y calor. Dos problemas de mecánica."
            }
          ]
        },
        {
          "nombre": "Semana 2",
          "tema": "Electricidad y magnetismo",
          "sesiones": [
            {
              "id": "e1-2026-10-12",
              "fecha": "2026-10-12",
              "minutos": 105,
              "texto": "Carga eléctrica, ley de Coulomb y campo eléctrico."
            },
            {
              "id": "e1-2026-10-13",
              "fecha": "2026-10-13",
              "minutos": 105,
              "texto": "Magnitudes de la electricidad: potencial, corriente, resistencia, potencia. Ley de Ohm."
            },
            {
              "id": "e1-2026-10-14",
              "fecha": "2026-10-14",
              "minutos": 105,
              "texto": "Circuitos en serie, paralelo y mixtos. Leyes de Kirchhoff."
            },
            {
              "id": "e1-2026-10-15",
              "fecha": "2026-10-15",
              "minutos": 105,
              "texto": "Dispositivos electrónicos (resistor, capacitor, diodo, LED, transistor) y circuito eléctrico del hogar (corriente alterna, consumo en kWh, protecciones)."
            },
            {
              "id": "e1-2026-10-16",
              "fecha": "2026-10-16",
              "minutos": 105,
              "texto": "Magnetismo: campo magnético, fuerza sobre cargas y sobre corrientes."
            },
            {
              "id": "e1-2026-10-17",
              "fecha": "2026-10-17",
              "minutos": 180,
              "texto": "Inducción electromagnética (flujo, Faraday, Lenz) y ondas electromagnéticas (espectro, c = λf). Set de problemas con reloj."
            },
            {
              "id": "e1-2026-10-18",
              "fecha": "2026-10-18",
              "minutos": 180,
              "texto": "Mini simulacro de electricidad y magnetismo y corrección. Dos problemas de mecánica."
            }
          ]
        },
        {
          "nombre": "Semana 3",
          "tema": "Ondas y óptica · última semana de clases",
          "sesiones": [
            {
              "id": "e1-2026-10-19",
              "fecha": "2026-10-19",
              "minutos": 105,
              "texto": "Movimiento armónico simple: resorte y péndulo, periodo, energía."
            },
            {
              "id": "e1-2026-10-20",
              "fecha": "2026-10-20",
              "minutos": 105,
              "texto": "Movimiento ondulatorio: v = λf, ondas en cuerdas, superposición, ondas estacionarias."
            },
            {
              "id": "e1-2026-10-21",
              "fecha": "2026-10-21",
              "minutos": 105,
              "texto": "Sonido: intensidad y decibeles, resonancia, efecto Doppler."
            },
            {
              "id": "e1-2026-10-22",
              "fecha": "2026-10-22",
              "minutos": 105,
              "texto": "Reflexión y refracción de la luz: ley de Snell, reflexión total interna."
            },
            {
              "id": "e1-2026-10-23",
              "fecha": "2026-10-23",
              "minutos": 105,
              "texto": "Espejos y lentes: ecuación, aumento, trazado de rayos."
            },
            {
              "id": "e1-2026-10-24",
              "fecha": "2026-10-24",
              "minutos": 180,
              "texto": "Interferencia, difracción y polarización. Dispersión y descomposición de la luz. Cerrar la hoja de fórmulas de todo el temario."
            }
          ]
        }
      ]
    },
    {
      "id": "e2",
      "nombre": "Resolver la Fase 1",
      "inicio": "2026-10-25",
      "fin": "2026-11-08",
      "tramos": [
        {
          "id": "e2-2026-10-25",
          "inicio": "2026-10-25",
          "fin": "2026-10-25",
          "texto": "Descargar la prueba y leerla completa. Clasificar cada pregunta por tema y dificultad. No resolver todavía. Si quedó óptica pendiente, se termina entre hoy y el martes.",
          "descanso": false
        },
        {
          "id": "e2-2026-10-26",
          "inicio": "2026-10-26",
          "fin": "2026-10-28",
          "texto": "Sección teórica. Repasar el tema antes de responder y escribir la justificación, no solo la respuesta.",
          "descanso": false
        },
        {
          "id": "e2-2026-10-29",
          "inicio": "2026-10-29",
          "fin": "2026-11-01",
          "texto": "Sección de problemas. Primero los directos. A cada problema difícil, dos intentos en días distintos.",
          "descanso": false
        },
        {
          "id": "e2-2026-11-02",
          "inicio": "2026-11-02",
          "fin": "2026-11-03",
          "texto": "Problemas pendientes. Revisar unidades, cifras significativas y órdenes de magnitud en todas las respuestas.",
          "descanso": false
        },
        {
          "id": "e2-2026-11-04",
          "inicio": "2026-11-04",
          "fin": "2026-11-04",
          "texto": "Pasar todo en limpio según las instrucciones del correo de la olimpiada.",
          "descanso": false
        },
        {
          "id": "e2-2026-11-05",
          "inicio": "2026-11-05",
          "fin": "2026-11-05",
          "texto": "Enviar la prueba y guardar el comprobante. Quedan dos días de margen.",
          "descanso": false
        },
        {
          "id": "e2-2026-11-06",
          "inicio": "2026-11-06",
          "fin": "2026-11-07",
          "texto": "Colchón por fallas técnicas. El sábado 7 es el último día para entregar.",
          "descanso": false
        },
        {
          "id": "e2-2026-11-08",
          "inicio": "2026-11-08",
          "fin": "2026-11-08",
          "texto": "Descanso.",
          "descanso": true
        }
      ]
    },
    {
      "id": "e3",
      "nombre": "Preparar la Fase 2",
      "inicio": "2026-11-09",
      "fin": "2027-02-06",
      "regla_diaria": {
        "lunes_a_viernes": "Tema de la semana, sesión entre_semana.",
        "sabado": "Simulacro parcial del tema de la semana, sesión fin_de_semana.",
        "domingo": "Corrección del simulacro y reintento de los errores pendientes, sesión fin_de_semana."
      },
      "semanas": [
        {
          "id": "e3-s1",
          "n": 1,
          "inicio": "2026-11-09",
          "fin": "2026-11-15",
          "area": "Mecánica",
          "texto": "Vectores. Magnitudes físicas del movimiento y tipos de movimiento. Movimiento en 1 y 2 dimensiones: tiro parabólico, movimiento relativo.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s2",
          "n": 2,
          "inicio": "2026-11-16",
          "fin": "2026-11-22",
          "area": "Mecánica",
          "texto": "Fuerza: leyes de Newton, fricción, poleas, plano inclinado, movimiento circular.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s3",
          "n": 3,
          "inicio": "2026-11-23",
          "fin": "2026-11-29",
          "area": "Mecánica",
          "texto": "Movimiento de rotación y torque. Momento lineal y colisiones.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s4",
          "n": 4,
          "inicio": "2026-11-30",
          "fin": "2026-12-06",
          "area": "Mecánica",
          "texto": "Energía y potencia mecánica. Teorema del trabajo y la energía. Conservación de la energía mecánica.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s5",
          "n": 5,
          "inicio": "2026-12-07",
          "fin": "2026-12-13",
          "area": "Fluidos",
          "texto": "Hidrostática e hidrodinámica a nivel de problema largo: Arquímedes, Pascal, Bernoulli, Torricelli.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s6",
          "n": 6,
          "inicio": "2026-12-14",
          "fin": "2026-12-20",
          "area": "Calor y temperatura",
          "texto": "Temperatura, propiedades térmicas de los materiales, cambios de temperatura y fase.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s7",
          "n": 7,
          "inicio": "2026-12-21",
          "fin": "2026-12-27",
          "area": "Calor y temperatura",
          "texto": "Procesos termodinámicos, ley cero y primera ley de la termodinámica.",
          "nota": "24 y 25 libres",
          "dias_libres": [
            "2026-12-24",
            "2026-12-25"
          ]
        },
        {
          "id": "e3-s8",
          "n": 8,
          "inicio": "2026-12-28",
          "fin": "2027-01-03",
          "area": "Ondas mecánicas",
          "texto": "Movimiento armónico simple. Movimiento ondulatorio y sonido.",
          "nota": "31 dic y 1 ene libres",
          "dias_libres": [
            "2026-12-31",
            "2027-01-01"
          ]
        },
        {
          "id": "e3-s9",
          "n": 9,
          "inicio": "2027-01-04",
          "fin": "2027-01-10",
          "area": "Electricidad y magnetismo",
          "texto": "Carga y campo eléctrico. Corriente eléctrica y circuitos.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s10",
          "n": 10,
          "inicio": "2027-01-11",
          "fin": "2027-01-17",
          "area": "Electricidad y magnetismo",
          "texto": "Campos magnéticos, inducción electromagnética, ondas electromagnéticas.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s11",
          "n": 11,
          "inicio": "2027-01-18",
          "fin": "2027-01-24",
          "area": "Magnitudes y simulacro",
          "texto": "Sistema Internacional, cifras y conversiones, error en la medida. Simulacro 1: seis problemas con reloj.",
          "nota": "sáb 23: convocatoria por correo",
          "dias_libres": []
        },
        {
          "id": "e3-s12",
          "n": 12,
          "inicio": "2027-01-25",
          "fin": "2027-01-31",
          "area": "Simulacros",
          "texto": "Simulacros 2 y 3. Repaso dirigido por la lista de errores.",
          "nota": "",
          "dias_libres": []
        },
        {
          "id": "e3-s13",
          "n": 13,
          "inicio": "2027-02-01",
          "fin": "2027-02-06",
          "area": "Cierre",
          "texto": "Repaso ligero con la hoja de fórmulas. Viernes 5 sin estudiar.",
          "nota": "sáb 6: Fase 2",
          "dias_libres": [
            "2027-02-05"
          ]
        }
      ],
      "simulacros_completos": [
        {
          "n": 1,
          "fecha": "2027-01-23",
          "texto": "Simulacro 1: seis problemas con reloj, temario completo de la Prueba A."
        },
        {
          "n": 2,
          "fecha": "2027-01-30",
          "texto": "Simulacro 2: seis problemas con reloj."
        },
        {
          "n": 3,
          "fecha": "2027-01-31",
          "texto": "Simulacro 3: seis problemas con reloj."
        }
      ]
    }
  ],
  "causas_de_error": [
    "Concepto",
    "Álgebra",
    "Unidades",
    "Lectura del enunciado"
  ],
  "temario": [
    {
      "id": "t01",
      "contenido": "Magnitudes físicas",
      "subcontenido": "Sistema Internacional de Unidades",
      "octubre": [
        "2026-10-03"
      ],
      "etapa3_semanas": [
        11
      ]
    },
    {
      "id": "t02",
      "contenido": "Magnitudes físicas",
      "subcontenido": "Cifras y conversiones",
      "octubre": [
        "2026-10-03"
      ],
      "etapa3_semanas": [
        11
      ]
    },
    {
      "id": "t03",
      "contenido": "Magnitudes físicas",
      "subcontenido": "Error en la medida",
      "octubre": [
        "2026-10-03"
      ],
      "etapa3_semanas": [
        11
      ]
    },
    {
      "id": "t04",
      "contenido": "Mecánica",
      "subcontenido": "Magnitudes físicas del movimiento",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        1
      ]
    },
    {
      "id": "t05",
      "contenido": "Mecánica",
      "subcontenido": "Tipos de movimiento",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        1
      ]
    },
    {
      "id": "t06",
      "contenido": "Mecánica",
      "subcontenido": "Fuerza y torque",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        2,
        3
      ]
    },
    {
      "id": "t07",
      "contenido": "Mecánica",
      "subcontenido": "Energía mecánica",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        4
      ]
    },
    {
      "id": "t08",
      "contenido": "Mecánica",
      "subcontenido": "Instrumentos de medición",
      "octubre": [
        "2026-10-03"
      ],
      "etapa3_semanas": null
    },
    {
      "id": "t09",
      "contenido": "Mecánica",
      "subcontenido": "Vectores",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        1
      ]
    },
    {
      "id": "t10",
      "contenido": "Mecánica",
      "subcontenido": "Movimiento en 1 y 2 dimensiones",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        1
      ]
    },
    {
      "id": "t11",
      "contenido": "Mecánica",
      "subcontenido": "Movimiento de rotación",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        3
      ]
    },
    {
      "id": "t12",
      "contenido": "Mecánica",
      "subcontenido": "Momento lineal",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        3
      ]
    },
    {
      "id": "t13",
      "contenido": "Energía",
      "subcontenido": "Teorema del trabajo y la energía",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        4
      ]
    },
    {
      "id": "t14",
      "contenido": "Energía",
      "subcontenido": "Tipos de energía mecánica",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        4
      ]
    },
    {
      "id": "t15",
      "contenido": "Energía",
      "subcontenido": "Conservación de la energía mecánica",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        4
      ]
    },
    {
      "id": "t16",
      "contenido": "Energía",
      "subcontenido": "Potencia mecánica",
      "octubre": [
        "2026-10-04"
      ],
      "etapa3_semanas": [
        4
      ]
    },
    {
      "id": "t17",
      "contenido": "Fluidos",
      "subcontenido": "Hidrostática",
      "octubre": [
        "2026-10-05",
        "2026-10-06"
      ],
      "etapa3_semanas": [
        5
      ]
    },
    {
      "id": "t18",
      "contenido": "Fluidos",
      "subcontenido": "Hidrodinámica",
      "octubre": [
        "2026-10-07",
        "2026-10-08"
      ],
      "etapa3_semanas": [
        5
      ]
    },
    {
      "id": "t19",
      "contenido": "Mecánica de fluidos",
      "subcontenido": "Principio de Arquímedes",
      "octubre": [
        "2026-10-06"
      ],
      "etapa3_semanas": [
        5
      ]
    },
    {
      "id": "t20",
      "contenido": "Mecánica de fluidos",
      "subcontenido": "Principio de Pascal",
      "octubre": [
        "2026-10-06"
      ],
      "etapa3_semanas": [
        5
      ]
    },
    {
      "id": "t21",
      "contenido": "Mecánica de fluidos",
      "subcontenido": "Teorema fundamental de la hidrostática",
      "octubre": [
        "2026-10-05"
      ],
      "etapa3_semanas": [
        5
      ]
    },
    {
      "id": "t22",
      "contenido": "Mecánica de fluidos",
      "subcontenido": "Principio de Bernoulli",
      "octubre": [
        "2026-10-07"
      ],
      "etapa3_semanas": [
        5
      ]
    },
    {
      "id": "t23",
      "contenido": "Mecánica de fluidos",
      "subcontenido": "Teorema de Torricelli",
      "octubre": [
        "2026-10-08"
      ],
      "etapa3_semanas": [
        5
      ]
    },
    {
      "id": "t24",
      "contenido": "Calor y temperatura I",
      "subcontenido": "Temperatura",
      "octubre": [
        "2026-10-09"
      ],
      "etapa3_semanas": [
        6
      ]
    },
    {
      "id": "t25",
      "contenido": "Calor y temperatura I",
      "subcontenido": "Propiedades térmicas de los materiales",
      "octubre": [
        "2026-10-09"
      ],
      "etapa3_semanas": [
        6
      ]
    },
    {
      "id": "t26",
      "contenido": "Calor y temperatura II",
      "subcontenido": "Cambios de temperatura y fase",
      "octubre": [
        "2026-10-10"
      ],
      "etapa3_semanas": [
        6
      ]
    },
    {
      "id": "t27",
      "contenido": "Calor y temperatura II",
      "subcontenido": "Procesos termodinámicos",
      "octubre": [
        "2026-10-11"
      ],
      "etapa3_semanas": [
        7
      ]
    },
    {
      "id": "t28",
      "contenido": "Calor y temperatura II",
      "subcontenido": "Ley cero de la termodinámica",
      "octubre": [
        "2026-10-11"
      ],
      "etapa3_semanas": [
        7
      ]
    },
    {
      "id": "t29",
      "contenido": "Calor y temperatura II",
      "subcontenido": "Primera ley de la termodinámica",
      "octubre": [
        "2026-10-11"
      ],
      "etapa3_semanas": [
        7
      ]
    },
    {
      "id": "t30",
      "contenido": "Electricidad y magnetismo",
      "subcontenido": "Magnitudes de la electricidad",
      "octubre": [
        "2026-10-13"
      ],
      "etapa3_semanas": [
        9
      ]
    },
    {
      "id": "t31",
      "contenido": "Electricidad y magnetismo",
      "subcontenido": "Circuitos",
      "octubre": [
        "2026-10-14"
      ],
      "etapa3_semanas": [
        9
      ]
    },
    {
      "id": "t32",
      "contenido": "Electricidad y magnetismo",
      "subcontenido": "Magnetismo",
      "octubre": [
        "2026-10-16"
      ],
      "etapa3_semanas": [
        10
      ]
    },
    {
      "id": "t33",
      "contenido": "Electricidad",
      "subcontenido": "Carga y campo eléctrico",
      "octubre": [
        "2026-10-12"
      ],
      "etapa3_semanas": [
        9
      ]
    },
    {
      "id": "t34",
      "contenido": "Electricidad",
      "subcontenido": "Dispositivos electrónicos",
      "octubre": [
        "2026-10-15"
      ],
      "etapa3_semanas": null
    },
    {
      "id": "t35",
      "contenido": "Electricidad",
      "subcontenido": "Circuito eléctrico del hogar",
      "octubre": [
        "2026-10-15"
      ],
      "etapa3_semanas": null
    },
    {
      "id": "t36",
      "contenido": "Electromagnetismo",
      "subcontenido": "Inducción electromagnética",
      "octubre": [
        "2026-10-17"
      ],
      "etapa3_semanas": [
        10
      ]
    },
    {
      "id": "t37",
      "contenido": "Electromagnetismo",
      "subcontenido": "Ondas electromagnéticas",
      "octubre": [
        "2026-10-17"
      ],
      "etapa3_semanas": [
        10
      ]
    },
    {
      "id": "t38",
      "contenido": "Ondas mecánicas",
      "subcontenido": "Movimiento armónico simple",
      "octubre": [
        "2026-10-19"
      ],
      "etapa3_semanas": [
        8
      ]
    },
    {
      "id": "t39",
      "contenido": "Ondas mecánicas",
      "subcontenido": "Movimiento ondulatorio y sonido",
      "octubre": [
        "2026-10-20",
        "2026-10-21"
      ],
      "etapa3_semanas": [
        8
      ]
    },
    {
      "id": "t40",
      "contenido": "Óptica",
      "subcontenido": "Reflexión, refracción de la luz",
      "octubre": [
        "2026-10-22"
      ],
      "etapa3_semanas": null
    },
    {
      "id": "t41",
      "contenido": "Óptica",
      "subcontenido": "Espejos y lentes",
      "octubre": [
        "2026-10-23"
      ],
      "etapa3_semanas": null
    },
    {
      "id": "t42",
      "contenido": "Óptica",
      "subcontenido": "Interferencia, difracción y polarización de la luz",
      "octubre": [
        "2026-10-24"
      ],
      "etapa3_semanas": null
    },
    {
      "id": "t43",
      "contenido": "Óptica",
      "subcontenido": "Dispersión y descomposición de la luz",
      "octubre": [
        "2026-10-24"
      ],
      "etapa3_semanas": null
    }
  ]
}
```
