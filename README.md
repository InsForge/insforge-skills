# InsForge Agent Skills

Agent Skills to help developers using AI agents build applications with [InsForge](https://insforge.dev) Backend-as-a-Service.

## Installation

### Codex plugin marketplace

Add this repository as a Codex plugin marketplace, then install the InsForge plugin:

```bash
codex plugin marketplace add InsForge/insforge-skills
codex plugin add insforge@insforge
```

After installing, start a new Codex thread and ask Codex to use InsForge or one of the bundled skills.

### Using the skills registry

```bash
npx skills add insforge/insforge-skills
```

### Claude Code

```bash
/install-skills insforge/insforge-skills
```

## Available Skills

<details>
<summary><strong>insforge</strong> - InsForge Backend-as-a-Service Development</summary>

Build full-stack applications with InsForge. This skill provides comprehensive guidance for:

- **Database**: CRUD operations, schema design, RLS policies, triggers
- **Authentication**: Sign up/in flows, OAuth, sessions, email verification
- **Storage**: File uploads, downloads, bucket management
- **Functions**: Serverless function deployment and invocation
- **AI**: OpenRouter via project Model Gateway key setup, chat completions, image/video/audio generation, embeddings, and model discovery
- **Real-time**: WebSocket connections, subscriptions, event publishing
- **Payments**: Stripe Checkout/Billing Portal and Razorpay Orders/Subscriptions
- **Deployments**: Frontend app deployment to InsForge hosting

**Key distinction**: Backend infrastructure uses the CLI skill. Most client integration uses `@insforge/sdk`; new AI features use OpenRouter APIs with an API key set up by `npx @insforge/cli ai setup`.

</details>

<details>
<summary><strong>insforge-cli</strong> - InsForge CLI Project Management</summary>

Create and manage InsForge projects from the command line. This skill provides comprehensive guidance for:

- **Authentication**: Login (OAuth/password), logout, session verification
- **Project Management**: Create, link, and inspect projects
- **Database**: Raw SQL execution, schema inspection, RLS, import/export
- **Edge Functions**: Deploy, invoke, and view function source
- **Storage**: Bucket and object management (upload, download, list)
- **Deployments**: Frontend app deployment and status tracking
- **AI**: OpenRouter key setup with `npx @insforge/cli ai setup`
- **Payments**: Stripe/Razorpay key setup, catalog sync, provider webhooks
- **Secrets**: Create, update, and manage project secrets
- **CI/CD**: Non-interactive workflows using environment variables

**Key distinction**: Use this skill for infrastructure management via `@insforge/cli`. For writing application code with the InsForge SDK, use the **insforge** skill instead.

</details>

<details>
<summary><strong>insforge-debug</strong> - InsForge Debugging & Diagnostics</summary>

Diagnose errors, bugs, and performance issues in InsForge projects. This skill guides diagnostic command execution for:

- **SDK Errors**: Frontend SDK error objects and unexpected behavior
- **HTTP Errors**: 4xx/5xx responses from InsForge backend
- **Edge Functions**: Failures, timeouts, and deploy errors
- **Database**: Slow queries and performance degradation
- **Auth**: Authentication and authorization failures
- **Real-time**: Channel connection and subscription issues
- **Deployments**: Frontend (Vercel) and edge function deploy failures

**Key distinction**: This skill guides diagnostic command execution to locate problems — it does not provide fix suggestions.

</details>

<details>
<summary><strong>insforge-integrations</strong> - Third-Party Auth Provider Integrations</summary>

Connect external providers to InsForge. The auth-provider guides cover JWT configuration, token signing, and InsForge client setup for Row Level Security (RLS); the OKX x402 guide is a separate onchain payment-facilitator flow:

- **Auth0**: Post Login Action, Auth0 v4 SDK, custom claim embedding
- **Clerk**: JWT Template config, client-side `getToken()` flow
- **Kinde**: Server-side JWT signing (no custom signing key support)
- **Stytch**: Magic link flow, server-side session validation
- **WorkOS**: AuthKit middleware, server-side JWT signing
- **Better Auth**: Framework-agnostic auth/bridge primitives, RLS policies, client hook
- **OKX x402**: Onchain pay-per-use billing via the x402 payment facilitator (not an auth provider)

**Key distinction**: Use these guides when connecting an external auth provider (or the x402 payment facilitator) to InsForge. For InsForge's built-in authentication, use the **insforge** skill instead.

</details>

## Usage

Once installed, AI agents can access InsForge-specific guidance when:

- Setting up backend infrastructure (tables, buckets, functions, auth, AI)
- Integrating `@insforge/sdk` into frontend applications
- Implementing database CRUD operations with proper RLS
- Building authentication flows with OAuth and email verification
- Adding Stripe or Razorpay payment flows
- Deploying serverless functions and frontend apps

## Skill Structure

Each skill follows the [Agent Skills Open Standard](https://agentskills.io/):

```
skills/
├── insforge/
│   ├── SKILL.md              # Main skill manifest and overview
│   ├── database/
│   │   └── sdk-integration.md
│   ├── auth/
│   │   ├── sdk-integration.md
│   │   └── ssr-integration.md
│   ├── storage/
│   │   ├── sdk-integration.md
│   │   ├── s3-gateway.md
│   │   └── postgres-rls.md
│   ├── functions/
│   │   └── sdk-integration.md
│   ├── ai/
│   │   ├── overview.md
│   │   ├── chat-completions.md
│   │   ├── image-generation.md
│   │   ├── video-generation.md
│   │   ├── audio.md
│   │   ├── embeddings-and-rag.md
│   │   └── models-list.md
│   ├── realtime/
│   │   └── sdk-integration.md
│   ├── payments/
│   │   ├── stripe.md
│   │   └── razorpay.md
│   └── email/
│       └── sdk-integration.md
├── insforge-cli/
│   ├── SKILL.md              # CLI skill manifest and command reference
│   └── references/
│       ├── auth.md
│       ├── login.md
│       ├── create.md
│       ├── config.md
│       ├── realtime.md
│       ├── compute-deploy.md
│       ├── schedules.md
│       ├── diagnostics.md
│       ├── posthog.md
│       ├── functions-deploy.md
│       ├── database/
│       │   ├── migrations.md
│       │   ├── query.md
│       │   ├── access-control.md
│       │   ├── integrity.md
│       │   ├── vector.md
│       │   ├── export.md
│       │   └── import.md
│       ├── branch/
│       │   ├── overview.md
│       │   ├── merge.md
│       │   └── reset.md
│       ├── payments/
│       │   ├── overview.md
│       │   ├── stripe.md
│       │   └── razorpay.md
│       └── deployments/
│           ├── deploy.md
│           └── domains.md
├── insforge-debug/
│   ├── SKILL.md              # Debug & diagnostics skill manifest
│   └── references/
│       ├── error-objects.md
│       ├── logs.md
│       ├── metrics.md
│       ├── db-health.md
│       ├── advisor.md
│       ├── policies.md
│       ├── metadata.md
│       ├── deploy-state.md
│       └── ai-assisted.md
└── insforge-integrations/
    ├── SKILL.md              # Integrations skill manifest
    └── references/
        ├── auth0.md          # Auth0 integration guide
        ├── clerk.md          # Clerk integration guide
        ├── kinde.md          # Kinde integration guide
        ├── stytch.md         # Stytch integration guide
        ├── workos.md         # WorkOS integration guide
        ├── better-auth.md    # Better Auth integration guide
        └── okx-x402.md       # OKX x402 payment facilitator guide
```

### Documentation Pattern

- **`sdk-integration.md`**: How to use app-facing SDKs/APIs in application code.
- **AI capability guides**: `ai/overview.md` links to smaller OpenRouter-focused guides for chat completions, image generation, video generation, audio, embeddings/RAG, and model discovery.
- **Specialized guides**: Focused references such as `references/database/access-control.md`, `references/database/integrity.md`, `storage/postgres-rls.md`, `s3-gateway.md`, `references/database/vector.md`, payment provider guides, or other provider-specific integration guides.

## Contributing

To create or improve skills, first install the skill-creator tool:
```bash
npx skills add anthropics/skills -s skill-creator
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding or improving skills.

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
