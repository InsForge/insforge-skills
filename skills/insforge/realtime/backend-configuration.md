# Real-time Admin Configuration

Configure real-time channels and database triggers using raw SQL. Requires admin authentication.

## Create Channel Patterns

Use raw SQL endpoint to configure channels.

```
POST /api/database/advance/rawsql
Authorization: Bearer {admin-token-or-api-key}
Content-Type: application/json

{
  "query": "INSERT INTO realtime.channels (pattern, description, enabled) VALUES ('orders', 'Global order events', true), ('order:%', 'Order-specific (order:123)', true), ('chat:%', 'Chat rooms', true)"
}
```

### Pattern Syntax

- `:` as separator (e.g., `order:123`)
- `%` as wildcard (SQL LIKE pattern)

Examples:
- `orders` - Exact match
- `order:%` - Matches `order:123`, `order:456`, etc.
- `chat:%` - Matches `chat:room-1`, `chat:general`, etc.

## Create Database Triggers

Automatically publish events when database records change.

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION notify_order_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'order:' || NEW.id::text,    -- channel
    TG_OP || '_order',           -- event: INSERT_order, UPDATE_order
    jsonb_build_object(
      'id', NEW.id,
      'status', NEW.status,
      'total', NEW.total
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to table
CREATE TRIGGER order_realtime
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_changes();
```

### Conditional Trigger (Status Changes Only)

```sql
CREATE OR REPLACE FUNCTION notify_order_status()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'order:' || NEW.id::text,
    'status_changed',
    jsonb_build_object('id', NEW.id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER order_status_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_order_status();
```

## Access Control (RLS)

RLS is disabled by default. To restrict channel access:

### Enable RLS

```sql
ALTER TABLE realtime.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
```

### Restrict Subscribe (SELECT on channels)

```sql
CREATE POLICY "users_subscribe_own_orders"
ON realtime.channels FOR SELECT
TO authenticated
USING (
  pattern = 'order:%'
  AND EXISTS (
    SELECT 1 FROM orders
    WHERE id = NULLIF(split_part(realtime.channel_name(), ':', 2), '')::uuid
      AND user_id = auth.uid()
  )
);
```

### Restrict Publish (INSERT on messages)

```sql
CREATE POLICY "members_publish_chat"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  channel_name LIKE 'chat:%'
  AND EXISTS (
    SELECT 1 FROM chat_members
    WHERE room_id = NULLIF(split_part(channel_name, ':', 2), '')::uuid
      AND user_id = auth.uid()
  )
);
```

## Quick Reference

| Task | SQL |
|------|-----|
| Create channel | `INSERT INTO realtime.channels (pattern, description, enabled) VALUES (...)` |
| Create trigger | `CREATE TRIGGER ... EXECUTE FUNCTION ...` |
| Publish from SQL | `PERFORM realtime.publish(channel, event, payload)` |
| Enable RLS | `ALTER TABLE realtime.channels ENABLE ROW LEVEL SECURITY` |

---

## Best Practices

1. **Create channel patterns first** before subscribing from frontend
   - Insert channel patterns into `realtime.channels` table
   - Ensure `enabled` is set to `true`

2. **Use specific channel patterns**
   - Use wildcard `%` patterns for dynamic channels (e.g., `order:%` for `order:123`)
   - Use exact patterns for global channels (e.g., `notifications`)

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Subscribing to undefined channel pattern | Create channel pattern in `realtime.channels` first |
| Channel not receiving messages | Ensure channel `enabled` is `true` |
| Publishing without trigger | Create database trigger to auto-publish on changes |

## Recommended Workflow

```
1. Create channel patterns   → INSERT INTO realtime.channels
2. Ensure enabled = true     → Set enabled to true
3. Create triggers if needed → Auto-publish on database changes
4. Proceed with SDK subscribe → Use channel name matching pattern
```
