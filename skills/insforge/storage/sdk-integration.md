# Storage SDK Integration

Use InsForge SDK to upload, download, and manage files in your frontend application.

> **Recommended path.** Prefer `@insforge/sdk` for all storage work — it is the supported default for app code (browser and server), handles auth/session scoping, and keeps project-admin credentials in backend/admin tooling. Reach for the [S3-compatible gateway](./s3-gateway.md) only when the consumer is existing S3 tooling (CI pipelines running `aws s3 cp` / `rclone sync`, Terraform, backup/log shippers) where adopting the SDK would be impractical.

## Setup

First, ensure your `.env` file is configured with your InsForge URL and anon key. Get the anon key with `npx @insforge/cli secrets get ANON_KEY`. See the main [SKILL.md](../SKILL.md) for framework-specific variable names and full setup steps.

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,       // adjust prefix for your framework
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY   // adjust prefix for your framework
})
```

For Next.js / SSR Client Components, use the SSR browser client so direct browser uploads have the user's access token:

```typescript
import { createBrowserClient } from '@insforge/sdk/ssr'

const insforge = createBrowserClient()
```

Use `createBrowserClient()` for authenticated browser uploads. It reads the browser-readable `insforge_access_token` cookie and refreshes through `/api/auth/refresh`; the refresh token remains httpOnly.

## Upload File

Upload with specific path/key.

```javascript
const { data, error } = await insforge.storage
  .from('images')
  .upload('posts/post-123/cover.jpg', fileObject)

// IMPORTANT: Save BOTH url and key to database
await insforge.database
  .from('posts')
  .update({
    image_url: data.url,
    image_key: data.key  // Required for download/delete
  })
  .eq('id', 'post-123')
```

## Upload with Auto-Generated Key

```javascript
const { data, error } = await insforge.storage
  .from('uploads')
  .uploadAuto(fileObject)

// data.key: "myfile-1705315200000-abc123.jpg"
```

## Content Type (avoid `application/octet-stream`)

The stored `mimeType` comes from the uploaded blob's `type` property. The SDK
does **not** sniff bytes or guess from the file extension — when `type` is empty,
the object is stored as `application/octet-stream`.

- **Browser**: a `File` from an `<input type="file">` or drag-and-drop already
  carries the correct `type`. Nothing to do.
- **Node / server-side / generated content**: a bare `new Blob([data])` has an
  **empty** `type`. Always set it, or the object is stored as octet-stream:

```javascript
// ✅ type is set → stored as image/png
const blob = new Blob([bytes], { type: 'image/png' })
await insforge.storage.from('images').upload('posts/cover.png', blob)

// ❌ no type → stored as application/octet-stream
await insforge.storage.from('images').upload('posts/cover.png', new Blob([bytes]))

// In Node, a typed File works the same way:
const file = new File([bytes], 'cover.png', { type: 'image/png' })
await insforge.storage.from('images').uploadAuto(file)
```

## Download File

```javascript
// Get key from database
const { data: post } = await insforge.database
  .from('posts')
  .select('image_key')
  .eq('id', 'post-123')
  .single()

// Download using key
const { data: blob, error } = await insforge.storage
  .from('images')
  .download(post.image_key)

const url = URL.createObjectURL(blob)
```

## Delete File

```javascript
const { data, error } = await insforge.storage
  .from('images')
  .remove(post.image_key)

// Clear database reference
await insforge.database
  .from('posts')
  .update({ image_url: null, image_key: null })
  .eq('id', 'post-123')
```

## Important Notes

- **Always save both `url` AND `key`**: The URL is for display; the key is required for download/delete operations
- All methods return `{ data, error }` - always check for errors
- Bucket must exist before uploading (create via admin API)
- In Next.js / SSR apps, direct browser uploads should use `createBrowserClient()` from `@insforge/sdk/ssr` so Storage RLS sees the signed-in user

---

## Best Practices

1. **Verify bucket exists before uploading**
   - Check available buckets via CLI: `insforge storage buckets`
   - If no buckets exist, create one first via admin API

2. **Always store both URL and key**
   - The `url` is for displaying/embedding files
   - The `key` is required for download and delete operations

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Uploading before the bucket exists | Verify the bucket via admin API before uploading |
| Saving only the returned URL | Save both `data.url` and `data.key` |
| Using the URL for download/delete operations | Use the stored `key` |
| Uploading a typeless `Blob` from Node/server (stored as `application/octet-stream`) | Construct the blob with its type: `new Blob([data], { type: 'image/png' })` |
| Creating a plain browser client in SSR Client Components | Use `createBrowserClient()` so access refresh flows through `/api/auth/refresh` and the refresh token remains httpOnly |

## Recommended Workflow

```
1. Check available buckets → insforge storage buckets
2. If no bucket exists     → Create one first
3. Upload file             → Save both url and key to database
4. Display file            → Use url
5. Download/Delete         → Use key
```
