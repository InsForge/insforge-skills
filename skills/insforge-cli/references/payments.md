# npx @insforge/cli payments

Manage the Stripe payments foundation for a linked InsForge project.

Use this command group for infrastructure and agent/admin workflows: Stripe key configuration, unified sync, webhook setup, catalog inspection, product CRUD, price CRUD, subscription reads, and payment history reads. For frontend checkout and customer portal code, use the `insforge` SDK skill and `@insforge/sdk`.

## Availability

Payments are in private preview. Older InsForge projects or self-hosted backends may not expose `/api/payments`.

Always start with:

```bash
npx @insforge/cli payments status
```

If the CLI says `Payments are not available on this backend`, stop and ask the developer/admin to enable payments or upgrade the self-hosted backend. Do not configure Stripe through generic `secrets` commands, and never put Stripe secret keys in frontend code.

## Mental Model

- Stripe is the source of truth.
- Every command targets `test`, `live`, or all configured environments.
- Agents should default to `test` while building.
- Product and price mutations call Stripe first, then InsForge mirrors the result.
- Runtime checkout and portal sessions are created by the SDK, not by CLI commands.

## Status

```bash
npx @insforge/cli payments status
npx @insforge/cli payments status --json
```

Shows key status, masked key, Stripe account id, webhook status, latest sync status, and sync timestamp for each environment.

## Configure Keys

```bash
npx @insforge/cli payments config
npx @insforge/cli payments config set test sk_test_xxx
npx @insforge/cli payments config set live sk_live_xxx
npx @insforge/cli payments config remove test -y
```

Use `payments config set`, not generic `secrets add`, for Stripe keys. The payments config flow validates the key, records Stripe account identity, best-effort creates the managed webhook, and runs sync when the account changes.

If the backend URL is localhost or otherwise not public, webhook setup can fail while key setup still succeeds. Retry later with `payments webhooks configure`.

## Sync

```bash
npx @insforge/cli payments sync
npx @insforge/cli payments sync --environment test
npx @insforge/cli payments sync --environment live --json
```

Sync pulls products, prices, and subscriptions from Stripe into InsForge. Unconfigured environments are skipped. Sync does not create or repair webhook endpoints.

## Catalog

```bash
npx @insforge/cli payments catalog
npx @insforge/cli payments catalog --environment test
npx @insforge/cli payments catalog --environment test --json
```

Use catalog to inspect mirrored products and prices together.

## Products

```bash
npx @insforge/cli payments products list --environment test
npx @insforge/cli payments products get prod_123 --environment test

npx @insforge/cli payments products create \
  --environment test \
  --name "Pro Plan" \
  --description "Monthly access" \
  --metadata '{"plan":"pro"}' \
  --idempotency-key "product:pro"

npx @insforge/cli payments products update prod_123 \
  --environment test \
  --name "Pro Plan v2" \
  --active true

npx @insforge/cli payments products delete prod_123 --environment test -y
```

Product deletion only succeeds if Stripe allows it, usually when the product has no prices. Otherwise update `--active false`.

## Prices

```bash
npx @insforge/cli payments prices list --environment test
npx @insforge/cli payments prices list --environment test --product prod_123
npx @insforge/cli payments prices get price_123 --environment test

# One-time price, amount in smallest currency unit
npx @insforge/cli payments prices create \
  --environment test \
  --product prod_123 \
  --currency usd \
  --unit-amount 4900 \
  --idempotency-key "price:pro:onetime"

# Monthly subscription price
npx @insforge/cli payments prices create \
  --environment test \
  --product prod_123 \
  --currency usd \
  --unit-amount 1900 \
  --interval month \
  --idempotency-key "price:pro:monthly"

npx @insforge/cli payments prices update price_123 \
  --environment test \
  --active false

npx @insforge/cli payments prices archive price_123 --environment test
```

Stripe prices are immutable for amount, currency, and recurring cadence. Create a new price when those fields change.

## Webhooks

```bash
npx @insforge/cli payments webhooks configure test
npx @insforge/cli payments webhooks configure live
```

Creates or recreates the InsForge-managed Stripe webhook endpoint for an environment. Stripe requires the webhook URL to be publicly accessible.

## Session RLS Before App Integration

Before exposing subscription checkout or Billing Portal UI, define RLS policies for the app's business model:

- `payments.checkout_sessions` controls who can create and read Checkout Session attempts for a subject.
- `payments.customer_portal_sessions` controls who can create and read Billing Portal Session attempts for a subject.

If subscriptions bill teams, policies should check team membership. If subscriptions bill organizations, workspaces, groups, or users, policies should check that model instead. Do not let generated apps pass arbitrary subject IDs without matching policies.

See the SDK skill guide `skills/insforge/payments/backend-configuration.md` for policy examples.

## Subscriptions and Payment History

```bash
npx @insforge/cli payments subscriptions --environment test
npx @insforge/cli payments subscriptions --environment test --subject-type team --subject-id team_123

npx @insforge/cli payments history --environment test
npx @insforge/cli payments history --environment test --limit 20 --json
```

These are admin/debug reads over InsForge's payment projections. They are not the runtime frontend read surface for end users.

## Recommended Agent Workflow

```text
1. Verify project                  -> npx @insforge/cli current
2. Check payment status            -> payments status
3. Configure test key if missing   -> payments config set test ...
4. Sync Stripe state               -> payments sync --environment test
5. Create product if needed        -> payments products create ...
6. Create one-time/recurring price -> payments prices create ...
7. Configure webhook if public URL -> payments webhooks configure test
8. Add payment-session RLS         -> checkout_sessions and customer_portal_sessions
9. Build app checkout UI           -> use @insforge/sdk payments methods
10. Repeat for live only when approved by developer
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Managing Stripe keys with generic secrets commands | Use `payments config set` |
| Mutating live while still developing | Use `--environment test` |
| Expecting `payments sync` to configure webhooks | Use `payments webhooks configure` |
| Trying to update price amount/currency | Create a new price and archive the old one |
| Using CLI for runtime checkout | Use `insforge.payments.createCheckoutSession` in app code |
| Shipping subscription UI before RLS | Add policies on `payments.checkout_sessions` and `payments.customer_portal_sessions` first |
