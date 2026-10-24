/**
 * The flows Settings → Flows edits (Messages, cut 4; the residential customer's and the sub's since v2.5498): each kind
 * of person's flow but the one-step flow for a number nobody has named, in the tab row's order, with the tab's name.
 * The editor reads who is on a flow through `flow_rows_kind`, which knows a customer, a trade partner and an architect.
 * A residential customer's and a sub's rows come from their own loaders (`residentialLoad.ts`) with no such read yet,
 * so for those two the editor saves the steps with nobody to try them on, and says so.
 */
import type { FlowKind } from './facts'

export type EditorKind = Exclude<FlowKind, 'unknown'>

/** The tab row, in order: the seeds' flows, each named as its tab reads. */
export const EDITOR_KINDS: readonly (readonly [EditorKind, string])[] = [
  ['customer', 'Customer'],
  ['trade', 'Trade partner'],
  ['arch', 'Architect'],
  ['residential', 'Residential customer'],
  ['sub', 'Sub'],
  // The candidate flow (spike): hiring steps read from the Team board; nobody to try a change on yet.
  ['candidate', 'Candidate'],
]

/** The kinds `flow_rows_kind` reads everyone of. */
const PEOPLE_READ: ReadonlySet<EditorKind> = new Set<EditorKind>(['customer', 'trade', 'arch'])

/** Whether the editor can read who is on this kind's flow, to try a change on them and say how it is going. */
export function readsPeopleOf(kind: EditorKind): boolean {
  return PEOPLE_READ.has(kind)
}

/** What the editor says, under Before you save and on How it is going, for a flow whose people it cannot read. */
export const PEOPLE_NOT_READ = 'Who is on this flow is not read here yet. Save still changes it for everyone on it.'
