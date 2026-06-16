# Verify runbook

The full step-by-step flow. `SKILL.md` has the overview, when-to-use, and scope;
this is the runbook you follow once you've decided to verify. **Stay in branch
context** from step 2 until teardown.

## 1. Stand up an isolated branch backend

```bash
npx @insforge/cli preview create <name>
```

Branches the linked project — a real backend plus a copy of its data. All your test
writes (and the frontend you deploy below) land in this isolated branch, never prod.

## 2. Switch to the branch, apply migrations, seed verified users

Switch context to the branch (so the admin key, the migration apply, and the deploy
all target the branch — not prod). Real flows sit behind a login wall and signup
needs an email OTP a test agent can't read, so create verified accounts directly with
the branch admin key.

```bash
npx @insforge/cli branch switch <name>      # context + admin key + deploy target -> the branch
BRANCH_URL=$(node -e "console.log(require('./.insforge/project.json').oss_host)")
ADMIN_KEY=$(node -e "console.log(require('./.insforge/project.json').api_key)")

# Did your change include a migration (schema / RLS / functions)? The branch is a
# snapshot from create time, so apply pending local migrations to it before testing —
# otherwise you verify the old backend (a loosened RLS policy would still look correct).
npx @insforge/cli db migrations up --all

# Seed a verified account (repeat for verify-b@example.com to test cross-user isolation):
curl -s -X POST "$BRANCH_URL/api/auth/users" -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-a@example.com","password":"Test1234!pass","name":"verify a"}' >/dev/null
curl -s -X POST "$BRANCH_URL/api/database/advance/rawsql" -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"UPDATE auth.users SET email_verified=true WHERE email='"'"'verify-a@example.com'"'"'","params":[]}'
```

Hand the credentials to the test agent so it can sign in.

## 3. Deploy the frontend to a real, isolated https URL

Deploy from branch context. The deploy targets the **branch's own** site slug (a real
https domain, isolated from prod) and is removed when the branch is torn down.
`NEXT_PUBLIC_*` are baked at build time, so pass them with `--env`.

```bash
# A branch gets its OWN anon key (fresh per branch — NOT the parent's):
ANON=$(curl -s -X POST "$BRANCH_URL/api/auth/tokens/anon" -H "Authorization: Bearer $ADMIN_KEY" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken))")
npx @insforge/cli deployments deploy . \
  --env "{\"NEXT_PUBLIC_INSFORGE_URL\":\"$BRANCH_URL\",\"NEXT_PUBLIC_INSFORGE_ANON_KEY\":\"$ANON\"}"
```

The returned `https://<branch-appkey>.insforge.site` URL is what you test against — the
real production build over real https against the isolated branch backend (so cookie /
domain / CORS behaviour matches prod, which a localhost dev server can't confirm).

## 4. Test the UI with Playwright Test Agents

Let the official Playwright Test Agents (planner -> generator -> healer) test the
deployed https app, signed in as a seeded user. They own the UI layer: exploring
routes, writing specs, driving a real browser, self-healing.

Give the planner a **narrow task scoped to the change** (see Scope in SKILL.md), not
"test the app". State what to test and what to skip, e.g.:

> "Plan ONE test: add an item to cart, change its quantity, verify the new quantity
> persisted. Sign in programmatically; do NOT test login UI, checkout, account, or
> other cart operations."

Generated specs land in `tests/*.spec.ts` — reuse them on re-verification (step 6)
instead of re-running the planner.

```bash
# One-time SETUP (not part of a test run): install the agent definitions, then RESTART
# Claude Code so planner/generator/healer load as usable subagents. Subagents load at
# session start — running init-agents mid-session leaves them unavailable. The CLI can
# do this for you at link time: `npx @insforge/cli link --with-test-agents`.
npx playwright init-agents --loop=claude
```

If the Test Agents aren't available this session, fall back to writing and running
Playwright specs directly — same UI coverage, you just lose the planner/healer automation.

This step answers only **"does the app look right in the UI?"** The next step is what
makes this an InsForge verification.

## 5. Cross-check against backend truth

A green UI assertion can still be a false pass — a page that silently redirected,
served a stale value, or leaked another user's row. The isolated branch backend plus
the admin key let you confirm the UI against ground truth.

- **Backend truth.** For each UI assertion, read the branch DB directly and confirm it
  agrees with what the UI claimed:

  ```bash
  curl -s -X POST "$BRANCH_URL/api/database/advance/rawsql" \
    -H "Authorization: Bearer $ADMIN_KEY" -H "Content-Type: application/json" \
    -d '{"query":"<a read that proves what the UI showed>","params":[...]}'
  ```

  UI asserts a state the backend doesn't reflect -> FALSE PASS. Fail it.

- **Cross-user isolation (double-sided).** Sign the two seeded users in to get session
  tokens, then probe the data API (`/api/database/records/<table>`, PostgREST-style)
  with each user's token:

  ```bash
  login() { curl -s -X POST "$BRANCH_URL/api/auth/sessions" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"Test1234!pass\"}" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.accessToken||(j.data&&j.data.accessToken)||'')})"; }
  A_TOKEN=$(login verify-a@example.com); B_TOKEN=$(login verify-b@example.com)
  ```

  - User B lists a user-scoped table (Bearer `$B_TOKEN`) -> only B's own rows appear.
  - User B filters for user A's rows -> must be empty.
  - **Positive control:** user A reads A's own rows -> must be non-empty. Rules out
    "the API returns empty for everyone" — a fake isolation that would pass silently.
  - Anonymous (no token) -> must be 401/403/empty.

  Any of A's data reachable by B is an RLS leak. Fail loudly.

Report each flow as UI result + backend-truth result + whether they agree. Never report
success on UI assertions alone.

## 6. If verification fails: fix, then re-verify

The Test Agents' healer fixes flaky *tests*, not your app — a real bug stays red. When
a UI case or a backend-truth check reveals an actual defect:

1. **Locate it in the source** (the change you're verifying is the prime suspect).
2. **Fix the app code** (you, the main session — not a subagent).
3. **Redeploy the branch frontend** so the fix is live:
   `npx @insforge/cli deployments deploy . --env "{…branch URL + anon key…}"` (still in
   branch context).
4. **Re-verify by re-running the existing spec**, not the planner:
   `npx playwright test tests/<the-failing-spec>.spec.ts` — plus the backend-truth read
   for that flow. Seconds, not minutes.
5. Repeat until green in both UI and backend, or you've confirmed the behaviour is intended.

Report the bug, the fix, and the passing re-verification.

## 7. Tear down

```bash
npx @insforge/cli branch switch --parent    # leave branch context
npx @insforge/cli preview teardown <name>   # deletes the branch — the branch-scoped deployment goes with it
```
