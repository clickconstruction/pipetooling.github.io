/**
 * Person Desk section ids (v2.2810, PR 2 of the Users status column): every section has an
 * anchor so a chip on People → Users, a deep link, or any door can open the Desk scrolled to
 * the one section that answers it. Pure; the Desk body owns the scrolling.
 */
export const PERSON_DESK_SECTION_IDS = ['hours', 'portal', 'work_orders', 'pay', 'team', 'push', 'field', 'paperwork', 'records', 'schedule', 'access'] as const

export type PersonDeskSectionId = (typeof PERSON_DESK_SECTION_IDS)[number]

export function isPersonDeskSectionId(x: unknown): x is PersonDeskSectionId {
  return typeof x === 'string' && (PERSON_DESK_SECTION_IDS as readonly string[]).includes(x)
}

/** The DOM id a section renders — `desk-paperwork`. */
export function deskSectionDomId(id: PersonDeskSectionId): string {
  return `desk-${id}`
}

/** `?section=` value → id, or null for anything unknown (a stale link opens the Desk at the top). */
export function parseDeskSectionParam(raw: string | null | undefined): PersonDeskSectionId | null {
  const s = (raw ?? '').trim().toLowerCase()
  return isPersonDeskSectionId(s) ? s : null
}
