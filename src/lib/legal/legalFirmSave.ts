/**
 * Settings → Collections law firm, when a save fails (punch list #85, item 27).
 * The office works with one firm at a time, and the schema holds it: the
 * partial unique index `legal_firms_one_active` refuses a second active row.
 * Settings edits the one active firm, so a refusal means another tab or person
 * saved a firm first. Say so in the app's words instead of Postgres's.
 */

export const ONE_FIRM_INDEX = 'legal_firms_one_active'

export function legalFirmSaveErrorWords(message: string | null | undefined): string {
  const m = message ?? ''
  if (m.includes(ONE_FIRM_INDEX)) return 'One firm at a time: another firm is already active. Reload Settings to edit it.'
  return `Could not save: ${m || 'unknown error'}`
}
