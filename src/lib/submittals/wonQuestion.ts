/**
 * The won question (Submittals stage 4c): what to ask the moment a job is made from a
 * won bid. Pure — the prompt feeds it what it read and renders the answer.
 *
 *   ask          the bid has picked rows (or a schedule) and no revision yet — ask
 *   has-revision a submittal exists — nothing to ask; the job id is back-filled onto it
 *   not-needed   the office already answered "not needed on this job"
 *   nothing      no bid, or no picks and no schedule — the prompt closes itself
 */

export type WonQuestionInput = {
  bidId: string | null
  revisionCount: number
  pickedCount: number
  specifiedCount: number
  notNeededAt: string | null
}

export type WonQuestionState = 'ask' | 'has-revision' | 'not-needed' | 'nothing'

export function wonQuestionState(i: WonQuestionInput): WonQuestionState {
  if (!i.bidId) return 'nothing'
  if (i.notNeededAt) return 'not-needed'
  if (i.revisionCount > 0) return 'has-revision'
  if (i.pickedCount === 0 && i.specifiedCount === 0) return 'nothing'
  return 'ask'
}

/** "4 tags on the schedule · 3 picked lines" — what Rev 1 would be built from. */
export function wonQuestionSubline(i: Pick<WonQuestionInput, 'pickedCount' | 'specifiedCount'>): string {
  const parts: string[] = []
  if (i.specifiedCount > 0) parts.push(`${i.specifiedCount} tag${i.specifiedCount === 1 ? '' : 's'} on the schedule`)
  if (i.pickedCount > 0) parts.push(`${i.pickedCount} picked line${i.pickedCount === 1 ? '' : 's'}`)
  if (i.specifiedCount === 0 && i.pickedCount > 0) parts.push('no schedule yet — accessory rows only')
  if (i.pickedCount === 0 && i.specifiedCount > 0) parts.push('nothing picked yet — every tag reads missing')
  return parts.join(' · ')
}
