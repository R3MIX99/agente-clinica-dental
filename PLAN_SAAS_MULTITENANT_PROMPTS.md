# Plan de conversión a SaaS multi-tenant - Prompts para Claude Code

Este documento contiene los prompts por fases que Claude Code debe ejecutar para
convertir el software de la clínica dental (de una sola clínica) en un SaaS
multi-tenant con suscripciones, donde cualquier empresa puede registrarse, pagar
un plan mensual y administrar su propia clínica de forma aislada.

Este plan se ejecuta DESPUÉS de que ya estén implementados los planes anteriores
(base, extensión de pacientes/doctores, móvil y autenticación/usuarios). No debe
romper nada de lo ya construido: lo que hoy es "una clínica" se convierte en la
primera clínica de la primera cuenta de prueba.

## Reglas globales (aplican a TODAS las fases)

- Cero emojis en todo el desarrollo: código, UI, textos, mensajes del bot,
  nombres de variables, mensajes de commit. Esto es estricto.
- Sí se usan acentos y la letra ñ como corresponde al español mexicano correcto
  (Próxima, Teléfono, Extracción, años, diseño, etc.). Todos los archivos en UTF-8.
- Stack que ya existe y se mantiene: Next.js (App Router) + TypeScript + Tailwind
  + shadcn/ui + framer-motion (animaciones sobrias) + Supabase + n8n.
- Toda la base de datos la decide e implementa Claude Code. Aquí solo se describe
  QUÉ debe lograrse, no el SQL. Claude Code elige tablas, tipos, índices,
  políticas y migraciones.
- Aislamiento por inquilino (tenant) obligatorio: ninguna cuenta puede ver ni
  tocar datos de otra. Esto se valida tanto en el servidor como con RLS en
  Supabase.
- Seguridad de secretos: el PAT de GitHub, la service_role key de Supabase y las
  llaves de Mercado Pago NUNCA se escriben en el repositorio ni en el historial.
  Solo viven en variables de entorno del servidor o en el gestor de secretos del
  hosting. Claude Code usa su propio MCP de GitHub / gh para autenticarse.
- Al final de CADA fase: commit + push a la rama principal (main) del repositorio
  ya existente (agente-clinica-dental). Mensajes de commit en español, sin emojis,
  estilo convencional (feat, fix, refactor, chore).
- Moneda y zona horaria: precios en pesos mexicanos (MXN), zona horaria
  America/Mexico_City.

## Glosario de conceptos (vocabulario único para todo el proyecto)

- Cuenta (o "Cliente"): la empresa que contrata y paga. Es la raíz del inquilino
  (tenant). Una cuenta puede tener una o varias clínicas.
- Clínica: una sede o consultorio que pertenece a una cuenta. Tiene sus propios
  doctores, pacientes, citas, conversaciones y configuración (datos, FAQ, canal).
- Membresía: la relación entre un usuario y una cuenta/clínica, con un rol
  (administrador, supervisor, doctor).
- Plan: el paquete de suscripción (límites de doctores, usuarios, uso de IA,
  recordatorios) con un precio mensual.
- Suscripción: la instancia activa de un plan para una cuenta, con su estado
  (activa, en periodo de prueba, vencida, cancelada, suspendida).
- Add-on: extra contratable sobre el plan (por ejemplo, un doctor adicional).
- Saldo de IA: el monto (en MXN) disponible para gastar en uso de inteligencia
  artificial durante el periodo. Cada plan incluye un saldo inicial equivalente a
  un porcentaje del precio de la suscripción (por ejemplo, 20 por ciento), y la
  clínica puede recargar más cuando se agota. El consumo de IA se descuenta de este
  saldo según el costo real de la API, no por número de mensajes.
- Uso / metering: la medición del consumo del periodo. Para la IA se mide por costo
  real (saldo consumido); para recordatorios se cuentan los enviados; para doctores
  y usuarios se cuentan los activos. Sirve para mostrar el avance, avisar de saldo
  bajo y comparar contra lo contratado.
- Superadmin: el dueño del SaaS (tú). Administra todas las cuentas desde un panel
  aparte. No es lo mismo que el administrador de una clínica.

---

## Fase S0 - Preparación y decisiones de arquitectura multi-tenant

Objetivo: dejar claras las decisiones de arquitectura antes de tocar código, sin
romper la app de una sola clínica.

1. Lee y comprende todo el código y los planes ya implementados (base, extensión,
   móvil, autenticación). Identifica todas las tablas y consultas que hoy asumen
   "una sola clínica".
2. Decide e implementa el modelo de aislamiento multi-tenant. La recomendación es
   base de datos compartida con aislamiento por fila (row-level) usando una
   columna de inquilino (por ejemplo clinica_id, y por encima cuenta_id) más
   políticas RLS en Supabase. Justifica brevemente la decisión en un archivo
   docs/ARQUITECTURA_MULTITENANT.md (sin secretos).
3. Define cómo se propaga el contexto de inquilino en cada petición: el usuario
   autenticado pertenece a una o varias clínicas; cada consulta debe resolver "qué
   clínica estoy viendo" y filtrar por ella. Documenta la estrategia (claims en el
   JWT de Supabase Auth, tabla de membresías consultada en las políticas RLS, o
   ambas).
4. Crea una rama de trabajo si lo prefieres, pero el entregable final de cada fase
   se integra a main.
5. No cambies todavía el esquema. Solo deja el documento de arquitectura y un plan
   de migración de datos (cómo lo existente pasa a ser "Cuenta demo" + "Clínica
   demo").
6. Commit + push. Mensaje sugerido: "docs(saas): arquitectura multi-tenant y plan de migracion".

Criterio de aceptación: existe docs/ARQUITECTURA_MULTITENANT.md con el modelo de
aislamiento elegido, cómo se resuelve el inquilino por petición, y el plan de
migración de la clínica actual a cuenta+clínica demo. La app sigue funcionando
igual que antes.

---

## Fase S1 - Modelo de datos multi-tenant y migración de lo existente

Objetivo: introducir la jerarquía Cuenta -> Clínica -> (doctores, usuarios,
pacientes, citas, conversaciones) y migrar los datos actuales sin pérdida.

1. Diseña e implementa el modelo de datos para: cuentas, clínicas, membresías
   (usuario-cuenta/clínica con rol), planes, suscripciones y registro de uso
   (metering). Claude Code decide los nombres, tipos y relaciones exactas.
2. Agrega la pertenencia a clínica en todas las entidades del dominio que hoy
   existen (doctores, pacientes, citas, conversaciones, mensajes, laboratorios,
   estudios, notas, horarios, configuración de clínica, FAQ, servicios). Cada
   registro debe poder atribuirse a una clínica (y por ella, a una cuenta).
3. Implementa RLS por inquilino en todas esas tablas: un usuario solo ve y
   modifica datos de las clínicas a las que pertenece, y un superadmin (rol
   aparte) puede ver todo desde el panel de superadmin. La service_role solo se
   usa del lado del servidor.
4. Migra los datos actuales: crea una "Cuenta demo" y una "Clínica demo", y
   reasigna todo lo existente a esa clínica. Después de migrar, ninguna fila debe
   quedar sin clínica.
5. Regenera los tipos de TypeScript de Supabase y ajusta el código para que todas
   las consultas filtren por la clínica activa.
6. Verifica que la app de una sola clínica siga funcionando exactamente igual al
   entrar como el administrador de la Clínica demo.
7. Commit + push. Mensaje sugerido: "feat(saas): modelo multi-tenant y migracion de clinica demo".

Criterio de aceptación: existen cuentas, clínicas, membresías, planes,
suscripciones y metering; todo el dominio está atado a una clínica; RLS aísla por
inquilino; los datos previos viven bajo la Cuenta demo / Clínica demo y la app
funciona igual que antes para ese usuario.

---

## Fase S2 - Autenticación multi-tenant y selección de clínica

Objetivo: que el login resuelva a qué cuenta/clínica pertenece el usuario y que
toda la app opere dentro del contexto de la clínica activa.

1. Extiende la autenticación ya existente para que, tras iniciar sesión, se
   resuelvan las membresías del usuario (a qué cuenta y clínicas pertenece y con
   qué rol).
2. Si el usuario pertenece a más de una clínica, agrega un selector de clínica
   (en el sidebar en escritorio y en el menú del top bar en móvil). Si solo
   pertenece a una, se entra directo a ella. La clínica activa se conserva entre
   navegaciones.
3. Propaga el contexto de clínica activa a todas las consultas del servidor y a
   las políticas RLS. Ninguna vista debe poder mostrar datos de otra clínica
   aunque se manipule la URL o los parámetros.
4. Ajusta los roles ya existentes (administrador, supervisor, doctor) para que
   siempre se interpreten dentro de la clínica activa (un usuario puede ser
   administrador en una clínica y doctor en otra, si el negocio lo permite; si no,
   mantenlo simple: rol por membresía).
5. Verifica el aislamiento: crea una segunda cuenta+clínica de prueba con datos
   distintos e intenta, desde un usuario de la primera, acceder a la segunda. Debe
   ser imposible.
6. Commit + push. Mensaje sugerido: "feat(saas): contexto de clinica activa y aislamiento por tenant".

Criterio de aceptación: el login resuelve membresías; existe selector de clínica
cuando aplica; toda consulta respeta la clínica activa; un usuario de una cuenta
no puede ver datos de otra ni manipulando la URL.

---

## Fase S3 - Registro self-service (landing, alta de cuenta y onboarding)

Objetivo: que cualquier empresa llegue a la web, se registre sola, cree su cuenta
y su primera clínica, y quede lista para usar el sistema.

1. Crea una landing pública (fuera del área autenticada) con: propuesta de valor
   del agente de IA dental, lista de planes con precios en MXN, y botones de
   "Empezar" / "Contratar". El diseño usa shadcn/ui + ckmui-styling, animaciones
   sobrias, cero emojis.
2. Crea el flujo de registro self-service: el usuario crea su cuenta (empresa),
   define su primera clínica (nombre, datos de contacto, zona horaria) y queda
   como administrador de esa cuenta/clínica. Nota de seguridad: el alta de la
   cuenta de Supabase Auth la realiza el propio usuario (no Claude Code crea
   cuentas por terceros); el flujo solo orquesta el registro estándar.
3. Inmediatamente después del registro, lanza un asistente de onboarding (wizard)
   por pasos: datos de la clínica, horarios de atención, primeros servicios y
   precios, FAQ inicial, e invitación de su equipo (doctores/usuarios por correo).
   Cada paso se puede omitir y completar después.
4. Selección de plan: al registrarse, el usuario elige un plan. Si aún no se ha
   integrado el cobro (Fase S5), deja la suscripción en estado de prueba (trial)
   por un número de días configurable.
5. Aplica RLS y validaciones de servidor para que todo lo creado en el onboarding
   quede atado a la clínica recién creada.
6. Privacidad: no se piden datos sensibles (financieros o de identidad) en el
   registro; solo nombre, correo, teléfono y datos de la clínica.
7. Commit + push. Mensaje sugerido: "feat(saas): registro self-service y onboarding de clinica".

Criterio de aceptación: existe landing pública con planes; una empresa puede
registrarse sola, crear su clínica y quedar como administrador; un wizard guía la
configuración inicial; todo queda aislado en su clínica; sin pedir datos sensibles.

---

## Fase S4 - Planes, saldo de IA por consumo y panel de uso

Objetivo: que el uso de la inteligencia artificial se gobierne por SALDO (costo
real), no por un tope de mensajes; que cada plan incluya un saldo inicial
proporcional a su precio; y que la clínica vea su consumo con barras de progreso y
pueda recargar cuando se agote.

Justificación del cambio: el agente atiende a todos los pacientes por chat, así que
un tope de mensajes fijo (1,000 o 2,000 al mes) es demasiado bajo para una clínica
con muchos pacientes. En su lugar, el límite de IA se maneja como un saldo de
dinero que se consume según el costo real de la API de Claude.

1. Catálogo de planes (administrable desde el panel de superadmin en la Fase S8).
   Cada plan define al menos: número incluido de doctores, número incluido de
   usuarios (administradores/supervisores), saldo de IA incluido por periodo
   (expresado como un porcentaje del precio de la suscripción, por defecto 20 por
   ciento, convertido a un monto en MXN), tope de recordatorios por mes, y precio
   mensual en MXN. Claude Code decide el modelo de datos. El porcentaje destinado a
   IA debe ser configurable por el superadmin (no quemado en código).

2. Saldo de IA por consumo real:
   - Al iniciar cada periodo de facturación, abona a la clínica el saldo de IA
     incluido del plan (por defecto, 20 por ciento del precio del plan en MXN).
   - Cada vez que el agente procesa un mensaje con la IA, calcula el costo real de
     esa llamada a la API de Claude (con base en los tokens de entrada y salida y
     el precio del modelo claude-haiku-4-5-20251001) y descuéntalo del saldo de la
     clínica. Aplica un margen/markup configurable por el superadmin sobre el costo
     de la API para definir cuánto se descuenta del saldo (así el negocio no opera a
     pérdida). Documenta la fórmula en docs/.
   - Lleva un registro detallado de cada consumo (fecha, conversación, tokens,
     costo descontado) para poder auditarlo y mostrarlo en el panel.
   - El saldo NO consumido al cierre del periodo: define el comportamiento (por
     defecto, no se acumula al siguiente periodo; el superadmin puede activar
     acumulación si se desea). Las recargas compradas aparte sí pueden tener
     vigencia distinta; documenta la regla.

3. Recargas de saldo de IA:
   - Permite a la clínica comprar saldo adicional cuando el incluido se está
     agotando (paquetes de recarga en MXN; ver el plan de negocio para los montos).
   - La compra de recarga se cobra por Mercado Pago (Fase S5) como cargo único, no
     como suscripción recurrente, y abona el saldo de inmediato.

4. Recordatorios: se mantienen como conteo con tope mensual por plan (es un costo
   distinto y predecible). Al acercarse al tope (por ejemplo 80 por ciento) avisa, y
   al superarlo aplica el comportamiento configurable (avisar y pausar por defecto,
   o contratar el paquete de recordatorios).

5. Enforcement:
   - Doctores y usuarios: al intentar agregar uno por encima del incluido, ofrece
     contratar el add-on correspondiente (Fase S6) o bloquea con un mensaje claro.
   - Saldo de IA bajo o agotado: cuando el saldo cae por debajo de un umbral (por
     ejemplo 20 por ciento), muestra aviso e invita a recargar o subir de plan.
     Cuando el saldo llega a cero, define el comportamiento configurable: pausar las
     respuestas automáticas de la IA (el agente avisa al paciente que en breve lo
     atenderá una persona y se marca la conversación para handoff) hasta que
     recarguen o inicie el nuevo periodo. Implementa "pausar y notificar al equipo"
     como predeterminado para la demo. Nunca se cobra de más sin consentimiento.
   - Todas las validaciones se hacen también del lado del servidor, no solo en la
     UI, para que no se puedan evadir.

6. Panel de "Uso y plan" en el dashboard (visible para administrador y supervisor):
   - Barra de progreso del saldo de IA: monto consumido contra incluido del
     periodo, saldo restante, porcentaje usado, y estado (saludable, por agotarse,
     agotado). Botón para recargar.
   - Barra de progreso de recordatorios usados contra el tope del periodo.
   - Indicadores de doctores y usuarios usados contra los incluidos (más add-ons).
   - Llamado a subir de plan, recargar saldo o contratar add-ons según el caso.
   - Diseño con shadcn/ui + ckmui-styling, animaciones sobrias, cero emojis.

7. Commit + push. Mensaje sugerido: "feat(saas): saldo de IA por consumo, recargas y panel de uso".

Criterio de aceptación: el uso de IA se gobierna por saldo (costo real con
markup configurable), no por tope de mensajes; cada plan abona un saldo incluido
proporcional al precio (por defecto 20 por ciento); se puede recargar saldo; hay
barras de progreso de saldo de IA y recordatorios con avisos de saldo bajo; al
agotarse el saldo se pausan las respuestas automáticas y se notifica al equipo; las
validaciones corren en el servidor.

---

## Fase S4b - Dashboard de analítica del agente de IA

Objetivo: dar a la clínica un dashboard que muestre cómo está funcionando el agente
de IA: a cuántos pacientes atendió, cómo reaccionan, y estadísticas de
conversaciones, para que la clínica perciba el valor que recibe.

1. Crea una sección de "Estadísticas" o "Analítica" en el dashboard, accesible para
   administrador y supervisor (el doctor ve, en su caso, solo lo relativo a sus
   pacientes). Respeta el aislamiento por clínica y las reglas de roles.
2. Métricas mínimas a mostrar (todas filtrables por rango de fechas: hoy, 7 días,
   30 días, periodo personalizado):
   - Pacientes atendidos por el agente (conversaciones únicas) en el periodo.
   - Mensajes totales: del paciente, del bot y de agentes humanos.
   - Conversaciones resueltas solo por la IA contra las que requirieron handoff a
     una persona, y porcentaje de resolución automática.
   - Tiempo promedio de primera respuesta y, si aplica, tiempo de resolución.
   - Recordatorios enviados y, si se puede medir, citas confirmadas a partir de
     ellos.
   - Distribución de temas/intención de las consultas (por ejemplo: precios,
     ubicación, agendar cita, horarios, facturación) usando una clasificación
     simple de las conversaciones.
   - Reacción de los pacientes a la IA: implementa una señal de satisfacción ligera
     (por ejemplo, una valoración opcional al cierre de la conversación o un
     análisis de sentimiento básico de los mensajes del paciente) y muéstrala como
     porcentaje de interacciones positivas/neutras/negativas. Documenta el método.
   - Consumo de saldo de IA en el periodo (enlazado al panel de uso de la Fase S4).
3. Visualízalo con tarjetas de indicadores (KPI) y gráficas sobrias. Puedes usar una
   librería de gráficas compatible con el stack (por ejemplo recharts) manteniendo
   el estilo shadcn/ui + ckmui-styling, animaciones sobrias y cero emojis.
4. Asegura versión móvil de esta sección coherente con el plan móvil (sin tablas en
   teléfono; usa tarjetas y listas; las gráficas deben ser legibles en pantallas
   angostas).
5. Todo el cálculo de métricas debe respetar la clínica activa y las políticas RLS;
   ninguna clínica ve estadísticas de otra.
6. Commit + push. Mensaje sugerido: "feat(saas): dashboard de analitica del agente de IA".

Criterio de aceptación: existe un dashboard de analítica por clínica con pacientes
atendidos, volumen de mensajes, resolución automática contra handoff, temas de
consulta, reacción/satisfacción de pacientes y consumo de saldo de IA; es filtrable
por fechas; respeta roles y aislamiento por clínica; tiene versión móvil; sin
emojis y con acentos correctos.

---

## Fase S5 - Cobro de suscripciones con Mercado Pago

Objetivo: cobrar la suscripción mensual recurrente y mantener el estado de la
suscripción sincronizado con los pagos.

1. Integra Mercado Pago para suscripciones recurrentes (preapproval / suscripción
   con plan asociado). El flujo: el usuario elige plan -> se le envía al checkout
   de Mercado Pago -> al autorizar, regresa a la app y la suscripción queda activa.
   Nota de seguridad: el usuario captura sus datos de pago directamente en el
   entorno de Mercado Pago; la app nunca almacena ni captura tarjetas. Claude Code
   no introduce datos financieros.
2. Implementa el webhook de Mercado Pago para recibir eventos de pago/suscripción
   (autorizada, cobrada, rechazada, pausada, cancelada) y actualizar el estado de
   la suscripción en la base de datos. Valida la autenticidad del webhook con la
   firma/clave correspondiente.
3. Maneja los estados de la suscripción: en prueba (trial), activa, pago pendiente,
   vencida (dunning), suspendida y cancelada. Define el periodo de gracia tras un
   pago fallido antes de suspender el acceso.
4. Cuando una suscripción quede suspendida o cancelada, restringe el acceso de la
   cuenta (por ejemplo, modo de solo lectura o pantalla de "regulariza tu pago"),
   sin borrar datos. Las eliminaciones permanentes nunca son automáticas.
5. Crea una sección de "Facturación" en el dashboard del administrador donde pueda
   ver su plan actual, estado de pago, próximo cobro, e ir al portal de gestión de
   su suscripción en Mercado Pago. No expongas datos de tarjeta.
6. Todas las llaves de Mercado Pago (access token, etc.) van en variables de
   entorno del servidor, nunca en el repo ni en el cliente.
7. Usa el ambiente de pruebas (sandbox) de Mercado Pago para la demo y documenta en
   docs/ cómo cambiar a producción (sin incluir llaves reales).
8. Commit + push. Mensaje sugerido: "feat(saas): suscripciones con Mercado Pago y webhooks".

Criterio de aceptación: una cuenta puede contratar un plan y pagar de forma
recurrente en sandbox; el webhook actualiza el estado de la suscripción; los
estados (trial, activa, vencida, suspendida, cancelada) se gestionan con periodo de
gracia; la suspensión restringe acceso sin borrar datos; las llaves viven solo en
el servidor.

---

## Fase S6 - Add-ons y cambios de plan (upgrade / downgrade)

Objetivo: permitir agregar extras (como un doctor adicional) y cambiar de plan,
con prorrateo correcto.

1. Implementa add-ons contratables sobre la suscripción. El primero: "Doctor
   adicional" con precio mensual en MXN (ver el plan de negocio para el monto). El
   add-on aumenta el límite de doctores incluidos de la clínica.
2. Al contratar o quitar un add-on a mitad de periodo, calcula el prorrateo y
   refleja el cambio en Mercado Pago (ajuste del monto de la suscripción o cargo
   adicional, según lo que soporte el proveedor). Documenta el comportamiento.
3. Implementa upgrade y downgrade de plan: al subir de plan, aplica de inmediato y
   prorratea; al bajar de plan, aplica al siguiente periodo y valida que el uso
   actual no exceda los límites del plan menor (si excede, pide ajustar antes de
   bajar).
4. La UI debe dejar muy claro al administrador qué incluye su plan, cuántos
   doctores/usuarios tiene contratados (incluidos + add-ons) y el costo total
   mensual resultante.
5. Quién paga el add-on lo decide la clínica: el cobro siempre va a la cuenta (la
   empresa), no al doctor individual. (Si más adelante se quiere cobro por doctor,
   se trataría en una fase futura.)
6. Valida en el servidor que el número de doctores/usuarios reales nunca supere lo
   contratado (incluidos + add-ons).
7. Commit + push. Mensaje sugerido: "feat(saas): add-ons de doctor y cambios de plan con prorrateo".

Criterio de aceptación: se puede contratar y quitar el add-on de doctor adicional
con prorrateo; se puede subir y bajar de plan con las reglas descritas; la UI
muestra el costo total y los límites resultantes; el servidor impide exceder lo
contratado.

---

## Fase S7 - Personalización por clínica (marca, datos, FAQ, canal)

Objetivo: que cada clínica configure su propia identidad y contenido, de modo que
el software se sienta "suyo".

1. Permite a cada clínica personalizar: nombre comercial, logo, datos de contacto
   (dirección, teléfono, correo, sitio web), horarios de atención, catálogo de
   servicios y precios, y el contenido de la FAQ que usa el agente.
2. Aplica esa personalización en el dashboard (encabezado/marca) y, sobre todo, en
   las respuestas del agente de IA: ubicación, servicios, costos, teléfono, sitio,
   correo, facturación, horarios y formas de pago deben venir de los datos de ESA
   clínica.
3. Configuración de canal por clínica: cada clínica define sus propias
   credenciales de canal (por ahora Telegram; preparado para WhatsApp). El token
   del bot y los identificadores de canal se guardan de forma segura por clínica
   (en el servidor, nunca en el repo ni en el cliente) y nunca se mezclan entre
   clínicas.
4. Mantén la abstracción de canal ya existente para que agregar WhatsApp después
   no requiera rehacer la lógica.
5. Cambiar permisos de acceso o compartir recursos NO es algo que Claude Code
   ejecute de forma automática; cualquier ajuste de quién accede a qué lo realiza
   el administrador desde la UI.
6. Commit + push. Mensaje sugerido: "feat(saas): personalizacion por clinica y configuracion de canal".

Criterio de aceptación: cada clínica configura su marca, datos, servicios, FAQ y
canal; el agente responde con los datos de la clínica correspondiente; las
credenciales de canal están aisladas por clínica y guardadas de forma segura.

---

## Fase S8 - Panel de superadmin (administración del SaaS)

Objetivo: darte a ti (dueño del SaaS) un panel para administrar todas las cuentas,
planes y uso, separado del dashboard de las clínicas.

1. Crea un área de superadmin protegida, accesible solo para usuarios con rol de
   superadmin (rol distinto a administrador de clínica). El acceso se valida en
   servidor y con RLS.
2. Funciones del panel: lista de cuentas con su plan, estado de suscripción, número
   de clínicas/doctores/usuarios y uso del mes; ver detalle de una cuenta;
   suspender o reactivar una cuenta (sin borrar datos); administrar el catálogo de
   planes y precios; ver métricas agregadas (ingresos recurrentes, cuentas activas,
   altas y bajas).
3. Acciones sensibles (suspender cuenta, cambiar plan de un cliente) requieren
   confirmación explícita en la UI. Nada de eliminaciones permanentes automáticas.
4. El superadmin nunca ve datos clínicos sensibles de pacientes salvo lo
   estrictamente necesario para soporte; prioriza la privacidad (muestra
   agregados, no historiales clínicos completos, salvo que sea indispensable y
   esté justificado).
5. Commit + push. Mensaje sugerido: "feat(saas): panel de superadmin y metricas".

Criterio de aceptación: existe un panel de superadmin protegido por rol; lista y
detalle de cuentas; suspensión/reactivación con confirmación; administración de
planes; métricas agregadas; respeto a la privacidad de datos de pacientes.

---

## Fase S9 - Agente n8n por inquilino (enrutamiento y recordatorios por clínica)

Objetivo: que los flujos de n8n funcionen para muchas clínicas, cada una con su
canal y su configuración, respetando los límites del plan.

1. Ajusta los 3 workflows de n8n (ya versionados en la carpeta /n8n) para que sean
   multi-tenant: cada mensaje entrante debe resolver a qué clínica pertenece (por
   el token/identificador del canal) y operar solo con los datos de esa clínica.
2. El workflow de respuesta del agente debe: identificar la clínica, leer su FAQ,
   servicios, horarios y datos, generar la respuesta con la IA, y registrar el
   COSTO real de esa llamada a la API (tokens de entrada/salida) descontándolo del
   saldo de IA de esa clínica según la fórmula de la Fase S4. Antes de responder,
   verifica que la clínica tenga saldo de IA disponible; si el saldo está agotado,
   aplica el comportamiento definido en la Fase S4 (pausar la respuesta automática,
   avisar al paciente que en breve lo atenderá una persona y marcar la conversación
   para handoff). Registra también los datos necesarios para la analítica de la
   Fase S4b (intención de la consulta, si fue resuelta por IA o derivada, etc.).
3. El workflow de recordatorios (24 horas antes, con fecha, hora, servicio y costo)
   debe recorrer las citas de TODAS las clínicas activas, enviar por el canal de
   cada clínica, y registrar cada recordatorio en el metering de esa clínica
   respetando su tope.
4. El handoff a agente humano debe respetar el aislamiento: una conversación solo
   la pueden atender usuarios de esa clínica.
5. Mantén el round-trip de importación/exportación: los workflows siguen siendo la
   fuente de verdad en /n8n y cualquier cambio se versiona ahí. Recuerda que el MCP
   de n8n puede leer y ejecutar, pero la creación/edición de workflows se entrega
   como JSON importable en /n8n.
6. No coloques tokens ni llaves reales en los JSON versionados; usa credenciales de
   n8n referenciadas por nombre o variables, no valores en claro.
7. Commit + push. Mensaje sugerido: "feat(saas): workflows n8n multi-tenant por clinica".

Criterio de aceptación: los workflows resuelven la clínica por el canal; el agente
responde con los datos correctos por clínica y registra uso; los recordatorios
recorren todas las clínicas activas respetando límites; el handoff respeta el
aislamiento; los JSON en /n8n no contienen secretos.

---

## Fase S10 - QA multi-tenant, seguridad y cierre

Objetivo: verificar aislamiento, cuotas, billing y calidad antes de cerrar.

1. Pruebas de aislamiento entre inquilinos: con dos cuentas distintas, confirma que
   ninguna puede ver ni modificar datos de la otra por UI, por API ni manipulando
   parámetros/URL. Revisa las políticas RLS con los advisors de Supabase y corrige
   cualquier hallazgo.
2. Pruebas de saldo y cuotas: simula consumir el saldo de IA hasta agotarlo
   (verifica el descuento por costo real, la barra de progreso, el aviso de saldo
   bajo, la pausa al llegar a cero y la recarga); simula alcanzar y superar los
   topes de recordatorios, doctores y usuarios; verifica avisos, bloqueos y oferta
   de recarga/add-ons/upgrade. Verifica también que el dashboard de analítica (Fase
   S4b) muestre cifras correctas y respete el aislamiento por clínica.
3. Pruebas de billing en sandbox: alta, cobro recurrente, pago fallido (dunning),
   suspensión, reactivación, cancelación, add-on y cambio de plan con prorrateo.
4. Calidad de código: `tsc --noEmit` sin errores, `npm run lint` limpio,
   `npm run build` exitoso.
5. Verifica que NO haya emojis en el código ni en la UI ni en los mensajes del bot
   (usa una búsqueda por rango de emojis), y que los acentos y la ñ estén
   correctos. Asegura UTF-8 en todos los archivos.
6. Verifica que no haya secretos en el repositorio (PAT de GitHub, service_role de
   Supabase, llaves de Mercado Pago, tokens de canal): revisa el historial y los
   archivos. Confirma que existe un .gitignore adecuado y que credenciales-prueba
   (si aplica) está ignorado.
7. Revisa que la app de una sola clínica (Cuenta demo) siga funcionando igual que
   antes para sus usuarios.
8. Actualiza el README con la sección de SaaS multi-tenant: cómo se registra una
   empresa, cómo funcionan planes/add-ons, y cómo administrar desde superadmin (sin
   incluir secretos).
9. Commit + push y etiqueta una versión, por ejemplo v0.5.0-saas.

Criterio de aceptación: aislamiento verificado entre inquilinos; cuotas, billing y
add-ons probados; build/lint/tsc limpios; sin emojis y con acentos/ñ correctos; sin
secretos en el repo; la Cuenta demo funciona como antes; README actualizado y tag
creado.

---

## Resumen de fases

- S0: Arquitectura multi-tenant y plan de migración (sin tocar esquema).
- S1: Modelo de datos multi-tenant + migración de la clínica actual a Cuenta/Clínica demo + RLS.
- S2: Autenticación multi-tenant, selector de clínica y aislamiento por contexto.
- S3: Registro self-service, landing pública y onboarding (wizard).
- S4: Planes con saldo de IA por consumo real, recargas y panel de uso.
- S4b: Dashboard de analítica del agente de IA (pacientes atendidos, reacción, stats).
- S5: Suscripciones recurrentes con Mercado Pago y manejo de estados.
- S6: Add-ons (doctor adicional) y cambios de plan con prorrateo.
- S7: Personalización por clínica (marca, datos, FAQ, canal).
- S8: Panel de superadmin y métricas del SaaS.
- S9: Workflows de n8n multi-tenant por clínica (agente, recordatorios, handoff).
- S10: QA multi-tenant, seguridad, sin secretos, sin emojis, tag de versión.

Notas de seguridad que se mantienen en todo el plan: ningún secreto en el repo
(PAT, service_role, llaves de Mercado Pago, tokens de canal); el usuario captura
sus propios datos de pago en Mercado Pago; Claude Code no crea cuentas de terceros
ni introduce datos financieros; las eliminaciones permanentes y los cambios de
permisos/accesos los hace el usuario desde la UI, no de forma automática.
