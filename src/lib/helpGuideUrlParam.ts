/**
 * URL query param that selects a help guide (`/help?g=<slug>`, `/settings?tab=settings-guides&g=<slug>`).
 * Owned by GuideBrowser; shared so Settings search (v2.2902) can deep-link a guide without importing
 * the component.
 */
export const HELP_GUIDE_URL_PARAM = 'g'
