/**
 * The affidavit pane's and the retainage pane's stacked section heads (v2.7320, the owner's ask of 2026-11-15:
 * "those section titles should look like the notice pane's grey bars across"). Both panes drew bordered boxes
 * with a tiny muted caption inside; now each is sections under the notice pane's grey sticky heads
 * (`lienPaneSections.ts`, `LienPaneHead`), in the same `{ key, label, fact, tail }` shape, so the head component
 * draws them unchanged. Pure: facts in, heads out.
 */
import type { LienAffidavitGateKey } from './lienDeskAffidavits'
import type { LienRetainageGateKey, LienPaymentBond } from './lienDeskRetainage'
import { lienAffidavitGateShortWords } from './lienDeskGates'
import type { LienAffidavitNoticeStanding } from './lienAffidavitNoticeStanding'
import { AFFIDAVIT_PILE_WORDS, affidavitPileFor, type OwnerCall } from './lienOwnerCall'
import type { LienAffidavitForm } from './lienAffidavitForm'
import type { LienPaneSection } from './lienPaneSections'

export type LienAffidavitPaneSectionKey = 'path' | 'gates' | 'owner' | 'months' | 'paper'
export type LienAffidavitPaneSection = LienPaneSection<LienAffidavitPaneSectionKey>

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n)
}

/** "✓ all five clear" or "✗ 2 missing" — the same verdict on both panes' gate heads. */
function gatesFact(gates: ReadonlyArray<{ ok: boolean }>): string {
  if (gates.length === 0) return '—'
  const missing = gates.filter((g) => !g.ok).length
  return missing === 0 ? `✓ all ${numberWord(gates.length)} clear` : `✗ ${missing} missing`
}

/** Where the affidavit's window starts, and where that month came from (v2.7224: a stand-in month says so). */
export type LienAffidavitWindow = { lastMonth: string; fromCreation: boolean; fromBill: boolean }

/** The gate caption's words of old, now the first line of the gates section: "§ 53.052 · window from Aug 2026, the last month worked". */
export function lienAffidavitWindowWords(w: LienAffidavitWindow, monthLabel: (key: string) => string): string {
  const from = w.fromCreation ? (w.fromBill ? 'the month of the bill, since the job has no clock hours' : 'the month the job was created — it has no clock hours') : 'the last month worked'
  return `§ 53.052 · window from ${monthLabel(w.lastMonth)}, ${from}`
}

export type LienAffidavitPaneSectionsInput = {
  /** The timeline's next step, "File the affidavit — 9 days."; null with no timeline. */
  nextWords: string | null
  gates: ReadonlyArray<{ key: LienAffidavitGateKey; ok: boolean }>
  /** Where the job's notice stands while its gate is closed (`lienAffidavitNoticeStanding.ts`); absent, the tail keeps *no § 53.056 notice on the job*. */
  noticeStanding?: LienAffidavitNoticeStanding | null
  window: LienAffidavitWindow
  /** The owner's answers on the sent notice; null before any call. */
  ownerCall: OwnerCall | null
  bond: LienPaymentBond
  /** The months section, drawn on a sub job with work months: the months the paper swears and the months worked with no notice. Null when the pane draws no months. */
  months: { sworn: readonly string[]; unsecured: number } | null
  /** "$2,976" — the claim as the paper swears it. */
  claimWords: string
  form: LienAffidavitForm
  /** Who signs the paper; '' when nobody is named. */
  signer: string
  monthLabel: (key: string) => string
}

/** The owner's answers in a glance: the pile counsel sorts the job into, or that no call is recorded yet. */
export function lienOwnerAnswersFact(call: OwnerCall | null): string {
  if (!call) return 'no call yet'
  const pile = affidavitPileFor(call)
  return pile ? `Pile ${pile} · ${AFFIDAVIT_PILE_WORDS[pile].short}` : 'answers do not sort it yet'
}

/** The bond's state, short, for the owner head's tail. */
export function lienBondTail(bond: LienPaymentBond): string {
  return bond === 'yes' ? 'payment bond on the project' : bond === 'no' ? 'no payment bond' : 'bond unknown'
}

/** The affidavit pane's heads in pane order. The months head is drawn only when the pane draws the months. */
export function lienAffidavitPaneSections(i: LienAffidavitPaneSectionsInput): LienAffidavitPaneSection[] {
  const out: LienAffidavitPaneSection[] = []
  out.push({ key: 'path', label: 'Where this affidavit is', fact: (i.nextWords ?? '').replace(/\.$/, '') || 'nothing due', tail: '' })
  const missing = i.gates.filter((g) => !g.ok)
  out.push({
    key: 'gates',
    label: 'Before it can be generated',
    fact: gatesFact(i.gates),
    tail: missing.length ? missing.map((g) => lienAffidavitGateShortWords(g, { noticeStanding: i.noticeStanding })).join(' · ') : `window from ${i.monthLabel(i.window.lastMonth)}`,
  })
  out.push({ key: 'owner', label: "The owner's answers", fact: lienOwnerAnswersFact(i.ownerCall), tail: lienBondTail(i.bond) })
  if (i.months) {
    const m = i.months
    out.push({
      key: 'months',
      label: 'Months the affidavit claims',
      fact: `${m.sworn.length ? m.sworn.map(i.monthLabel).join(' + ') : 'no months'} · ${i.claimWords}`,
      tail: m.unsecured > 0 ? `${m.unsecured} worked, not noticed` : '',
    })
  }
  out.push({ key: 'paper', label: 'The paper', fact: i.form === 'short' ? 'short form' : 'earlier form', tail: i.signer })
  return out
}

export type LienRetainagePaneSectionKey = 'gates' | 'claim' | 'paper'
export type LienRetainagePaneSection = LienPaneSection<LienRetainagePaneSectionKey>

/** The retainage gates' red words, short, for the head's tail. */
export function lienRetainageGateShortWords(gate: { key: LienRetainageGateKey }): string {
  return gate.key === 'owner' ? 'owner of record missing' : gate.key === 'gc' ? 'no original contractor' : gate.key === 'contract_ended' ? 'our contract has not ended' : 'no retainage recorded'
}

/** The retainage gate caption's words of old, now the first line of its gates section. */
export function lienRetainageWindowWords(endedWords: string): string {
  return `§ 53.057 · 30 days from the day our contract on the job ended · ${endedWords}`
}

export type LienRetainagePaneSectionsInput = {
  gates: ReadonlyArray<{ key: LienRetainageGateKey; ok: boolean }>
  /** "complete Sep 3" or "our contract still open" (`contractEndedWords`). */
  endedWords: string
  /** "$1,760" — the retainage the notice claims. */
  retainageWords: string
  /** A recorded § 53.056 notice already named this retainage inside its claim. */
  inClaim: boolean
  /** The pages of the paper: the cover letter and the form. */
  pages: number
}

/** The retainage pane's heads in pane order: the gates, the § 53.056 claim, the paper. */
export function lienRetainagePaneSections(i: LienRetainagePaneSectionsInput): LienRetainagePaneSection[] {
  const missing = i.gates.filter((g) => !g.ok)
  return [
    { key: 'gates', label: 'Before it can go', fact: gatesFact(i.gates), tail: missing.length ? missing.map((g) => lienRetainageGateShortWords(g)).join(' · ') : `${i.retainageWords} · ${i.endedWords}` },
    { key: 'claim', label: 'The § 53.056 claim', fact: i.inClaim ? 'inside a recorded notice' : 'not yet inside one', tail: i.inClaim ? 'the owner may withhold it now' : 'the owner withholds once the affidavit is filed' },
    { key: 'paper', label: 'The paper', fact: `${i.pages} ${i.pages === 1 ? 'page' : 'pages'} · cover letter + the form`, tail: '§ 53.057(a-2)' },
  ]
}
