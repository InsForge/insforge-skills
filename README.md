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
└── insforge/
    ├── SKILL.md              # Main skill manifest and overview
    ├── database/
    │   ├── sdk-integration.md
    │   └── backend-configuration.md
    ├── auth/
    │   ├── sdk-integration.md
    │   └── backend-configuration.md
    ├── storage/
    │   ├── sdk-integration.md
    │   └── backend-configuration.md
    ├── functions/
    │   ├── sdk-integration.md
    │   └── backend-configuration.md
    ├── ai/
    │   ├── sdk-integration.md
    │   └── backend-configuration.md
    ├── realtime/
    │   ├── sdk-integration.md
    │   └── backend-configuration.md
    └── deployments/
        └── workflow.md
```

### Documentation Pattern

- **`sdk-integration.md`**: How to use `@insforge/sdk` in frontend application code
- **`backend-configuration.md`**: How to configure InsForge backend via HTTP API

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding or improving skills.

## License

MIT License - see [LICENSE](LICENSE) for details.
