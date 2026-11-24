/**
 * URL query param that selects a help guide (`/help?g=<slug>`, `/settings?tab=settings-guides&g=<slug>`).
 * Owned by GuideBrowser; shared so Settings search (v2.2902) can deep-link a guide without importing
 * the component.
 */
export const HELP_GUIDE_URL_PARAM = 'g'

/**
 * Where `/help/<slug>` opens. A guide link is written `/help/<slug>` inside a guide and in the docs, and a person
 * who typed or pasted that address from outside the app used to match no route and land on the Dashboard with no
 * word (found on the Bills sent walk of 2026-11-23). The guide lives at `/help?g=<slug>`. A heading's anchor rides
 * along. An empty slug opens the list of guides.
 */
export function helpGuideAddressFromSlugPath(slug: string | null | undefined, hash = ''): string {
  const s = (slug ?? '').trim()
  const anchor = hash.startsWith('#') && hash.length > 1 ? hash : ''
  return s ? `/help?${HELP_GUIDE_URL_PARAM}=${encodeURIComponent(s)}${anchor}` : `/help${anchor}`
}
