# Meta Ads (Full) — Ad Accounts → Campaigns → Adsets → Ads

Este documento describe la integración de Meta Ads usada por el CRM en `/ads`.

## Autenticación (todas las llamadas)

Headers requeridos:
- `Authorization: Bearer <accessToken>`
- `X-Organization-Id: <orgId>`

## 1) Listar Ad Accounts

**GET** `/api/integrations/meta/ad-accounts`

```bash
curl -sS 'http://localhost:4000/api/integrations/meta/ad-accounts' \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID"
```

## 2) Configuración (persistir adAccountId por organización)

**GET** `/api/integrations/meta/config`

```bash
curl -sS 'http://localhost:4000/api/integrations/meta/config' \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID"
```

**PUT** `/api/integrations/meta/config`

Body:

```json
{ "adAccountId": "act_123..." }
```

```bash
curl -sS -X PUT 'http://localhost:4000/api/integrations/meta/config' \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H 'Content-Type: application/json' \
  -d '{"adAccountId":"act_123456789"}'
```

## 3) Campaigns (con insights)

**GET** `/api/integrations/meta/campaigns?from=&to=&limit=&after=&adAccountId=`

- `from/to`: ISO (opcional). Default: últimos 30 días.
- `limit`: default 25 (max 100)
- `after`: cursor (opcional)
- `adAccountId`: opcional; si no se manda usa `Organization.settings.meta.adAccountId`

```bash
curl -sS "http://localhost:4000/api/integrations/meta/campaigns?from=2024-01-01&to=2024-01-31&limit=25" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID"
```

## 4) Adsets por Campaign (con insights)

**GET** `/api/integrations/meta/adsets?campaignId=&from=&to=&limit=&after=`

- `campaignId`: requerido

```bash
curl -sS "http://localhost:4000/api/integrations/meta/adsets?campaignId=123456789&limit=25" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID"
```

## 5) Ads por Adset (con insights)

**GET** `/api/integrations/meta/ads?adsetId=&from=&to=&limit=&after=`

- `adsetId`: requerido
- `from/to`: ISO (opcional). Default: últimos 30 días.
- `limit`: default 25 (max 100)
- `after`: cursor (opcional)

```bash
curl -sS "http://localhost:4000/api/integrations/meta/ads?adsetId=987654321&from=2024-01-01&to=2024-01-31&limit=25" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID"
```

## Respuesta (shape)

### Campaigns

```json
{
  "data": [
    {
      "id": "123",
      "name": "Campaign name",
      "status": "ACTIVE",
      "objective": "OUTCOME_SALES",
      "createdTime": "2024-01-01T00:00:00+0000",
      "updatedTime": "2024-01-10T00:00:00+0000",
      "insights": { "spend": "0.00", "impressions": 0, "clicks": 0, "ctr": "0.00", "cpc": "0.00" }
    }
  ],
  "paging": { "after": null }
}
```

### Adsets

```json
{
  "data": [
    {
      "id": "adset_123",
      "name": "Adset name",
      "status": "ACTIVE",
      "dailyBudget": "1000",
      "lifetimeBudget": null,
      "startTime": "2024-01-01T00:00:00+0000",
      "endTime": null,
      "campaignId": "123",
      "insights": { "spend": "0.00", "impressions": 0, "clicks": 0, "ctr": "0.00", "cpc": "0.00" }
    }
  ],
  "paging": { "after": null }
}
```

### Ads

```json
{
  "data": [
    {
      "id": "ad_123",
      "name": "Ad name",
      "status": "ACTIVE",
      "insights": { "spend": "0.00", "impressions": 0, "clicks": 0, "ctr": "0.00", "cpc": "0.00" }
    }
  ],
  "paging": { "after": null }
}
```

## Errores (alto nivel)

- **400**: faltan parámetros requeridos (por ej. `campaignId` / `adsetId`) o Meta no conectado
- **401**: token inválido o sesión inválida
- **502**: error externo consultando Meta Graph API (sin exponer tokens)

