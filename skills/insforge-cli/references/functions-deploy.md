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

## Usage Examples

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

Functions run on Deno Subhosting. Use standard ESM imports and `export default` to define your handler.

- Import `createClient` from `npm:@insforge/sdk`
- Export a default async function that receives a `Request` and returns a `Response`
- Use `Deno.env.get()` to access secrets and environment variables
- Always handle CORS preflight (`OPTIONS`) for browser-invoked functions

### Public Function (No Authentication Required)

```typescript
import { createClient } from 'npm:@insforge/sdk';

export default async function(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Create client with anon token — no authentication needed
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY')
  });

  // Access public data
  const { data, error } = await client.database
    .from('public_posts')
    .select('*')
    .limit(10);

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### Authenticated Function (Access User Data)

```typescript
import { createClient } from 'npm:@insforge/sdk';

export default async function(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Extract token from request headers
  const authHeader = req.headers.get('Authorization');
  const userToken = authHeader ? authHeader.replace('Bearer ', '') : null;

  // Create client with user's token for authenticated access
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    edgeFunctionToken: userToken
  });

  // Get authenticated user
  const { data: userData } = await client.auth.getCurrentUser();
  if (!userData?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Access user's private data or create records with user_id
  await client.database.from('user_posts').insert([{
    user_id: userData.user.id,
    content: 'My post'
  }]);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

## Function Status

| Status | Description |
|--------|-------------|
| `draft` | Saved but not deployed |
| `active` | Deployed and invokable |
| `error` | Deployment error |

## Best Practices

1. **Always handle CORS** — include preflight `OPTIONS` handler and CORS headers in every response
2. **Store credentials as secrets** — use `insforge secrets add` for API keys, base URLs, etc.
3. **Check available functions first** before invoking from frontend
   - Call `insforge functions list` to see existing functions
   - Verify the target function exists and has `status: "active"`
4. **Always return a `Response`** — the runtime expects a `Response` object

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Invoking non-existent function | Check functions first with `insforge functions list`, create if needed |
| Invoking draft function | Ensure function `status` is `"active"` |
| Missing CORS headers | Always handle `OPTIONS` preflight and include CORS headers in responses |
| Forgetting to check auth | For authenticated functions, always verify `getCurrentUser()` before proceeding |

## Recommended Workflow

```
1. Write function code            → insforge/functions/{slug}/index.ts
2. Deploy                         → insforge functions deploy {slug}
3. Check status                   → insforge functions list
4. Ensure secrets are set         → insforge secrets add INSFORGE_BASE_URL https://...
5. Invoke from frontend           → insforge.functions.invoke('{slug}', { body: {...} })
```
