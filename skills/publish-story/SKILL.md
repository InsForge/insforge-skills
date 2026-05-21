---
name: publish-story
description: Publish a customer story to the InsForge content management system. Use when asked to create, publish, or update a customer story in `stories/` or `/customers` from a Notion page, interview notes, or other source material.
argument-hint: "[notion-url-or-company]"
---

# Publish Customer Story to InsForge CMS

You are publishing a customer story to the `InsForge/insforge-content-management-system` repo.

## Required Context First

Before writing prose:

- Read `stories/README.md`
- Read one existing story, defaulting to `stories/peak-mojo.md`
- Check `assets/README.md` if asset paths or formats are unclear

## Workflow

### 1. Gather Source Content

- If the user gives a **Notion URL**, prefer the Notion MCP if it is available.
- If MCP is unavailable but the page is public, use the public Notion fallback:
  1. Fetch the page HTML.
  2. Extract the `pageId` from `requiredRedirectMetadata` or normalize it from the URL slug.
  3. POST to `https://www.notion.so/api/v3/loadPageChunk`.
- If the user gives **raw notes** or a draft, use them directly.
- Flatten the source into an outline:
  - company summary
  - website
  - founded/location
  - headline or subtitle
  - challenge
  - why InsForge
  - solution
  - results
  - what's next
  - quotes
  - images, gifs, and videos

**Do not trust raw Notion blocks blindly.** Ignore discussion metadata except when it reveals editorial risk. Skip anything marked with notes like `DRAFT QUOTE`, `NEEDS CUSTOMER APPROVAL`, unresolved fragments, or obviously broken quote attribution.

### 2. Determine Slug and Paths

- Convert the company name to **kebab-case** for the filename and asset folder.
- File path: `stories/<slug>.md`
- Image directory: `assets/images/<slug>/`
- Optional video directory: `assets/videos/<slug>/`
- Default to `status: "staging"` unless the user explicitly asks to publish.

### 3. Build the Markdown File

Use this frontmatter template:

```yaml
---
title: "Customer Story Title"
subtitle: "Optional subtitle shown below the title"
description: "Brief description of how the customer uses InsForge"
coverImage: "/assets/images/company-name/cover.webp"
companyLogo: "/assets/images/company-name/logo.webp"
companyName: "Company Name"
companyAbout: "Brief description of what the company does"
companyWebsite: "https://company.com/"
companyFounded: "Location or Year Founded"
date: 2026-04-26
status: "staging"
---
```

- `subtitle` is optional. Use it when the source includes a strong subheading or dek that should render directly below the title.
- `coverImage` and `companyLogo` are required.
- Use the current date unless the user provides a specific publish date.
- Keep `title` and `description` concise enough to pass `scripts/seo-audit.mjs` when the story is ready.

### 4. Write the Story

Default structure:

1. Opening paragraph
2. Optional hero media near the top if it materially improves the story
3. `## The Challenge`
4. `## Why InsForge`
5. `## The Solution`
6. `## Results`
7. `## What's Next` only when the source supports it

Voice and structure rules:

- Follow the style and pacing of `stories/peak-mojo.md`
- Keep paragraphs short and concrete
- Preserve exact brand casing like `InsForge` and `Postgres`
- Do not invent metrics, product details, customer approvals, or operational results
- Prefer operator-focused details over marketing fluff
- If the source material is thin, stay sparse rather than padding

For approved quotes, use the existing blockquote pattern:

```html
<blockquote class="quote-with-avatar">
  <p>"Quote here."</p>
  <div class="quote-author">
    <img src="/assets/images/<slug>/person-avatar.webp" alt="Person Name" />
    <span>Person Name - Title of Company</span>
  </div>
</blockquote>
```

- Normalize broken Notion attributions like `— Carson Lin(` into clean text such as `Carson Lin - Co-founder of Hermes`.
- If the quote and speaker appear as separate blocks, pair them during cleanup.
- If no shared avatar exists, store the avatar in the story asset directory.

### 5. Prepare Assets

- Required images:
  - `assets/images/<slug>/cover.webp`
  - `assets/images/<slug>/logo.webp`
- Reuse repo assets if they already exist.
- If only remote assets exist, download them to a temp directory and convert them to `.webp`.
- If local image conversion tools are missing, prefer the bundled Python runtime with Pillow.
- Keep existing motion gifs as `.gif`; do not force-convert them to `.webp`.

Media patterns:

```html
<video autoplay muted loop playsinline>
  <source src="/assets/videos/<slug>/<file>.mp4" type="video/mp4">
</video>
```

```html
<img src="/assets/images/<slug>/<file>.gif" alt="Descriptive alt text" />
```

- Use `assets/videos/<slug>/` only for actual video files.
- A gif can stay in `assets/images/<slug>/`.
- If the user asks for motion media at the very bottom, append it after the final section.

### 6. Verify Before Hand-Off

- Confirm every referenced asset path exists.
- Make sure headings do not use bold syntax like `## **Heading**`.
- Re-read the story once for invented claims, draft-only quotes, and broken attribution.
- Run `node scripts/seo-audit.mjs` when checking final `title` and `description`.
- Review the final diff for `stories/<slug>.md` and the corresponding asset folder.
- If no build or browser preview was run, say so explicitly.

## Public Notion Fallback

Use this when a Notion page is public but MCP content retrieval is unavailable:

```bash
curl -L 'https://www.notion.so/<page-slug>' > /tmp/story-page.html

curl -L 'https://www.notion.so/api/v3/loadPageChunk' \
  -H 'Content-Type: application/json' \
  --data '{"pageId":"<page-id>","limit":100,"cursor":{"stack":[]},"chunkNumber":0,"verticalColumns":false}' \
  -o /tmp/story-page.json
```

Useful block-flattening pattern:

```bash
jq -r '
  .recordMap.block["<page-id>"].value.value.content[] as $id
  | .recordMap.block[$id].value.value
  | [(.type // ""), (.properties.title[0][0] // .format.display_source // "")]
  | @tsv
' /tmp/story-page.json
```

This is usually enough to recover the page outline, quote blocks, image filenames, and section headers without loading the full Notion app.

## Optional Publish Step

If the user asks for branch, commit, or PR work:

- Branch name: `story/<slug>`
- Keep the story in `staging` until explicitly approved for `published`
- Include the markdown file plus all story assets in the same PR

## Checklist

- [ ] `stories/README.md` and an existing story reviewed first
- [ ] Source material flattened into a clean outline
- [ ] Draft-only or unapproved quotes excluded
- [ ] `stories/<slug>.md` created with valid frontmatter
- [ ] `cover.webp` and `logo.webp` exist
- [ ] Optional gifs/videos embedded with the right HTML pattern
- [ ] All referenced paths verified
- [ ] SEO audit considered before hand-off
