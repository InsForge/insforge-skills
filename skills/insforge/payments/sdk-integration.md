# Payments SDK Integration

Use InsForge Payments to create Stripe Checkout Sessions and Stripe Billing Portal Sessions from the developer's app. Payments use the developer-owned Stripe account configured on the InsForge backend.

## Setup

First, ensure the app has a normal InsForge SDK client. See the main [SKILL.md](../SKILL.md) for framework-specific environment variables and client initialization.

```typescript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: import.meta.env.VITE_INSFORGE_URL,
  anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY
})
```

Before writing app code, verify the backend payment foundation exists:

```bash
npx @insforge/cli payments status
npx @insforge/cli payments catalog --environment test
```

If the CLI says `Payments are not available on this backend`, stop and ask the developer/admin to enable payments or upgrade the self-hosted backend. Do not implement a direct Stripe secret-key flow in the frontend. If keys, products, or prices are missing, configure them first. See the **insforge-cli** skill's [payments](../../insforge-cli/references/payments.md) reference.

Before integrating payments, make sure a Stripe key is configured. If `payments status` shows `unconfigured`, ask the user for the Stripe key first. See the **insforge-cli** skill's [payments](../../insforge-cli/references/payments.md) reference.

## Authorization Prerequisite

Before adding subscription checkout or customer portal UI, implement RLS policies for the app's billing subject model:

- `payments.checkout_sessions` controls who can create and read Checkout Session attempts for a subject.
- `payments.customer_portal_sessions` controls who can create and read Billing Portal Session attempts for a subject.

Checkout creation needs an `INSERT` policy. If the app sends checkout `idempotencyKey`, add a matching `SELECT` policy too: the backend insert uses `ON CONFLICT (environment, idempotency_key) DO NOTHING`, and conflict retries read `payments.checkout_sessions` under the caller context to find the existing attempt.

For example, if subscriptions belong to teams, policies must prove the current user belongs to the team before allowing rows with `subject: { type: 'team', id: teamId }`. If subscriptions belong to organizations, workspaces, or users, write policies for that structure instead.

Do not expose UI that accepts arbitrary `subject.type` or `subject.id` until these policies exist. See the **insforge-cli** skill's [payments](../../insforge-cli/references/payments.md#session-rls-before-app-integration) reference.

## One-Time Checkout

Use `mode: 'payment'` for one-time purchases. For one-time payments, `subject` is optional. Anonymous checkout is allowed, but include `customerEmail` when available.

If the buyer is signed in, prefer passing a subject so checkout RLS can use the same ownership model as subscriptions. If you enable RLS on `payments.checkout_sessions`, subject-less `mode: 'payment'` rows need their own narrow `INSERT` policy, plus `SELECT` when the request sends `idempotencyKey` or user-facing read paths need to see the checkout attempt. See the **insforge-cli** skill's [payments](../../insforge-cli/references/payments.md#session-rls-before-app-integration) reference.

If the payment should fulfill an app record such as an order, credit grant, download, or booking, create that app record first and pass its ID in checkout metadata. Do not mark it paid from the success URL.

Signed-in checkout with subject-based RLS:

```typescript
const { data, error } = await insforge.payments.createCheckoutSession('test', {
  mode: 'payment',
  lineItems: [{ stripePriceId: 'price_123', quantity: 1 }],
  successUrl: `${window.location.origin}/checkout/success`,
  cancelUrl: `${window.location.origin}/pricing`,
  subject: { type: 'user', id: user.id },
  customerEmail: user.email ?? null,
  metadata: { order_id: order.id },
  idempotencyKey: `cart:${cartId}`
})

if (error) {
  throw error
}

if (data?.checkoutSession.url) {
  window.location.assign(data.checkoutSession.url)
}
```

### What `lineItems` Does Not Support

The current request shape only accepts `lineItems: [{ stripePriceId, quantity }]`. It does not accept `priceData`, `discounts`, `coupons`, or `allowPromotionCodes`.

For tiered pricing, create one Stripe Price per `(product x pricing tier)`, store each variant on the app's product row, and pick the right `stripePriceId` before checkout.

```sql
ALTER TABLE public.products
  ADD COLUMN stripe_price_id TEXT,
  ADD COLUMN stripe_member_price_id TEXT;
```

```typescript
const lineItems = cart.items.map(({ product, quantity }) => ({
  stripePriceId:
    membership === 'member'
      ? product.stripe_member_price_id
      : product.stripe_price_id,
  quantity,
}))
```

### One-Time Frontend Fulfillment Flow

Stripe redirects are user navigation only. The success page can say "processing" and poll or subscribe to an app-owned table, but the durable fulfillment signal should come from InsForge's webhook-backed payment projection.

Frontend pattern:

1. Insert a pending row in an app table, for example `public.orders`.
2. Create Checkout with `metadata: { order_id: order.id }`.
3. Redirect to the returned Stripe Checkout URL.
4. On the success route, read the app-owned order/entitlement table and show `pending`, `paid`, or `fulfilled`.
5. Optionally subscribe to the app-owned table with Realtime for immediate UI updates.

Do not let users supply arbitrary `order_id` metadata. Create or select the pending order through app logic/RLS first, then pass that trusted row ID into Checkout.

If the success page also runs user-dependent side effects, wait for auth loading to finish before choosing the signed-in vs guest branch. Webhook-backed Realtime updates can arrive before a cold-load auth refresh completes. See [../auth/sdk-integration.md#dont-fire-user-dependent-side-effects-during-auth-loading](../auth/sdk-integration.md#dont-fire-user-dependent-side-effects-during-auth-loading).

The backend fulfillment migration should be implemented separately before relying on the success page. See the **insforge-cli** skill's [payments](../../insforge-cli/references/payments.md#fulfillment-migrations) reference for the trigger/source-table guidance.

## Subscription Checkout

Use `mode: 'subscription'` for recurring prices. Subscription checkout requires a `subject` because ongoing access belongs to an app-specific billing owner.

```typescript
const { data, error } = await insforge.payments.createCheckoutSession('test', {
  mode: 'subscription',
  lineItems: [{ stripePriceId: 'price_monthly_123', quantity: 1 }],
  successUrl: `${window.location.origin}/billing/success`,
  cancelUrl: `${window.location.origin}/billing`,
  subject: { type: 'team', id: teamId },
  customerEmail: user.email,
  idempotencyKey: `subscription:${teamId}:monthly`
})

if (error) throw error
if (data?.checkoutSession.url) window.location.assign(data.checkoutSession.url)
```

`subject.type` and `subject.id` are intentionally generic. They can represent a user, team, organization, workspace, tenant, or any other app billing owner. The app must only create checkout sessions for subjects the current user is allowed to bill.

## Customer Portal

Use Stripe Billing Portal when a customer needs to manage an existing subscription, payment method, invoice, or cancellation.

```typescript
const { data, error } = await insforge.payments.createCustomerPortalSession('test', {
  subject: { type: 'team', id: teamId },
  returnUrl: `${window.location.origin}/billing`
})

if (error) throw error
if (data?.customerPortalSession.url) {
  window.location.assign(data.customerPortalSession.url)
}
```

Portal creation requires an existing Stripe customer mapping for the subject. Usually that mapping is created after a successful Checkout Session. If the backend returns `404`, the subject has no Stripe customer yet; show a subscribe/checkout CTA instead.

## Runtime Payment State

The SDK currently exposes creation flows only:

- `insforge.payments.createCheckoutSession(environment, body)`
- `insforge.payments.createCustomerPortalSession(environment, body)`

Do not assume frontend users can read `payments.subscriptions` or `payments.payment_history` directly. Those are admin/backend projections. If the app needs user-facing entitlement or billing status, create an app-specific read model such as:

- `public.team_billing_status`
- `public.user_entitlements`
- `public.orders`

Protect those tables with app-specific RLS. Backend fulfillment should populate them from InsForge payment projections or a trusted server path; see the **insforge-cli** skill's [payments](../../insforge-cli/references/payments.md#fulfillment-migrations) reference.

## Live/Test Environment

During implementation, pass `'test'` as the first argument to the payments SDK methods, for example `insforge.payments.createCheckoutSession('test', body)`. Only switch to `'live'` after the developer explicitly approves production Stripe changes and live prices are configured.

Do not put Stripe secret keys in frontend code. Stripe keys are configured through the dashboard or CLI and stored in InsForge's secret store.

## Best Practices

1. **Use stable idempotency keys** for checkout creation, especially carts and subscription plan changes.
2. **Always redirect using the returned URL**; never construct Stripe Checkout or Portal URLs manually.
3. **Use explicit success and cancel URLs** matching the app routes.
4. **Treat Stripe as source of truth** for catalog data. Use the CLI/dashboard to sync before relying on product or price IDs.
5. **Use subjects consistently**. If subscriptions bill teams, always use `subject: { type: 'team', id: teamId }`.
6. **Create payment-session RLS before subscription UI**. Checkout creation needs `INSERT`; checkout requests with `idempotencyKey` also need matching `SELECT`. See the **insforge-cli** skill's [payments](../../insforge-cli/references/payments.md#session-rls-before-app-integration) reference.
7. **Do not treat redirects as fulfillment**. Success pages should read app-owned fulfilled state.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Putting `sk_test_...` or `sk_live_...` in frontend code | Configure keys with `npx @insforge/cli payments config set ...` |
| Creating subscription checkout without a subject | Pass the app billing owner as `subject` |
| Letting users submit arbitrary subject IDs | Add RLS on `payments.checkout_sessions` and `payments.customer_portal_sessions` based on membership/ownership |
| Idempotent checkout retries fail after adding only `INSERT` | Add a matching `SELECT` policy for rows the caller may retry/read |
| Reading payment admin tables from the browser | Create app-specific entitlement tables or a trusted edge function |
| Using live environment during development | Use `test` until the developer approves production |
| Marking an order paid on the success URL | Add backend fulfillment first, then read the app-owned order state |
| Using `payments.checkout_sessions` as proof of payment | Treat checkout sessions as attempts; read app-owned fulfilled state instead |

## Recommended Workflow

```text
1. Configure Stripe keys/catalog        -> CLI/dashboard
2. Implement payment-session RLS        -> checkout_sessions and customer_portal_sessions
3. Build pricing UI from known prices   -> App constants or synced admin output
4. Create Checkout Session             -> SDK createCheckoutSession
5. Redirect to Stripe                  -> window.location.assign(url)
6. Return to success/cancel URL        -> App route
7. Fulfill payment/subscription        -> Backend updates app-owned tables
8. Manage subscription later           -> SDK createCustomerPortalSession
9. Render app entitlement              -> App-specific table or trusted edge function
```
