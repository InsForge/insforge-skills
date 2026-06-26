# Apify data source

> ⚠️ **Private beta.** The Apify data source is rolling out to early-access projects, and is **cloud-only**. Self-hosted backends don't expose the `/datasources/apify/*` endpoints, so connecting and scraping through InsForge won't work there. If `insforge datasource apify connect` fails with `HTTP 404`, this project doesn't have it enabled yet; wait for the rollout or ask the InsForge team to enable it.

## 1. Connect (one-time)

```bash
npx @insforge/cli datasource apify connect
```

Opens the Apify OAuth flow and stores a refreshable token in InsForge. After a successful connect the CLI automatically runs the auth bridge (step 2) so the local agent is immediately usable.

## 2. Auth bridge (per machine)

```bash
npx @insforge/cli datasource apify login
```

Fetches the InsForge-managed token, ensures the Apify CLI is installed (`apify-ultimate-scraper` drives it), runs `apify login --token <token>` (no browser), and installs Apify's official agent skills. Verify with `apify info`.

**Hard rule:** never run plain `apify login` (browser OAuth). On any Apify `401` or "not logged in" error, re-run `login`; InsForge re-fetches a fresh token. Do not fall back to browser-based login under any circumstance.

For the `apify-sdk-integration` path (app code using the `apify-client` package), the client reads `APIFY_TOKEN` from the environment instead of the CLI login. Get a fresh token the same way and export it (`export APIFY_TOKEN=<token>`); never hardcode or commit it; it is short-lived and managed by InsForge.

## 3. Scrape (on demand)

Use Apify's official skills (such as `apify-ultimate-scraper`) to pick and run the right actor for the task. Chain actors when the job requires it. For example: Google Maps actor to get place IDs, then a reviews actor, then a contact-details actor.

## 4. Land the result

Choose the landing strategy by result size. The target is whatever satisfies the use case, not necessarily a database table.

| Size / shape | Strategy |
|---|---|
| Small / one-shot | Keep the data in context and satisfy the use case directly (answer inline, return CSV, etc.). No persistence needed. |
| Persist short/medium | Write an InsForge edge function that fetches the Apify dataset and upserts rows into a table. Deploy with `npx @insforge/cli functions deploy`. |
| Long-running or large dataset | Use InsForge Fly compute (`npx @insforge/cli compute deploy`). Paginate the dataset and upsert in batches to stay within memory limits. |

**Getting the Apify token inside the handler.** An edge function or compute job reads two injected env vars (`INSFORGE_BASE_URL` and `API_KEY`) and fetches a fresh Apify token at runtime:

```
GET ${INSFORGE_BASE_URL}/api/datasources/apify/token
Authorization: Bearer ${API_KEY}
→ { "accessToken": "..." }
```

Use that `accessToken` for Apify API calls. The token is short-lived, so **do not cache it for the whole run**: a short edge function fetches it once at the start (it finishes well before expiry); a long compute job fetches it per batch, or re-fetches and retries on a `401`. InsForge always returns a freshly refreshed token, so no personal API key needed.

## 5. Recurring runs (optional)

**Heavy / long actor run:** schedule the run in Apify. When it finishes, Apify fires a webhook to an InsForge edge function that fetches the completed dataset and lands it. No polling needed.

**Short / fast actor run:** an InsForge schedule triggers an edge function that calls Apify `run-sync-get-dataset-items`, gets the result in one HTTP call, and lands it immediately. No webhook.

Set up schedules with `npx @insforge/cli schedules create`. See `references/schedules.md` for cron format and secret header references.
