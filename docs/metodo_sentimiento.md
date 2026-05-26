# Metodo de deteccion de sentimiento e intencion — Agente Dental

Este documento describe como se clasifican el sentimiento y la intencion de cada
conversacion, que valores son validos y como se actualiza ese dato.

---

## 1. Columnas en `conversations`

| Columna      | Tipo   | Valores validos                                      |
|--------------|--------|------------------------------------------------------|
| `intencion`  | text   | `cita`, `consulta`, `urgencia`, `recordatorio`, `otro` |
| `sentimiento`| text   | `positivo`, `neutro`, `negativo`                     |

Ambas columnas son opcionales (`NULL`). El dashboard de analitica agrupa los
registros sin valor bajo la categoria "Sin datos".

---

## 2. Quien escribe estos valores

### Fase actual (S4b)
Los valores se asignan **manualmente** en el panel de conversaciones o mediante
seed directo en migraciones de demo. El agente de n8n todavia no los escribe.

### Fase futura (S5+)
n8n llamara al endpoint `PATCH /api/conversaciones/:id/clasificar` al cerrar
cada conversacion, enviando la intencion y el sentimiento detectados por Claude
a partir del historial completo de mensajes.

Ejemplo de payload:
```json
{
  "intencion": "cita",
  "sentimiento": "positivo"
}
```

El endpoint valida los valores contra los permitidos antes de escribir en la base.

---

## 3. Logica de clasificacion sugerida para n8n

### Intencion
Se determina por la **primera intencion clara** del paciente en la conversacion.
Claude recibe el historial y responde con un JSON estructurado:

```
Clasifica la intencion principal de esta conversacion dental.
Opciones: cita | consulta | urgencia | recordatorio | otro
Responde solo con el valor, sin explicacion.
```

### Sentimiento
Se determina por el **tono general del paciente** a lo largo de toda la
conversacion, no solo del ultimo mensaje.

```
Clasifica el sentimiento predominante del paciente en esta conversacion.
Opciones: positivo | neutro | negativo
Considera cortesia, satisfaccion, urgencia y quejas.
Responde solo con el valor, sin explicacion.
```

---

## 4. Uso en el dashboard de analitica

- **KPI "Resolucion automatica"**: conversaciones donde `mode = 'bot'` y `status = 'cerrada'`.
- **Grafica "Distribucion de intenciones"**: agrupacion por `intencion`, frecuencia descendente.
- **Grafica "Sentimiento del paciente"**: dona con los 3 valores + "Sin datos".
- Conversaciones con `intencion = NULL` se cuentan en la categoria "otro" en la
  grafica de intenciones, y en "Sin datos" en la de sentimiento.

---

## 5. Actualizacion sin redespliegue

Los valores permitidos estan definidos como restricciones `CHECK` en PostgreSQL.
Para agregar un nuevo valor (por ejemplo `"seguimiento"`), se requiere una
migracion SQL que modifique la restriccion. No es necesario redesplegar la
aplicacion Next.js, pero si aplicar la migracion en Supabase.
