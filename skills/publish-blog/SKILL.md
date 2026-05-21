---
name: publish-blog
description: Publish a blog post to the InsForge content management system. Use when asked to create, publish, or set up a new blog post from a Notion draft or other source content. Handles the full workflow — reading source content, creating the markdown file with proper frontmatter, downloading and pushing images, and creating a PR.
argument-hint: "[notion-url-or-topic]"
---

# Publish Blog to InsForge CMS

You are publishing a blog post to the `InsForge/insforge-content-management-system` GitHub repo.

## Workflow

### 1. Gather Content
- If given a **Notion URL**, use the Notion MCP to retrieve the page and all block children (images, videos, text).
- If given **raw content**, use it directly.
- Extract: title, body text, images (with positions), videos, and any metadata.

### 2. Determine Blog Slug
- Convert the title to **kebab-case** for the filename and branch name.
- Example: "Getting into YC after 6 tries" → `getting-into-yc-after-6-tries`

### 3. Create Branch
- Branch name: `blog/<slug>` from `main`.
- Check if branch already exists first. If it does, use it.

### 4. Build the Markdown File
- File path: `blogs/<slug>.md`
- **Voice, structure, and what to leave out:** For **product launches, integration announcements, and partnership posts**, read `style-guide.md` (in this skill directory) BEFORE writing prose. It covers opener templates, list/code/link rules, target word counts, the house "Never" list, and before/after examples. For essays, founder narratives, war stories, or event recaps, the style guide's scope does not apply — only its core voice/tone rules do.
- Use this frontmatter template:

```yaml
---
title: "<title>"
description: "<1-2 sentence SEO description>"
author: "<author name>"
authorTitle: "<author title, e.g. CEO & Co-Founder>"
authorAvatar: "/assets/images/avatars/<author-slug>-avatar.webp"
date: <YYYY-MM-DD>
length: "<N> minute"
tags: ["tag1", "tag2"]
keywords: ["keyword1", "keyword2"]
category: "<category>"
image: "/assets/images/<slug>/cover.webp"
imageAlt: "<alt text>"
featured: true
status: "staging"
---
```

- **Status** should be `"staging"` unless explicitly told to publish. Three values are valid:
  - `"staging"` — draft, hidden in production everywhere (default for new posts)
  - `"published"` — visible in `/blog` list, in sitemap, at `/blog/[slug]`
  - `"unlisted"` — sitemap-only SEO landing page (search-prompt-targeted content). **If the user asked for an SEO post, comparison page, or "best X for Y" page, stop and use the `seo-landing-page` skill instead** — the workflow is different (target prompts, fixed body template, mandatory JSON-LD).
- Reference images using relative paths: `![alt](../assets/images/<slug>/<filename>)`
- Reference videos using HTML: `<video controls autoplay muted loop playsinline><source src="/assets/videos/<slug>/<filename>" type="video/quicktime"></video>`

### 4a. JSON-LD schema (recommended for `published`, mandatory for `unlisted`)

Every post with `status: "published"` or `status: "unlisted"` should end with at least an Article schema `<script type="application/ld+json">` block appended to the markdown body. The frontend extracts these and renders them as proper script tags in the page `<head>` so search engines pick them up.

For `status: "unlisted"` SEO landing pages: see the `seo-landing-page` skill for the full schema templates, `about`/`mentions` array conventions, FAQPage schema rules, and validation steps. That skill is the source of truth for SEO-targeted content. **The SEO audit (`scripts/seo-audit.mjs`) blocks unlisted posts that ship without JSON-LD** — fail-fast at PR time.

For `status: "published"` regular posts: a minimal Article schema is enough. The audit warns (advisory only) when missing, so you can ship without — but skipping it costs you SERP rich-result eligibility, so include it whenever the post stands on its own as evergreen content. Paste at the end of the markdown body:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "<exact post title>",
  "description": "<one-sentence summary>",
  "author": { "@type": "Person", "name": "<author name>" },
  "publisher": { "@type": "Organization", "name": "InsForge" },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://insforge.dev/blog/<slug>"
  }
}
</script>
```

Validate with [Google's Rich Results test](https://search.google.com/test/rich-results) after deploy. JSON-LD must be strict JSON (double quotes, no trailing commas, no comments).

### 5. Download and Push Images
- Download all images from the source (Notion S3 URLs, etc.) to a temp directory.
- Give each image a descriptive kebab-case filename (not `image.png`).
- Push images to `assets/images/<slug>/` in the repo.
- For images small enough for the API (<50MB), use the GitHub Git Data API (create blobs with base64 encoding, create tree, create commit).
- For larger files (videos), clone the repo using the PAT token from the GitHub MCP config and push via git CLI:
  ```
  git clone --branch blog/<slug> --single-branch https://<PAT>@github.com/InsForge/insforge-content-management-system.git
  ```

### 6. Push the Blog Markdown
- Use the GitHub MCP `create_or_update_file` tool to push the markdown file to the blog branch.

### 7. Create a Pull Request
- Use the GitHub MCP `create_pull_request` tool.
- Title: `Blog: <title>`
- Body should include:
  - Summary of the blog post
  - Author
  - Status (staging/published)
  - Checklist of assets (images, video, cover image)
- Base branch: `main`
- Head branch: `blog/<slug>`

### 8. Report Back
- Send the PR URL back to the user (via Discord if that's where the request came from).
- Note any missing assets (e.g., cover image not provided).

## Key References

- **Repo:** `InsForge/insforge-content-management-system`
- **Blog directory:** `blogs/`
- **Image directory:** `assets/images/<slug>/`
- **Video directory:** `assets/videos/<slug>/`
- **Author avatars:** `assets/images/avatars/`
- **Existing authors:**
  - Hang Huang: `authorTitle: "CEO & Co-Founder"`, avatar: `hang.huang-avatar.webp`
- **Status values:** `staging` (draft/review) → `published` (live)
- **Image format:** Prefer `.webp`, but `.png` is acceptable
- **Branch convention:** `blog/<slug>`

## Publishing Checklist
- [ ] All required frontmatter fields filled
- [ ] All images downloaded and pushed
- [ ] Image references in markdown match pushed file paths
- [ ] Cover image exists (or noted as missing)
- [ ] Author avatar exists
- [ ] PR created with descriptive body
