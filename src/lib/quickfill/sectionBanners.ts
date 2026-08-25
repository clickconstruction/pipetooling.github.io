/**
 * Default Quickfill banner questions (v2.2189, owner-approved): every section
 * opens with one line that says what "up to date" means here. A dev-edited
 * banner (app_settings `quickfill_section_banners`) still wins per section.
 */
export const QUICKFILL_DEFAULT_SECTION_BANNERS: Readonly<Record<string, string>> = {
  'office-arriving': 'Is the workspace ready for the day?',
  'assistant-dailys': "Are today's assistant dailys done?",
  texts: 'Did anything fall through the cracks from today or yesterday?',
  'email-inbox': 'Are work@ and bids@ clean, and is nothing stuck in Follow Up or Next Actions?',
  'physical-inbox': 'Can I get to the bottom of the pile?',
  schedule: 'Are there any obvious schedule conflicts?',
  'tomorrow-schedule': 'Who is on what job tomorrow?',
  'dispatch-inbox': 'Has every field request been answered or sent on?',
  warnings: 'Is anything flashing that nobody owns?',
  'no-customer-stages': 'Can every job be billed — customer, pictures, email?',
  'jobs-cleanup': "Is every sub labor sheet attached to a job, and is today's money moving? Link each sheet, then work the cards — they're the same ones on Jobs → Pipeline.",
  'people-hours-new': "Are yesterday's and today's hours right?",
  'unassigned-field-time': 'Is every paid field hour tied to a job?',
  'vehicle-odometers': 'Do we have a reading and a check-in on every truck?',
  'difficult-people': 'Who needs a conversation this week?',
  'banking-sorting': 'Is every bank transaction sorted to a job?',
  'crew-jobs': 'Does every crew day have its job split?',
  'billed-awaiting': 'Who owes us, and who do we lean on first?',
  'unpriced-fixtures': 'Does every fixture in the book have a price?',
  'cant-reach': 'Can we reach every prospect we promised to?',
  prospects: 'Did every prospect hear from us on time?',
  'supply-houses': 'Is anything past due with a supply house?',
  'jobs-billing': 'Is every finished job billed?',
  'complete-no-bill': 'Does every finished job have a bill total?',
  'my-inbox': 'Anything due today or overdue?',
  'office-leaving': 'Is the office closed up for the night?',
}

export function defaultQuickfillSectionBanner(sectionId: string): string | null {
  return QUICKFILL_DEFAULT_SECTION_BANNERS[sectionId] ?? null
}
