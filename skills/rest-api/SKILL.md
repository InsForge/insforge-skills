---
name: rest-api
description: |
  Interact with external REST APIs. Use when developers need to:
  (1) Fetch data from remote endpoints using standard HTTP methods
  (2) Authenticate requests via API Keys or OAuth tokens
  (3) Parse JSON responses and handle errors gracefully
license: MIT
metadata:
  author: user
  version: "1.0.0"
---

# REST API Skill

## STOP: Check Credentials First

**You MUST have these before making ANY API calls:**

| Credential | Format | Required For |
|------------|--------|--------------|
| **Base URL** | `https://api.example.com/v1` | All API calls |
| **API Key** | `eyJbh...` or `api_key_...` | Authorization header |

**Action:** If the user has not provided credentials, **ASK NOW** before proceeding.

---

## When to Use This Skill

Use this skill when you need to:
- Retrieve data from a third-party service (GET)
- Create new resources on a remote server (POST)
- Update existing resources (PUT/PATCH)
- Delete resources (DELETE)

## Basic Usage

### 1. Setup

Ensure you have a way to make HTTP requests (e.g., `fetch` in JS/TS, `requests` in Python).

**JavaScript/TypeScript:**
```javascript
const API_BASE_URL = 'https://api.example.com/v1';
const API_KEY = process.env.API_KEY;

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};
```

### 2. Making Requests

**GET Request:**
```javascript
const response = await fetch(`${API_BASE_URL}/resource`, { headers });
const data = await response.json();
```

**POST Request:**
```javascript
const response = await fetch(`${API_BASE_URL}/resource`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'New Item' })
});
```

## Common Patterns

### Error Handling
Always check for non-2xx status codes.

```javascript
if (!response.ok) {
  throw new Error(`API Error: ${response.status} ${response.statusText}`);
}
```

### Pagination
Handle pagination logic if the API returns paginated results (e.g., `page` query param or `next_token`).

## Module Reference

If this skill interacts with a specific complex service, organize documentation by resource:

| Module | Documentation |
|--------|---------------|
| **Users** | [users/endpoints.md](users/endpoints.md) |
| **Products** | [products/endpoints.md](products/endpoints.md) |
