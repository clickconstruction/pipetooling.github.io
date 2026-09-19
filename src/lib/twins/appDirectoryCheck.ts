/**
 * Phase 4 upkeep of the digital-twins program (v2.3619, `to-dos/robots-residuals.md` item 5):
 * the twin briefs in `docs/twins/` navigate by URL and open help by slug, so every path they name
 * must be a route `src/App.tsx` declares and every `/help?g=<slug>` a guide in `src/content/help/`.
 * Pure: the test hands in the sources; nothing here reads the disk.
 */

/** Every `path="…"` a `<Route>` declares, as an absolute path (nested routes are prefixed with `/`). */
export function appRoutePathsFromSource(src: string): string[] {
  const out = new Set<string>()
  for (const m of src.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)) {
    const raw = m[1]!
    if (raw === '*') continue
    out.add(raw.startsWith('/') ? raw : `/${raw}`)
  }
  return [...out]
}

/** The app paths a brief names in backticks — `/bids?tab=pricing` reads as `/bids`; `<slug>`-style placeholders are skipped. */
export function docPathsFromMarkdown(md: string): string[] {
  const out = new Set<string>()
  for (const m of md.matchAll(/`(\/[^`\s]*)`/g)) {
    const base = m[1]!.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
    if (/[<>]/.test(base)) continue
    out.add(base)
  }
  return [...out]
}

/** Every `help?g=<slug>` a brief names, real slugs only (a `<slug>` placeholder is not one). */
export function helpSlugsFromMarkdown(md: string): string[] {
  const out = new Set<string>()
  for (const m of md.matchAll(/help\?g=([a-z0-9][a-z0-9-]*)/g)) out.add(m[1]!)
  return [...out]
}

/** `/customers/abc` matches `/customers/:id`; segment counts must agree. */
export function pathMatchesRoute(path: string, route: string): boolean {
  const p = path.split('/').filter(Boolean)
  const r = route.split('/').filter(Boolean)
  if (p.length !== r.length) return false
  return r.every((seg, i) => seg.startsWith(':') || seg === p[i])
}

export type DirectoryDoc = { file: string; markdown: string }

/** One line per drift: a path no route serves, or a help slug with no guide. Empty when the briefs and the app agree. */
export function directoryProblems(input: { docs: DirectoryDoc[]; routes: string[]; helpSlugs: ReadonlySet<string> }): string[] {
  const problems: string[] = []
  for (const doc of input.docs) {
    for (const path of docPathsFromMarkdown(doc.markdown)) {
      if (!input.routes.some((r) => pathMatchesRoute(path, r))) problems.push(`${doc.file}: \`${path}\` is not a route in src/App.tsx`)
    }
    for (const slug of helpSlugsFromMarkdown(doc.markdown)) {
      if (!input.helpSlugs.has(slug)) problems.push(`${doc.file}: help?g=${slug} has no guide in src/content/help/`)
    }
  }
  return problems
}
