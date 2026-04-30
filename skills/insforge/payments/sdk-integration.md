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

If the CLI says `Payments are not available on this backend`, stop and ask the developer/admin to enable payments or upgrade the self-hosted backend. Do not implement a direct Stripe secret-key flow in the frontend. If keys, products, or prices are missing, configure them first. See [backend-configuration.md](backend-configuration.md).

## Authorization Prerequisite

Before adding subscription checkout or customer portal UI, implement RLS policies for the app's billing subject model:

- `payments.checkout_sessions` controls who can create and read Checkout Session attempts for a subject.
- `payments.customer_portal_sessions` controls who can create and read Billing Portal Session attempts for a subject.

For example, if subscriptions belong to teams, policies must prove the current user belongs to the team before allowing rows with `subject: { type: 'team', id: teamId }`. If subscriptions belong to organizations, workspaces, or users, write policies for that structure instead.

Do not expose UI that accepts arbitrary `subject.type` or `subject.id` until these policies exist. See [backend-configuration.md](backend-configuration.md).

## One-Time Checkout

Use `mode: 'payment'` for one-time purchases. Anonymous checkout is allowed, but include `customerEmail` when available.

```typescript
const { data, error } = await insforge.payments.createCheckoutSession({
  environment: 'test',
  mode: 'payment',
  lineItems: [{ stripePriceId: 'price_123', quantity: 1 }],
  successUrl: `${window.location.origin}/checkout/success`,
  cancelUrl: `${window.location.origin}/pricing`,
  customerEmail: user?.email ?? null,
  idempotencyKey: `cart:${cartId}`
})

if (error) {
  throw error
}

if (data?.checkoutSession.url) {
  window.location.assign(data.checkoutSession.url)
}
```

## Subscription Checkout

Use `mode: 'subscription'` for recurring prices. Subscription checkout requires a `subject` because ongoing access belongs to an app-specific billing owner.

```typescript
const { data, error } = await insforge.payments.createCheckoutSession({
  environment: 'test',
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
const { data, error } = await insforge.payments.createCustomerPortalSession({
  environment: 'test',
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

- `insforge.payments.createCheckoutSession(...)`
- `insforge.payments.createCustomerPortalSession(...)`

Do not assume frontend users can read `payments.subscriptions` or `payments.payment_history` directly. Those are admin/backend projections. If the app needs user-facing entitlement or billing status, create an app-specific read model such as:

- `public.team_billing_status`
- `public.user_entitlements`
- `public.orders`

Protect those tables with app-specific RLS. Populate them from a trusted server path or edge function that validates the current user before reading admin payment state.

## Live/Test Environment

During implementation, target `environment: 'test'`. Only switch to `live` after the developer explicitly approves production Stripe changes and live prices are configured.

Do not put Stripe secret keys in frontend code. Stripe keys are configured through the dashboard or CLI and stored in InsForge's secret store.

## Best Practices

1. **Use stable idempotency keys** for checkout creation, especially carts and subscription plan changes.
2. **Always redirect using the returned URL**; never construct Stripe Checkout or Portal URLs manually.
3. **Use explicit success and cancel URLs** matching the app routes.
4. **Treat Stripe as source of truth** for catalog data. Use the CLI/dashboard to sync before relying on product or price IDs.
5. **Use subjects consistently**. If subscriptions bill teams, always use `subject: { type: 'team', id: teamId }`.
6. **Create payment-session RLS before subscription UI**. Checkout and portal creation are gated by app-specific permissions. See [backend-configuration.md](backend-configuration.md).

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Putting `sk_test_...` or `sk_live_...` in frontend code | Configure keys with `npx @insforge/cli payments config set ...` |
| Creating subscription checkout without a subject | Pass the app billing owner as `subject` |
| Letting users submit arbitrary subject IDs | Add RLS on `payments.checkout_sessions` and `payments.customer_portal_sessions` based on membership/ownership |
| Reading payment admin tables from the browser | Create app-specific entitlement tables or a trusted edge function |
| Using live environment during development | Use `test` until the developer approves production |

## Recommended Workflow

```text
1. Configure Stripe keys/catalog        -> CLI/dashboard
2. Implement payment-session RLS        -> checkout_sessions and customer_portal_sessions
3. Build pricing UI from known prices   -> App constants or synced admin output
4. Create Checkout Session             -> SDK createCheckoutSession
5. Redirect to Stripe                  -> window.location.assign(url)
6. Return to success/cancel URL        -> App route
7. Manage subscription later           -> SDK createCustomerPortalSession
8. Render app entitlement              -> App-specific table or trusted edge function
```
