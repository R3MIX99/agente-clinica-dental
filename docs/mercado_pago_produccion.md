# Mercado Pago — Guia de configuracion y paso a produccion

Este documento describe como configurar Mercado Pago en sandbox para desarrollo
y como migrar a produccion sin exponer llaves en el repositorio.

---

## 1. Variables de entorno requeridas

Todas las llaves viven exclusivamente en el servidor. Ninguna debe estar en el
repositorio ni en el cliente.

| Variable               | Descripcion                                               | Entorno       |
|------------------------|-----------------------------------------------------------|---------------|
| `MP_ACCESS_TOKEN`      | Access token de la aplicacion MP (con prefijo TEST- en sandbox) | Servidor      |
| `MP_PUBLIC_KEY`        | Llave publica MP (actualmente no usada en el frontend)    | Servidor      |
| `MP_WEBHOOK_SECRET`    | Secreto para validar la firma HMAC del webhook            | Servidor      |
| `NEXT_PUBLIC_APP_URL`  | URL publica de la app (para construir la `back_url` de MP)| Servidor/build|

---

## 2. Sandbox (desarrollo y pruebas)

### 2.1 Crear la aplicacion en MP

1. Ir a https://www.mercadopago.com.mx/developers/panel/app
2. Crear una nueva aplicacion
3. Habilitar "Suscripciones" en los productos
4. Copiar el **Access Token de prueba** (empieza con `TEST-`) y la **Public Key de prueba**

### 2.2 Configurar el webhook en sandbox

1. En el panel del desarrollador → tu app → Webhooks
2. Agregar la URL: `https://tu-subdominio.vercel.app/api/mp/webhook`
   (para desarrollo local usa ngrok o similar: `https://abc123.ngrok.io/api/mp/webhook`)
3. Seleccionar los eventos: `preapproval` y `payment`
4. Copiar el **Secreto de firma** generado por MP y asignarlo a `MP_WEBHOOK_SECRET`

### 2.3 Cuentas de prueba

MP provee cuentas sandbox para probar el flujo completo:
- Crear cuentas de prueba en: https://www.mercadopago.com.mx/developers/panel/test-users
- Usar esas cuentas para aprobar o rechazar pagos en el checkout sandbox
- Tarjetas de prueba disponibles en: https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards

### 2.4 .env.local para desarrollo

```
MP_ACCESS_TOKEN=TEST-1234567890-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-123456789
MP_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MP_WEBHOOK_SECRET=tu-secreto-de-firma-mp
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

---

## 3. Produccion

### 3.1 Cambiar las llaves

En Vercel (u otro proveedor):
1. Ir a Settings → Environment Variables
2. Reemplazar el valor de `MP_ACCESS_TOKEN` con el **Access Token de produccion** (sin prefijo TEST-)
3. Reemplazar `MP_PUBLIC_KEY` con la **Public Key de produccion**
4. Mantener `MP_WEBHOOK_SECRET` con el secreto del webhook de produccion
5. Actualizar `NEXT_PUBLIC_APP_URL` con el dominio real, ej: `https://app.tudominio.com`

### 3.2 Configurar webhook de produccion

En el panel del desarrollador → tu app → Webhooks:
- URL: `https://app.tudominio.com/api/mp/webhook`
- Eventos: `preapproval` y `payment`
- Copiar y guardar el nuevo secreto de firma en `MP_WEBHOOK_SECRET`

### 3.3 Tipo de cambio en config_sistema

El endpoint cobra en MXN. Si MP requiere cobros en otra moneda, ajustar
`currency_id` en `app/actions/facturacion.ts` → `iniciarCheckout`.

### 3.4 Verificacion antes de lanzar

- [ ] `MP_ACCESS_TOKEN` de produccion no tiene prefijo TEST-
- [ ] Webhook configurado con la URL de produccion y el secreto correcto
- [ ] `NEXT_PUBLIC_APP_URL` apunta al dominio real
- [ ] Hacer un pago de prueba real con una cuenta de MP en modo produccion
- [ ] Verificar que el webhook recibe el evento y actualiza la suscripcion

---

## 4. Flujo de pago (resumen tecnico)

```
Usuario → "Contratar" → iniciarCheckout() [Server Action]
  → POST /preapproval [MP API]
  → Guardar mp_subscription_id en suscripciones
  → Retornar init_point URL
  → window.location.href = init_point (redireccion al checkout de MP)

Usuario autoriza pago en MP
  → MP redirige a /facturacion/resultado?preapproval_id=xxx
  → confirmarCheckout() [Server Action]
  → GET /preapproval/{id} [MP API]
  → Actualizar suscripcion.estado

MP envia eventos al webhook /api/mp/webhook
  → Validar firma HMAC
  → procesarPago() o procesarPreapproval()
  → Actualizar suscripcion.estado + historial_pagos
```

---

## 5. Estados de la suscripcion

| Estado          | Descripcion                                                      | Acceso al sistema |
|-----------------|------------------------------------------------------------------|-------------------|
| `prueba`        | Periodo de prueba gratuito                                       | Completo          |
| `activa`        | Suscripcion pagada y vigente                                     | Completo          |
| `pago_pendiente`| Pago fallido; dentro del periodo de gracia (config: `mp_dias_gracia`) | Completo (temporal) |
| `vencida`       | Pago no regularizado tras el periodo de gracia                   | Solo facturacion  |
| `suspendida`    | Acceso restringido por falta de pago                             | Solo facturacion  |
| `cancelada`     | Suscripcion cancelada por el usuario                             | Solo facturacion  |

### Periodo de gracia

Configurable en `config_sistema` con clave `mp_dias_gracia` (por defecto: 3 dias).
Tras un pago fallido, el acceso se mantiene por ese periodo. Si no se regulariza,
el estado cambia a `suspendida` en la siguiente carga del layout.

---

## 6. Datos que nunca se almacenan

La aplicacion NUNCA almacena:
- Numeros de tarjeta
- CVV / CVC
- Fechas de vencimiento de tarjeta
- Tokens de tarjeta de MP

Solo se almacena el `preapproval_id` (ID publico de la suscripcion en MP)
y el correo del pagador, que MP devuelve en sus respuestas.
