/**
 * Prospects → Permits on the address (punch list #307): the Needs you line *names on permits look
 * like a customer* opens Builders with the **Looks like a customer** chip already on, in the city
 * that has some. Builders and the chip ride the address, so a reload comes back to them. The
 * city is taken once when the tab opens and remembered by the browser from there, as every city
 * a person picks is. No React, no Supabase.
 */
import { permitCity } from '../../../supabase/functions/_shared/permitCities'

const VIEW = 'view'
const LOOKS = 'looks'
const CITY = 'city'

/** What the address asks of the Permits tab. */
export type PermitsLink = {
  /** Open on Builders, not on Skim. */
  builders: boolean
  /** The **Looks like a customer** chip is on. Only on Builders. */
  looks: boolean
  /** The city to open in, when it is one the pull reads. */
  city: string | null
}

export function readPermitsLink(params: URLSearchParams): PermitsLink {
  const builders = params.get(VIEW) === 'builders'
  return { builders, looks: builders && params.get(LOOKS) === '1', city: permitCity(params.get(CITY))?.name ?? null }
}

/** Builders with the **Looks like a customer** chip on, in a city when one is named. */
export function lookAlikesHref(city: string | null | undefined): string {
  const params = new URLSearchParams({ tab: 'permits', [VIEW]: 'builders', [LOOKS]: '1' })
  const named = permitCity(city)?.name
  if (named) params.set(CITY, named)
  return `/prospects?${params.toString()}`
}

/**
 * The address for the view on screen: Builders says so, and any other view drops it with the
 * chip. The city is dropped either way: the tab took it when it opened.
 */
export function permitsLinkForView(params: URLSearchParams, builders: boolean): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete(CITY)
  if (builders) {
    next.set(VIEW, 'builders')
  } else {
    next.delete(VIEW)
    next.delete(LOOKS)
  }
  return next
}

/** The address with the **Looks like a customer** chip on or off. */
export function permitsLinkWithLooks(params: URLSearchParams, on: boolean): URLSearchParams {
  const next = new URLSearchParams(params)
  if (on) next.set(LOOKS, '1')
  else next.delete(LOOKS)
  return next
}

/** The address with nothing of the Permits tab's own on it: the tab opens on Skim when its name is pressed. */
export function permitsLinkCleared(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of [VIEW, LOOKS, CITY]) next.delete(key)
  return next
}
