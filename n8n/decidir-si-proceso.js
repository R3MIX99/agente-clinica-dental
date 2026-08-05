// Vuelve a armar el lote pendiente con datos frescos (tal como
// "Calcular espera de debounce"). Si el mensaje "entrante" mas reciente ya
// NO es el que inserto esta misma ejecucion, algo mas nuevo llego mientras
// se esperaba: esta ejecucion se detiene aqui, la del mensaje nuevo se
// encarga de todo. Si sigue siendo el mas reciente, se combinan todos los
// mensajes del lote en un solo texto para el asistente.
const recientes = $input.all().map((i) => i.json);

const pendientes = [];
for (const m of recientes) {
  if (m.direction === 'saliente') break;
  pendientes.push(m);
}
pendientes.reverse();

const { miMensajeId } = $('Calcular espera de debounce').first().json;
const masReciente = pendientes.length > 0 ? pendientes[pendientes.length - 1] : null;
const deboProcesar = !!masReciente && masReciente.id === miMensajeId;

const ctx = $('Asignar id conversacion').first().json;
const textoCombinado = pendientes.map((m) => m.contenido).join('\n');

return [{ json: { ...ctx, deboProcesar, texto_entrante: textoCombinado || ctx.texto_entrante } }];
