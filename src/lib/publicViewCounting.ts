/**
 * Client door to the public view-counting rule (journey-map Tier-2 #37). Same file the edge
 * functions run — one predicate, no mirror. The office openers build their preview URLs with
 * `withPreviewFlag`; the public pages forward the flag with `PUBLIC_PREVIEW_PARAM`.
 */
export {
  PUBLIC_PREVIEW_PARAM,
  isPreviewFlag,
  shouldCountPublicView,
  userBearerToken,
  withPreviewFlag,
} from '../../supabase/functions/_shared/publicViewCounting'
