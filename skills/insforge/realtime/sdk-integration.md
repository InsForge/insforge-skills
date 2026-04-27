# Real-time SDK Integration

Use InsForge SDK for WebSocket pub/sub messaging in your frontend application.

## Setup

First, ensure your `.env` file is configured with your InsForge URL and anon key. Get the anon key with `npx @insforge/cli secrets get ANON_KEY`. See the main [SKILL.md](../SKILL.md) for framework-specific variable names and full setup steps.

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,       // adjust prefix for your framework
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY   // adjust prefix for your framework
})
```

## Connect

```javascript
await insforge.realtime.connect()
console.log('Connected:', insforge.realtime.isConnected)
```

## Subscribe to Channel

```javascript
const response = await insforge.realtime.subscribe('order:123')

if (!response.ok) {
  console.error('Failed:', response.error?.message)
} else {
  console.log('Subscribed to:', response.channel)
  console.log('Members already present:', response.presence.members)
}

// Auto-connects if not connected
```

## Presence Snapshot on Subscribe

A successful `subscribe()` always returns a `presence` snapshot:

```javascript
{
  ok: true,
  channel: 'order:123',
  presence: {
    members: [
      {
        type: 'user',
        presenceId: 'user-123',
        joinedAt: '2026-04-25T17:00:00.000Z'
      }
    ]
  }
}
```

Use this snapshot to seed local participant state before listening for live deltas.

- `presence.members` is the initial source of truth for who is already in the channel
- `presenceId` is the stable key for a member: user ID for `type: 'user'`, socket ID for `type: 'anonymous'`
- Authenticated users are deduplicated into one logical member across multiple sockets or tabs
- Anonymous connections are tracked per socket, so multiple tabs show up as separate members
- Do not wait for your own `presence:join` event after subscribing; your own presence is already represented in the subscribe response

## Listen for Events

```javascript
// Listen for events
insforge.realtime.on('status_changed', (payload) => {
  console.log('Status:', payload.status)
  console.log('Meta:', payload.meta.messageId, payload.meta.timestamp)
})

// Presence deltas for other members in the channel
insforge.realtime.on('presence:join', (message) => {
  console.log('Member joined:', message.member.presenceId, message.member.type)
})

insforge.realtime.on('presence:leave', (message) => {
  console.log('Member left:', message.member.presenceId)
})

// Listen once
insforge.realtime.once('order_completed', (payload) => {
  console.log('Completed:', payload)
})

// Remove listener
insforge.realtime.off('status_changed', handler)
```

## Integrate Presence into UI State

```javascript
const channel = `chat:${roomId}`
const response = await insforge.realtime.subscribe(channel)

if (!response.ok) throw new Error(response.error?.message || 'Subscribe failed')

let members = response.presence.members
renderMembers(members)

const handleJoin = ({ member, meta }) => {
  if (meta.channel !== channel) return

  const exists = members.some((current) => current.presenceId === member.presenceId)
  members = exists ? members : [...members, member]
  renderMembers(members)
}

const handleLeave = ({ member, meta }) => {
  if (meta.channel !== channel) return

  members = members.filter((current) => current.presenceId !== member.presenceId)
  renderMembers(members)
}

insforge.realtime.on('presence:join', handleJoin)
insforge.realtime.on('presence:leave', handleLeave)
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

const channel = `order:${orderId}`
const response = await insforge.realtime.subscribe(channel)

if (!response.ok) throw new Error(response.error?.message || 'Subscribe failed')

let members = response.presence.members
renderPresence(members)

insforge.realtime.on('status_changed', (payload) => {
  updateUI(payload.status)
})

insforge.realtime.on('presence:join', ({ member, meta }) => {
  if (meta.channel !== channel) return
  const exists = members.some((current) => current.presenceId === member.presenceId)
  members = exists ? members : [...members, member]
  renderPresence(members)
})

insforge.realtime.on('presence:leave', ({ member, meta }) => {
  if (meta.channel !== channel) return
  members = members.filter((current) => current.presenceId !== member.presenceId)
  renderPresence(members)
})

// Client can also publish
await insforge.realtime.publish(channel, 'viewed', {
  viewedAt: new Date().toISOString()
})
```

---

## Best Practices

1. **Ensure channel pattern exists before subscribing**
   - Channel patterns must be created in `realtime.channels` table via SQL: `INSERT INTO realtime.channels (pattern, description, enabled) VALUES (...)`
   - If no channel pattern exists, create one first via admin API

2. **Seed presence from `subscribe()` before processing deltas**
   - Treat `response.presence.members` as the initial source of truth
   - Apply `presence:join` and `presence:leave` as incremental updates after the subscribe call succeeds
   - Use `presenceId` as your stable UI key

3. **Handle connection events and rebuild presence after reconnect**
   - Listen for `connect`, `disconnect`, and `connect_error` events
   - Presence is ephemeral and tracked in-memory on a single backend instance, so reconnect by subscribing again and rebuilding from the returned snapshot

4. **Design for presence visibility rules**
   - Authenticated subscribers expose their user ID through `presenceId` to other channel members
   - Avoid presence-enabled channels when subscriber identity should stay opaque

5. **Clean up subscriptions**
   - Unsubscribe from channels when no longer needed
   - Disconnect when leaving the page/component

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Subscribing without channel pattern configured | ✅ Create channel pattern in backend first |
| ❌ Waiting for your own `presence:join` event | ✅ Initialize local presence state from `subscribe()` response |
| ❌ Assuming presence is global or durable | ✅ Treat presence as single-instance, in-memory state and resubscribe after reconnects |
| ❌ Not handling connection errors | ✅ Listen for `connect_error` and `disconnect` events |
| ❌ Forgetting to unsubscribe | ✅ Clean up subscriptions on component unmount |
| ❌ Publishing without subscribing | ✅ Subscribe to channel before publishing |

## Recommended Workflow

```text
1. Create channel patterns        → INSERT INTO realtime.channels via SQL
2. Connect to realtime            → await insforge.realtime.connect()
3. Subscribe and seed presence    → const response = await insforge.realtime.subscribe('channel')
4. Listen for events and deltas   → on('event', handler) + on('presence:join'/'presence:leave')
5. Clean up on unmount            → unsubscribe() and disconnect()
```
