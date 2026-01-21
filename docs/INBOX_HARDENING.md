# Inbox Hardening (Operación real)

## ✅ Reglas de permisos

- **OWNER / ADMIN / MANAGER**: pueden cambiar status de cualquier conversación.
- **SELLER**: puede cambiar status **solo** si `conversation.assignedToId === userId`.
  - Enforced en backend (no depende del frontend).

## ✅ Búsqueda + filtros

- `q=...` soporta búsqueda por:
  - `phone`
  - `handle`
  - `lead.name`
  - **texto de mensajes** (`messages.text`)
- `assignedToId=unassigned` filtra `assignedToId=null`
- SELLER queda forzado a `assignedToId=userId` server-side (solo ve sus chats).

## ✅ Mensajes: paginación operativa

Endpoint:

- `GET /api/inbox/conversations/:id/messages?limit=50&before=<ISO>`

Comportamiento:
- Sin `before`: devuelve los **últimos N** (orden ascendente en UI)
- Con `before`: devuelve **anteriores** (mensajes con `createdAt < before`)
- Responde `nextBefore` con el cursor para el siguiente “Cargar anteriores”.

## ✅ Idempotencia (anti-duplicados)

- `MessageLog.externalMessageId` es **unique**
- Webhooks usan `externalMessageId` = id del mensaje de proveedor
- Si llega duplicado → se ignora sin error (Prisma P2002)

## ✅ Métricas mínimas

- `inbox_messages_created_total{provider="WHATSAPP|INSTAGRAM"}`

