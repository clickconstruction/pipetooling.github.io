/**
 * A guide that was renamed keeps its old address (v2.7050, Farm Mode → Task Mode). A guide's slug is
 * its file's name, and the slug is the address: `/help?g=<slug>`, `/help/<slug>` inside another
 * guide, the share page at `/g/<slug>/`. Renaming the file used to break every one a person had
 * saved, texted or bookmarked, and the browser's answer was "That guide wasn't found".
 *
 * One row per old name: the old slug, then the slug that answers it now. `GuideBrowser` opens the
 * new guide and rewrites the address, the build writes a share page at the old `/g/` path too, and
 * Settings → Usage counts the old opens with the new ones. A new guide link is still written with
 * the current slug: `helpGuideLinks.guides.test.ts` reads the guides' files and knows no other.
 * `helpGuideFormerSlugs.test.ts` holds each row to a real guide and to no file of its own.
 *
 * Pure, and free of Vite's glob, so `vite.config.ts` and the kernels can both read it.
 */
export const HELP_GUIDE_FORMER_SLUGS: ReadonlyArray<readonly [former: string, current: string]> = [
  ['farm-mode', 'task-mode'],
]

const CURRENT_BY_FORMER = new Map<string, string>(HELP_GUIDE_FORMER_SLUGS)

/** The slug that answers today: the new name for a renamed guide, the slug itself for every other. */
export function currentHelpGuideSlug(slug: string): string {
  return CURRENT_BY_FORMER.get(slug) ?? slug
}

/** The old names a guide still answers to, for the build's share pages. */
export function formerHelpGuideSlugs(slug: string): string[] {
  return HELP_GUIDE_FORMER_SLUGS.filter(([, current]) => current === slug).map(([former]) => former)
}
