import type { LienStopPaper } from '../../components/jobs/LienStopPaperWindow'
import { lienStopCounselView, type LienStopCounselInput } from './lienStopEvidence'

/**
 * The counsel-side stop as the window takes it (v2.4800): the view's cards, checklist, words and
 * rail folded into one `LienStopPaper`, the acts the host hands in. Pure but for the acts.
 */
export function lienStopCounselPaper(input: LienStopCounselInput & { act: LienStopPaper['act']; onCopy: (text: string) => void; copyLabel: string }): LienStopPaper {
  const v = lienStopCounselView(input)
  return {
    pages: [],
    envelope: null,
    before: [],
    record: null,
    act: input.act,
    secondAct: { label: input.copyLabel, onPress: () => input.onCopy(v.text) },
    words: { title: v.title, line: v.line },
    cards: v.cards,
    checklist: v.checklist ? { rows: v.checklist, note: v.checklistNote } : null,
    does: v.does,
    ruleWords: v.rule,
    rail: [...(v.follows ? [{ key: 'follows', label: 'What follows', words: v.follows }] : []), ...(v.venue ? [{ key: 'venue', label: 'Venue', words: v.venue }] : [])],
    moveWords: v.move,
    note: v.cards.length || v.checklist ? null : input.step.kind === 'last_work' || input.step.kind === 'hold' || input.step.kind === 'suit' ? null : 'Nothing has gone out at this stop yet. The office’s path says when it will.',
  }
}
