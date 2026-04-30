# AI Agent Guidance

This document helps AI coding agents work effectively with the InsForge Agent Skills repository.

## Repository Structure

```
agent-skills/
├── skills/
│   └── insforge/           # InsForge BaaS development skill
│       ├── SKILL.md        # Skill manifest and overview
│       ├── database/       # Database operations
│       ├── auth/           # Authentication flows
│       ├── storage/        # File storage
│       ├── functions/      # Serverless functions
│       ├── ai/             # AI/ML operations
│       ├── realtime/       # Real-time messaging
│       ├── payments/       # Stripe payments
│       └── deployments/    # App deployment
│   └── insforge-cli/       # InsForge CLI project management
│       ├── SKILL.md        # Skill manifest and command reference
│       └── references/     # CLI command reference
│           ├── create.md
│           ├── login.md
│           ├── link.md
│           ├── db-query.md
│           ├── db-export.md
│           ├── db-import.md
│           ├── functions-deploy.md
│           ├── payments.md
│           └── deployments-deploy.md
├── AGENTS.md               # This file
├── CONTRIBUTING.md         # Contribution guidelines
├── LICENSE                 # MIT License
└── README.md               # Repository documentation
```

## Skill Format

This repository follows the [Agent Skills Open Standard](https://agentskills.io/).

### SKILL.md Structure

Each skill contains a `SKILL.md` with:

1. **YAML Frontmatter**: Required `name` and `description` fields, optional `license` and `metadata`
2. **Markdown Body**: Instructions, examples, and references to module documentation

### Documentation Pattern

InsForge skill modules use a two-file pattern:

| File | Purpose | When to Use |
|------|---------|-------------|
| `sdk-integration.md` | Frontend SDK usage with `@insforge/sdk` | Implementing features in user's app code |
| `backend-configuration.md` | Backend HTTP API configuration | Setting up infrastructure before app can use it |

## Working with This Repository

### Adding a New Module

1. Create a directory under `skills/insforge/` with the module name
2. Add `sdk-integration.md` for client-side SDK usage
3. Add `backend-configuration.md` for backend configuration (if applicable)
4. Update the module reference table in `skills/insforge/SKILL.md`

### Updating Existing Documentation

1. Locate the relevant file in the module directory
2. Maintain the existing format: Setup, Usage Examples, Best Practices, Common Mistakes
3. Keep code examples concise and runnable
4. Include both correct and incorrect examples where helpful

### Validation Checklist

Before committing changes:

- [ ] SKILL.md frontmatter is valid YAML
- [ ] Skill name matches directory name (lowercase, hyphens only)
- [ ] Description is clear and includes keywords for agent discovery
- [ ] Code examples are syntactically correct
- [ ] All internal links are valid relative paths

## Key InsForge Patterns

When working with InsForge skills, remember:

1. **Backend First**: Most features require backend configuration before SDK integration
2. **Metadata Endpoint**: Always fetch `/api/metadata` before making changes
3. **Auth References**: Use `auth.users(id)` for user foreign keys, `auth.uid()` in RLS policies
4. **Array Inserts**: Database inserts require array format: `insert([{...}])`
5. **Storage Keys**: Save both `url` and `key` for storage operations
