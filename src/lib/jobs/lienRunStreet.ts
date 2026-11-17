/**
 * The property's street beside a job's name in the run window (v2.7489, the office's report of 2026-11-16).
 *
 * One original contractor's envelope listed five jobs. Two were at one address, and the office saw one of the two,
 * because the other job's name did not say the street. A job's name is whatever was typed when the job was made.
 * The street comes from the property record the job points at (`jobs_ledger.customer_address_id`), never from a
 * match on typed addresses, and it shows only when the name does not already say it.
 *
 * Pure.
 */

/** The street as the property record holds it: the first line of its address. '' when the record has none. */
export function lienPropertyStreet(address: string | null | undefined): string {
  return ((address ?? '').split(/\s*[,\n]\s*/)[0] ?? '').replace(/\s+/g, ' ').trim()
}

/** Words that end a street's name or point its direction: they do not tell one street from another. */
const STREET_FILLER = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west', 'st', 'street', 'rd', 'road', 'dr', 'drive', 'ave', 'avenue', 'blvd', 'boulevard', 'ln', 'lane', 'ct', 'court', 'cir', 'circle', 'pkwy', 'parkway', 'hwy', 'highway', 'way', 'trl', 'trail', 'pl', 'place', 'loop', 'ih', 'fm', 'unit', 'ste', 'suite', 'apt'])

const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(Boolean)

/**
 * The street to show beside a job's name, or '' when the name already says it. A name says the street when it has
 * the house number and the street's first telling word (*1204 Elwick*). A street with no number goes by its word alone.
 */
export function lienRunStreetBeside(jobName: string | null | undefined, street: string | null | undefined): string {
  const line = lienPropertyStreet(street)
  if (!line) return ''
  const name = new Set(tokens(jobName ?? ''))
  const parts = tokens(line)
  const number = parts.find((t) => /^\d/.test(t)) ?? null
  const word = parts.find((t) => !/^\d/.test(t) && !STREET_FILLER.has(t)) ?? null
  const says = (number ? name.has(number) : true) && (word ? name.has(word) : true) && (number != null || word != null)
  return says ? '' : line
}
