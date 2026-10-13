/**
 * Messages, cut 2: who a conversation can be handed to, and who Follow up's picker lists. The GC office team with a name
 * (`GC_OFFICE_TEAM`, the people Follow up is for), by name: a superintendent cannot open Follow up, so a conversation
 * handed to one would sit where nobody sees it.
 */
import { GC_OFFICE_TEAM } from '../gc/access'

export function followUpTeamOf<T extends { id: string; name: string; role: string }>(team: readonly T[]): T[] {
  return team.filter((t) => t.name.trim() !== '' && (GC_OFFICE_TEAM as readonly string[]).includes(t.role)).sort((a, b) => a.name.localeCompare(b.name))
}
