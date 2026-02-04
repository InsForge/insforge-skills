# Schedules (Cron Jobs) Backend Configuration

Configure scheduled tasks (cron jobs) that invoke HTTP endpoints on a schedule. Requires admin authentication.

## Authentication

```
Authorization: Bearer {admin-token-or-api-key}
```

## List Schedules

```
GET /api/schedules
Authorization: Bearer {admin-token}
```

Returns all schedules with computed `nextRun` timestamps.

## Get Schedule Details

```
GET /api/schedules/{id}
Authorization: Bearer {admin-token}
```

## Create Schedule

```
POST /api/schedules
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "name": "Daily Report",
  "cronSchedule": "0 9 * * *",
  "functionUrl": "https://your-project.region.insforge.app/functions/daily-report",
  "httpMethod": "POST",
  "headers": {
    "Authorization": "Bearer ${{secrets.REPORT_API_KEY}}"
  },
  "body": {
    "sendEmail": true
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Display name (min 3 characters) |
| `cronSchedule` | string | Yes | 5-field cron expression |
| `functionUrl` | string | Yes | URL to invoke (must be valid URL) |
| `httpMethod` | string | Yes | `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` |
| `headers` | object | No | HTTP headers (supports secret references) |
| `body` | object | No | JSON body to send with request |

## Update Schedule

```
PATCH /api/schedules/{id}
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "cronSchedule": "0 10 * * *",
  "isActive": true
}
```

All fields are optional. Supports partial updates including toggling `isActive`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Updated display name |
| `cronSchedule` | string | Updated cron expression |
| `functionUrl` | string | Updated target URL |
| `httpMethod` | string | Updated HTTP method |
| `headers` | object | Updated headers |
| `body` | object | Updated request body |
| `isActive` | boolean | Enable or disable the schedule |

## Delete Schedule

```
DELETE /api/schedules/{id}
Authorization: Bearer {admin-token}
```

## Get Execution Logs

View execution history for a schedule.

```
GET /api/schedules/{id}/logs?limit=50&offset=0
Authorization: Bearer {admin-token}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max 100 |
| `offset` | number | 0 | Pagination offset |

Response:
```json
{
  "logs": [
    {
      "id": "uuid",
      "scheduleId": "uuid",
      "executedAt": "2026-01-15T09:00:00.000Z",
      "statusCode": 200,
      "success": true,
      "durationMs": 150,
      "message": null
    }
  ],
  "totalCount": 100,
  "limit": 50,
  "offset": 0
}
```

## Cron Expression Format

InsForge uses **5-field cron expressions** (pg_cron format). 6-field expressions with seconds are NOT supported.

```
┌─────────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌─────────── day of month (1-31)
│ │ │ ┌───────── month (1-12)
│ │ │ │ ┌─────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour (at minute 0) |
| `0 9 * * *` | Daily at 9:00 AM |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `0 0 1 * *` | First day of every month at midnight |
| `30 14 * * 1-5` | Weekdays at 2:30 PM |

## Secret References in Headers

Headers can reference secrets stored in InsForge using the syntax `${{secrets.KEY_NAME}}`.

```json
{
  "headers": {
    "Authorization": "Bearer ${{secrets.API_TOKEN}}",
    "X-API-Key": "${{secrets.EXTERNAL_API_KEY}}"
  }
}
```

Secrets are resolved at schedule creation/update time. If a referenced secret doesn't exist, the operation fails with a 404 error.

## Quick Reference

| Task | Endpoint |
|------|----------|
| List schedules | `GET /api/schedules` |
| Get schedule | `GET /api/schedules/{id}` |
| Create schedule | `POST /api/schedules` |
| Update schedule | `PATCH /api/schedules/{id}` |
| Delete schedule | `DELETE /api/schedules/{id}` |
| Get execution logs | `GET /api/schedules/{id}/logs` |

---

## Best Practices

1. **Use 5-field cron expressions only**
   - pg_cron does not support seconds (6-field format)
   - Example: `*/5 * * * *` for every 5 minutes

2. **Store sensitive values as secrets**
   - Use `${{secrets.KEY_NAME}}` in headers for API keys and tokens
   - Create secrets first via the secrets API before referencing them

3. **Target InsForge functions for serverless tasks**
   - Use the function URL format: `https://your-project.region.insforge.app/functions/{slug}`
   - Ensure the target function exists and has `status: "active"`

4. **Monitor execution logs**
   - Check logs regularly to ensure schedules are running successfully
   - Look for non-200 status codes and failed executions

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Using 6-field cron (with seconds) | Use 5-field format only: `minute hour day month day-of-week` |
| Referencing non-existent secret | Create the secret first via secrets API |
| Targeting non-existent function | Verify function exists and is `active` before scheduling |
| Schedule not running | Check `isActive` is `true` and cron expression is valid |

## Recommended Workflow

```
1. Create secrets if needed     -> POST /api/secrets
2. Create/verify target function -> POST /api/functions
3. Create schedule              -> POST /api/schedules
4. Verify schedule is active    -> GET /api/schedules/{id}
5. Monitor execution logs       -> GET /api/schedules/{id}/logs
```
