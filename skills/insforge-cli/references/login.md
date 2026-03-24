# npx @insforge/cli login

Authenticate with the InsForge platform.

## Syntax

```bash
npx @insforge/cli login [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--email` | Use email/password login instead of OAuth |
| `--client-id <id>` | Custom OAuth client ID |

## Authentication Methods

### OAuth (Default)

Opens your browser for OAuth 2.0 authentication with PKCE:

```bash
npx @insforge/cli login
```

The CLI starts a local callback server, opens the browser, and waits up to 5 minutes for you to authorize.

### Email/Password

```bash
npx @insforge/cli login --email
```

Prompts for email and password interactively. For non-interactive use (CI/CD), set environment variables:

```bash
INSFORGE_EMAIL=user@example.com INSFORGE_PASSWORD=secret npx @insforge/cli login --email
```

## Credential Storage

Tokens are saved to `~/.insforge/credentials.json` with restricted file permissions (0600). Includes:
- `access_token` and `refresh_token`
- User info (id, name, email)

Tokens refresh automatically on 401 responses.

## Examples

```bash
# Interactive OAuth login (recommended)
npx @insforge/cli login

# Email/password login
npx @insforge/cli login --email

# CI/CD non-interactive login
INSFORGE_EMAIL=$EMAIL INSFORGE_PASSWORD=$PASSWORD npx @insforge/cli login --email --json
```
