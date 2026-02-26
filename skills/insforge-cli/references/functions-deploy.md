# insforge functions deploy

Deploy (create or update) an edge function.

## Syntax

```bash
insforge functions deploy <slug> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--file <path>` | Path to function source file |
| `--name <name>` | Display name |
| `--description <desc>` | Function description |

## Default File Path

If `--file` is not specified, the CLI looks for:

```
insforge/functions/{slug}/index.ts
```

## What It Does

1. Checks if the function already exists (GET)
2. If exists: updates (PUT)
3. If new: creates (POST)

## Examples

```bash
# Deploy from default path (insforge/functions/my-handler/index.ts)
insforge functions deploy my-handler

# Deploy from custom file
insforge functions deploy cleanup-expired --file ./handler.ts --name "Cleanup Expired" --description "Removes expired records"

# Update an existing function
insforge functions deploy payment-webhook --file ./webhooks/payment.ts
```

## Output

Success message with the slug and action taken (created or updated).

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

## Best Practices

1. **Check available functions first** before invoking from frontend
   - Call `insforge functions list` to see existing functions
   - Verify the target function exists and has `status: "active"`

2. **Create function if none exist**
   - If no functions are available, create one first via `insforge functions deploy`
   - Set `status: "active"` to make it invokable

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Invoking non-existent function | Check functions first, create if needed |
| Invoking draft function | Ensure function `status` is `"active"` |
| Forgetting to set status to active | Always set `status: "active"` for invokable functions |

## Recommended Workflow

```
1. Check available functions → `insforge functions list`
2. If no function exists     → Create one via `insforge functions deploy`
3. Ensure status is active
4. Proceed with invoke       → `insforge functions invoke`
```
