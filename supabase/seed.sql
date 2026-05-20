-- Seed de datos de ejemplo (español, sin emojis)
-- Las citas dentro de la ventana 24h se calculan con now() para que la demo del
-- recordatorio funcione en cualquier momento que se aplique el seed.

insert into clinic_info (nombre, direccion, telefono, email, sitio_web, horario, formas_pago, facturacion, mapa_url, faq)
values (
  'Clínica Dental Sonrisa Plena',
  'Av. Reforma 123, Col. Centro, Ciudad de México, CP 06000',
  '+52 55 1234 5678',
  'contacto@sonrisaplena.mx',
  'https://www.sonrisaplena.mx',
  'Lunes a viernes de 9:00 a 19:00, sábados de 9:00 a 14:00',
  'Efectivo, tarjetas de crédito y débito, transferencia bancaria',
  'Emitimos factura. Solicitela en recepción o al correo facturacion@sonrisaplena.mx con sus datos fiscales.',
  'https://maps.google.com/?q=Av.+Reforma+123+CDMX',
  '[
    {"pregunta":"Dónde están ubicados?","respuesta":"Estamos en Av. Reforma 123, Col. Centro, Ciudad de México, CP 06000."},
    {"pregunta":"Cuál es su horario?","respuesta":"Lunes a viernes de 9:00 a 19:00 y sábados de 9:00 a 14:00."},
    {"pregunta":"Qué servicios ofrecen?","respuesta":"Limpieza dental, revisión general, blanqueamiento, extracciones, resinas y consulta de ortodoncia."},
    {"pregunta":"Cómo agendo una cita?","respuesta":"Puede agendar por este chat, por teléfono al +52 55 1234 5678 o en recepción."},
    {"pregunta":"Tienen teléfono y correo?","respuesta":"Teléfono +52 55 1234 5678 y correo contacto@sonrisaplena.mx."},
    {"pregunta":"Puedo facturar?","respuesta":"Sí. Solicite su factura en recepción o escriba a facturacion@sonrisaplena.mx con sus datos fiscales."},
    {"pregunta":"Qué formas de pago aceptan?","respuesta":"Efectivo, tarjetas de crédito y débito, y transferencia bancaria."},
    {"pregunta":"Tienen sitio web?","respuesta":"Sí, www.sonrisaplena.mx."}
  ]'::jsonb
);

insert into services (nombre, descripcion, precio, duracion_min, activo) values
  ('Limpieza dental', 'Limpieza y profilaxis dental completa', 700.00, 40, true),
  ('Revisión general', 'Consulta y diagnóstico general', 400.00, 30, true),
  ('Blanqueamiento', 'Blanqueamiento dental en consultorio', 2500.00, 60, true),
  ('Extracción', 'Extracción dental simple', 900.00, 45, true),
  ('Consulta de ortodoncia', 'Valoración para tratamiento de ortodoncia', 500.00, 30, true),
  ('Resina', 'Restauración con resina por pieza', 850.00, 45, true);

insert into patients (nombre, telefono, email, channel, channel_user_id, notas) values
  ('María González', '+52 55 1111 1111', 'maria.gonzalez@example.com', 'telegram', '100000001', 'Prefiere citas por la mañana'),
  ('Juan Pérez', '+52 55 2222 2222', 'juan.perez@example.com', 'telegram', '100000002', null),
  ('Ana Ramírez', '+52 55 3333 3333', 'ana.ramirez@example.com', 'telegram', '100000003', 'Alergia a la penicilina'),
  ('Carlos López', '+52 55 4444 4444', 'carlos.lopez@example.com', 'telegram', '100000004', null);

insert into agents (nombre, email, role, activo) values
  ('Laura Mendoza', 'laura.mendoza@sonrisaplena.mx', 'admin', true),
  ('Sofía Torres', 'sofia.torres@sonrisaplena.mx', 'recepcion', true),
  ('Diego Herrera', 'diego.herrera@sonrisaplena.mx', 'recepcion', true);

-- Citas: 2 dentro de la ventana 24h (recordatorio pendiente), más otras de muestra
insert into appointments (patient_id, service_id, fecha_hora, status, costo, recordatorio_enviado_at, notas)
select p.id, s.id, now() + interval '24 hours', 'confirmada', s.precio, null, 'Cita dentro de ventana 24h'
from patients p, services s
where p.channel_user_id = '100000001' and s.nombre = 'Limpieza dental';

insert into appointments (patient_id, service_id, fecha_hora, status, costo, recordatorio_enviado_at, notas)
select p.id, s.id, now() + interval '23 hours 30 minutes', 'programada', s.precio, null, 'Cita dentro de ventana 24h'
from patients p, services s
where p.channel_user_id = '100000002' and s.nombre = 'Revisión general';

insert into appointments (patient_id, service_id, fecha_hora, status, costo, recordatorio_enviado_at, notas)
select p.id, s.id, now() + interval '3 days', 'programada', s.precio, null, null
from patients p, services s
where p.channel_user_id = '100000003' and s.nombre = 'Blanqueamiento';

insert into appointments (patient_id, service_id, fecha_hora, status, costo, recordatorio_enviado_at, notas)
select p.id, s.id, now() - interval '2 days', 'completada', s.precio, now() - interval '3 days', 'Cita pasada'
from patients p, services s
where p.channel_user_id = '100000004' and s.nombre = 'Resina';

insert into appointments (patient_id, service_id, fecha_hora, status, costo, recordatorio_enviado_at, notas)
select p.id, s.id, now() + interval '7 days', 'programada', s.precio, null, null
from patients p, services s
where p.channel_user_id = '100000001' and s.nombre = 'Consulta de ortodoncia';

insert into conversations (patient_id, channel, mode, status, assigned_agent_id, last_message_at)
select p.id, 'telegram', 'bot', 'abierta', null, now() - interval '10 minutes'
from patients p where p.channel_user_id = '100000001';

insert into conversations (patient_id, channel, mode, status, assigned_agent_id, last_message_at)
select p.id, 'telegram', 'humano', 'pendiente', a.id, now() - interval '2 minutes'
from patients p, agents a
where p.channel_user_id = '100000003' and a.email = 'sofia.torres@sonrisaplena.mx';

insert into messages (conversation_id, direction, sender, contenido, created_at)
select c.id, 'entrante', 'paciente', 'Hola, cuál es su horario?', now() - interval '12 minutes'
from conversations c join patients p on p.id = c.patient_id
where p.channel_user_id = '100000001';

insert into messages (conversation_id, direction, sender, contenido, created_at)
select c.id, 'saliente', 'bot', 'Hola. Nuestro horario es de lunes a viernes de 9:00 a 19:00 y sábados de 9:00 a 14:00.', now() - interval '11 minutes'
from conversations c join patients p on p.id = c.patient_id
where p.channel_user_id = '100000001';

insert into messages (conversation_id, direction, sender, contenido, created_at)
select c.id, 'entrante', 'paciente', 'Quiero hablar con una persona por favor', now() - interval '4 minutes'
from conversations c join patients p on p.id = c.patient_id
where p.channel_user_id = '100000003';

insert into messages (conversation_id, direction, sender, contenido, created_at)
select c.id, 'saliente', 'bot', 'En un momento le atiende un miembro de nuestro equipo.', now() - interval '3 minutes'
from conversations c join patients p on p.id = c.patient_id
where p.channel_user_id = '100000003';
