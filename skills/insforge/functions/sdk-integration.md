# Functions SDK Integration

Use InsForge SDK to invoke serverless functions from your frontend application.

## Setup

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://your-project.region.insforge.app',
  anonKey: 'your-anon-key'
})
```

## Invoke Function

```javascript
// POST with body (default)
const { data, error } = await insforge.functions.invoke('hello-world', {
  body: { name: 'World' }
})

// GET request
const { data, error } = await insforge.functions.invoke('get-stats', {
  method: 'GET'
})

// With custom headers
const { data, error } = await insforge.functions.invoke('api-endpoint', {
  method: 'PUT',
  body: { id: '123', status: 'active' },
  headers: { 'X-Custom-Header': 'value' }
})
```

## Important Notes

- SDK automatically includes user's auth token
- All methods return `{ data, error }` - always check for errors
- Function must be deployed and have `status: "active"` to be invokable

---

## Best Practices

1. **Verify function exists and is active before invoking**
   - Check available functions via `GET /api/functions` (see [backend-configuration.md](backend-configuration.md))
   - If no functions exist, create one first via admin API
   - Ensure function `status` is `"active"` (not `"draft"`)

2. **Handle errors gracefully**
   - Functions may fail due to code errors or timeouts
   - Always check `error` in response

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Invoking without checking function exists | ✅ Verify function via admin API first |
| ❌ Invoking a draft function | ✅ Ensure function status is `"active"` |
| ❌ Ignoring errors | ✅ Always handle `error` in response |

## Recommended Workflow

```
1. Check available functions → GET /api/functions (admin API)
2. If no function exists     → Create one first with status: "active"
3. Invoke function           → Use function slug
4. Handle response           → Check for errors
```
