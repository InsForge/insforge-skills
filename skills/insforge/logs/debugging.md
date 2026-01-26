# Logs Debugging

Fetch container logs to debug backend runtime issues. Requires admin authentication.

## Authentication

```
Authorization: Bearer {admin-token-or-api-key}
```

## Get Container Logs

```
GET /api/logs/{source}?limit={limit}
Authorization: Bearer {admin-token-or-api-key}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | Log source (see below) |
| `limit` | number | Number of logs to return (default: 20) |

## Log Sources

| Source | Description |
|--------|-------------|
| `insforge.logs` | Main InsForge backend logs |
| `postgREST.logs` | PostgREST API layer logs |
| `postgres.logs` | PostgreSQL database logs |
| `function.logs` | Serverless function execution logs |

## Quick Reference

| Task | Endpoint |
|------|----------|
| InsForge backend logs | `GET /api/logs/insforge.logs` |
| Database API logs | `GET /api/logs/postgREST.logs` |
| Database logs | `GET /api/logs/postgres.logs` |
| Function logs | `GET /api/logs/function.logs` |

---

## Best Practices

1. **Start with function.logs for function issues**
   - Check execution errors, timeouts, and runtime exceptions

2. **Use postgres.logs for query problems**
   - Debug slow queries, constraint violations, connection issues

3. **Check insforge.logs for API errors**
   - Authentication failures, request validation, general backend errors

## Common Debugging Scenarios

| Problem | Check |
|---------|-------|
| Function not working | `function.logs` |
| Database query failing | `postgres.logs`, `postgREST.logs` |
| Auth issues | `insforge.logs` |
| API returning 500 errors | `insforge.logs`, `postgREST.logs` |
