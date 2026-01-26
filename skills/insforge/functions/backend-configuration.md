# Functions Admin Configuration

HTTP endpoints to deploy and manage serverless functions. Requires admin authentication.

## Authentication

All admin endpoints require:
```
Authorization: Bearer {admin-token-or-api-key}
```

## List Functions

```
GET /api/functions
Authorization: Bearer {admin-token}
```

## Get Function Details

```
GET /api/functions/{slug}
Authorization: Bearer {admin-token}
```

## Create Function

```
POST /api/functions
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "name": "Hello World",
  "slug": "hello-world",
  "description": "Returns a greeting",
  "code": "export default async function(request) { ... }",
  "status": "active"
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Display name |
| `slug` | string | URL identifier (alphanumeric, hyphens) |
| `description` | string | Optional description |
| `code` | string | Deno JavaScript code |
| `status` | string | `"draft"` or `"active"` |

## Update Function

```
PUT /api/functions/{slug}
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "name": "Hello World v2",
  "code": "export default async function(request) { ... }"
}
```

## Delete Function

```
DELETE /api/functions/{slug}
Authorization: Bearer {admin-token}
```

## Function Code Structure

Functions run in Deno runtime. Export default async function:

```javascript
export default async function(request) {
  // Parse body
  const body = await request.json()

  // Get headers
  const authHeader = request.headers.get('Authorization')

  // Get query params
  const url = new URL(request.url)
  const param = url.searchParams.get('param')

  return new Response(
    JSON.stringify({ message: `Hello, ${body.name}!` }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
```

### Public Function (No Auth Required)

```javascript
import { createClient } from 'npm:@insforge/sdk'

export default async function(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY')
  })

  const { data } = await client.database.from('public_posts').select('*')
  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

### Authenticated Function

```javascript
import { createClient } from 'npm:@insforge/sdk'

export default async function(req) {
  const authHeader = req.headers.get('Authorization')
  const userToken = authHeader?.replace('Bearer ', '')

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    edgeFunctionToken: userToken
  })

  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Access user's data with RLS
  await client.database.from('user_posts').insert([{
    user_id: userData.user.id,
    content: 'My post'
  }])

  return new Response(JSON.stringify({ success: true }))
}
```

## Function Status

| Status | Description |
|--------|-------------|
| `draft` | Saved but not deployed |
| `active` | Deployed and invokable |
| `error` | Deployment error |

## Quick Reference

| Task | Endpoint |
|------|----------|
| List functions | `GET /api/functions` |
| Get function | `GET /api/functions/{slug}` |
| Create function | `POST /api/functions` |
| Update function | `PUT /api/functions/{slug}` |
| Delete function | `DELETE /api/functions/{slug}` |

---

## Best Practices

1. **Check available functions first** before invoking from frontend
   - Call `GET /api/functions` to see existing functions
   - Verify the target function exists and has `status: "active"`

2. **Create function if none exist**
   - If no functions are available, create one first via `POST /api/functions`
   - Set `status: "active"` to make it invokable

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Invoking non-existent function | Check functions first, create if needed |
| Invoking draft function | Ensure function `status` is `"active"` |
| Forgetting to set status to active | Always set `status: "active"` for invokable functions |

## Recommended Workflow

```
1. Check available functions → GET /api/functions
2. If no function exists     → Create one via POST /api/functions
3. Ensure status is active   → Update if needed via PUT /api/functions/{slug}
4. Proceed with SDK invoke   → Use function slug from step 1 or 2
```
