# Real-time SDK Integration

Use InsForge SDK for WebSocket pub/sub messaging in your frontend application.

## Setup

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://your-project.region.insforge.app',
  anonKey: 'your-anon-key'
})
```

## Connect

```javascript
await insforge.realtime.connect()
console.log('Connected:', insforge.realtime.isConnected)
```

## Subscribe to Channel

```javascript
const { ok, error } = await insforge.realtime.subscribe('order:123')
if (!ok) console.error('Failed:', error?.message)

// Auto-connects if not connected
```

## Listen for Events

```javascript
// Listen for events
insforge.realtime.on('status_changed', (payload) => {
  console.log('Status:', payload.status)
  console.log('Meta:', payload.meta.messageId, payload.meta.timestamp)
})

// Listen once
insforge.realtime.once('order_completed', (payload) => {
  console.log('Completed:', payload)
})

// Remove listener
insforge.realtime.off('status_changed', handler)
```

## Publish Messages

```javascript
// Must be subscribed to channel first
await insforge.realtime.publish('chat:room-1', 'new_message', {
  text: 'Hello!',
  sender: 'Alice'
})
```

## Unsubscribe and Disconnect

```javascript
insforge.realtime.unsubscribe('order:123')
insforge.realtime.disconnect()
```

## Connection Events

```javascript
insforge.realtime.on('connect', () => console.log('Connected'))
insforge.realtime.on('disconnect', (reason) => console.log('Disconnected:', reason))
insforge.realtime.on('connect_error', (err) => console.error('Error:', err))
insforge.realtime.on('error', ({ code, message }) => console.error(code, message))
```

Error codes: `UNAUTHORIZED`, `NOT_SUBSCRIBED`, `INTERNAL_ERROR`

## Properties

```javascript
insforge.realtime.isConnected           // boolean
insforge.realtime.connectionState       // 'disconnected' | 'connecting' | 'connected'
insforge.realtime.socketId              // string
insforge.realtime.getSubscribedChannels() // string[]
```

## Message Metadata

All messages include `meta`:

```javascript
{
  meta: {
    messageId: 'uuid',
    channel: 'order:123',
    senderType: 'system' | 'user',
    senderId: 'user-uuid',  // if user
    timestamp: 'ISO string'
  },
  // ...payload fields
}
```

## Complete Example

```javascript
await insforge.realtime.connect()
await insforge.realtime.subscribe(`order:${orderId}`)

insforge.realtime.on('status_changed', (payload) => {
  updateUI(payload.status)
})

// Client can also publish
await insforge.realtime.publish(`order:${orderId}`, 'viewed', {
  viewedAt: new Date().toISOString()
})
```

---

## Best Practices

1. **Ensure channel pattern exists before subscribing**
   - Channel patterns must be created in `realtime.channels` table (see [backend-configuration.md](backend-configuration.md))
   - If no channel pattern exists, create one first via admin API

2. **Handle connection events**
   - Listen for `connect`, `disconnect`, and `connect_error` events
   - Implement reconnection logic for dropped connections

3. **Clean up subscriptions**
   - Unsubscribe from channels when no longer needed
   - Disconnect when leaving the page/component

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Subscribing without channel pattern configured | ✅ Create channel pattern in backend first |
| ❌ Not handling connection errors | ✅ Listen for `connect_error` and `disconnect` events |
| ❌ Forgetting to unsubscribe | ✅ Clean up subscriptions on component unmount |
| ❌ Publishing without subscribing | ✅ Subscribe to channel before publishing |

## Recommended Workflow

```
1. Create channel patterns   → Via admin API (backend-configuration.md)
2. Connect to realtime       → await insforge.realtime.connect()
3. Subscribe to channel      → await insforge.realtime.subscribe('channel')
4. Listen for events         → insforge.realtime.on('event', handler)
5. Clean up on unmount       → unsubscribe() and disconnect()
```
