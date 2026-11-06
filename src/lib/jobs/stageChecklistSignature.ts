/**
 * Needs a signature (punch list #237, PR 2): the words and the rules of the signature sheet, the locked row and *Take
 * it back*. The author of a checklist marks an item *needs a signature* beside *Asks for a photo*, on every add box,
 * and whoever answers it signs the way the app signs a lien notice (`lienNoticeSignature.ts`, v2.5077): a mark typed
 * or drawn (`SignatureTypeOrDrawInput`, v2.3159), adopted with one press under the signer's own sign-in, bound to the
 * answer as given by a hash (`checklistAnswerHash` in `stageChecklist.ts`) so a later change voids it. The sheet says
 * what is being claimed and who will read it, takes the mark, and asks for the agreed line. The owner, 2026-11-01:
 * "we force a user to sign when they complete certain checklist items so they understand the severity and gravity."
 *
 * A signature item is not answered until it is signed; Not here signs too, the owner's default, since it is the claim
 * an inspector would test. A signed No asks for the note (the walks). A signed row locks: *Take it back* voids it with
 * a reason, the voided row and its mark stay in the record, and the next press writes a new answer. Anyone who may
 * answer may take an answer back, their own or another's (the walk lets the technician).
 *
 * Pure; the io is `stageChecklistSheetIo.ts`, and the mark rides the outbox as `checklist-sign` (`offline/outbox.ts`).
 */
import { PICK_WORDS, stampWords, type ChecklistSignature, type ChecklistSignatureMode, type StageChecklistAnswer, type StageChecklistPick, type StageChecklistState } from './stageChecklist'

/** The author's toggle, beside *Asks for a photo* on every add box, and the guide's rule for it. */
export const NEEDS_SIGNATURE_WORDS = {
  label: 'Needs a signature',
  hint: 'Whoever answers it signs, and the row is locked after. Use it where a wrong answer costs a wall or an inspection.',
  /** The chip on the open row and the read-out's tag while the row is unsigned. */
  tag: 'needs a signature',
  /** The tag once signed. */
  signed: 'signed',
} as const

/** The line the signer agrees to, under the mark. */
export const AGREED_LINE = 'I did this check myself and the answer is true.'

/** The signature sheet's words. */
export const SIGN_WORDS = {
  title: 'Sign your answer',
  name: 'Your name, as it prints under the mark',
  namePlaceholder: 'Your full name',
  nameHint: 'Type your full name.',
  agreeHint: 'Tick the line to sign.',
  drawHint: 'Sign in the box.',
  note: 'A note, if you want to say more',
  noteNo: 'Why it is No',
  noteNoHint: 'A signed No says why. Type the note.',
  notePlaceholder: 'What is there to say?',
  /** Under the agreed line: what the lock means. */
  lockHint: 'A signed answer is locked. Take it back opens a new row with a reason. The signed one stays in the record.',
  notNow: 'Not now',
  confirm: 'Sign and save',
  busy: 'Signing…',
  /** The toast when the signal is gone and the press waits on the phone. */
  queued: 'Kept on the phone. Your signed answer sends when the signal is back.',
  /** What the row says while its signature waits on the phone. */
  waiting: 'Signed. Waiting for signal to send.',
} as const

/** Who reads a signed answer, the sheet's last sentence. */
export const READERS_LINE = 'The office, the GC and an inspector can read it.'

/**
 * The gravity words: what is being claimed, where it goes, who reads it. In three parts so the pick can be bold:
 * *You are signing **Yes** to “Did the final water test hold?”. It goes on J1042's Trim Set record with your name and
 * the time. The office, the GC and an inspector can read it.*
 */
export function signingWords(pick: StageChecklistPick, questionWords: string, jobLabel: string, stageName: string): { before: string; pick: string; after: string } {
  const job = jobLabel.trim() || 'this job'
  const owner = job.endsWith('s') ? `${job}'` : `${job}'s`
  return { before: 'You are signing ', pick: PICK_WORDS[pick], after: ` to “${questionWords.trim()}”. It goes on ${owner} ${stageName} record with your name and the time. ${READERS_LINE}` }
}

/** What the signer fills before the press. */
export interface SignInput {
  pick: StageChecklistPick
  note: string
  printedName: string
  agreed: boolean
  mode: ChecklistSignatureMode
  /** The drawn PNG as a data URL, or null when the pad is empty or the mode is typed. */
  drawnPng: string | null
}

/** The first thing that stops the press, in words, or null when it can sign. */
export function signProblem(input: SignInput): string | null {
  if (!input.printedName.trim()) return SIGN_WORDS.nameHint
  if (input.pick === 'no' && !input.note.trim()) return SIGN_WORDS.noteNoHint
  if (input.mode === 'draw' && !input.drawnPng) return SIGN_WORDS.drawHint
  if (!input.agreed) return SIGN_WORDS.agreeHint
  return null
}

/** The longest printed name a row keeps (the migration's check). */
export const PRINTED_NAME_MAX_CHARS = 120

/** Where a drawn mark waits in the checklist bucket: beside the job's photos, under `sig`, so the job's gate reads it and the sweep never does. */
export function signaturePngPath(jobId: string, answerId: string, signedAtMs: number): string {
  return `${jobId}/sig/${answerId}-${signedAtMs}.png`
}

/** Under a signed answer's pick: *Signed by Luis Ortega · Nov 1 · 9:14 am*. */
export function signedRowWords(sig: Pick<ChecklistSignature, 'printedName' | 'signedAt'>): string {
  return `Signed by ${stampWords(sig.printedName, sig.signedAt)}`
}

/** The statement row's second line once signed: the stamp, then *signed*. */
export function signedStampWords(stamp: string): string {
  return stamp ? `${stamp} · signed` : 'signed'
}

/** The toast once a signed answer lands: *Signed and saved. Trim Set is now 3 of 5.* */
export function signedToastWords(stageName: string, state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return `Signed and saved. ${stageName} is now ${state.answered} of ${state.asked}.`
}

// ── Take it back ─────────────────────────────────────────────────────────────

/** The shortest and the longest reason a take back keeps, in characters (the migration's check and the trigger's rule). */
export const VOID_WHY_MIN_CHARS = 3
export const VOID_WHY_MAX_CHARS = 200

export const TAKE_BACK_WORDS = {
  press: 'Take it back',
  hint: 'The signed answer stays in the record as taken back. Say why, then answer the question again.',
  label: 'Why the answer is taken back',
  placeholder: 'Why, like the wrong unit',
  confirm: 'Take it back',
  keep: 'Keep it',
  /** The heading over the voided lines under a row. */
  heading: 'Taken back',
  /** What a take back the database filtered away says: no error and no row is a refusal, not a save. */
  refused: 'That answer was not taken back. It may be taken back already, or this job may not be yours to change.',
} as const

/** What stops a take back, in words, or null: it needs its reason. */
export function takeBackProblem(why: string): string | null {
  return why.trim().length < VOID_WHY_MIN_CHARS ? 'Say why the answer is taken back.' : null
}

/** True when the row offers *Take it back*: a signed answer not yet taken back. An unsigned row is changed in place. */
export function canTakeBack(answer: Pick<StageChecklistAnswer, 'pick' | 'signature' | 'voided'> | null | undefined): boolean {
  return Boolean(answer?.pick && answer.signature && !answer.voided)
}

/**
 * A voided line under the row: *Was Yes, signed by Luis Ortega · Nov 1 · 9:14 am. Taken back by Luis Ortega · Nov 5 ·
 * 9:20 am · “wrong unit”.* An unsigned answer taken back reads *Was Yes by Luis Ortega · …*.
 */
export function voidedLineWords(answer: Pick<StageChecklistAnswer, 'pick' | 'answeredBy' | 'answeredAt' | 'signature' | 'voided'>): string {
  const v = answer.voided
  if (!v) return ''
  const pick = answer.pick ? PICK_WORDS[answer.pick] : 'nothing'
  const was = answer.signature ? `Was ${pick}, signed by ${stampWords(answer.signature.printedName, answer.signature.signedAt)}.` : `Was ${pick} by ${stampWords(answer.answeredBy, answer.answeredAt)}.`
  return `${was} Taken back by ${stampWords(v.by, v.at)} · “${v.why.trim()}”.`
}

/** The toast once an answer is taken back: *Taken back. Trim Set is now 2 of 5.* */
export function takenBackToastWords(stageName: string, state: Pick<StageChecklistState, 'asked' | 'answered'>): string {
  return `Taken back. ${stageName} is now ${state.answered} of ${state.asked}.`
}

/** The read-out's and the paper's count: *1 signed*, *3 signed*, '' with none. */
export function signedCountWords(n: number): string {
  return n === 0 ? '' : `${n} signed`
}
