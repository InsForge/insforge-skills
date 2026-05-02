# Payments Backend Configuration

Use the InsForge CLI to configure Stripe keys, sync Stripe catalog state, and manage products/prices. Use this before adding payment UI in app code.

## Availability

Payments are in private preview. Older projects or self-hosted backends may not expose `/api/payments`.

Run `npx @insforge/cli payments status` before configuring Stripe. If the CLI says `Payments are not available on this backend`, stop and ask the developer/admin to enable payments or upgrade the self-hosted backend. Do not fall back to generic secrets or direct Stripe secret-key usage in app code.

## Core Model

InsForge Payments uses the developer's own Stripe account. There are two independent environments:

- `test` uses the Stripe test secret key.
- `live` uses the Stripe live secret key.

Stripe is the source of truth. Product and price mutations go to Stripe first, then InsForge mirrors the result locally. Sync pulls Stripe products, prices, and subscriptions into the InsForge payments schema.

## Initial Setup

```bash
# Verify CLI auth and linked project
npx @insforge/cli whoami
npx @insforge/cli current

# Configure Stripe keys
npx @insforge/cli payments config set test sk_test_xxx
npx @insforge/cli payments config set live sk_live_xxx

# Check connection, sync, and webhook state
npx @insforge/cli payments status
```

Key configuration validates the key, records the Stripe account identity, best-effort configures the managed webhook, and runs one unified sync when the account changes. If webhook creation fails locally because the backend URL is not public, key configuration still succeeds.

## Sync Stripe State

```bash
# Sync all configured environments
npx @insforge/cli payments sync

# Sync one environment
npx @insforge/cli payments sync --environment test

# Inspect catalog
npx @insforge/cli payments catalog --environment test
```

Manual sync does not configure webhooks. It only syncs products, prices, and subscriptions from Stripe to InsForge.

## Manage Products

```bash
npx @insforge/cli payments products list --environment test

npx @insforge/cli payments products create \
  --environment test \
  --name "Pro Plan" \
  --description "Monthly access to Pro features" \
  --idempotency-key "product:pro"

npx @insforge/cli payments products update prod_123 \
  --environment test \
  --active true

npx @insforge/cli payments products delete prod_123 \
  --environment test \
  -y
```

Product delete only works when Stripe allows deletion. Products with prices generally cannot be deleted; archive or deactivate them instead.

## Manage Prices

```bash
# One-time price
npx @insforge/cli payments prices create \
  --environment test \
  --product prod_123 \
  --currency usd \
  --unit-amount 4900 \
  --idempotency-key "price:pro:onetime"

# Monthly recurring price
npx @insforge/cli payments prices create \
  --environment test \
  --product prod_123 \
  --currency usd \
  --unit-amount 1900 \
  --interval month \
  --idempotency-key "price:pro:monthly"

# Archive a price
npx @insforge/cli payments prices archive price_123 --environment test
```

Stripe prices are immutable for amount/currency/recurring cadence. To change those fields, create a new price and archive the old one.

## Configure Webhooks

```bash
npx @insforge/cli payments webhooks configure test
npx @insforge/cli payments webhooks configure live
```

Managed webhooks keep checkout sessions, subscriptions, and payment history projected into InsForge. Stripe requires a publicly accessible webhook URL; localhost backends should use Stripe CLI for local webhook testing.

## Checkout and Portal Authorization

Before exposing subscription checkout or customer subscription management UI, implement the app's desired RLS policies on the payment session tables:

- `payments.checkout_sessions` controls who can create and read Checkout Session attempts for a billing subject.
- `payments.customer_portal_sessions` controls who can create and read Billing Portal Session attempts for a billing subject.

This must be based on the app's business model. A subject can be a user, team, organization, workspace, tenant, group, or any other billing owner. InsForge cannot infer that automatically.

For anonymous one-time purchases, the app may choose to keep checkout unrestricted. For subscriptions, team/org billing, or any flow where the caller passes `subject`, add policies before shipping UI so one user cannot start checkout or open subscription management for another user's subject.

Example for team billing:

```sql
ALTER TABLE payments.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments.customer_portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team members create checkout sessions"
ON payments.checkout_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  subject_type = 'team'
  AND subject_id ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = subject_id::uuid
      AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "team members read checkout sessions"
ON payments.checkout_sessions
FOR SELECT
TO authenticated
USING (
  subject_type = 'team'
  AND subject_id ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = subject_id::uuid
      AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "team members create portal sessions"
ON payments.customer_portal_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  subject_type = 'team'
  AND EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = subject_id::uuid
      AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "team members read portal sessions"
ON payments.customer_portal_sessions
FOR SELECT
TO authenticated
USING (
  subject_type = 'team'
  AND subject_id ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = subject_id::uuid
      AND tm.user_id = auth.uid()
  )
);
```

Adjust table names, ID casts, and membership checks to the app schema. Do not copy this policy blindly if the app uses organizations, workspaces, groups, string IDs, or user-level billing.

If enabling RLS on `payments.checkout_sessions` and the app still needs anonymous one-time checkout, add separate narrow `anon` INSERT and SELECT policies for `mode = 'payment'` rows with `subject_type IS NULL` and `subject_id IS NULL`.

## Runtime Integration

After keys and catalog are ready, use the SDK from app code:

- [sdk-integration.md](sdk-integration.md) for checkout and customer portal flows.
- `npx @insforge/cli payments subscriptions --environment test` for admin debugging.
- `npx @insforge/cli payments history --environment test` for admin debugging.

## Fulfillment Business Logic

InsForge mirrors Stripe webhook state into payment projection tables, but it cannot know the app's business rules. Agents should add app-specific migrations that copy payment state into app-owned tables with app-specific RLS.

Use these source tables:

| App need | Source table | Signal |
|----------|--------------|--------|
| One-time fulfillment | `payments.payment_history` | `type = 'one_time_payment'` and `status = 'succeeded'` |
| Refund handling | `payments.payment_history` | `type = 'refund'`, or original payment rows with refunded amount |
| Subscription access | `payments.subscriptions` | Status and billing subject columns |
| Checkout debugging | `payments.checkout_sessions` | Attempt state only, not final payment proof |

Do not fulfill from the success redirect URL. The success page can show a pending state and read an app-owned table, but payment completion should come from webhook-backed projection rows.

Simple one-time order pattern:

```sql
-- The app creates public.orders(status = 'pending') before Checkout.
-- Checkout metadata includes: { "order_id": "<orders.id>" }.
CREATE OR REPLACE FUNCTION public.fulfill_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payments
AS $$
DECLARE
  order_id_text text;
  order_id uuid;
BEGIN
  IF NEW.type <> 'one_time_payment' OR NEW.status <> 'succeeded' THEN
    RETURN NEW;
  END IF;

  SELECT cs.metadata->>'order_id'
  INTO order_id_text
  FROM payments.checkout_sessions cs
  WHERE cs.stripe_checkout_session_id = NEW.stripe_checkout_session_id;

  IF order_id_text IS NULL
    OR order_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN NEW;
  END IF;

  order_id := order_id_text::uuid;

  UPDATE public.orders
  SET status = 'paid',
      paid_at = COALESCE(paid_at, now())
  WHERE id = order_id
    AND status = 'pending';

  RETURN NEW;
END;
$$;

CREATE TRIGGER fulfill_paid_order
AFTER INSERT OR UPDATE ON payments.payment_history
FOR EACH ROW
EXECUTE FUNCTION public.fulfill_paid_order();
```

Keep triggers idempotent. Stripe can retry webhooks, and projection rows may be updated multiple times. For external side effects such as sending email, calling a fulfillment API, or provisioning a third-party service, write an app-owned outbox row from the trigger and process it from an edge function or worker.

## Best Practices

1. **Default to test** while agents build and verify payment flows.
2. **Use idempotency keys** for product, price, and checkout creation.
3. **Sync before relying on Stripe IDs** when a developer has existing Stripe catalog objects.
4. **Never expose Stripe secret keys** in app code or deployed frontend env vars.
5. **Define payment-session RLS before subscription UI** on `payments.checkout_sessions` and `payments.customer_portal_sessions`.
6. **Use app-specific tables for entitlements** if the user-facing UI needs billing status.
7. **Use payment projections as trigger sources** for fulfillment, not as the user-facing read model.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `secrets add STRIPE_*` instead of payments config | Use `npx @insforge/cli payments config set ...` so account validation and sync run |
| Expecting sync to configure webhooks | Use `payments webhooks configure <environment>` |
| Editing prices for amount/currency | Create a new price and archive the old one |
| Using live keys during development | Use `--environment test` until production is explicitly approved |
| Adding subscription checkout or portal UI without RLS | Add policies on `payments.checkout_sessions` and `payments.customer_portal_sessions` for the app subject model |
| Marking orders paid from the success URL | Add an idempotent trigger from `payments.payment_history` |
| Exposing `payments.payment_history` directly to frontend users | Copy the needed state into app-owned tables with app RLS |
