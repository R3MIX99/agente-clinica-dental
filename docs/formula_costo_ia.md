# Formula de costo de IA — Agente Dental

Este documento describe como se calcula el costo de cada llamada a la API de Claude,
como se descuenta del saldo de la clinica y cuales son las reglas de acumulacion.

Todos los parametros son configurables por el superadmin en la tabla `config_sistema`
de Supabase sin necesidad de redespliegue.

---

## 1. Costo real de la API (en USD)

```
costo_api_usd = (tokens_entrada / 1_000_000 x precio_input_usd_por_mtoken)
              + (tokens_salida  / 1_000_000 x precio_output_usd_por_mtoken)
```

### Valores por defecto (modelo claude-haiku-4-5-20251001)

| Parametro                           | Valor por defecto | Clave en config_sistema              |
|-------------------------------------|-------------------|--------------------------------------|
| Precio tokens de entrada (USD/MTok) | 0.80              | ia_precio_input_usd_por_mtoken       |
| Precio tokens de salida  (USD/MTok) | 4.00              | ia_precio_output_usd_por_mtoken      |

> Actualizar estos valores en `config_sistema` cuando Anthropic cambie sus precios,
> sin necesidad de redesplegar la aplicacion.

---

## 2. Conversion a MXN con markup

```
costo_descontado_mxn = costo_api_usd x tipo_cambio_usd_mxn x markup
```

| Parametro               | Valor por defecto | Clave en config_sistema  |
|-------------------------|-------------------|--------------------------|
| Tipo de cambio USD/MXN  | 17.50             | ia_tipo_cambio_usd_mxn   |
| Markup (multiplicador)  | 2.00              | ia_markup                |

El markup de 2.00 significa que se cobra el doble del costo real de la API.
Esto cubre: margen del negocio, variaciones en el tipo de cambio, costos de
infraestructura y un colchon para que el servicio no opere a perdida.

---

## 3. Ejemplo concreto

Mensaje con **800 tokens de entrada** y **400 tokens de salida**:

```
costo_api_usd = (800 / 1_000_000 x 0.80) + (400 / 1_000_000 x 4.00)
              = 0.00064 + 0.00160
              = 0.00224 USD

costo_descontado_mxn = 0.00224 x 17.50 x 2.00
                     = 0.0784 MXN
```

Es decir, un mensaje de ese tamano cuesta aproximadamente **$0.08 pesos** del saldo.

Con el plan Profesional ($1,899/mes, $380 MXN de saldo de IA):
- Mensajes posibles aproximados: 380 / 0.0784 = ~4,846 mensajes por periodo.

---

## 4. Saldo incluido por plan

```
saldo_ia_incluido_mxn = precio_mensual_mxn x (saldo_ia_pct / 100)
```

El porcentaje por defecto es 20%, configurable en `ia_pct_saldo_plan`.

| Plan         | Precio mensual | Saldo de IA incluido |
|--------------|----------------|----------------------|
| Solo         | $599 MXN       | $120 MXN             |
| Profesional  | $1,899 MXN     | $380 MXN             |
| Clinica      | $3,799 MXN     | $760 MXN             |

---

## 5. Reglas de acumulacion de saldo

| Tipo de saldo     | Se acumula al siguiente periodo |
|-------------------|---------------------------------|
| Saldo incluido    | No (configurable en `ia_saldo_incluido_acumula`) |
| Saldo de recargas | Si, si `vigencia_fin` es posterior al fin del periodo |

Regla por defecto: el saldo incluido no consumido se pierde al cerrar el periodo.
Las recargas compradas adicionalmente tienen `vigencia_fin` propio y pueden sobrevivir
al cambio de periodo.

**Orden de descuento:** primero se consume el saldo incluido del periodo, luego el de
recargas (implementacion futura). Actualmente todo el saldo se maneja en el campo
`saldo_ia_disponible_mxn` de la suscripcion.

---

## 6. Comportamiento al agotar el saldo

Configurable en `ia_comportamiento_saldo_cero`:

| Valor               | Comportamiento                                                              |
|---------------------|-----------------------------------------------------------------------------|
| pausar_y_notificar  | (Predeterminado) El agente responde al paciente que pronto lo atendera una persona. La conversacion se marca para handoff manual. El equipo recibe notificacion. |
| continuar           | El agente sigue respondiendo sin descontar (no recomendado, puede generar perdidas). |

El saldo **nunca se cobra de mas** sin consentimiento del administrador de la clinica.

---

## 7. Aviso de saldo bajo

Cuando el saldo restante baja del umbral configurado en `ia_umbral_saldo_bajo_pct`
(20% por defecto), el panel de "Uso y plan" muestra un aviso destacado con boton
de recarga. En fases futuras se enviara tambien una notificacion al administrador.

---

## 8. Implementacion tecnica

- **Funcion PostgreSQL atomica:** `public.registrar_consumo_ia()` — descuenta el saldo
  y registra el consumo en `consumos_ia` en una sola transaccion con `FOR UPDATE` para
  evitar condiciones de carrera cuando hay multiples mensajes simultaneos.
- **Endpoint n8n:** `POST /api/ia/consumo` — llamado por n8n despues de cada respuesta
  del agente. Requiere header `X-Shared-Secret`.
- **Consulta previa:** `GET /api/ia/consumo?clinica_id=uuid` — n8n consulta antes de
  llamar a Claude para decidir si el saldo esta disponible.
- **Funcion de lectura:** `public.ia_disponible(p_clinica_id)` — retorna JSON con
  `disponible`, `saldo`, `pct_restante`, `saldo_bajo`, `agotado`.
