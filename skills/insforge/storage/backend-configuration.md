# Storage Admin Configuration

HTTP endpoints to manage storage buckets. Requires admin authentication.

## Authentication

All admin endpoints require:
```
Authorization: Bearer {admin-token-or-api-key}
```

## List Buckets

```
GET /api/storage/buckets
Authorization: Bearer {admin-token}
```

## Create Bucket

```
POST /api/storage/buckets
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "bucketName": "user-uploads",
  "isPublic": false
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `bucketName` | string | Unique bucket identifier |
| `isPublic` | boolean | `true` for public access, `false` for authenticated only |

## Update Bucket Visibility

```
PATCH /api/storage/buckets/{bucketName}
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "isPublic": true
}
```

## Delete Bucket

```
DELETE /api/storage/buckets/{bucketName}
Authorization: Bearer {admin-token}
```

## List Objects in Bucket

```
GET /api/storage/buckets/{bucketName}/objects?prefix=users/&limit=50
Authorization: Bearer {admin-token}
```

Query parameters:
- `prefix`: Filter by path prefix
- `limit`: Maximum results

## Quick Reference

| Task | Endpoint |
|------|----------|
| List buckets | `GET /api/storage/buckets` |
| Create bucket | `POST /api/storage/buckets` |
| Update bucket | `PATCH /api/storage/buckets/{name}` |
| Delete bucket | `DELETE /api/storage/buckets/{name}` |
| List objects | `GET /api/storage/buckets/{name}/objects` |

---

## Best Practices

1. **Always check available buckets first** before implementing storage features
   - Call `GET /api/storage/buckets` to see existing buckets
   - Verify the target bucket exists before attempting uploads

2. **Create bucket if none exist**
   - If no buckets are available, create one first via `POST /api/storage/buckets`
   - Uploads will fail if the bucket doesn't exist

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Uploading to non-existent bucket | Check buckets first, create if needed |
| Assuming buckets exist | Always verify with `GET /api/storage/buckets` |

## Recommended Workflow

```
1. Check available buckets → GET /api/storage/buckets
2. If no bucket exists     → Create one via POST /api/storage/buckets
3. Proceed with SDK uploads → Use bucket name from step 1 or 2
```
