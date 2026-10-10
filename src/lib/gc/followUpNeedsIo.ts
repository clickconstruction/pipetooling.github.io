/**
 * GC mode, the Dashboard's Follow up line (the Board's B2b-ii-b, call E4): everyone the office waits on, once a person
 * across their jobs (`gcNeedsYou` over `allPeople`). It reads the GC projects page's own rows, `loadGcProjects` and then
 * `loadGcBoardRows` with our number's inputs only for the money team as the page passes them, so the line, Follow up's
 * badge and its By people say one number from the same reads (call E1). The hook imports this file on demand, after
 * first paint, so the Dashboard's own chunk does not carry the GC kernels.
 */
import { boardStateFromRows } from './boardRows'
import { loadGcBoardRows, loadGcProjects } from './gcIo'
import { gcNeedsYou, type GcNeedsYou } from './needsYou'

/** The line for today, or null when nobody waits on us. `money`: the reader is on the money team (`canSeeGcMoney`). */
export async function loadGcFollowUpNeeds(today: string, { money = false }: { money?: boolean } = {}): Promise<GcNeedsYou | null> {
  const projects = await loadGcProjects()
  if (projects.length === 0) return null
  return gcNeedsYou(boardStateFromRows(await loadGcBoardRows(projects, today, { money })))
}
