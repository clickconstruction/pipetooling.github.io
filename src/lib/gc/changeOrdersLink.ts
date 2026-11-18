/**
 * The address of a GC project's **Change orders** window (punch list #391).
 *
 * The GC projects page opens that window for the money team at `?changes=<project id>`, and the project card's own
 * **Change orders** door sets the same parameter. A trip that cannot go on a GC billing job's lines points here: on a
 * job we build as the GC the customer's price grows only by a signed change order.
 *
 * Kept out of `links.ts` on purpose. That file is copied into the edge functions' kernels, and no function opens
 * this window, so a change here must not owe a redeploy.
 */

/** Pure: the address that opens Change orders on a GC project. */
export function changeOrdersHref(projectId: string): string {
  return `/gc?changes=${encodeURIComponent(projectId)}`
}

/** Pure: the project a `?changes=` opens Change orders on, or null. */
export function changeOrdersFromSearch(search: URLSearchParams): string | null {
  const id = search.get('changes')?.trim()
  return id ? id : null
}
