# webgen — AI website generator

Turn a URL into a fully branded, animated, deploy-ready website from one
command. `webgen` is a zero-dependency Node.js CLI that runs the whole
"AI website" workflow end to end:

```
extract branding  →  visual directions  →  hero visuals
       →  build site  →  improve HTML  →  deploy
```

It is built so the **whole pipeline runs offline**. Every external API is
optional — when a key is missing, that stage falls back to a deterministic
mock, so you always get a working site. Add keys to turn each stage "live".

| Stage | Live integration | Offline fallback |
|-------|------------------|------------------|
| Extract branding | Firecrawl | plain `fetch()`, then a brand synthesized from the domain |
| Visual directions | Claude (Anthropic) | three built-in art-direction archetypes |
| Hero visuals | Gemini image model ("Nano Banana 2") | layered SVG hero art |
| Transition motion | — | animated SVG (always generated) |
| Build site | deterministic template engine | (same) |
| Improve HTML | Claude (Anthropic) | rule-based enhancement pass |
| Deploy | Vercel API | printed GitHub + Vercel steps |

> **Reality check:** AI accelerates execution, but output quality still
> depends on the inputs. A rich source page (clear colors, fonts, copy)
> produces a far better site than a thin one — strong inputs, strong output.

## Requirements

- Node.js >= 18.17 (uses the built-in `fetch`). No `npm install` needed.

## Quick start

```bash
cd webgen

# Run the full pipeline (offline mocks if no keys are set)
node bin/webgen.js run https://stripe.com --no-deploy

# Preview the result
npx serve output/stripe-com/site
```

## Configuration

Copy `.env.example` to `.env` and fill in whichever keys you have. All keys
are optional.

```
FIRECRAWL_API_KEY=    # branding extraction
GEMINI_API_KEY=       # hero image generation
ANTHROPIC_API_KEY=    # visual directions + HTML improvement
VERCEL_TOKEN=         # deployment
```

The CLI prints which integrations are `live` vs `mock` at the start of
every run.

## Commands

```
webgen run <url> [options]      Run the whole pipeline
webgen branding <url>           Extract branding assets only
webgen directions [workspace]   Generate three visual directions
webgen visuals [workspace]      Generate hero + transition visuals
webgen build [workspace]        Build the static site
webgen improve <file.html>      Improve an existing HTML file
webgen deploy [workspace]       Deploy the built site to Vercel
```

Options:

- `--workspace <dir>` — project folder (default: `output/<slug-of-url>`)
- `--direction <n>` — which of the three directions to use, `1`-`3`
- `--out <file>` — output path for `improve` (default: in place)
- `--no-deploy` — skip the deploy step in `run`

Each step writes a JSON artifact into the workspace, so you can run the
stages individually and re-run later ones without repeating the earlier
work. `directions`, `visuals`, `build` and `deploy` auto-detect the
workspace when only one project exists under `output/`.

## Output structure

```
output/<slug>/
  brand.json          extracted/synthesized branding
  directions.json     three visual directions
  visuals.json        hero + transition + logo asset manifest
  assets/             generated hero / transition / logo art
  site/               the deployable static site
    index.html
    styles.css
    main.js
    assets/
    vercel.json
```

The generated site is a single animated landing page (hero, features,
showcase, CTA) with scroll-reveal animations, a sticky blurred nav, a
palette and typography driven by the chosen direction, responsive layout,
and `prefers-reduced-motion` support. It works with JavaScript disabled —
the animations are progressive enhancement only.

## Improving an existing page

`improve` also works as a standalone tool on any HTML file:

```bash
node bin/webgen.js improve ./some-page.html --out ./some-page.improved.html
```

With an Anthropic key it asks Claude for a layout/motion/accessibility
rewrite; without one it applies a safe rule-based pass (meta tags, lang,
viewport, lazy-loading, Open Graph).
