const todos = $input.all();
let citas = [];
if (todos.length === 1 && Array.isArray(todos[0].json)) {
  citas = todos[0].json;
} else {
  citas = todos.map(i => i.json).filter(v => v && typeof v === 'object' && !Array.isArray(v));
}

const ahora = Date.now();
const DOS_HORAS = 2 * 3600000;

const elegibles = citas.filter(c => {
  if (!c.clinicas || c.clinicas.activa === false) return false;
  if (!c.clinicas.datos_pago) return false;
  if (!c.patients || !c.patients.channel_user_id) return false;
  const iso = (c.completada_at || '').replace(' ', 'T').replace(/\+(\d{2})$/, '+$1:00');
  const t = new Date(iso).getTime();
  // Enviar solo cuando ya pasaron al menos 2 horas desde que se marco completada (no desde fecha_hora)
  return !isNaN(t) && (ahora - t) >= DOS_HORAS;
});

return elegibles.map(c => ({ json: c }));