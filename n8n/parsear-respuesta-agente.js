const ctx = $('Construir system prompt').first().json;
const resp = $input.first().json;

// Con el Structured Output Parser conectado, el Agent devuelve el objeto ya
// parseado en `output`. Si por algun motivo llega como texto, se hace el
// mismo parseo defensivo que antes.
let parsed = { tipo: 'respuesta', texto: 'En este momento no puedo procesar su solicitud. Por favor llame al telefono de la clinica.', intencion: 'otro', sentimiento: 'neutro' };

if (resp.output && typeof resp.output === 'object') {
  parsed = resp.output;
} else {
  const txt = typeof resp.output === 'string' ? resp.output : (resp.text || '');
  try {
    const match = txt.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch (_) {}
}

// El nodo Agent NO trae el conteo de tokens en su propia salida (resp) —
// eso siempre daba 0. Los tokens reales viven en el sub-nodo "Modelo —
// Claude", que se ejecuta una vez por cada llamada interna que hace el
// Agent (una por cada tool usada, mas la respuesta final). Se suman todas
// sus corridas de esta ejecucion para tener el total real.
let tokensEntrada = 0;
let tokensSalida = 0;
try {
  const corridasModelo = $('Modelo — Claude').all();
  for (const item of corridasModelo) {
    const u = item.json?.tokenUsage || {};
    tokensEntrada += u.promptTokens || 0;
    tokensSalida += u.completionTokens || 0;
  }
} catch (_) {}

const INTENCIONES_VALIDAS = ['cita', 'consulta', 'urgencia', 'recordatorio', 'otro'];
const intencion = INTENCIONES_VALIDAS.includes(parsed.intencion) ? parsed.intencion : 'otro';

const sentimientoRaw = (parsed.sentimiento || '').toLowerCase();
const sentimiento = sentimientoRaw === 'positivo' ? 'positivo'
  : sentimientoRaw === 'negativo' ? 'negativo'
  : 'neutro';

return [{ json: { ...ctx, tipo_respuesta: parsed.tipo, texto_respuesta: parsed.texto, intencion, sentimiento, tokens_entrada: tokensEntrada, tokens_salida: tokensSalida } }];
