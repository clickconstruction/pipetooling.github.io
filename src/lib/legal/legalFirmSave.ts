/**
 * Settings → Collections law firms, when a save fails. From punch list #85 (item 27) to
 * v2.5756 the schema held the office to one firm: the partial unique index
 * `legal_firms_one_active` refused a second active row. Punch list #144 drops it (two firms,
 * one per territory), so a refusal naming it now means the client is ahead of the database:
 * the v2.5756 migration has not been pushed yet. Say so in the app's words.
 */

export const ONE_FIRM_INDEX = 'legal_firms_one_active'

export function legalFirmSaveErrorWords(message: string | null | undefined): string {
  const m = message ?? ''
  if (m.includes(ONE_FIRM_INDEX)) return 'The database still holds one firm at a time. Push the v2.5756 migration, then add the second firm.'
  return `Could not save: ${m || 'unknown error'}`
}
