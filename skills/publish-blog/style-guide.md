# InsForge Blog Style Guide

This is the house style for InsForge blog posts, derived from Supabase's blog (which consistently reads as crisp, developer-respecting, and scannable). When writing any InsForge blog, follow this guide for voice, structure, and — most importantly — what to leave out.

**Core principle:** State the thing. Show the thing. Tell the reader how to use it. Leave.

## Scope

This guide is written for **product launches, integration announcements, and partnership announcements** — posts whose primary job is to tell developers about something InsForge just shipped or connected to.

It does **not** cover:

- Founder narratives or personal essays (e.g., `getting-into-yc-after-6-tries`, `focus-or-die`)
- Technical war stories or post-mortems (e.g., `why-127-0-0-1-doesnt-work-in-docker`)
- Event recaps (e.g., hackathon posts)
- Profile / interview pieces introducing a person

For those post types, the core **voice/tone rules** and the **"Never" list** below still apply (no marketing adjectives, no "we're excited to…", no TL;DR, peer-assumed reader). But opener templates, structural requirements (flat H2s, mandatory `## Get Started`), and word-count targets are launch-specific and should not be force-fit onto essays or narratives.

## Opener Templates

Pick the one that fits. One sentence. No windup.

InsForge's house pattern for launches and integrations is `now supports` / `now has` / `just shipped` — not `Today we're launching`. That Supabase-style opener implies co-announcement, which we usually don't have.

| Use when | Template | Example |
|---|---|---|
| **Default** — announcing anything InsForge built, added support for, or integrated with | `InsForge now supports [X]` | "InsForge now supports pgvector natively." / "InsForge now supports Clerk for authentication." |
| **New capability of an existing sub-product** | `InsForge [sub-product] now supports [X]` | "InsForge Auth now supports custom SMTP providers and a built-in email template editor." |
| **Something you shipped internally** (hub page, tool, UI, dashboard feature) | `We just shipped [X]` | "We just shipped a new Integrations page on insforge.dev." |
| **Co-announced partnership** (partner is jointly posting / quoted / has a reciprocal announcement) | `[Partner] now has a first-party InsForge integration` | "Zeabur now has a first party InsForge integration." |

Avoid `Today we're launching...` unless the post genuinely is a co-announcement with a specific date hook. Avoid `We're excited to announce...` always (see the "Never" list).

## Structure

- **Flat H2s.** Avoid H3 unless a single section genuinely has subsections (e.g., "Key Features" → "PKCE by Default" / "Multi-Platform Apps"). Never use H4.
- **Always end with `## Get Started`** for launch/integration posts. Install commands + bullet CTAs.
- **Section length**: 2–4 short paragraphs per section. If a section crosses 6 paragraphs, split it.
- **Word count targets:**

| Post type | Target |
|---|---|
| Launch / integration | 400–800 words |
| Technical deep-dive | 1000–1500 words |
| Milestone / partnership | 275–400 words |

## Lists

- **Bullets** carry most of the information load. Use the pattern `**Bold label**: one-line description.`
- **Numbered lists** only for:
  - Sequential setup steps ("Getting Started: 1. Go to X. 2. Click Y...")
  - The 2–5 core actions that scaffold something end-to-end
- **Avoid** numbered lists for non-sequential items (e.g., "3 reasons to use X" should be bullets, not numbered).

## Code Blocks

- **Short only.** 2–6 lines is typical. Max ~15.
- **Show THE essential line**, not a full file. Readers have the repo if they want the whole thing.
- **Multi-language** when the SDK ships multiple clients (JS/Dart/Swift). List them in that order, each in its own block.
- **Don't** dump config files, full SQL schemas, or component code — link to the sample repo.

## Links

- **All inline.** No footer references, no numbered citations.
- **Link to docs instead of explaining.** If the reader needs to know PKCE, link `[PKCE](...)` and move on. Don't paragraph-explain.
- **Link density.** A 1,400-word post should have 10+ outbound links. Under-linking is a sign you're over-explaining.

## CTAs

- Section header: `## Get Started` (not `## Conclusion`, not `## Try It`, not `## Next Steps`).
- Install commands (for tools/SDKs) go first in this section. For integrations without a binary to install, skip them.
- Bullet list of 3–5 links: docs, browse all X, GitHub, social follow.
- Close with a soft community ask if relevant: "Let us know on GitHub" / "Open an issue if you find one missing".

## Tone

- **First-person plural.** "We just shipped", "We kept seeing", "We rewrote".
- **Present tense for announcements.** "Today we're..." not "This week we will..."
- **Declarative, no hedging.** "It does X." not "It should do X in most cases."
- **Imperative in bullets.** "Never use user_metadata for authorization." not "You should consider avoiding user_metadata."
- **Short punctuation sentences** for rhythm. Three-to-five-word sentences break up dense paragraphs:
  - "We put it there on purpose."
  - "Review the diff. Ship."
  - "That swap is the integration. Everything else is scaffolding."
- **Observational asides are OK** if they're genuine and short: "We kept seeing agents skip RLS policies, so we wrote this down."

## The "Never" List

These are things a less-disciplined writer would include and that our blog does not:

- ❌ **Metaphors / analogies** ("think of it as a bridge between…", "the fork in the road"). Rare exceptions allowed — use at most once per post.
- ❌ **"Why this matters" framing paragraphs.** The reader knows why they're here.
- ❌ **Marketing adjectives.** No "powerful", "seamless", "revolutionary", "robust", "blazing-fast", "game-changing".
- ❌ **"When to use / when not to use" sections.** Hedging at the end reads as "maybe don't use this".
- ❌ **Background primers.** If the reader is reading a Clerk integration post, they know what Clerk is. Don't explain JWT, OAuth, RLS, MCP, or similar primitives. Link to docs if they need a refresher.
- ❌ **TL;DR or summary paragraphs.** The post is already short.
- ❌ **"In this post we'll cover…"** Just cover it.
- ❌ **Emoji in body text.** (Emoji in commit messages / PR bodies is separate.)
- ❌ **FAQ sections.**
- ❌ **Rhetorical questions** ("Ever wondered how X works?").
- ❌ **Author anecdotes** ("I was debugging last week and…").
- ❌ **Competitor comparisons / positioning paragraphs.**
- ❌ **Customer testimonials, founder quotes.**
- ❌ **"We're excited to…"** Never write this phrase.
- ❌ **Exclamation points** in body text (except in milestone posts where one is OK).

## Reader Assumption

Write as if the reader is a technical peer who:

- Knows the primitives relevant to your post (JWT, OAuth, RLS, MCP, etc.)
- Already has a reason to care — they clicked the link
- Wants to evaluate fit, not be sold to
- Will read the docs / source if they want depth

If a sentence explains something the reader already knows, delete it.

## Before / After Examples

### Opener

**❌ Wordy:**
> Every app that stores user data eventually hits the same fork in the road: do you build authentication yourself, or hand it off to a specialist? Building it yourself gives you control but swallows weeks of work — sign-up forms, email verification, password resets, OAuth callbacks, session management, MFA. Handing it off to a specialist like Clerk gets you polished UI components and a hosted user store in an afternoon, but now you have two systems to reconcile.

**✅ Direct:**
> Clerk is now an official auth integration for InsForge.
>
> - Full guide: [insforge.dev/integrations/clerk](...)
> - Live demo: [clerkauth.insforge.site](...)

### Explaining a Concept

**❌ Explains the primitive:**
> Clerk's JWT Templates feature lets you customize the token Clerk issues for a session — the claims inside it, the audience, and crucially, the signing key. If you point Clerk at your own HS256 secret and give it the InsForge-expected claims, the token Clerk hands your frontend is indistinguishable from one InsForge itself would sign…

**✅ Assumes the reader knows JWTs:**
> Clerk signs the session token with InsForge's JWT secret. InsForge accepts it natively — no exchange service, no user sync.

### Closing

**❌ Hedge + wrap-up:**
> ## When to Use This
>
> Clerk + InsForge is a good fit when you want a hosted sign-up UI... Less good fit if Clerk's per-MAU pricing is a concern at your scale.
>
> ## Try It
>
> The full step-by-step lives in the integration guide. If you've been eyeing Clerk, this is a fifteen-minute job…

**✅ Just tell them where to go:**
> ## Get Started
>
> - [Clerk integration guide](...)
> - [Browse all integrations](...)
> - [Star us on GitHub](...)

## Self-Check Before Shipping

Scan the draft and flag any of:

- [ ] Opener longer than 2 sentences
- [ ] A section titled "Why This Matters", "Why We Built This" (OK only for deep-dives), "When to Use", "Conclusion", "TL;DR"
- [ ] Any metaphor beyond one per post
- [ ] Any of: "powerful", "seamless", "robust", "revolutionary", "game-changing", "we're excited to"
- [ ] An explanation of what JWT / OAuth / RLS / MCP / similar primitives are
- [ ] Rhetorical questions
- [ ] A code block over 15 lines (unless genuinely necessary)
- [ ] A paragraph over ~60 words
- [ ] Word count outside the target range for the post type
- [ ] Missing `## Get Started` at the end (for launches/integrations)

Any hit = edit. No exceptions because "this one is different".
