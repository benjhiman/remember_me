# Meta Ads Hardening (Performance + Resiliencia)

## ✅ Bulk insights (menos requests)

Para evitar 1 request por item, se usa **bulk insights** vía:

- `GET /act_<adAccountId>/insights?level=campaign|adset|ad`
- `fields=spend,impressions,clicks,ctr,cpc,<id_field>`
- `filtering=[{ field: \"campaign.id|adset.id|ad.id\", operator: \"IN\", value: [...] }]`
- `time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}`

Si bulk falla, el endpoint devuelve items con insights en cero (fail-soft) y se puede reintentar.

## ✅ Cache Redis (fail-open)

Se cachea por 60–180s (default 120s) por clave:

- orgId
- adAccountId / campaignId / adsetId
- from/to
- limit/after

Variables:
- `REDIS_URL` (si no está, cache se deshabilita)
- `META_CACHE_TTL_SEC` (default 120)

Fail-open:
- Si Redis cae/no responde, **no rompe** los endpoints.

## ✅ Refresh / bypass cache

El frontend puede forzar refresh con:

- `?refresh=1` en `campaigns`, `adsets`, `ads`

Esto bypass cache y recalcula.

## ✅ Métricas mínimas

Prometheus:
- `meta_requests_total{endpoint,status}`
- `meta_latency_ms{endpoint,status}`

