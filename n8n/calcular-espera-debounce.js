// Junta los mensajes "entrante" mas recientes hasta toparse con el ultimo
// "saliente" (o el inicio de la lista) -> ese es el lote pendiente de
// responder. Calcula cuanto falta esperar: DEBOUNCE_SEGUNDOS despues de
// CADA mensaje, pero nunca mas de TOPE_SEGUNDOS desde que llego el primer
// mensaje del lote (para no posponer la respuesta para siempre si el
// paciente no deja de escribir).
const DEBOUNCE_SEGUNDOS = 12;
const TOPE_SEGUNDOS = 30;

const recientes = $input.all().map((i) => i.json);
// vienen mas nuevo -> mas viejo (order=created_at.desc); se recorren asi
// hasta el primer "saliente", y se voltean para quedar cronologico.
const pendientes = [];
for (const m of recientes) {
  if (m.direction === 'saliente') break;
  pendientes.push(m);
}
pendientes.reverse();

const miMensajeRaw = $('Insertar mensaje entrante2').first().json;
const miMensaje = Array.isArray(miMensajeRaw) ? miMensajeRaw[0] : miMensajeRaw;

const primerPendienteAt = pendientes.length > 0
  ? new Date(pendientes[0].created_at).getTime()
  : Date.now();
const transcurridoSeg = (Date.now() - primerPendienteAt) / 1000;
const esperaSegundos = Math.max(1, Math.min(DEBOUNCE_SEGUNDOS, Math.ceil(TOPE_SEGUNDOS - transcurridoSeg)));

return [{ json: { esperaSegundos, miMensajeId: miMensaje.id } }];
