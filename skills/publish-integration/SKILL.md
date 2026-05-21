---
name: publish-integration
description: Publish an integration page to the InsForge content management system. Use when asked to create, publish, or set up a new integration from a Notion draft or other source content. Handles the full workflow — reading source content, creating the markdown file with proper frontmatter, downloading and pushing the logo, and creating a PR.
argument-hint: "[notion-url-or-topic]"
---

# Publish Integration to InsForge CMS

You are publishing an integration page to the `InsForge/insforge-content-management-system` GitHub repo.

## Workflow

### 1. Gather Content
- If given a **Notion URL**, use the Notion MCP to retrieve the page and all block children (text, images, code blocks).
- If given **raw content**, use it directly.
- Extract: title, description, category, website URL, docs URL, logo, and body content.

### 2. Determine Integration Slug
- Convert the title to **kebab-case** for the filename and branch name.
- Example: "GitHub OAuth" → `github-oauth`

### 3. Create Branch
- Branch name: `integration/<slug>` from `main`.
- Check if branch already exists first. If it does, use it.

### 4. Build the Markdown File
- File path: `integrations/<slug>.md`
- Use this frontmatter template:

```yaml
---
title: "<title>"
description: "<1-2 sentence SEO description>"
date: <YYYY-MM-DD>
status: "staging"
logo: "/assets/images/integrations/<logo-filename>.webp"
category: "<category>"
website: "<website URL>"

# Optional fields
docsUrl: "<docs URL>"
---
```

- **Status** should be `"staging"` unless explicitly told to publish.
- **docsUrl** is optional — omit it if not provided.
- **Category** should be one of: `auth`, `deployment`, `devtools`, `messaging`, `storage`, `low-code`.
- Body content should include sections like **Overview**, **Getting Started**, **SDK Usage**, **Scopes** / **Configuration** as appropriate.
- Reference images using relative paths: `![alt](../assets/images/integrations/<filename>)`

### 5. Download and Push Logo
- Download the logo from the source (Notion S3 URLs, etc.) to a temp directory.
- Give the logo a descriptive kebab-case filename matching the integration name (e.g., `github.webp`).
- Prefer `.webp` format; `.png` is acceptable.
- Push the logo to `assets/images/integrations/` in the repo.
- For files small enough for the API (<50MB), use the GitHub Git Data API (create blobs with base64 encoding, create tree, create commit).
- For larger files, clone the repo using the PAT token from the GitHub MCP config and push via git CLI:
  ```
  git clone --branch integration/<slug> --single-branch https://<PAT>@github.com/InsForge/insforge-content-management-system.git
  ```

### 6. Push the Integration Markdown
- Use the GitHub MCP `create_or_update_file` tool to push the markdown file to the integration branch.

### 7. Create a Pull Request
- Use the GitHub MCP `create_pull_request` tool.
- Title: `Integration: <title>`
- Body should include:
  - Summary of the integration
  - Category
  - Status (staging/published)
  - Checklist of assets (logo)
- Base branch: `main`
- Head branch: `integration/<slug>`

### 8. Report Back
- Send the PR URL back to the user (via Discord if that's where the request came from).
- Note any missing assets (e.g., logo not provided).

## Key References

- **Repo:** `InsForge/insforge-content-management-system`
- **Integration directory:** `integrations/`
- **Logo directory:** `assets/images/integrations/`
- **Status values:** `staging` (draft/review) → `published` (live)
- **Logo format:** Prefer `.webp`, but `.png` is acceptable
- **Branch convention:** `integration/<slug>`
- **Categories:** `auth`, `deployment`, `devtools`, `messaging`, `storage`, `low-code`
- **Existing integrations:**
  - Clerk: category `auth`, logo `clerk.webp`

## Publishing Checklist
- [ ] All required frontmatter fields filled
- [ ] Logo downloaded and pushed
- [ ] Logo reference in frontmatter matches pushed file path
- [ ] Body content includes Overview and Getting Started sections
- [ ] PR created with descriptive body
