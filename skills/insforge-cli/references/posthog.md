# npx @insforge/cli posthog setup

One-shot command that ensures the InsForge dashboard has a PostHog connection, then prints the official PostHog wizard command so the user can wire PostHog into their app code in their own terminal.

> ⚠️ **For coding agents:** `npx @insforge/cli posthog setup` itself is safe to run from your shell — it just ensures the dashboard connection and exits. The **wizard command it prints at the end** (`npx -y @posthog/wizard@latest`) is interactive (browser OAuth + framework picker), so don't try to spawn that one yourself. After `posthog setup` exits, ask the user to run the wizard with the `!` prefix:
>
> ```
> ! npx -y @posthog/wizard@latest
> ```
>
> Note: if the InsForge dashboard isn't connected to PostHog yet, `posthog setup` opens a browser for the user to authorize — the agent should let the user know to check their browser.

## Availability

PostHog integration is in beta. If `npx @insforge/cli posthog setup` fails with `PostHog connect flow unavailable (HTTP 404)`, this project doesn't have PostHog enabled yet — wait for the rollout or ask the InsForge team to enable it. Self-hosted backends don't currently expose `/integrations/posthog/v1/*` and this command won't work there; users on self-hosted should install PostHog directly per [PostHog's docs](https://posthog.com/docs/libraries). Do not work around the 404 by pulling a `phc_` key from a separate PostHog account and embedding it in the app's env — events will flow to PostHog but the InsForge Analytics page reads from a server-side OAuth-backed `posthog_connections` row that only `posthog setup` populates, so the page stays empty even though the integration "looks" wired.

## Usage

```bash
cd /path/to/your/app
npx @insforge/cli link --project-id <insforge-project-id>   # if not already linked
npx @insforge/cli posthog setup
# CLI exits after the dashboard connection is ensured. Then run the wizard
# command it prints (something like `npx -y @posthog/wizard@latest`) in your
# own terminal.
```

| Flag | Description |
|------|-------------|
| `--skip-browser` | Don't auto-open the browser for InsForge's OAuth step; only print the URL (useful for headless / SSH sessions). |

Inherited global flags (e.g. `--json`, `--api-url`) work too — see the main CLI skill.

## What the CLI does in order

1. Reads `.insforge/project.json` from the current directory to find your InsForge project ID
2. Calls cloud-backend `/integrations/posthog/v1/cli-start`. Two outcomes:
   - **Already connected**: dashboard already has a PostHog connection → go straight to step 3
   - **Not connected**: cloud-backend returns an authorize URL. CLI opens it in the browser (unless `--skip-browser`) and polls `/connection` until the dashboard receives the OAuth callback
3. Prints a `Next step` note with the `npx -y @posthog/wizard@latest` command and exits

CLI does NOT spawn the wizard — that's left to the user. The wizard:
- Opens its own browser for PostHog OAuth (independent of step 2)
- Lets the user pick a PostHog project
- Detects the app's framework, installs the SDK, writes env vars, and adds the SDK init / provider code

## Two OAuths, briefly explained

The whole flow involves two OAuths in sequence, both targeting PostHog but for different consumers:

| Step | What it sets up | Driver | What it writes |
|------|-----------------|--------|----------------|
| 2 — InsForge cli-start | Server-side connection so the InsForge dashboard Analytics page can query PostHog on the user's behalf | `npx @insforge/cli posthog setup` | `posthog_connections` row in cloud-backend |
| post-step 3 — `@posthog/wizard` | Client-side instrumentation so events flow from the app to PostHog | User runs `npx -y @posthog/wizard@latest` themselves | Env vars + SDK init in the app code |

Practically the user signs in with the same PostHog account both times and ends up on the same PostHog project.

## Web Analytics ingestion delay

PostHog's `sessions` materialized view (which powers Web Analytics queries) has multi-hour ingestion lag for new projects. Events show in PostHog's Activity page within seconds, but `visitors / views / sessions` on Web Analytics and the InsForge Analytics page can return 0 for the first 24h. This is not a CLI bug — wait it out.

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Running `npx @insforge/cli posthog setup` outside the linked project directory | The CLI reads `.insforge/project.json` from cwd. Run it from the project root after `npx @insforge/cli link --project-id <id>` |
| Headless environment, browser doesn't open for the InsForge OAuth step | Pass `--skip-browser` and copy the printed URL onto a machine with a browser |
| Agent ran `posthog setup` and the wizard command printed at the end was never executed | The wizard is interactive — the agent should ask the user to run it (`! npx -y @posthog/wizard@latest`). The InsForge dashboard connection is already in place, but app-code instrumentation is not. |
