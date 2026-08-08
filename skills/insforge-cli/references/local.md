# InsForge CLI Local Instances

`npx -y @insforge/cli local` runs an InsForge backend in Docker on the user's own
machine — Postgres, PostgREST, the backend, and the edge-functions runtime.

## When to use this

Only when the user explicitly asks for a backend on their own machine: "run
InsForge locally", "I want it in Docker", "no account", "offline".

A cloud project is the default for everything else. Do not reach for `local` when
`login` fails, when a browser is unavailable, or when `create` seems slower — use
`login --user-api-key`, `login --device`, or `create` instead. A local instance is
a different backend with different data, so starting one to work around an auth
problem silently moves the user off the project they meant to use.

## Commands

- `npx -y @insforge/cli local start` - start the stack, wait for health, link this
  directory, seed `.env.local`. Flags: `--storage <local|minio|rustfs>`, `--pull`,
  `--port-app <n>` (and `--port-auth`, `--port-deno`, `--port-postgres`,
  `--port-postgrest`).
- `npx -y @insforge/cli local status [--show-keys] [--json]` - health, ports,
  backend version, per-container state. Keys are masked unless `--show-keys`.
- `npx -y @insforge/cli local stop [--delete-data] [--unlink]` - stop the stack.

After `local start` the directory is linked, so every other CLI command targets
the local backend with no login. `local status --json` is the way to read its
state; `local start --json` returns the keys for scripting.

## Destructive

`local stop --delete-data` removes the volumes — database, storage objects, and
logs — and is classified `critical` by the human-in-the-loop guard. Confirm intent
before running it. A plain `local stop` keeps the data and never prompts.

## What it runs

The first start fetches `deploy/setup.sh` from the InsForge repository and runs it
into `.insforge/checkout/`, then runs the compose file that script wrote — the
same one self-hosting uses. The CLI adds one overlay: the telemetry stamp, and
loopback binding for the published ports.

`.insforge/checkout/.env` holds the generated secrets. If it goes missing while
volumes still exist, `local start` refuses instead of generating new ones —
Postgres reads its password only at cluster creation, so fresh secrets would leave
the database unreachable. Restore the file, or `local stop --delete-data`.

## One instance per directory

The compose project name carries a hash of the directory path, so two folders get
separate containers, volumes, and databases — including two that share a name.

The first instance on a machine gets ports 7130 / 7131 / 7133 / 5432 / 5430. When
those are taken the whole block shifts by ten, and `start` prints what moved. A
port passed with `--port-*`, or one the directory already used, never moves.

## Requirements

Docker with Compose 2.24.4 or newer, and roughly 1.5 GB available to the daemon.
Any Docker-compatible runtime works. Without Docker, `create` gives the user a
hosted project instead — offer it, but do not switch to it on your own.

## Self-hosting is not this

`local start` is a development backend: loopback ports, `:latest` images, one
instance per directory. Deploying InsForge to a server is `deploy/setup.sh`
directly — see the InsForge repository's deployment docs. Do not point a user
setting up a server at `local start`.
