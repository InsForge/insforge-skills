# Storage SDK Integration

Use InsForge SDK to upload, download, and manage files in your frontend application.

## Setup

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://your-project.region.insforge.app',
  anonKey: 'your-anon-key'
})
```

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

---

## Best Practices

1. **Verify bucket exists before uploading**
   - Check available buckets via `GET /api/storage/buckets` (see [backend-configuration.md](backend-configuration.md))
   - If no buckets exist, create one first via admin API

2. **Always store both URL and key**
   - The `url` is for displaying/embedding files
   - The `key` is required for download and delete operations

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Uploading without checking bucket exists | ✅ Verify bucket via admin API first |
| ❌ Only saving URL, not key | ✅ Save both `data.url` and `data.key` to database |
| ❌ Using URL for download/delete | ✅ Use the stored `key` for these operations |

## Recommended Workflow

```
1. Check available buckets → GET /api/storage/buckets (admin API)
2. If no bucket exists     → Create one first
3. Upload file             → Save both url and key to database
4. Display file            → Use url
5. Download/Delete         → Use key
```
