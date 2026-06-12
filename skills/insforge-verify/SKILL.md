---
name: insforge-verify
description: >-
  Use after making backend or full-stack changes to an InsForge project, when
  you want to verify the change end-to-end before merging the branch to prod.
  Spins up an isolated full-stack preview (a branch backend + the frontend
  pointed at it) and an authenticated test session, then hands off to your own
  browser test agent (Playwright Test Agents) to explore and verify the running
  app, and tears the preview down afterward. Built for "full stack branch per
  git branch, easy to verify."
license: MIT
metadata:
  author: insforge
  version: "0.1.0"
  organization: InsForge
  date: June 2026
---

# InsForge Verify

> 🔒 **Private preview.** Experimental, not yet generally available. Depends on
> `insforge preview` commands that are still rolling out (older CLI versions
> won't have them) and uses a manual workaround for the auth session — see Known
> gaps. Behavior and commands may change. Ask the InsForge team for early access.

Verify an InsForge full-stack change the way a real user would: in an **isolated
preview** (a branch backend + the frontend pointed at it), driven by a **real
browser**.

This skill does NOT write or run the tests. It sets up the things your browser
test agent **cannot get itself**, then gets out of the way:

| Your test agent does | This skill provides |
| --- | --- |
| Explore the app, write the test plan, drive the browser, judge results | An isolated full-stack environment (`preview create`) |
| Decide what to test and how | The frontend wired to that environment (`--wire-env`) |
| | An authenticated test session (the login wall blocks autonomous testing) |
| | Backend ground truth to check against, and teardown |

> Do not prescribe a test plan here — let the test agent's planner discover the
> flows from the live app. This skill only stands up a verifiable environment.

## When to use

After changing schema / RLS / functions / frontend, to confirm the app actually
works before merging the branch to prod.

## Steps

### 1. Stand up an isolated full-stack preview

```bash
insforge preview create <name> --wire-env .env.local
```

Branches the linked project (real backend + a copy of its data) and repoints
`NEXT_PUBLIC_INSFORGE_URL` in `.env.local` at the branch backend (a
`.env.local.preview-bak` backup is made). Your test writes now land in the
isolated branch, not prod.

### 2. Get an authenticated test session

Real flows sit behind a login wall, and signup needs an email OTP a test agent
can't read. Hand it a ready-to-use verified account using admin access to the
branch:

```bash
insforge branch switch <name>      # pulls the branch's own admin key into .insforge
BRANCH_URL=$(node -e "console.log(require('./.insforge/project.json').oss_host)")
ADMIN_KEY=$(node -e "console.log(require('./.insforge/project.json').api_key)")

curl -s -X POST "$BRANCH_URL/api/auth/users" -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-test@example.com","password":"Test1234!pass","name":"verify test"}' >/dev/null
curl -s -X POST "$BRANCH_URL/api/database/advance/rawsql" -H "x-api-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"UPDATE auth.users SET email_verified=true WHERE email='"'"'verify-test@example.com'"'"'","params":[]}'

insforge branch switch --parent    # context back to parent; .env stays on the branch
```

Hand `verify-test@example.com` / `Test1234!pass` to the test agent so it can sign
in. (For a cross-user isolation check, seed a second account the same way.)

### 3. Start the frontend

```bash
npm run dev        # picks up the branch backend from the wired .env.local
```

(For a real https domain instead of localhost: `insforge deployments deploy .
--env '{"NEXT_PUBLIC_INSFORGE_URL":"<branch-url>","NEXT_PUBLIC_INSFORGE_ANON_KEY":"<anon>"}'`
and verify against the returned `*.insforge.site` URL.)

### 4. Hand off to the browser test agent

```bash
npx playwright init-agents --loop=claude
```

Let the test agent explore the running app and generate + run its own plan
against it, signed in as the seeded user. Two reminders to pass along — let it
figure out the rest:

- Cover **cross-user data isolation** using the second seeded account (one user
  must not see another's data). This is the leak class clicking the UI misses.
- **Confirm against backend truth, not just the UI** — a green assertion on a
  page that silently redirected to a login wall is a false pass. Cross-check the
  branch DB (`/api/database/advance/rawsql` with the branch admin key) for what
  should exist.

### 5. Tear down

```bash
insforge preview teardown <name>   # deletes the branch, restores .env.local from backup
```

## Known gaps (private preview)

1. `preview create --seed-user` not built — step 2 is a manual workaround.
2. `preview create` doesn't output the branch admin/anon key — hence `branch switch`.
3. `preview teardown` doesn't remove a frontend deployment — if you deployed in
   step 3, remove it from the dashboard.

## Versioning

Pre-1.0 (`0.x.y`) means private preview / unstable: commands and flow may change
without notice. Bump the minor (`0.2.0`, `0.3.0`) as the workarounds above are
replaced by real commands. Promote to `1.0.0` and drop the Private-preview
callout only when `preview create --seed-user` lands and the flow is stable.
