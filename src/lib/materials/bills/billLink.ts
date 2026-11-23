import { supplyHouseWebsitePortalHref } from '../../supplyHouseWebsite'

/**
 * A bill's pasted link as an address to go to (punch list #431): http or https alone, and never a map link someone
 * pasted there. The bill's lasting link (`fileOpenIo.ts`) and the bill viewer both read a row's link through here.
 */
export function billLinkHref(link: string | null | undefined): string | null {
  const href = supplyHouseWebsitePortalHref(link)
  return href && /^https?:\/\//i.test(href) ? href : null
}
