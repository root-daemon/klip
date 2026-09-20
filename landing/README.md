# KLIP landing page

Next.js 16 static site for [KLIP](https://github.com/root-daemon/klip).
Built as a static export so it can be dropped onto GitHub Pages, Vercel,
Netlify, Cloudflare Pages, or any plain static host.

## Develop

```bash
cd landing
bun install
bun run dev
```

Opens on http://localhost:3030.

## Build

```bash
bun run build
```

Produces a static bundle in `landing/out/`.

## Motion

Motion is native to the site: pointer-reactive light fields, companion orbits,
and compact status signals make the operating state legible without a
third-party animation asset. Every animation settles for
`prefers-reduced-motion`.

## Deploy

### GitHub Pages

Serve `landing/out/` from Pages, or wire a workflow that runs
`cd landing && bun install --frozen-lockfile && bun run build` and
uploads `landing/out/` as the Pages artifact.

### Vercel

Set the **Root Directory** to `landing` in project settings. Next.js
is detected automatically.
