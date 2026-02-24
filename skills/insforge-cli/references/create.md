# insforge create

Create a new InsForge project.

## Syntax

```bash
insforge create [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--name <name>` | Project name |
| `--org-id <id>` | Organization ID |
| `--region <region>` | Region: `us-east`, `us-west`, `eu-central`, `ap-southeast` |
| `--template <template>` | Template: `react`, `nextjs`, `empty` |

## Interactive Mode

Without flags, the command prompts for organization, project name, region, and template.

## Non-Interactive Mode

Provide all required flags for CI/CD or agent use:

```bash
insforge create --name my-app --org-id org_123 --region us-east --template react -y
```

## What It Does

1. Creates the project via the InsForge Platform API
2. Waits for the project to become active (polls every 3s, timeout 120s)
3. Fetches the project's API key
4. Downloads template files (if not `empty`)
5. Installs InsForge Agent Skills via `npx skills add insforge/agent-skills`
6. Creates `.insforge/project.json` in the current directory

## Output

Project details: ID, name, appkey, region, and OSS host URL.

## Examples

```bash
# Interactive — prompts for everything
insforge create

# Non-interactive with all options
insforge create --name blog-app --org-id org_abc --region us-east --template react -y

# Create with empty template (no frontend scaffolding)
insforge create --name api-only --org-id org_abc --region eu-central --template empty
```

## Notes

- Requires authentication (`insforge login` first).
- Creates `.insforge/project.json` which links the directory to the project.
- Agent skills are auto-installed into `.agents/skills/insforge/`.
