---
name: write-mintlify-docs
description: >-
  Use this skill when authoring or updating documentation for InsForge in the
  Mintlify docs platform (the `insforge/docs/` directory, which has a `docs.json`
  and `.mdx` pages). Trigger on: "write docs for X", "add an API reference page",
  "update the Mintlify docs", "document this new feature", or any request that
  produces a new or modified `.mdx` file in a Mintlify-powered site. Covers
  frontmatter keys, the component cookbook (Callouts, Steps, CodeGroup, Tabs,
  Card, Accordion, ParamField, Frame), `docs.json` navigation edits, InsForge
  style rules, anti-patterns, and local preview with `mintlify dev`.
license: MIT
metadata:
  author: insforge
  version: "1.0.0"
  organization: InsForge
  date: April 2026
---

# Write Mintlify Docs

This skill teaches any AI agent how to author Mintlify-compliant MDX documentation for InsForge. InsForge docs live in the `insforge/docs/` directory of the `InsForge/insforge` repo and are served by [Mintlify](https://mintlify.com/docs/). Every page is an `.mdx` file, navigation is declared in `docs.json`, and the platform ships its own component library (Callouts, Steps, CodeGroup, Tabs, Card, Accordion, ParamField, Frame).

**Use this skill when** you are:

- Creating a new docs page (`introduction.mdx`, `sdks/typescript/database.mdx`, etc.)
- Updating an existing page to document new behavior
- Writing an API reference (`ParamField`, `ResponseField`)
- Adding a page to the sidebar navigation (`docs.json`)
- Converting prose or plain markdown into Mintlify-idiomatic components

**Do not use this skill for:**

- Writing `CLAUDE.md`, `AGENTS.md`, `README.md`, or other non-Mintlify markdown (these are not MDX and do not use Mintlify components)
- Editing Mintlify CI / deploy configuration (out of scope)
- Rewriting skills in `insforge-skills` (those are plain markdown SKILL.md files, not MDX)

## MDX Fundamentals

An `.mdx` file is Markdown plus JSX. Every docs page MUST start with YAML frontmatter, then Markdown, then optionally Mintlify components (written as JSX-style tags).

### Frontmatter keys InsForge uses

| Key | Required | What it does | Example |
|-----|----------|-------------|---------|
| `title` | Yes | Page `<h1>` and browser tab title | `title: "Introduction"` |
| `description` | Yes | Shown under the title + used for OG cards + search results | `description: "Backend built for AI-assisted development."` |
| `sidebarTitle` | No | Overrides how the page appears in the left nav (use when `title` is too long) | `sidebarTitle: "Intro"` |
| `icon` | No | [Font Awesome](https://fontawesome.com/icons) icon name shown next to the sidebar entry | `icon: "database"` |
| `mode` | No | Layout mode. `"wide"` drops the right-hand TOC, `"center"` centers narrow content, `"custom"` removes chrome | `mode: "wide"` |
| `noindex` | No | When `true`, tells search engines not to index the page | `noindex: true` |

Reference shape — see `insforge/docs/introduction.mdx`:

```mdx
---
title: "Introduction"
description: "Backend built for AI-assisted development."
---

InsForge is an AI-optimized Backend-as-a-Service platform...
```

For the full frontmatter reference, see [Mintlify frontmatter docs](https://mintlify.com/docs/pages).

### Import syntax

MDX lets you import shared snippets. InsForge uses this for repeated blocks (e.g., SDK installation):

```mdx
import Installation from '/snippets/sdk-installation.mdx';

<Installation />
```

The path is repo-root-relative (starts with `/`), not filesystem-relative. Shared snippets live in `insforge/docs/snippets/`.

## Component Cookbook

Mintlify ships a component library. Reach for the component, not raw HTML or plain markdown, when the content is semantically one of these shapes.

### Callouts — `<Note>`, `<Tip>`, `<Warning>`, `<Info>`, `<Check>`

One-line pull-outs that break up prose. Pick by intent:

| Component | Use when |
|-----------|----------|
| `<Note>` | Neutral side information the reader should see |
| `<Tip>` | A non-obvious shortcut or best practice |
| `<Warning>` | Something that will break the reader's code or cost money |
| `<Info>` | Contextual background (less urgent than `<Note>`) |
| `<Check>` | Confirmation of successful state or a positive outcome |

```mdx
<Tip>
  You can also use the [VS Code extension](/vscode-extension) for one-click MCP installation.
</Tip>

<Warning>
  Never commit `.env` files to version control. Add `.env`, `.env.local`, and `.env*.local` to your `.gitignore`.
</Warning>
```

### `<Steps>` / `<Step>` — numbered procedures

Use for ordered setup or install flows. The component renders a vertical stepper with each step as a heading-like node. Prefer over a plain numbered list when the steps contain code, screenshots, or callouts.

```mdx
<Steps>
  <Step title="Open the InsForge panel">
    Click the **InsForge** icon in the Activity Bar (left sidebar).
  </Step>
  <Step title="Login">
    Click **Login with InsForge** and complete the login flow in your browser.
    <Note>The callback is <code>http://127.0.0.1:54321/callback</code>.</Note>
  </Step>
  <Step title="Select a project">
    Pick an organization and project from the InsForge tree view.
  </Step>
</Steps>
```

Real example: `insforge/docs/vscode-extension.mdx`.

### `<CodeGroup>` — tabbed multi-language code

Use whenever the same action has multiple equivalent forms (shells, package managers, languages). Each child code block's language label becomes the tab label.

```mdx
<CodeGroup>
```bash npm
npm install @insforge/sdk@latest
```

```bash yarn
yarn add @insforge/sdk@latest
```

```bash pnpm
pnpm add @insforge/sdk@latest
```
</CodeGroup>
```

Real example: `insforge/docs/snippets/sdk-installation.mdx`.

### `<Tabs>` / `<Tab>` — alternate views

Use when two or more variants of the same content need to coexist but the content is not a code block (otherwise use `<CodeGroup>`). Typical: framework-specific setup, OS-specific steps.

```mdx
<Tabs>
  <Tab title="Next.js">
    Add `NEXT_PUBLIC_INSFORGE_URL` to `.env.local`.
  </Tab>
  <Tab title="Vite">
    Add `VITE_INSFORGE_URL` to `.env`.
  </Tab>
</Tabs>
```

### `<Card>` / `<CardGroup>` — landing-page links

Use to build a grid of entry points at the top of a section or landing page. Each `<Card>` takes `title`, `icon`, and `href`. `<CardGroup>` takes `cols` (1–4).

```mdx
<CardGroup cols={2}>
  <Card title="PostgreSQL Database" icon="database" href="/core-concepts/database/architecture">
    Tables become APIs instantly. No code. Just schema.
  </Card>
  <Card title="Authentication" icon="shield" href="/core-concepts/authentication/architecture">
    User signup, login, sessions, OAuth. Zero configuration.
  </Card>
</CardGroup>
```

Real example: `insforge/docs/introduction.mdx`.

### `<Accordion>` / `<AccordionGroup>` — collapsible detail

Use when a page needs to cover many parallel options (e.g., 12 different AI client MCP setups) and showing them all expanded would overwhelm the reader.

```mdx
<AccordionGroup>
  <Accordion title="Cursor">
    1. Open **Cursor Settings**
    2. Go to **Tools & MCP**
    3. Paste the MCP JSON
  </Accordion>
  <Accordion title="Claude Code">
    Run the installation command in your terminal.
  </Accordion>
</AccordionGroup>
```

Real example: `insforge/docs/mcp-setup.mdx` (uses this pattern for 12+ clients).

### `<ParamField>` / `<ResponseField>` — API reference

Use for documenting a function's parameters and its response shape. Attributes: `path`, `type`, `required`, `default`.

```mdx
## `createClient(options)`

<ParamField path="baseUrl" type="string" required>
  Your InsForge project URL, e.g. `https://myapp.us-east.insforge.app`.
</ParamField>

<ParamField path="anonKey" type="string">
  Anonymous key for public requests. Required if RLS is enabled.
</ParamField>

<ResponseField name="client" type="InsForgeClient">
  A configured InsForge client with `.auth`, `.database`, `.storage`, `.functions`, `.ai`, and `.realtime` namespaces.
</ResponseField>
```

### `<Frame>` — image + caption container

Use to wrap images or embedded videos with a consistent border. Supports a `caption` prop.

```mdx
<Frame caption="Cursor Settings → Tools & MCP">
  ![Cursor MCP settings](/images/mcp-setup/cursor-mcp.png)
</Frame>
```

For plain inline images without framing, standard Markdown `![alt](/path)` is fine — reserve `<Frame>` for screenshots and videos that benefit from a visual boundary.

### Full component reference

For components not covered here (`<Expandable>`, `<Icon>`, `<Update>`, `<Mermaid>`, etc.) see the official Mintlify component library: [mintlify.com/docs/components](https://mintlify.com/docs/components/).

## `docs.json` — Sidebar Navigation

Every new page MUST be registered in `insforge/docs/docs.json` or it will ship but be invisible in the sidebar.

### Structure

Top-level `navigation.tabs[]` contains tabs; each tab has `groups[]`; each group has `pages[]`. A page entry is either a string (the path without the `.mdx` extension, relative to `docs/`) or a nested group object.

```json
{
  "navigation": {
    "tabs": [
      {
        "tab": "Docs",
        "groups": [
          {
            "group": "Getting Started",
            "pages": ["introduction", "quickstart", "mcp-setup"]
          },
          {
            "group": "Core Concepts",
            "pages": [
              {
                "group": "Database",
                "pages": [
                  "core-concepts/database/architecture",
                  "core-concepts/database/pgvector"
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Adding a new page — concrete diff

Say you just authored `insforge/docs/core-concepts/database/triggers.mdx`. To expose it in the sidebar:

```diff
 {
   "group": "Database",
   "pages": [
     "core-concepts/database/architecture",
-    "core-concepts/database/pgvector"
+    "core-concepts/database/pgvector",
+    "core-concepts/database/triggers"
   ]
 }
```

Rules:

- Path is **without** the `.mdx` extension.
- Path is relative to `insforge/docs/` (no leading `/`).
- Order in `pages[]` is the order in the sidebar — place new pages where they fit logically, not always at the end.
- If you create a new sub-section with 3+ pages, wrap them in a nested `{"group": "...", "pages": [...]}` instead of flattening.

For the full `docs.json` schema (colors, search prompts, SEO, tab layout), see [Mintlify's settings docs](https://mintlify.com/docs/settings/global) — the schema URL is in the first line of `docs.json`: `https://mintlify.com/docs.json`.

## Common Anti-Patterns

| Anti-pattern | Use instead | Why |
|-------------|-------------|-----|
| `<details><summary>...</summary>...</details>` | `<Accordion>` | Raw HTML doesn't inherit Mintlify theme, breaks dark mode, no keyboard-nav polish |
| Plain triple-backtick block for multi-language install | `<CodeGroup>` | Readers can't tab; they have to scroll past languages they don't use |
| Plain numbered list for multi-step setup with screenshots | `<Steps>` | `<Steps>` visually anchors each step and allows embedded callouts / code without breaking numbering |
| No frontmatter | Always include `title` and `description` | Page will 404 in search, OG preview is blank, sidebar label is empty |
| Prose paragraph linking to 6 sub-pages | `<CardGroup>` of `<Card>`s | Cards scan visually at landing-page level; prose buries the links |
| `**Note:**` inline bold | `<Note>` component | Component renders as a visually distinct box the reader cannot skim past |
| Embedding a full image tag `<img>` | Markdown `![alt](/images/...)` or `<Frame>` for screenshots | Mintlify handles sizing / lazy-loading / dark-mode variants automatically |
| Long `.mdx` with 12 repeated install flows at top level | `<AccordionGroup>` | Collapses the page to something scannable |

## InsForge Style Rules

- **Second person** — "you install the SDK", never "we install the SDK" or "the user installs the SDK".
- **Imperative verbs** — "Run `npm install`", not "You can run `npm install`".
- **Capitalize product and API names** — InsForge, PostgreSQL, PostgREST, JWT, MCP, SDK, CLI. Lowercase their command forms: `npx @insforge/cli`, `createClient()`.
- **Short sentences** — aim for one idea per sentence. If a sentence has two clauses joined by "and", consider splitting.
- **Filename captions on code blocks where possible** — for multi-file code examples, label each block with its filename after the language: `` ```ts app/page.tsx ``. This renders as a small caption above the block.
- **Link style** — prefer inline prose links (`[InsForge Cloud](https://insforge.dev)`) for single destinations; use `<Card>` or `<CardGroup>` when a whole paragraph is just "here are the N next places to go".
- **Never hard-code secrets or project IDs** in examples — always use placeholders like `<your-project-id>` or environment variable references like `process.env.NEXT_PUBLIC_INSFORGE_URL`.
- **Always show the `{ data, error }` pattern** when documenting SDK methods — it is the core SDK contract.

## Verification

Before shipping docs changes, preview locally.

### Install Mintlify CLI (once)

```bash
npm install -g mintlify
```

### Preview

Run `mintlify dev` from the `docs/` directory (the directory containing `docs.json`):

```bash
cd insforge/docs
mintlify dev
```

This starts a local server on `http://localhost:3000` that hot-reloads on `.mdx` edits. Use it to verify:

- Frontmatter renders (title + description visible)
- Components are recognized (no raw `<Note>` text showing as prose)
- New page appears in the sidebar (only if you edited `docs.json`)
- Internal links resolve (no 404s on hover)
- Images load

If `mintlify dev` fails on a syntax error, the error message points to the exact `.mdx` file and line — usually an unclosed component tag or an invalid JSX prop.

For CI checks and broken-link detection, see [Mintlify's docs on validation](https://mintlify.com/docs/settings/broken-links).

## Good Example vs. Bad Example

### Bad — raw markdown, no frontmatter, no components

```mdx
# Signing Up a User

Here's how to sign up a user:

```javascript
insforge.auth.signUp({ email, password })
```

**Note:** this returns a promise.

You can see how it works in our other docs at /auth, /auth/oauth, and /auth/sessions.

If you get an error saying "User already exists" that means the email is taken.
```

**Why it's bad:**

- No frontmatter (no title, no description, no sidebar entry)
- `# Signing Up` duplicates the frontmatter title (Mintlify renders `title` as `<h1>` automatically)
- Plain `**Note:**` should be `<Note>`
- Three destination links buried in prose — should be `<CardGroup>`
- Error advice should be a `<Warning>` or `<Tip>`
- Code block isn't labeled with a filename

### Good — frontmatter, semantic components, scan-able

```mdx
---
title: "Sign Up a User"
description: "Create a new InsForge user with email and password."
sidebarTitle: "Sign Up"
---

Sign up a new user with `insforge.auth.signUp()`. The method returns `{ data, error }` — always destructure both.

```typescript app/signup.ts
const { data, error } = await insforge.auth.signUp({
  email: 'jane@example.com',
  password: 'hunter2',
});
```

<Note>
  `signUp` returns immediately with the new user object. If email confirmation is enabled on the project, the user must click the confirmation link before they can sign in.
</Note>

<Warning>
  If `error.code === 'user_already_exists'`, the email is already taken. Prompt the user to sign in instead.
</Warning>

## Next Steps

<CardGroup cols={3}>
  <Card title="Sign In" icon="lock" href="/auth/signin">
    Email + password and session handling
  </Card>
  <Card title="OAuth" icon="github" href="/auth/oauth">
    GitHub, Google, and other OAuth providers
  </Card>
  <Card title="Sessions" icon="cookie" href="/auth/sessions">
    Refresh tokens and `getCurrentUser()`
  </Card>
</CardGroup>
```

**Why it's good:**

- Frontmatter registers the page with a searchable title + description and overrides the long sidebar label
- The `<h1>` is delegated to frontmatter
- Code block has a filename caption (`app/signup.ts`)
- Semantic callouts (`<Note>` for neutral info, `<Warning>` for error handling)
- `<CardGroup>` replaces the "other docs at /foo, /bar, /baz" prose
- Uses the `{ data, error }` contract consistently
- Imperative second person throughout

## References

- [Mintlify docs](https://mintlify.com/docs/) — official platform documentation
- [Mintlify component library](https://mintlify.com/docs/components/) — exhaustive component list
- [Mintlify frontmatter reference](https://mintlify.com/docs/pages) — every supported frontmatter key
- `insforge/docs/` — the live InsForge docs repo; read existing `.mdx` files for shape reference
- `insforge/docs/docs.json` — canonical navigation configuration
- `insforge/docs/snippets/` — shared snippets imported across pages
