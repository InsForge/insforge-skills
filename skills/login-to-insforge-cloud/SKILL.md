---
name: login-to-insforge-cloud
description: >-
  Use this skill whenever an agent needs to log into the InsForge cloud control
  plane on behalf of the user, provision a new InsForge project, or call
  control-plane APIs from a headless context (no browser, no redirect
  listener). Trigger on: "log in to InsForge", "authenticate with InsForge
  cloud", "create a new InsForge project", "call InsForge control-plane APIs",
  "get me an InsForge project URL", or any agent-initiated request that needs
  a user-scoped control-plane token. This skill implements RFC 8628 OAuth
  Device Authorization Grant — the same pattern used by `gh auth login`,
  `aws sso login`, and `gcloud auth application-default login`. After a token
  is minted and a project is created, this skill hands off to the **insforge**
  skill (SDK) or **insforge-cli** skill (infrastructure) for calling the
  project's own API directly.
license: MIT
metadata:
  author: insforge
  version: "1.0.0"
  organization: InsForge
  date: April 2026
---

# Log in to InsForge Cloud (Agent Device Flow)

Teach an AI agent to obtain a user-scoped control-plane token from InsForge
Cloud without needing a browser, a redirect listener, or the user's long-lived
personal JWT. The agent shows the user a short code; the user approves it in a
browser; the agent polls until it has a token.

> **Spec reference.** All endpoint shapes, status codes, and TTLs below are
> pulled from the authoritative design spec
> [`docs/superpowers/specs/2026-04-17-agent-auth-device-flow-design.md`](https://github.com/InsForge/insforge-cloud-backend/pull/433)
> in `InsForge/insforge-cloud-backend`. If the spec has drifted since this
> skill was last updated, the spec wins — re-read the PR and fix the skill.

## When to use

Use this skill when the user asks for anything that requires a control-plane
token on their behalf:

- "Log me in to InsForge."
- "Create a new InsForge project called `my-app` in `us-east-1`."
- "List my InsForge projects."
- "Call InsForge control-plane APIs for me."
- "Give me the URL for a fresh InsForge backend."

Do **not** use this skill for:

- Calling an existing project's own API. That's the **insforge** skill (SDK)
  or **insforge-cli** skill (infra). Control-plane auth only gets you *to* a
  project; once you have its URL + key you switch to the project's own auth.
- Interactive browser-based login. That's the Authorization Code + PKCE flow
  the browser SDK already uses.
- Pasting the user's long-lived personal JWT into the agent. Don't. The
  whole point of Device Flow is to avoid this.

## The two phases

```
┌──────────────────────────┐      ┌─────────────────────────────┐
│  Phase 1: Control-plane  │      │   Phase 2: Project's own    │
│  (this skill)            │ ───▶ │   backend (insforge skill)  │
│                          │      │                             │
│  • Device Flow login     │      │  • OSS auth (anon key)      │
│  • POST /projects        │      │  • SDK or REST calls        │
│  • Get api_url + api_key │      │  • Out of control plane     │
└──────────────────────────┘      └─────────────────────────────┘
```

Phase 1 ends when the agent has an `api_url` + `api_key` for the newly-created
project. From that point, use the **insforge** skill — don't keep hammering
the control plane for every database query.

## Process — Phase 1: Device Flow login

### Step 0 — Know the endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/oauth/v1/device/code` | Start the flow. Public. |
| `POST /api/oauth/v1/token` | Poll for the token. Public. |
| `POST /api/oauth/v1/device/approve` | Browser-side: user approves. Auth'd. |
| `GET  /api/oauth/v1/device/lookup` | Browser-side: consent-page prefetch. Auth'd. |
| `GET  /api/oauth/v1/device/connected-agents` | Dashboard: list grants. Auth'd. |
| `DELETE /api/oauth/v1/device/revoke/:client_id` | Dashboard: revoke a grant. Auth'd. |

The agent only calls the **first two**. The last four are used by the cloud
dashboard UI (`https://cloud.insforge.dev`) when the user opens it in a
browser; the agent never touches them.

Base URL: `https://cloud.insforge.dev` (control plane). Not the project URL.

### Step 1 — Request a device code

```bash
curl -sS -X POST https://cloud.insforge.dev/api/oauth/v1/device/code \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'client_id=agent_cli_01HV...' \
  --data-urlencode 'scope=projects:write organizations:read'
```

JSON form also accepted:

```bash
curl -sS -X POST https://cloud.insforge.dev/api/oauth/v1/device/code \
  -H 'Content-Type: application/json' \
  -d '{"client_id":"agent_cli_01HV...","scope":"projects:write organizations:read"}'
```

Response (200):

```json
{
  "device_code": "GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS",
  "user_code": "ABCD-1234",
  "verification_uri": "https://cloud.insforge.dev/device",
  "verification_uri_complete": "https://cloud.insforge.dev/device?user_code=ABCD-1234",
  "expires_in": 900,
  "interval": 5
}
```

**Scope guidance:**

- `projects:write` — create/update/delete projects. Required for "make a new project."
- `projects:read` — list existing projects.
- `organizations:read` — needed if the user belongs to multiple orgs and you
  must pick one.
- `projects.database:read`, `projects.database:write` — direct DB access via
  control plane. Usually NOT what you want; switch to the project's own SDK
  after provisioning.

Request the **narrowest** scope set that matches the user's ask. Consent
fatigue is real; over-requesting trains users to click Approve blindly.

**Errors on `/device/code`:**

| Status | `error` | Meaning |
|---|---|---|
| 400 | `invalid_client` | `client_id` unknown, inactive, or wrong type |
| 400 | `unauthorized_client` | client exists but device grant not enabled |
| 400 | `invalid_scope` | scope not in the client's allowed list |

### Step 2 — Show the user the code and URL

Display both the URL and the `user_code` clearly. Be explicit about what
happens next.

```
To log in to InsForge Cloud, open this URL in your browser:

    https://cloud.insforge.dev/device

Then enter this code:

    ABCD-1234

(This code expires in 15 minutes. I'll wait for you to approve.)
```

If the agent has a way to open a browser on the user's machine (e.g. a
desktop assistant), use `verification_uri_complete` to pre-fill the code:

```
https://cloud.insforge.dev/device?user_code=ABCD-1234
```

### Step 3 — Poll `/api/oauth/v1/token` at the server-provided `interval`

```bash
curl -sS -X POST https://cloud.insforge.dev/api/oauth/v1/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:device_code' \
  --data-urlencode 'device_code=GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS' \
  --data-urlencode 'client_id=agent_cli_01HV...'
```

**Responses (RFC 8628 §3.5):**

| HTTP | `error` in body | Meaning | What the agent does |
|---|---|---|---|
| 200 | *(success)* | Token minted | Stop polling. Use the token. |
| 400 | `authorization_pending` | User hasn't approved yet | Sleep `interval` seconds. Poll again. |
| 400 | `slow_down` | You polled too fast | Add 5 s to your interval. Sleep the new interval. Poll again. |
| 400 | `access_denied` | User clicked Deny | **Stop polling.** Don't retry. Tell the user. |
| 400 | `expired_token` | Code aged out (>15 min) | **Stop polling.** Restart the flow from Step 1. |
| 400 | `invalid_grant` | Code already redeemed, or not found | **Stop polling.** Surface the error. |

Polling loop — bash reference implementation:

```bash
interval=5                       # server tells you this; default 5
deadline=$(( $(date +%s) + 900 ))  # expires_in = 900 s

while [ "$(date +%s)" -lt "$deadline" ]; do
  sleep "$interval"

  resp=$(curl -sS -X POST https://cloud.insforge.dev/api/oauth/v1/token \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:device_code' \
    --data-urlencode "device_code=$DEVICE_CODE" \
    --data-urlencode "client_id=$CLIENT_ID")

  err=$(echo "$resp" | jq -r '.error // empty')

  case "$err" in
    "")                       # success; response has access_token
      access_token=$(echo "$resp" | jq -r '.access_token')
      refresh_token=$(echo "$resp" | jq -r '.refresh_token')
      break
      ;;
    "authorization_pending")  # keep polling at current interval
      ;;
    "slow_down")              # back off by +5 s
      interval=$(( interval + 5 ))
      ;;
    "access_denied"|"expired_token"|"invalid_grant")
      echo "Login aborted: $err" >&2
      exit 1
      ;;
    *)
      echo "Unexpected error: $resp" >&2
      exit 1
      ;;
  esac
done
```

Equivalent Python:

```python
import time, requests

deadline = time.time() + 900
interval = 5

while time.time() < deadline:
    time.sleep(interval)
    r = requests.post(
        "https://cloud.insforge.dev/api/oauth/v1/token",
        data={
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "device_code": device_code,
            "client_id": client_id,
        },
    )
    body = r.json()
    if r.ok:
        access_token = body["access_token"]
        refresh_token = body["refresh_token"]
        break
    err = body.get("error")
    if err == "authorization_pending":
        continue
    if err == "slow_down":
        interval += 5
        continue
    if err in ("access_denied", "expired_token", "invalid_grant"):
        raise RuntimeError(f"Login aborted: {err}")
    raise RuntimeError(f"Unexpected error: {body}")
else:
    raise RuntimeError("Device code expired before user approved")
```

**Key polling rules:**

- Start at the server-provided `interval` (default 5 s). Respect it.
- On `slow_down`, **grow** your interval by 5 s. Do not shrink it back later.
- Stop polling immediately on `access_denied`, `expired_token`, or
  `invalid_grant`. These are terminal.
- `authorization_pending` is **not** a failure. It is the expected response
  every time you poll before the user has clicked Approve. Continue.

### Step 4 — Token response (success)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_01HV8X7N...",
  "scope": "projects:write organizations:read"
}
```

- `access_token` is a JWT. 1-hour TTL. Send as `Authorization: Bearer <jwt>`.
- `refresh_token` is opaque. 30-day **sliding** TTL (each refresh resets it).
- Store in memory. **Do not persist to disk without explicit user consent.**
  See `Defensive rules` below.

### Step 5 — Provision a project

```bash
curl -sS -X POST https://cloud.insforge.dev/api/projects \
  -H "Authorization: Bearer $access_token" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "my-app",
    "region": "us-east-1"
  }'
```

Response (201):

```json
{
  "project_id": "proj_01HV...",
  "api_url": "https://my-app.us-east.insforge.app",
  "api_key": "sk_live_..."
}
```

### Step 6 — Hand off to Phase 2

Once you have `api_url` and `api_key`, **stop using the control-plane
token for project data.** Switch to the **insforge** skill (SDK client
code) or **insforge-cli** skill (infrastructure). The project's own
backend has its own auth — that's where you call database, storage,
functions, and realtime APIs from.

```javascript
// Phase 2: project's own SDK
import { createClient } from '@insforge/sdk';

const insforge = createClient({
  url: 'https://my-app.us-east.insforge.app',
  anonKey: 'sk_live_...',
});
```

## Process — Refresh the access token

When the access token's 1-hour TTL is near expiry, use the refresh token to
get a new pair. The old refresh token is **revoked** on success.

```bash
curl -sS -X POST https://cloud.insforge.dev/api/oauth/v1/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$refresh_token" \
  --data-urlencode "client_id=$CLIENT_ID"
```

Response has the same shape as Step 4. Store the new tokens and **discard the
old ones immediately** — reusing the old refresh token triggers replay
detection and revokes the **entire chain** (every token this agent has for
this user).

| Error on refresh | Meaning | What to do |
|---|---|---|
| `invalid_grant` on first refresh | Token revoked, expired, or user-revoked the grant | Restart the Device Flow from Step 1 |
| `invalid_grant` after a visible success | Replay detection killed the chain — token was stolen or your code re-used it | Restart Device Flow. Log a security warning. |

## Defensive rules (do not skip)

1. **Redact tokens in stdout and logs.** Never print the raw `access_token`,
   `refresh_token`, or `api_key`. When logging for debugging, mask to the
   first 6 characters + `…` (e.g. `eyJhbG…`).

2. **Do not persist to disk without explicit user consent.** If you want to
   save the token for cross-invocation persistence, ask the user first,
   explain where you're saving it (`~/.insforge/credentials` or similar),
   and chmod `600`. Prefer an OS keychain if available.

3. **Remind the user they can revoke.** Any time you mint a new grant, tell
   the user: *"You can revoke this connection anytime at*
   `https://cloud.insforge.dev/settings/connected-agents`*."* This is the
   user's escape hatch if the agent goes rogue or the laptop is lost.

4. **One agent grant = one `client_id`.** Don't reuse the same client across
   users. Each user's grant to a given agent is tracked per-`client_id` in
   the dashboard; sharing a `client_id` across users means everyone sees
   everyone's grant.

5. **Request narrow scopes.** See the scope guidance under Step 1.

6. **Stop at the control plane.** Once a project is provisioned, don't keep
   calling `/api/oauth/v1/token` for access to that project. The project's
   own auth (OSS) is separate and lives at the project URL. Re-using the
   control-plane token for project data is an architectural smell and will
   either fail or log warnings.

## Good example — happy path

```
Agent: (calls POST /device/code with client_id + scope)
Agent: "To log in to InsForge Cloud, open
  https://cloud.insforge.dev/device
  and enter this code: ABCD-1234
  (expires in 15 minutes)"

User: (opens browser, pastes code, clicks Approve)

Agent: (polls every 5 seconds, sees authorization_pending x3,
  then 200 with tokens)

Agent: (calls POST /projects with Bearer token)
Agent: "Created project 'my-app' in us-east-1.
  URL: https://my-app.us-east.insforge.app
  You can revoke this agent's access at
  https://cloud.insforge.dev/settings/connected-agents anytime.
  Switching to the project's own SDK now."

Agent: (uses @insforge/sdk with project URL + anon key;
  stops talking to control plane)
```

## Bad example — what not to do

```
Agent: (calls POST /device/code — gets code ABCD-1234)
Agent: "Open https://cloud.insforge.dev/device, enter ABCD-1234"
Agent: (polls every 500 ms — too fast)
  ↳ gets "slow_down"
Agent: (keeps polling at 500 ms)                       ❌ ignored slow_down
  ↳ gets "slow_down" again, server grows interval to 15 s
Agent: (still polling at 500 ms)                       ❌ still ignored
Agent: (treats authorization_pending as fatal, aborts) ❌ not terminal
Agent: (or: logs the refresh_token verbatim to stdout) ❌ leaked secret
Agent: (or: caches the 1-hour JWT on disk in plaintext) ❌ no consent, no chmod
Agent: (or: reuses control-plane token for direct DB queries
  on the project instead of switching to the project's URL)  ❌ wrong phase
```

**Fixes for each:**

- Polling too fast → honor the server-provided `interval` (default 5 s) and
  grow it on `slow_down`. Never poll faster than the server told you.
- `authorization_pending` → it's the expected response while waiting for the
  user. Continue the loop, not abort.
- Logging refresh token → mask all secrets in logs. Treat `refresh_token`
  like a password.
- Persisting without consent → ask first; prefer keychain; chmod 600 files.
- Wrong phase → once `POST /projects` returns `api_url`, switch clients.

## Verification

After minting a token, verify it works with a cheap read-only call before
acting on it:

```bash
curl -sS -X GET https://cloud.insforge.dev/api/user/profile \
  -H "Authorization: Bearer $access_token"
```

Expected 200 with the current user's profile. If you get `401` the token is
invalid; if `403` the scope is insufficient (request more scope and restart
the flow); if `429` back off and retry.

## When the flow fails

| Symptom | Likely cause | Action |
|---|---|---|
| `/device/code` 400 `invalid_client` | Wrong `client_id` or client disabled | Check the `client_id` the agent was configured with. Ask the user to re-register it at cloud.insforge.dev. |
| `/token` 400 `authorization_pending` forever | User never approved | After `expires_in` (15 min), restart. Remind the user the code is time-limited. |
| `/token` 400 `access_denied` | User clicked Deny | Respect it. Don't re-prompt. Ask the user why, consider the request ended. |
| `/token` 400 `expired_token` | Code aged out | Restart from Step 1. |
| `/token` 200 but `/projects` returns 401 | Token scope doesn't include `projects:write` | Request with broader scope and re-run Device Flow. |
| `/token` 200 but `/projects` returns 403 | Organization policy or rate limit | Check the response body for details. |
| Refresh returns `invalid_grant` | Token chain revoked (user-revoked, or replay-detected theft) | Restart Device Flow. Warn the user if you suspect theft. |

## References

- [RFC 8628: OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628) — the base standard.
- [RFC 6749: OAuth 2.0 Framework](https://datatracker.ietf.org/doc/html/rfc6749) — §5.1 token response, §5.2 error envelope.
- [Authoritative design spec](https://github.com/InsForge/insforge-cloud-backend/pull/433) — InsForge-specific endpoint shapes, scopes, TTLs. If anything in this skill conflicts with that spec, the spec wins.
- Industry references: `gh auth login`, `aws sso login`, `gcloud auth application-default login`, `stripe login`. All use the same RFC 8628 pattern.
- Related InsForge skills: **insforge** (SDK for calling a project directly),
  **insforge-cli** (infrastructure mgmt via CLI), **insforge-integrations**
  (third-party auth providers for end users of a project).
