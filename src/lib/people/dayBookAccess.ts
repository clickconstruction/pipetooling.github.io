/**
 * Who may open the Day book (to-dos/day-book): the one rule the People tab, the Bids
 * door, the Crew Day line and the access hook all read. Owner decision 2 (2026-09-22,
 * v2.3732): devs and controllers only, for now. The RPC enforces the same gate
 * server-side; this only shapes what is drawn.
 */
export function canOpenDayBook(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'controller'
}
