# InsForge Agent Skills

Agent Skills to help developers using AI agents build applications with [InsForge](https://insforge.dev) Backend-as-a-Service.

## Installation

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
- **AI**: Chat completions, image generation, embeddings
- **Real-time**: WebSocket connections, subscriptions, event publishing
- **Deployments**: Frontend app deployment to InsForge hosting

**Key distinction**: Backend configuration uses HTTP API calls to the InsForge project URL. Client integration uses the `@insforge/sdk` in application code.

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

Integrate third-party authentication providers with InsForge for Row Level Security (RLS). Each integration covers JWT configuration, token signing, and InsForge client setup:

- **Auth0**: Post Login Action, Auth0 v4 SDK, custom claim embedding
- **Clerk**: JWT Template config, client-side `getToken()` flow
- **Kinde**: Server-side JWT signing (no custom signing key support)
- **Stytch**: Magic link flow, server-side session validation
- **WorkOS**: AuthKit middleware, server-side JWT signing

**Key distinction**: Use these guides when connecting an external auth provider to InsForge. For InsForge's built-in authentication, use the **insforge** skill instead.

</details>

<details>
<summary><strong>login-to-insforge-cloud</strong> - Agent OAuth Device Flow for InsForge Cloud</summary>

Teach any AI agent (Claude, Codex, Gemini, custom) to log into the InsForge cloud control plane on behalf of the user, provision a new InsForge project, then switch to calling that project directly. Implements [RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628) Device Authorization Grant — the same pattern used by `gh auth login`, `aws sso login`, and `gcloud auth application-default login`.

- **Device Flow login**: start a flow, show `user_code` + verification URL, poll `/token`
- **Error handling**: `authorization_pending`, `slow_down`, `expired_token`, `access_denied`
- **Project provisioning**: `POST /projects` with the control-plane token
- **Phase switch**: hand off to the project's own API (anon key) — stop using the control-plane token once you have the project URL
- **Refresh rotation** with replay detection
- **Defensive defaults**: token redaction in logs, no disk persistence without consent, revoke-UI reminder

**Key distinction**: This skill gets an agent **into** InsForge Cloud. Once you have a project, use the **insforge** skill (SDK) for application code or the **insforge-cli** skill for infrastructure management.

</details>

## Usage

Once installed, AI agents can access InsForge-specific guidance when:

- Setting up backend infrastructure (tables, buckets, functions, auth, AI)
- Integrating `@insforge/sdk` into frontend applications
- Implementing database CRUD operations with proper RLS
- Building authentication flows with OAuth and email verification
- Deploying serverless functions and frontend apps

## Skill Structure

Each skill follows the [Agent Skills Open Standard](https://agentskills.io/):

```
skills/
├── insforge/
│   ├── SKILL.md              # Main skill manifest and overview
│   ├── database/
│   │   ├── sdk-integration.md
│   │   └── backend-configuration.md
│   ├── auth/
│   │   ├── sdk-integration.md
│   │   └── backend-configuration.md
│   ├── storage/
│   │   ├── sdk-integration.md
│   │   └── backend-configuration.md
│   ├── functions/
│   │   ├── sdk-integration.md
│   │   └── backend-configuration.md
│   ├── ai/
│   │   ├── sdk-integration.md
│   │   └── backend-configuration.md
│   ├── realtime/
│   │   ├── sdk-integration.md
│   │   └── backend-configuration.md
│   └── deployments/
│       └── workflow.md
├── insforge-cli/
│   ├── SKILL.md              # CLI skill manifest and command reference
│   └── references/
│       ├── login.md
│       ├── create.md
│       ├── db-query.md
│       ├── db-export.md
│       ├── db-import.md
│       ├── functions-deploy.md
│       └── deployments-deploy.md
├── insforge-debug/
│   └── SKILL.md              # Debug & diagnostics skill
├── insforge-integrations/
│   ├── auth0/
│   │   └── SKILL.md          # Auth0 integration guide
│   ├── clerk/
│   │   └── SKILL.md          # Clerk integration guide
│   ├── kinde/
│   │   └── SKILL.md          # Kinde integration guide
│   ├── stytch/
│   │   └── SKILL.md          # Stytch integration guide
│   └── workos/
│       └── SKILL.md          # WorkOS integration guide
└── login-to-insforge-cloud/
    └── SKILL.md              # Agent OAuth Device Flow + project provision
```

### Documentation Pattern

- **`sdk-integration.md`**: How to use `@insforge/sdk` in frontend application code
- **`backend-configuration.md`**: How to configure InsForge backend via HTTP API

## Contributing

To create or improve skills, first install the skill-creator tool:
```bash
npx skills add anthropics/skills -s skill-creator
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding or improving skills.

## License

MIT License - see [LICENSE](LICENSE) for details.
