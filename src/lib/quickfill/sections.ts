/**
 * The Quickfill registry (moved here from the page in v2.5845, punch list #176, change 5, so the
 * Dashboard's office-round card can name a station without importing the page): every station's
 * DOM id, section id and label, in the default order. `warnings` second since v2.5843, Today's
 * lines first. The page's eligibility switch says who sees each; `SECTION_INSERT_AFTER` in the
 * page places a later-added station in an org's saved order.
 */
export const QUICKFILL_SECTIONS: { id: string; sectionId: string; label: string }[] = [
  // Today's lines opens the round since v2.5843 (punch list #176, change 3): the Needs you station, holding the
  // viewer's own lines first and the owner's folded, was the 28th of 28 and marked once in five workdays.
  { id: 'quickfill-needs-you', sectionId: 'needs-you', label: "Today's lines" },
  // Messages second since v2.6098 (punch list #178, D's PR 7): everyone waiting on us, the one count still outside the
  // round until then, with the Texts ledger folded in (the `texts` station retired into it, below).
  { id: 'quickfill-messages', sectionId: 'messages', label: 'Messages' },
  { id: 'quickfill-warnings', sectionId: 'warnings', label: 'Warnings' },
  { id: 'quickfill-office-arriving', sectionId: 'office-arriving', label: 'Office Arriving' },
  { id: 'quickfill-assistant-dailys', sectionId: 'assistant-dailys', label: 'Assistant Dailys' },
  { id: 'quickfill-my-inbox', sectionId: 'my-inbox', label: 'My Inbox' },
  { id: 'quickfill-people-hours-new', sectionId: 'people-hours-new', label: 'People Hours' },
  {
    id: 'quickfill-unassigned-field-time',
    sectionId: 'unassigned-field-time',
    label: 'Unassigned field time',
  },
  { id: 'quickfill-vehicle-odometers', sectionId: 'vehicle-odometers', label: 'Vehicle check-ins' },
  { id: 'quickfill-difficult-people', sectionId: 'difficult-people', label: 'Difficult people' },
  { id: 'quickfill-banking-sorting', sectionId: 'banking-sorting', label: 'Banking sorting' },
  { id: 'quickfill-billed-awaiting', sectionId: 'billed-awaiting', label: 'Billed Awaiting Payment' },
  { id: 'quickfill-gc-weekly-review', sectionId: 'gc-weekly-review', label: 'GC weekly review' },
  { id: 'quickfill-job-followups', sectionId: 'job-followups', label: 'Job follow-ups' },
  { id: 'quickfill-unpriced-fixtures', sectionId: 'unpriced-fixtures', label: 'Unpriced Fixtures' },
  { id: 'quickfill-cant-reach', sectionId: 'cant-reach', label: 'Unreachable Prospects' },
  { id: 'quickfill-prospects', sectionId: 'prospects', label: 'Prospects' },
  { id: 'quickfill-supply-houses', sectionId: 'supply-houses', label: 'Supply Houses' },
  { id: 'quickfill-jobs-billing', sectionId: 'jobs-billing', label: 'Jobs Billing' },
  { id: 'quickfill-complete-no-bill', sectionId: 'complete-no-bill', label: 'Complete, no Total Bill' },
  { id: 'quickfill-undated-bills', sectionId: 'undated-bills', label: 'Missing bill dates' },
  { id: 'quickfill-no-customer-stages', sectionId: 'no-customer-stages', label: 'Missing job info' },
  { id: 'quickfill-property-kinds', sectionId: 'property-kinds', label: 'Property kinds' },
  { id: 'quickfill-percent-complete', sectionId: 'percent-complete', label: 'Percent complete' },
  { id: 'quickfill-jobs-cleanup', sectionId: 'jobs-cleanup', label: 'Jobs Cleanup' },
  { id: 'quickfill-dispatch-inbox', sectionId: 'dispatch-inbox', label: 'Dispatch inbox' },
  { id: 'quickfill-field-photos', sectionId: 'field-photos', label: 'Field photos → Drive' },
  { id: 'quickfill-schedule', sectionId: 'schedule', label: 'Schedule' },
  {
    id: 'quickfill-tomorrow-schedule',
    sectionId: 'tomorrow-schedule',
    label: "Tomorrow's Schedule",
  },
  { id: 'quickfill-email-inbox', sectionId: 'email-inbox', label: 'Email' },
  { id: 'quickfill-physical-inbox', sectionId: 'physical-inbox', label: 'Physical inbox' },
  { id: 'quickfill-office-leaving', sectionId: 'office-leaving', label: 'Office Leaving' },
]

export type QuickfillSectionMeta = (typeof QUICKFILL_SECTIONS)[number]

/**
 * Stations folded into another (v2.6098, punch list #178): the old id's marks and history read under the new one, a
 * deep link to the old id lands on the new one, and the old label still names the events the old station left.
 */
export const QUICKFILL_RETIRED_SECTIONS: Readonly<Record<string, { label: string; into: string }>> = {
  texts: { label: 'Texts', into: 'messages' },
}

/** The station an event or a link means today: a retired id reads as the station it folded into. */
export function foldRetiredSectionId(sectionId: string): string {
  return QUICKFILL_RETIRED_SECTIONS[sectionId]?.into ?? sectionId
}

/** The ids whose marks a station's history reads: its own, and every id retired into it. */
export function markHistorySectionIds(sectionId: string): string[] {
  return [sectionId, ...Object.entries(QUICKFILL_RETIRED_SECTIONS).filter(([, r]) => r.into === sectionId).map(([old]) => old)]
}

export const QUICKFILL_SECTION_LABEL_BY_ID: ReadonlyMap<string, string> = new Map([
  ...QUICKFILL_SECTIONS.map((s): [string, string] => [s.sectionId, s.label]),
  ...Object.entries(QUICKFILL_RETIRED_SECTIONS).map(([id, r]): [string, string] => [id, r.label]),
])
