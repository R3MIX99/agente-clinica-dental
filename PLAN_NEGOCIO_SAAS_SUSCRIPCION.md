# Plan de negocio - SaaS de agente dental por suscripción

Este documento define el modelo de negocio, la estructura de precios y la
estrategia comercial para vender el software como un SaaS por suscripción a
clínicas dentales y a doctores particulares en México. Acompaña al plan técnico
(PLAN_SAAS_MULTITENANT_PROMPTS.md), que describe cómo construir la plataforma
multi-tenant.

Todos los precios están en pesos mexicanos (MXN) y son una propuesta de partida:
conviene ajustarlos con las primeras ventas y con la disposición de pago real de
tus clientes.

## 1. Qué vendes (la propuesta de valor)

No vendes "otro software de gestión dental". El mercado ya tiene muchos
(Dentalink, Akeito, Doctocliq, Admident, entre otros) que cobran desde unos $199
hasta más de $2,000 MXN al mes. Tu diferenciador es un agente de inteligencia
artificial que atiende a los pacientes por mensajería (Telegram hoy, WhatsApp
después), responde preguntas frecuentes, envía recordatorios de cita 24 horas
antes con fecha, hora, servicio y costo, y pasa la conversación a una persona del
equipo cuando hace falta, todo administrado desde un dashboard.

El valor concreto para la clínica:

- Menos ausencias a citas (las ausencias son pérdida directa de ingreso). Los
  recordatorios automáticos reducen el "no-show".
- Atención inmediata 24/7 a quien pregunta por servicios, precios, ubicación u
  horarios, sin ocupar a la recepción.
- Captura de citas fuera de horario, cuando la recepción no contesta.
- Un solo lugar para ver conversaciones, pacientes, doctores y citas, con la
  opción de que un humano tome el control.
- Un dashboard de analítica que muestra a cuántos pacientes atendió el agente, cómo
  reaccionan, cuántas dudas resolvió solo la IA y cuántas pasaron a una persona, y
  cuánto saldo de IA llevan consumido. La clínica ve, en números, el valor que
  recibe cada mes.

La venta se resume en una frase: "Tu recepcionista digital que contesta al
instante, llena tu agenda y te recuerda cada cita, por una fracción del costo de
una persona de medio tiempo."

## 2. A quién le vendes (segmentos)

Hay dos segmentos con necesidades y bolsillos distintos:

Doctor particular o consultorio de un solo dentista. Quiere algo simple y
económico, que conteste a sus pacientes y mande recordatorios. Decide rápido (es
el dueño). Precio sensible. Es tu puerta de entrada de menor fricción.

Clínica dental con varios doctores. Tiene recepción, varios consultorios y más
volumen de pacientes. Le importa la organización del equipo, los roles
(administrador, supervisor, doctor), el control de quién atiende qué y los
reportes. Paga más y se queda más tiempo, pero el ciclo de venta es un poco más
largo (a veces decide el dueño y opina la recepción).

Más adelante, un tercer segmento: grupos o franquicias con varias sedes, que
necesitan una cuenta con varias clínicas. Es el de mayor valor y el que justifica
el plan superior.

## 3. Estructura de planes (propuesta en MXN)

La lógica: un plan de entrada barato para doctores solos, un plan intermedio para
clínicas pequeñas y medianas (es donde estará la mayoría), y un plan superior para
clínicas grandes o con varias sedes. Todo mensual, con descuento si pagan anual.

| Plan | Para quién | Doctores incluidos | Usuarios incluidos (admin/supervisor) | Saldo de IA incluido (MXN/mes) | Recordatorios / mes | Clínicas (sedes) | Precio mensual | Precio anual (2 meses gratis) |
|------|------------|--------------------|--------------------------------------|--------------------------------|---------------------|------------------|----------------|-------------------------------|
| Solo (doctor particular) | Consultorio de 1 dentista | 1 | 1 administrador | $120 (20% del precio) | 300 | 1 | $599 | $5,990 |
| Profesional | Clínica pequeña/mediana | 5 | 1 administrador + 1 supervisor | $380 (20% del precio) | 1,500 | 1 | $1,899 | $18,990 |
| Clínica | Clínica grande o multi-sede | 12 | 2 administradores + 2 supervisores | $760 (20% del precio) | 5,000 | hasta 3 | $3,799 | $37,990 |

Cómo funciona el saldo de IA (cambio importante):

El agente atiende a TODOS los pacientes por chat, así que no tiene sentido limitarlo
por número de mensajes (mil o dos mil al mes se quedan cortos para una clínica con
volumen). En su lugar, el uso de la inteligencia artificial se cobra por consumo
real: cada plan incluye un saldo de IA equivalente al 20 por ciento de su precio,
que se gasta según el costo real de la API de Claude (sobre ese costo se aplica un
pequeño margen para que el negocio no opere a pérdida). La clínica ve una barra de
progreso con su saldo: cuánto lleva consumido, cuánto le queda y un aviso cuando
está por agotarse. Si se agota, puede recargar en cualquier momento (ver add-ons) o
subir de plan; mientras tanto, las respuestas automáticas se pausan y la
conversación se deriva a una persona del equipo, para que ningún paciente quede sin
atención.

Notas sobre los límites:

- "Doctores incluidos" es el número de perfiles de doctor activos sin costo extra.
- "Saldo de IA incluido" es el monto en MXN disponible para gastar en IA cada mes;
  se consume por costo real, no por número de mensajes, y se puede recargar.
- "Recordatorios / mes" es el número de avisos de cita enviados por mensajería (es
  un costo predecible, por eso se mantiene como conteo).
- El porcentaje del 20 por ciento y los montos son una propuesta inicial; ajústalos
  según el consumo real y el margen que veas en las primeras clínicas. El porcentaje
  destinado a IA es configurable desde el panel de superadmin.

## 4. Add-ons (extras contratables)

Los add-ons son la palanca de crecimiento de ingreso por cliente. La regla: el
cobro siempre va a la cuenta (la empresa/clínica), aunque internamente la clínica
decida si lo absorbe ella o se lo carga al doctor.

| Add-on | Qué incluye | Precio mensual |
|--------|-------------|----------------|
| Doctor adicional | +1 perfil de doctor activo sobre el límite del plan | $349 |
| Usuario adicional (supervisor) | +1 usuario administrativo | $199 |
| Recarga de saldo de IA | Saldo adicional para consumo de IA (paquetes de $200, $500 o $1,000) | desde $200 |
| Paquete de recordatorios | +1,000 recordatorios al mes | $199 |
| Sede adicional (clínica) | +1 clínica dentro de la misma cuenta | $1,499 |
| WhatsApp (cuando esté disponible) | Canal de WhatsApp además de Telegram | $499 |

El add-on de doctor adicional a $349 al mes es el equivalente a los "20 dólares"
que mencionaste; ronda esa cifra al tipo de cambio y se siente razonable frente a
lo que un doctor extra produce de ingreso.

## 5. Por qué este modelo funciona

Cobras por valor y por crecimiento del cliente. Una clínica que crece (más
doctores, más pacientes, más conversaciones) paga más de forma natural, sin que
tengas que renegociar. Eso se llama expansión de ingreso y es lo que hace
rentable a un SaaS.

El plan de entrada barato ($599) baja la barrera para que un doctor solo diga que
sí sin pensarlo mucho, y desde ahí lo subes a Profesional cuando contrata a su
primer colega o cuando ve que la herramienta le llena la agenda.

El intermedio ($1,899) es tu plan ancla: la mayoría debería caer ahí, y está
puesto a propósito como el de "mejor relación valor-precio" para empujar hacia él.

## 6. La mejor manera de venderlo (estrategia comercial)

No existe un solo canal mágico; lo que funciona en este tipo de software es
combinar prueba sin fricción + venta consultiva + alianzas. En orden de prioridad
para empezar:

Primero, prueba gratis con resultado rápido. Ofrece 14 días gratis (sin tarjeta) y
asegúrate de que en esos 14 días la clínica viva el momento "ajá": que el agente
conteste a un paciente real y que se envíe el primer recordatorio. El producto se
vende solo cuando el dueño ve que dejó de perder llamadas y citas. Acompaña la
prueba con un onboarding guiado (el wizard del plan técnico) para que no se queden
atorados configurando.

Segundo, demostración personalizada (venta consultiva). Para clínicas con varios
doctores, agenda una demo de 20 a 30 minutos donde muestres su caso: cuántas citas
pierden por no contestar, cuánto cuesta una ausencia, y cómo el agente lo
resuelve. Llega con números: si una clínica factura $800 por cita y recupera 8
ausencias al mes, son $6,400 recuperados contra $1,899 de suscripción. El retorno
de inversión es tu mejor argumento.

Tercero, alianzas con quien ya le vende a dentistas. Los depósitos dentales
(distribuidores de insumos y equipo), los laboratorios dentales y los
representantes de marcas ya tienen la confianza de muchas clínicas. Ofréceles
comisión por referido o un esquema de reventa. Una sola alianza buena te puede
traer decenas de clínicas. Lo mismo con contadores y consultores que atienden
consultorios.

Cuarto, presencia donde están los dentistas. Colegios y asociaciones dentales,
congresos y expos del gremio, y grupos de dentistas en redes (Facebook, WhatsApp,
Instagram). Patrocinar o dar una charla corta de "cómo dejar de perder pacientes
por no contestar" posiciona el producto sin sonar a venta dura.

Quinto, contenido y prueba social. Casos de éxito con números reales ("la Clínica
X redujo sus ausencias 30 por ciento en dos meses"), testimonios en video cortos,
y comparativas honestas. En salud, la confianza lo es todo: muestra que otras
clínicas como la suya ya lo usan.

Sexto, referidos. Tus clientes contentos son tu mejor fuerza de ventas. Da un mes
gratis (o un descuento) por cada clínica que refieran y que se quede. Los
dentistas se conocen entre sí y se recomiendan herramientas.

Recomendación de arranque concreta: empieza por venta directa a doctores
particulares y clínicas pequeñas con la prueba gratis y demos uno a uno (es el
ciclo más corto y te da casos de éxito rápido), y en paralelo cierra una o dos
alianzas con un depósito dental o laboratorio para tener un canal que escale.

## 7. Cómo presentar el precio (tácticas)

Muestra tres planes y resalta el de en medio como "el más popular": la mayoría
elige el intermedio cuando hay tres opciones.

Empuja el pago anual con dos meses gratis: mejora tu flujo de caja y reduce que se
den de baja.

Habla de retorno, no de costo: presenta el precio al lado de lo que recupera la
clínica (ausencias evitadas, citas capturadas fuera de horario). El precio se
siente pequeño frente al ingreso que protege.

No compitas por ser el más barato. Si el único argumento es precio, siempre habrá
alguien más barato y atraes a los clientes que más se quejan y más rápido se van.
Compite por resultado (agenda llena, cero ausencias, atención 24/7).

Considera un cargo único de implementación opcional (por ejemplo $1,500 MXN) para
clínicas que quieran que tú les configures todo (servicios, FAQ, horarios,
conexión del canal). Es ingreso extra y aumenta el compromiso del cliente.

## 8. Métricas que debes vigilar (salud del negocio)

Ingreso recurrente mensual (MRR): la suma de todas las suscripciones activas al
mes. Es tu número estrella.

Ingreso promedio por cuenta (ARPA): MRR dividido entre número de cuentas. Sube con
add-ons y upgrades.

Tasa de cancelación (churn): porcentaje de clientes que se van al mes. En SaaS de
pymes, mantenerlo por debajo de 3 a 5 por ciento mensual es sano. El onboarding y
el soporte son lo que más lo bajan.

Conversión de prueba a pago: de cada 10 que prueban, cuántos pagan. Si es bajo,
el problema casi siempre es que no llegaron al momento "ajá" en la prueba.

Costo de adquisición (CAC) contra valor de vida del cliente (LTV): cuánto te
cuesta conseguir un cliente contra cuánto te deja mientras se queda. La regla sana
es que el LTV sea al menos 3 veces el CAC.

## 9. Riesgos y cómo manejarlos

Privacidad y datos de pacientes: estás manejando información de salud. Comunica
con claridad que cada clínica solo ve sus datos (aislamiento por inquilino) y que
no se comparten entre clientes. Esto es además un argumento de venta frente a
soluciones improvisadas.

Dependencia del canal de mensajería: WhatsApp tiene reglas estrictas para mensajes
automatizados y plantillas. Por eso el plan arranca con Telegram (más permisivo) y
deja WhatsApp como add-on cuando esté la integración oficial lista. Sé honesto con
el cliente sobre qué canal está disponible.

Soporte y onboarding: la causa número uno de cancelación temprana es que el
cliente no logró configurarlo. Invierte en el wizard de onboarding, en plantillas
de FAQ por especialidad y en soporte rápido los primeros días.

Cobro y morosidad: con Mercado Pago, configura reintentos y un periodo de gracia
antes de suspender, para no perder clientes por un pago fallido pasajero. Suspende
el acceso, nunca borres los datos: así regresan cuando regularizan.

## 10. Hoja de ruta sugerida para lanzar

Mes 1 a 2: termina la plataforma multi-tenant (plan técnico), define los planes
finales y consigue de 3 a 5 clínicas piloto (idealmente conocidas) con precio
especial a cambio de testimonio y retroalimentación.

Mes 3 a 4: ajusta precios y límites con lo aprendido, publica la landing con los
tres planes y la prueba gratis, y arranca venta directa y la primera alianza con un
depósito o laboratorio.

Mes 5 en adelante: activa referidos, junta 3 a 5 casos de éxito con números,
empieza presencia en colegios/congresos y mide MRR, churn y conversión para decidir
dónde invertir más.

---

Resumen ejecutivo: vende un agente de IA que llena la agenda y reduce ausencias,
no "otro software". Tres planes (Solo $599, Profesional $1,899, Clínica $3,799) más
add-ons (doctor adicional $349, recarga de saldo de IA, paquete de recordatorios,
WhatsApp, sede adicional). El uso de IA se cobra por saldo (consumo real, 20 por
ciento del precio incluido y recargable), no por número de mensajes, y la clínica
lo ve en una barra de progreso junto a un dashboard de analítica del agente. Entra con prueba gratis de 14 días y demos con números de retorno;
escala con alianzas (depósitos dentales, laboratorios), referidos y casos de éxito.
Cobra por valor, empuja el plan intermedio y el pago anual, y cuida el onboarding y
el churn como prioridad número uno.
