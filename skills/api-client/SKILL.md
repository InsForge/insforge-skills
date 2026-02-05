---
name: api-client
description: |
  Universal API client for interacting with external services. Use when developers need to:
  (1) REST: Fetch data, handle authentication, and manage resources via standard HTTP methods
  (2) GraphQL: Execute queries and mutations against a GraphQL endpoint
  (3) WebSockets: Establish real-time, bi-directional connections for events
license: MIT
metadata:
  author: user
  version: "1.0.0"
---

# API Client Skill

## STOP: Check Credentials & Type First

**Before writing code, clearly identify the API type and required credentials.**

| Type | Required Info | Example |
|------|---------------|---------|
| **REST** | Base URL, API Key/Token | `https://api.example.com`, `Bearer ey...` |
| **GraphQL** | Endpoint, Query/Mutation | `https://api.example.com/graphql`, `query { me { name } }` |
| **WebSocket** | WebSocket URL (wss://) | `wss://api.example.com/v1/stream` |

**Action:** If requirements are missing, **ASK THE USER** before guessing endpoints.

---

## 1. REST API Usage

Use for standard request/response interactions.

### Basic Setup (JS/TS)
```javascript
const API_BASE_URL = 'https://api.example.com/v1';
const HEADERS = {
  'Authorization': `Bearer ${process.env.API_KEY}`,
  'Content-Type': 'application/json'
};
```

### GET Request
```javascript
const response = await fetch(`${API_BASE_URL}/users`, { headers: HEADERS });
if (!response.ok) throw new Error(`GET failed: ${response.status}`);
const data = await response.json();
```

### POST Request
```javascript
const response = await fetch(`${API_BASE_URL}/users`, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify({ name: 'Alice' })
});
```

---

## 2. GraphQL API Usage

Use for fetching specific data structures or batched operations.

### Basic Setup
Requires a single POST endpoint.

```javascript
const GQL_ENDPOINT = 'https://api.example.com/graphql';
```

### Query Execution
```javascript
const query = `
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
    }
  }
`;

const response = await fetch(GQL_ENDPOINT, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify({
    query,
    variables: { id: "123" }
  })
});

const { data, errors } = await response.json();
if (errors) console.error(errors);
```

---

## 3. WebSocket Usage

Use for real-time streams (chat, tickers, notifications).

### Connection Logic
Always verify protocol-specific connection requirements (e.g., auth in query param or initial message).

```javascript
const ws = new WebSocket('wss://api.example.com/stream?token=...');

ws.onopen = () => {
  console.log('Connected');
  // Send initial auth/subscription message if required
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'alerts' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onerror = (error) => console.error('WebSocket Error:', error);

ws.onclose = () => console.log('Disconnected');
```

---

## Best Practices

1. **Environment Variables**: Never hardcode API keys. Use `process.env`.
2. **Error Handling**: gracefully handle network failures, timeouts, and non-200 status codes.
3. **Rate Limiting**: Be aware of API limits; implement retry logic with exponential backoff if necessary.
4. **Cleanup**: Always close WebSocket connections (`ws.close()`) when components unmount.
