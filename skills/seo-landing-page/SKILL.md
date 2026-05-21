---
name: seo-landing-page
description: Use when creating an SEO landing page targeting specific search prompts — comparison pages ("X vs Y"), "best X for Y" pages, "what is X" explainers, or any post where the goal is to rank in Google search rather than entertain the existing blog audience. These ship as `status: "unlisted"` (sitemap-only, hidden from /blog list) and require hand-tuned JSON-LD. Trigger on requests like "create an SEO post", "make a landing page for the prompt X", "InsForge vs Y", "best backend for Z", or when a user gives you a list of target search prompts.
argument-hint: "[topic-or-target-prompts]"
---

# SEO Landing Page

Use this skill for **search-targeted content**, not regular blog posts. The goal is Google ranking + AI-answer citation, not engagement on the /blog feed. The audience is someone typing a query into Google or asking an AI assistant.

For a regular blog post (launch announcement, war story, founder essay, integration walkthrough), use `publish-blog` instead.

## When to use which

| Signal | Use |
|---|---|
| User says "blog post about X" | `publish-blog` (status: published) |
| User says "rank for X" / "SEO page for X" / gives target prompts list | `seo-landing-page` (status: unlisted) |
| Comparison: "X vs Y", "alternative to X" | `seo-landing-page` |
| "Best X for Y" / "How to do X with Y" | `seo-landing-page` |
| Launch announcement, partnership, changelog-as-blog | `publish-blog` |
| Founder essay, retro, war story | `publish-blog` |

## Workflow

### 1. Lock the target prompts FIRST

Before writing a word, write down the 5–8 search prompts this page is built to win. These drive everything:
- The title (must contain the highest-volume prompt)
- The H2/H3 structure (one per prompt where natural)
- The FAQ Qs (each FAQ is a long-tail prompt)
- The JSON-LD `about` and `mentions` arrays
- The PR description

If you can't list the prompts, you don't have a page yet — push back on the request.

### 2. Determine slug and branch

Slug = the primary search prompt in kebab-case, optionally with a year for freshness:
- "best backend for Claude Code" → `best-backend-for-claude-code-2026`
- "InsForge vs Supabase" → `insforge-vs-supabase`

Branch: `blog/<slug>` from `main`.

### 3. Frontmatter

```yaml
---
title: "<primary search prompt + clarifier, ≤65 chars>"
description: "<one-sentence answer to the primary prompt, 100–155 chars>"
author: "<author name>"
authorTitle: "<author title>"
authorAvatar: "/assets/images/avatars/<author-slug>-avatar.webp"
date: <YYYY-MM-DD>
length: "<N> minutes"
tags: ["<topic-1>", "<topic-2>", "<topic-3>"]
keywords:
  [
    "<primary prompt>",
    "<secondary prompt 1>",
    "<secondary prompt 2>",
    ...
  ]
category: "<category>"
image: ""
imageAlt: ""
noFeatureImage: true
featured: false
status: "unlisted"
---
```

Notes:
- `status: "unlisted"` is the whole point — sitemap-only, hidden from /blog list, hidden from prev/next nav on sibling posts.
- `noFeatureImage: true` is conventional for SEO pages (no cover art needed; the page is text-first for crawlers).
- `keywords:` should mirror the target-prompts list from step 1.
- Title can exceed 55 chars (advisory `shell_overflow` warning is fine for SEO landing pages — see `seo-frontmatter` skill).

### 4. Body structure

This is a fixed template for SEO landing pages. Don't improvise.

```markdown
## TL;DR

**<one-sentence direct answer to the primary prompt, bolded>**

<2–3 short paragraphs framing the problem and the answer. The answer should appear in the FIRST paragraph — Google's featured snippet often pulls from here.>

## The N main points

### 1. <Point 1, written as a claim>
<2–3 short paragraphs. End with a bolded one-sentence reinforcement of the claim.>

### 2. <Point 2 ...>

### 3. <Point 3 ...>

## <Primary prompt as H2, e.g. "What is the best backend for Claude Code in 2026?">

<Direct answer in the first sentence. Then expand.>

## <Each secondary prompt as its own H2 section>

<Direct answer first, then context.>

## <Comparison sections if applicable: "X vs Y for [use case]">

<Use a markdown table for the at-a-glance comparison. Tables rank well in AI answers.>

| Category | X | Y |
|---|---|---|
| ... | ... | ... |

## When should you use X?

<Concrete use cases as a bulleted list. AI answers love these.>

## When should you not use X?

<Honest counter-cases. Crawlers reward this — it signals authority, not marketing.>

## Final answer

<One paragraph that re-answers the primary prompt definitively. Often pulled by AI as the canonical answer.>

**<Bolded one-sentence summary, same as the TL;DR opener.>**

## FAQ

### <Long-tail prompt as a question>

<2–3 sentence answer. Plain text, no formatting tricks.>

### <Another long-tail prompt>

...
```

Keep it 8–12 visible FAQ entries in the body. The JSON-LD subset (next step) curates from these.

### 5. JSON-LD blocks (mandatory)

**Append both blocks at the very end of the markdown body**, after the visible FAQ. The slug page extracts them and re-emits as proper script tags in `<head>`.

#### Article schema — always include

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "<exact post title; can be longer than the SEO meta title>",
  "description": "<one-sentence summary of the page's core claim>",
  "author": {
    "@type": "Organization",
    "name": "InsForge"
  },
  "publisher": {
    "@type": "Organization",
    "name": "InsForge"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://insforge.dev/blog/<slug>"
  },
  "about": [ "<topic 1>", "<topic 2>", "<topic 3>", "<topic 4>" ],
  "mentions": [ "<product 1>", "<product 2>", "<protocol>", "<concept>" ]
}
</script>
```

- For SEO pages, `author` should be `Organization "InsForge"` (not a Person), because the page represents the brand's authority on the topic. For founder essays, regular blog posts, or first-person posts, use Person.
- `about` = 3–6 high-level topic strings (e.g. `"agent-native backend"`, `"MCP-native BaaS"`). Helps AI crawlers categorize.
- `mentions` = specific products/companies/protocols named (e.g. `"InsForge"`, `"Claude Code"`, `"Supabase"`, `"Postgres"`). Helps AI answers cite the post in comparisons.

#### FAQPage schema — include if the page has a FAQ

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "<question text, mirrors a ### heading from the visible FAQ>",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "<the answer paragraph from the body, plain text only — no HTML, no markdown>"
      }
    }
  ]
}
</script>
```

**Curate** — pick 5–7 highest-search-intent questions from the visible FAQ. Don't dump all 10–12. Google can downgrade or stop showing rich results for bloated FAQ schemas. Skip questions that are clearly self-promotional ("Should I use X?") — favor neutral informational questions ("What is X?", "How does X work with Y?").

#### Validation

- Must be valid JSON. No trailing commas, no single quotes, no comments inside the JSON.
- After deploy, validate at <https://search.google.com/test/rich-results>.
- View Source on the rendered page — the script tags should appear in the HTML exactly as written. If they don't, the frontend extraction logic broke (file an issue against `insforge-cloud`).

### 6. SEO audit + push

- Run `node scripts/seo-audit.mjs`. For unlisted posts the audit checks:
  - Title length (advisory `shell_overflow` warnings are fine; hard `too_long`/`missing` fails CI)
  - Description length (60–155 chars, hard fail outside that range)
  - **JSON-LD presence (mandatory for unlisted)** — at least one `<script type="application/ld+json">` block must exist in the body, or the audit blocks the PR. This catches the most common shipping mistake on SEO landing pages.
- The audit doesn't validate JSON-LD *contents* (use Google's Rich Results test post-deploy for that), only that a block exists.
- Push to `blog/<slug>` branch and open a PR.

### 7. PR description

The PR description should include the **target prompts list** so reviewers can sanity-check the SEO targeting. Use this template:

```markdown
## Summary
SEO landing page targeting: <list of target prompts from step 1>

Status: `unlisted` — in sitemap, hidden from /blog feed.

## Why
<1–2 sentences on the search opportunity. e.g. "InsForge vs Supabase" gets ~X searches/mo and is the highest-intent capture point for users actively shopping for a Supabase alternative.>

## Test plan
- [ ] `node scripts/seo-audit.mjs` clean
- [ ] After deploy, both `<script type="application/ld+json">` blocks valid in [Google Rich Results test](https://search.google.com/test/rich-results)
- [ ] Page reachable at `/blog/<slug>`
- [ ] Page does NOT appear on `/blog` list
- [ ] Page appears in `/sitemap.xml`
```

### 8. Cross-posting plan (after merge)

SEO landing pages should be cross-posted to Medium and Substack to capture additional discovery surface. Always set `rel="canonical"` pointing to `https://insforge.dev/blog/<slug>` on the cross-posts so they don't outrank the canonical (Medium has higher domain authority and will steal the rank otherwise).

The frontend slug page already emits `<link rel="canonical" href="https://insforge.dev/blog/<slug>">` in the metadata, so when you copy the article HTML into Medium/Substack, you just need to add a `<link rel="canonical">` on those platforms (both support this in their post settings).

## Common mistakes

- **Skipping target prompts** → page rambles, doesn't rank for anything specific. Always do step 1 first.
- **Using `status: "published"` for an SEO page** → it clutters the /blog feed and dilutes engagement metrics. Use `unlisted`.
- **Auto-generating JSON-LD or copy-pasting from another post** → `about`/`mentions` arrays are per-page; copy-paste means schema doesn't match content, which Google penalizes.
- **Including ALL FAQ questions in JSON-LD** → bloated FAQ schemas can get the rich result revoked. Curate to 5–7.
- **Using "Person" author for SEO pages** → the page represents brand authority; use `Organization "InsForge"`.
- **Forgetting to validate JSON-LD** → broken JSON ships silently. Run Rich Results test after every deploy.

## Reference

- Frontend rendering: `insforge-cloud` extracts `<script type="application/ld+json">` blocks from the body HTML and re-emits them as proper React script tags in `<head>`. Mechanism documented in `src/app/(public)/blog/[slug]/page.tsx`.
- Status semantics: `'staging' | 'published' | 'unlisted'` — see `insforge-cloud/src/features/contents/services/contentService.ts` for `shouldShowContent` and `shouldListContent`.
- Sitemap: includes both `published` and `unlisted` — see `insforge-cloud/src/app/sitemap.ts`.
- For frontmatter title/description length rules, see the `seo-frontmatter` skill in this repo.
- For mechanical workflow questions (image upload, PR creation, branch hygiene), see `publish-blog` in this repo.
