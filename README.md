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
└── insforge-cli/
    ├── SKILL.md              # CLI skill manifest and command reference
    └── references/
        ├── login.md
        ├── create.md
        ├── db-query.md
        ├── db-export.md
        ├── db-import.md
        ├── functions-deploy.md
        └── deployments-deploy.md
```

### Documentation Pattern

- **`sdk-integration.md`**: How to use `@insforge/sdk` in frontend application code
- **`backend-configuration.md`**: How to configure InsForge backend via HTTP API

## Contributing

To create or improve skills, first install the skill-creator tool:
```
npx skills add anthropics/skills -s skill-creator
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding or improving skills.

## License

MIT License - see [LICENSE](LICENSE) for details.
