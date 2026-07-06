# npx @insforge/cli login

Authenticate with the InsForge platform.

## Syntax

```bash
npx @insforge/cli login [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--user-api-key <key>` | Authenticate directly with a `uak_` user API key (no browser, no prompt) — best for headless / agent / CI use |
| `--email` | Use email/password login instead of OAuth |
| `--client-id <id>` | Custom OAuth client ID |

## Authentication Methods

### OAuth (Default)

Opens your browser for OAuth 2.0 authentication with PKCE:

```bash
npx @insforge/cli login
```

The CLI starts a local callback server, opens the browser, and waits up to 5 minutes for you to authorize.

### User API Key (direct) — recommended for headless / agent / CI

No browser, no interactive prompt. Create a key in the dashboard (Profile → API Keys), then:

```bash
npx @insforge/cli login --user-api-key uak_...
```

The key is stored and sent directly as the bearer credential on every request — it authenticates as your account with full access (it is not org-scoped). There is no token exchange or refresh: if the key is revoked or expires, the CLI asks you to log in again.

### Email/Password

```bash
npx @insforge/cli login --email
```

Prompts for email and password interactively. For non-interactive use (CI/CD), set environment variables:

```bash
INSFORGE_EMAIL=user@example.com INSFORGE_PASSWORD=secret npx @insforge/cli login --email
```

## Credential Storage

Credentials are saved to `~/.insforge/credentials.json` with restricted file permissions (0600). The shape depends on the login method:
- OAuth / email — `access_token` (JWT) + `refresh_token`
- User API key — `user_api_key` (the `uak_`, used directly as the bearer)

Plus user info (id, name, email). OAuth/email sessions refresh their JWT automatically on 401; a user-API-key session isn't refreshed — an invalid key prompts a re-login.

## Examples

```bash
# Interactive OAuth login (recommended for humans)
npx @insforge/cli login

# Headless / agent / CI: authenticate with a user API key (no browser)
npx @insforge/cli login --user-api-key uak_... --json

# Email/password login
npx @insforge/cli login --email

# CI/CD non-interactive login via email/password
INSFORGE_EMAIL=$EMAIL INSFORGE_PASSWORD=$PASSWORD npx @insforge/cli login --email --json
```
