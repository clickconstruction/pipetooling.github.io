/**
 * Supervision, PR 2 (to-dos/supervision): coverage of a scheduled block.
 *
 * A linked crew block (rows of `job_schedule_blocks` sharing `shared_block_group_id`)
 * is covered when at least one of its assignees can run a job — a master, or a
 * helper / sub with the office's "needs supervision" switch off. A block whose
 * assignees all need supervision is **unsupervised**: Dispatch marks it, never
 * refuses it. Keyed by `shared_block_group_id ?? block.id` so a legacy solo block
 * with no group id still gets a verdict.
 *
 * Unknowns are not warnings: an assignee the roster read did not return (outside the
 * dispatch cohort) makes the block `unknown`, and a block with no assignee who needs
 * supervision (office people only, or nobody) is `covered` — there is nobody there to
 * supervise.
 *
 * Pure: no React, no supabase.
 */
import { isSupervisor, needsSupervision, type SupervisionPerson } from '../people/supervision'

export type BlockCoverage = 'covered' | 'unsupervised' | 'unknown'

export type CoverageBlockRow = { id: string; shared_block_group_id: string | null; assignee_user_id: string }

export type CoveragePerson = Pick<SupervisionPerson, 'role' | 'needsSupervision'>

/** The map key for a block: its linked group, or itself when it has none. */
export function blockCoverageKey(block: Pick<CoverageBlockRow, 'id' | 'shared_block_group_id'>): string {
  return block.shared_block_group_id ?? block.id
}

/** The verdict for one crew's assignees. */
export function coverageOfAssignees(assigneeIds: readonly string[], personById: ReadonlyMap<string, CoveragePerson>): BlockCoverage {
  let anyNeeds = false
  for (const id of assigneeIds) {
    const p = personById.get(id)
    if (!p) return 'unknown'
    if (isSupervisor(p)) return 'covered'
    if (needsSupervision(p)) anyNeeds = true
  }
  return anyNeeds ? 'unsupervised' : 'covered'
}

/**
 * Coverage per block key across a set of blocks (a week of them, say): the legs of a
 * linked group are judged together, a solo block alone.
 */
export function buildBlockCoverageByKey(blocks: readonly CoverageBlockRow[], personById: ReadonlyMap<string, CoveragePerson>): Map<string, BlockCoverage> {
  const assigneesByKey = new Map<string, string[]>()
  for (const b of blocks) {
    const key = blockCoverageKey(b)
    const list = assigneesByKey.get(key) ?? []
    list.push(b.assignee_user_id)
    assigneesByKey.set(key, list)
  }
  const out = new Map<string, BlockCoverage>()
  for (const [key, ids] of assigneesByKey) out.set(key, coverageOfAssignees(ids, personById))
  return out
}

/** How many distinct block keys in the set are unsupervised. */
export function countUnsupervised(coverageByKey: ReadonlyMap<string, BlockCoverage>): number {
  let n = 0
  for (const v of coverageByKey.values()) if (v === 'unsupervised') n++
  return n
}

/**
 * The line the Add / Edit block modal shows while a block is being built: null when the
 * block is covered or the person is not one who needs supervision.
 */
export function supervisionWarningFor(personName: string, person: CoveragePerson | undefined, groupCoverage: BlockCoverage | undefined): string | null {
  if (!person || !needsSupervision(person)) return null
  if (groupCoverage === 'covered' || groupCoverage === 'unknown') return null
  return `${personName} needs supervision — nobody on this block can run it yet. Add a master, or someone who can run a job, as a linked copy. You can still save it.`
}
