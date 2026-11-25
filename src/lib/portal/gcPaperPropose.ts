/**
 * A GC proposes a stricter setting on their page (punch list #389, step 6): what the page reads out of the answer and
 * the words it shows. The sliders are the office's own, drawn from the same settings list, with every stop looser
 * than the job's greyed. A proposal changes no paper: the office takes it or declines. Pure.
 */
import { flowDefFromBook, hasNotice, stopOfPick } from '../contracts/jobPaperFlow'
import { proposalProblem } from '../contracts/jobPaperProposal'
import { choiceOf, parseSettingsDef, picksProblem, type PaperPicks, type PaperSetting, type SettingsDef } from '../contracts/paperSettings'
import { PAPER_OFF, stopRank, type PaperDef, type PaperStop } from '../documentBuilder/documentBuilder'
import type { GcJobPaper, GcPaperProposal } from '../../../supabase/functions/_shared/portalJobPapers'

export const GC_PROPOSE = {
  press: 'Propose a stricter setting',
  title: 'Propose a stricter setting',
  lead: 'Move a topic to a stricter stop, then send it. Our office reads it and takes it or declines.',
  nothingChanges: 'Nothing changes on the paper until our office takes it.',
  floorWhy: 'You can only make this stricter',
  nameLabel: 'Your name',
  namePlaceholder: 'First and last name',
  tick: 'I have read this.',
  send: 'Send the proposal',
  sending: 'Sending…',
  cancel: 'Cancel',
} as const

/** What the panel is drawn from: the list, the sliders' paper when the list has levels, and the job's picks. */
export interface GcProposeGround {
  def: SettingsDef
  /** The sliders' paper. Null for a list with no levels, which the panel sets with a list of choices a topic. */
  flow: PaperDef | null
  picks: PaperPicks
  basis: string | null
  hasNotice: boolean
}

/** Null when the list did not come, reads as no list, or the job's picks are not all choices of it. */
export function gcProposeGround(paper: GcJobPaper): GcProposeGround | null {
  const def = paper.propose ? parseSettingsDef(paper.propose.def) : null
  if (!def || !paper.propose || def.settings.length === 0 || picksProblem(def, paper.propose.picks) !== null) return null
  const basis = def.levels.some((l) => l.key === paper.propose?.basis) ? paper.propose.basis : null
  return {
    def,
    flow: def.levels.length > 0 ? flowDefFromBook(def, { paperId: paper.id, title: paper.name, job: '' }) : null,
    picks: paper.propose.picks,
    basis,
    hasNotice: hasNotice(def),
  }
}

/**
 * One topic as the panel draws it: the stop its pick sits on and the loosest stop a GC may pick, or nulls when the
 * pick sits on no level and the topic is set from a list of choices.
 */
export function gcProposeTopic(ground: GcProposeGround, setting: PaperSetting, pick: string | undefined): { stop: PaperStop | null; floor: number; label: string; says: string } {
  const choice = choiceOf(ground.def, setting.key, pick)
  const at = ground.flow ? stopOfPick(ground.def, setting, pick, ground.basis) : null
  const jobStop = ground.flow ? stopOfPick(ground.def, setting, ground.picks[setting.key], ground.basis) : null
  const usable = ground.flow !== null && at !== null && jobStop !== null
  return {
    stop: usable ? at : null,
    floor: usable && ground.flow ? Math.max(0, stopRank(ground.flow, jobStop)) : 0,
    label: choice?.label ?? 'Not picked',
    says: choice?.says ?? '',
  }
}

/** The choice a slider's stop stands for on a topic: Off is the choice that leaves it out, a level is its pick. */
export function gcProposePickAt(ground: GcProposeGround, setting: PaperSetting, stop: PaperStop): string | null {
  const choice = stop === PAPER_OFF ? setting.choices.find((c) => c.out) : choiceOf(ground.def, setting.key, ground.def.levels.find((l) => l.key === stop)?.picks[setting.key])
  return choice?.key ?? null
}

/** What stops the send, or null. The same four the database checks. */
export function gcProposeProblem(ground: GcProposeGround, to: PaperPicks, name: string, ticked: boolean): string | null {
  return proposalProblem({ def: ground.def, from: ground.picks, to, name, hasNotice: ground.hasNotice, ticked })
}

/**
 * Where the last proposal stands, as the page says it. `day` words an instant as the company's day. An overtaken
 * proposal reads as set aside: the paper changed after it.
 */
export function gcProposalLine(proposal: GcPaperProposal, day: (iso: string | null) => string | null): { tone: 'amber' | 'green' | 'grey'; chip: string; line: string; why: string | null } {
  const on = day(proposal.proposedAt)
  const answered = day(proposal.decidedAt)
  const yours = on ? `Your proposal of ${on}` : 'Your proposal'
  if (proposal.state === 'waiting') return { tone: 'amber', chip: 'With our office', line: `${yours} is with our office. ${GC_PROPOSE.nothingChanges}`, why: null }
  if (proposal.state === 'taken') return { tone: 'green', chip: 'Taken', line: `Our office took ${yours.charAt(0).toLowerCase()}${yours.slice(1)}${answered ? ` on ${answered}` : ''}. The paper above shows it.`, why: null }
  if (proposal.state === 'declined') return { tone: 'grey', chip: 'Declined', line: `Our office declined ${yours.charAt(0).toLowerCase()}${yours.slice(1)}${answered ? ` on ${answered}` : ''}.`, why: proposal.why }
  return { tone: 'grey', chip: 'Set aside', line: `${yours} was set aside. The paper changed after you sent it.`, why: null }
}
