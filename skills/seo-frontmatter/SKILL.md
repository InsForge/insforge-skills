---
name: seo-frontmatter
description: >-
  Use this skill when adding or editing blog posts, customer stories,
  alternatives pages, or integration pages in the InsForge CMS. The skill
  ensures `title` and `description` frontmatter fields fit Google's SERP
  limits (title ≤55 chars to leave room for the React shell's
  " | InsForge" suffix; description 60–155 chars). Trigger on: creating
  a new file in blogs/, alternatives/, integrations/, or stories/;
  editing the frontmatter of an existing file in those folders;
  CI failure from the SEO Frontmatter Lint workflow; or any
  user request mentioning "SEO", "meta description", "page title",
  or "frontmatter" for content in this repo.
license: Apache-2.0
metadata:
  author: insforge
  version: "1.0.0"
  organization: InsForge
  date: April 2026
---

# SEO Frontmatter

This CMS publishes content to four S3 buckets that get rendered inside the main `insforge.dev` React shell. The shell pulls `title` and `description` from each markdown file's frontmatter and injects them into `<title>` and `<meta name="description">` tags. Bad frontmatter → bad SERP listings → lost organic traffic.

## The rules

| Field | Min | Max | Why |
|---|---|---|---|
| `title` | 25 | **55** chars (effective) / 65 chars (hard) | The React shell appends ` \| InsForge` (≈11 chars). Frontmatter at 55 → SERP at ≈66, right at Google's truncation point. |
| `description` | 60 | 155 chars | Below 60 → Google rewrites it from page body. Above 155 → truncated with "..." in SERP. |
| **JSON-LD** | — | — | At least one `<script type="application/ld+json">` block in the body. **Mandatory for `status: unlisted` (BLOCK)**, recommended for `status: published` (advisory WARN). Source of truth for SEO content authoring is the `seo-landing-page` skill. |

The lint script at `scripts/seo-audit.mjs` enforces these. **Hard violations** (`too_long`, `missing`) fail CI. **Advisory warnings** (`too_short`, `shell_overflow`) print but don't block.

### When titles >55 chars are acceptable

Don't reflexively trim every title that warns with `shell_overflow`. The 55-char effective limit is the *ideal*, not the law. A title can stay >55 chars if **all** of the following hold:

- It's a `shell_overflow` warning (≤65 chars), not a hard `too_long` failure.
- The full title (after the ` | InsForge` suffix) still reads cleanly when truncated by Google around char 66 — the part that gets cut is editorial, not the keyword.
- Trimming further would drop the primary search keyword listed in `keywords:` or break a brand phrase.

When in doubt, audit the existing fleet — there are already 10+ posts in this repo with `shell_overflow` warnings that ship as-is because their long form is the right form. Match that bar.

## When to use

1. **Before committing a new content file**: run `node scripts/seo-audit.mjs` to check.
2. **When CI fails on a PR** with the `SEO Frontmatter Lint` check: fix the flagged file(s) per the rules below.
3. **When the user asks for SEO improvements** to existing content: run the audit first to find problems systematically.

## Workflow

```bash
# 1. Run the audit (works locally and in CI)
node scripts/seo-audit.mjs

# 2. For each violation, edit only the frontmatter title/description.
#    Body content stays untouched.

# 3. Re-run the audit to confirm
node scripts/seo-audit.mjs
```

For machine-parseable output: `node scripts/seo-audit.mjs --json`.

## How to rewrite a title (>55 chars)

Goal: keep the primary keyword, drop filler.

| Pattern | Bad | Better |
|---|---|---|
| Drop redundant verbs | `"Building an AI-Powered Content Moderation API with InsForge Edge Functions"` (76) | `"Build an AI Content Moderation API with InsForge Edge Functions"` (63) |
| Drop "Introducing" | `"Introducing InsForge Mobile SDKs: Native Support for Swift and Kotlin"` (70) | `"InsForge Mobile SDKs: Native Support for Swift and Kotlin"` (57) |
| Replace "and" with `&` or `+` | `"InsForge Skills and CLI: Build with Agents, Ship from the Terminal"` (66) | `"InsForge Skills + CLI: Build with Agents, Ship from Terminal"` (60) |
| Drop the "Use Any X to Y" tail | `"InsForge Now Supports Remote MCP: Use Any AI Coding Agent to Build Your Backend"` (80) | `"InsForge Now Supports Remote MCP for Any AI Coding Agent"` (56) |

Don't drop the keyword that's pulling search traffic — check `keywords:` in the frontmatter to see what the post is targeting.

## How to rewrite a description (>155 chars)

Goal: keep the lead value prop + 1 supporting clause, in ≤155 chars.

| Pattern | Bad | Better |
|---|---|---|
| Replace "Learn how to build a..." with imperative | `"Learn how to build a production-ready AI moderation API using InsForge Edge Functions, Model Gateway, PostgreSQL, and Storage - without managing external servers or infrastructure."` (180) | `"Build a production-ready AI moderation API with InsForge Edge Functions, Model Gateway, PostgreSQL, and Storage — no external servers."` (134) |
| Drop the "and the future of X" expansion | `"From Enigma to zero-knowledge proofs: explore the evolution of encryption, JWT authentication, and the future of secure digital communication in the age of quantum computing."` (174) | `"From Enigma to zero-knowledge proofs: the evolution of encryption, JWT authentication, and secure communication in the age of quantum computing."` (144) |
| Replace "we are X-ing" with the noun form | `"We are simplifying InsForge pricing to two tiers. Free gives you 2 dedicated instances and the full stack with no credit card required. Pro scales with you when your project grows."` (179) | `"Simplifying InsForge pricing to two tiers: Free gives 2 dedicated instances and the full stack — no card required. Pro scales as you grow."` (138) |

## Voice constraints

These are marketing pages — preserve the existing voice. Specifically:

- **Don't add hype words** ("revolutionary", "blazing-fast", "game-changing") that aren't already there.
- **Don't change branded terms** — "InsForge" is one word, not "Insforge"; "Postgres" is the preferred shorthand over "PostgreSQL" in titles (but PostgreSQL in body is fine).
- **For comparison pages** (`alternatives/`), keep neutral framing — "vs" not "beats", "alternative to" not "replacement for".
- **For the `keywords:` array**, leave it alone unless the user explicitly asks to retarget. Editing keywords is an editorial decision, not a length fix.

## Out of scope for this skill

The following SEO issues exist on the live site but **cannot be fixed in this CMS repo**:

- The `| InsForge | InsForge` duplicate-suffix bug — the `.njk` templates here don't emit `<title>`. The duplicate is injected by the React shell that wraps this CMS output. Fix lives in the shell repo.
- 301 redirects for dead URLs (`/blog/supabase-vs-firebase`, etc.) — belong in the shell or hosting layer.
- Site-wide canonical, OG image fallback, robots meta — same.
- New `/features`, `/solutions`, framework page routes — those aren't markdown content; they're React pages in the shell.

If a user asks for any of the above, point them to the React shell repo (the app that serves `insforge.dev/*`) and don't try to fix it here.

## Adding new content (proactive use)

When the user says "add a new blog post about X" or hands you a draft, before committing:

1. Write a `title` ≤55 chars that includes the primary keyword.
2. Write a `description` 100–155 chars that summarizes value + 1 supporting detail.
3. Run `node scripts/seo-audit.mjs` to confirm clean.
4. Make sure `status: "published"` is set when ready (drafts skip the audit).
