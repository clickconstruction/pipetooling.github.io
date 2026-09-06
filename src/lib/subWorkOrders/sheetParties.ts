/**
 * Who is on a sub sheet, sorted into the contractor and the teammates
 * (Sub Labor "subs only" naming): a sheet like "Malachi | Abraham | Michael A
 * | Behar Kraja" is Behar Kraja's sheet — the roster sub is the contractor,
 * the teammates rode along. The Sub Labor ledger and its Outstanding-by-
 * contractor rollup name the sheet by its contractor(s) and show the
 * teammates as "with …". Junction assignees first, then the delimited name
 * column; names the roster does not know are treated as contractors (the
 * ledger always did). A sheet with no roster sub at all is crew pay: its
 * people are the label, nobody is "with". Pure: no React, no Supabase.
 */
import { normalizePersonNameKey } from '../personNameKey'
import { splitAssignedToNames } from '../people/laborJobPersonMatch'
import { isRosterSub, type NeedsWorkOrderRosterPerson } from './rosterSub'

export type SheetParty = { id: string | null; name: string }

export type SheetParties = {
  /** The people the sheet is named for — the roster sub(s), or every assignee on a crew sheet. */
  contractors: SheetParty[]
  /** Teammates on a sub's sheet; empty on crew sheets. */
  teammates: SheetParty[]
  /** True when no assignee is a roster sub. */
  crew: boolean
  /** Contractor names joined the way the sheet column joins them. */
  label: string
  /** "with Malachi, Abraham" — null when nobody rode along. */
  withLabel: string | null
  /** `id:<people.id>` for a lone contractor with an id, else the name key of the label; '' for a blank sheet. */
  key: string
}

export type SheetPartiesLookup = {
  personById: ReadonlyMap<string, NeedsWorkOrderRosterPerson>
  personByNameKey: ReadonlyMap<string, NeedsWorkOrderRosterPerson>
}

export function buildSheetPartiesLookup(roster: readonly NeedsWorkOrderRosterPerson[]): SheetPartiesLookup {
  const personById = new Map(roster.map((p) => [p.id, p]))
  const personByNameKey = new Map<string, NeedsWorkOrderRosterPerson>()
  for (const p of roster) {
    const k = normalizePersonNameKey(p.name)
    if (k && !personByNameKey.has(k)) personByNameKey.set(k, p)
  }
  return { personById, personByNameKey }
}

export function sheetParties(
  sheet: { assigned_to_name: string | null | undefined },
  assignees: readonly { personId: string; personName: string | null }[] | undefined,
  lookup: SheetPartiesLookup,
): SheetParties {
  const people: Array<{ party: SheetParty; person: NeedsWorkOrderRosterPerson | undefined }> = []
  if (assignees && assignees.length > 0) {
    for (const a of assignees) {
      const person = lookup.personById.get(a.personId)
      const name = (a.personName ?? '').trim() || person?.name?.trim() || ''
      people.push({ party: { id: a.personId, name }, person })
    }
  } else {
    for (const name of splitAssignedToNames(sheet.assigned_to_name)) {
      const person = lookup.personByNameKey.get(normalizePersonNameKey(name))
      people.push({ party: { id: person?.id ?? null, name: person?.name?.trim() || name }, person })
    }
  }
  const subs = people.filter((p) => !p.person || isRosterSub(p.person)).map((p) => p.party)
  const teammates = people.filter((p) => p.person && !isRosterSub(p.person)).map((p) => p.party)
  const crew = subs.length === 0
  const contractors = crew ? teammates : subs
  const label = contractors.map((p) => p.name).filter(Boolean).join(' | ') || (sheet.assigned_to_name ?? '').trim()
  const withLabel = crew || teammates.length === 0 ? null : `with ${teammates.map((p) => p.name).filter(Boolean).join(', ')}`
  const key = contractors.length === 1 && contractors[0]!.id ? `id:${contractors[0]!.id}` : normalizePersonNameKey(label)
  return { contractors, teammates: crew ? [] : teammates, crew, label, withLabel, key }
}
