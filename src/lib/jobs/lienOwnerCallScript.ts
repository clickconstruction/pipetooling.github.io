import type { CoverLetterKind } from './gcOnNotice'
import { affidavitPileFor, releasedAgainstHold, type AffidavitPile, type OwnerCall, type OwnerOwesGc, type OwnerReserved } from './lienOwnerCall'

/**
 * The owner is calling (pure kernel, v2.3853 — to-do #47, the owner's call of
 * 2026-09-26): the call as a conversation. An owner who just got a lien letter
 * phones the office; whoever answers should not need the desk, the statute or
 * counsel's memo. Each card is one line to say and two or three replies in the
 * owner's own words; a reply opens the next card; the statutory facts — do
 * they still owe the GC, the 10 percent and when it went, their contract's
 * completion — are collected on the way and read back as one sentence. The
 * words are counsel's (memo of 2026-09-22), rearranged for the phone: owner-
 * protective, one number, the affidavit date, the release the same day, a
 * direct payment as the owner's decision with counsel's sign-off first, never
 * a joint check, never "the Code requires you to pay us", never the GC's other
 * jobs, never fees. `callToOwnerCall` is what Save writes — the same record
 * v2.3767's dialog wrote, plus the new facts.
 */

export type CallLetterKind = CoverLetterKind | 'paid_out' | 'unresponsive' | 'retainage'

export type CallLetterFacts = {
  /** "273 · Dudley (Lennox)" */
  jobLabel: string
  /** The property, as the letter addressed it. */
  property: string
  ownerName: string
  gcName: string
  /** Who "us" is on the phone — "Click". */
  us: string
  instrument: 'notice_53_056' | 'retainage_53_057'
  letterKind: CallLetterKind
  /** 'YYYY-MM-DD' — the day the packet went out. */
  mailedOn: string
  /** "$7,902.00" */
  amount: string
  /** "June, July and August 2026", or '' on a retainage notice. */
  months: string
  /** "Robert Douglas, Master Plumber" */
  signer: string
  phone: string
  /** 'YYYY-MM-DD' — the § 53.052 date the letter named, or ''. */
  affidavitBy: string
}

export type CallOpening = 'paid' | 'owes' | 'sued' | 'gc_silent' | 'pay_us' | 'callback'

/** The chips: what owners open with, in their words. `words` is the reply on the first card. */
export const CALL_OPENINGS: ReadonlyArray<{ key: CallOpening; chip: string; words: (gc: string) => string }> = [
  { key: 'paid', chip: 'Paid my builder', words: (gc) => `“I already paid ${gc} — everything.”` },
  { key: 'owes', chip: 'Still owe some', words: (gc) => `“I still owe ${gc} something.”` },
  { key: 'sued', chip: 'Am I being sued?', words: () => '“What is this? Am I being sued?”' },
  { key: 'gc_silent', chip: 'Builder’s gone quiet', words: (gc) => `“${gc} isn’t answering me either.”` },
  { key: 'pay_us', chip: 'Can I pay you?', words: () => '“Can I just pay you and be done?”' },
  { key: 'callback', chip: 'Wants a call back', words: (_gc) => '“Can I talk to the plumber who signed this?”' },
]

export type CallStep = 'open' | CallOpening | 'ten' | 'next' | 'wrap'

export type CallState = {
  step: CallStep
  opening: CallOpening | null
  owesGc: OwnerOwesGc
  owesAmount: number | null
  reserved: OwnerReserved
  releasedOn: string | null
  /** null = not asked; true = their contract with the GC is still open. */
  contractOpen: boolean | null
  completedOn: string | null
  wantsToPayUs: boolean
  gcSilentToThem: boolean
  callbackWanted: boolean
  note: string
  /** The cards read, in order. */
  told: CallStep[]
  /** Where Back goes. */
  history: CallStep[]
}

export const EMPTY_CALL_STATE: CallState = {
  step: 'open',
  opening: null,
  owesGc: 'unknown',
  owesAmount: null,
  reserved: 'unknown',
  releasedOn: null,
  contractOpen: null,
  completedOn: null,
  wantsToPayUs: false,
  gcSilentToThem: false,
  callbackWanted: false,
  note: '',
  told: ['open'],
  history: [],
}

/** A reply's extra facts, typed on the card before it is taken. */
export type CallReplyInputs = { amount?: number | null; releasedOn?: string | null; completedOn?: string | null; contractOpen?: boolean | null }

export type CallReply = {
  key: string
  /** In the owner's words. */
  words: string
  /** What the card asks for beside this reply before it is taken. */
  needs?: 'amount' | 'released' | 'completed'
}

export type CallCard = {
  step: CallStep
  /** "2 · paid in full" */
  title: string
  /** The line to say. Paragraphs split on blank lines. */
  say: string
  /** The cites behind the ⓘ — '' when none. */
  cites: string
  /** "They say…" / "Anything else they said?" */
  askLabel: string
  replies: CallReply[]
  /** The last card: Save lives here. */
  final: boolean
}

export type CallFmt = { day: (ymd: string) => string; money: (n: number) => string }

const BALANCE_REPLIES = (gc: string): CallReply[] => [
  { key: 'paid_all', words: `“All paid — there’s nothing left.”` },
  { key: 'still_owe', words: `“There’s still a payment to ${gc}.”`, needs: 'amount' },
  { key: 'not_sure', words: '“I’d have to check.”' },
]

const TEN_REPLIES: CallReply[] = [
  { key: 'ten_held', words: '“It’s still with me.”', needs: 'completed' },
  { key: 'ten_released', words: '“I paid it to them.”', needs: 'released' },
  { key: 'ten_never', words: '“I never held anything back.”', needs: 'completed' },
  { key: 'ten_unknown', words: '“I’d have to check.”' },
]

const NEXT_REPLIES = (signerFirst: string): CallReply[] => [
  { key: 'pay_us_now', words: '“Can I just pay you and be done with it?”' },
  { key: 'wait', words: '“Okay — I’ll wait to hear from you.”' },
  { key: 'callback', words: `“Can I talk to ${signerFirst}?”` },
]

function firstName(signer: string): string {
  const name = signer.split(',')[0]?.trim() ?? ''
  return name.split(/\s+/)[0] || 'the plumber who signed it'
}

function streetOf(property: string): string {
  return property.split(',')[0]?.trim() || 'your property'
}

/** "the notice on 9703 Lenox Hl" / "the retainage notice on …" */
function theNotice(f: CallLetterFacts): string {
  return `${f.instrument === 'retainage_53_057' ? 'the retainage notice' : 'the notice'} on ${streetOf(f.property)}`
}

/** The 10 percent, asked in the owner's words. */
function tenQuestion(gc: string): string {
  return `One thing I do need to ask: your builder usually held back about ten percent until the very end. Did that stay with you, or has it gone to ${gc}?`
}

/** The withhold line for what they still owe — the § 53.056 trap, or § 53.081(c) on a retainage-only packet. */
function holdLine(f: CallLetterFacts): string {
  const gc = f.gcName
  if (f.instrument === 'retainage_53_057') {
    return `Please don’t release retainage or make a final payment to ${gc} until this is cleared. On a retainage notice your right to hold our ${f.amount} back from ${gc} begins the day our filed affidavit reaches you — we’ll send it within five days of recording.`
  }
  return `Please don’t send ${gc} that money until this is cleared. The notice lets you hold back ${f.amount} from it. The clean ways to end it: ${gc} pays us; you hold it and let us know; or ${gc} emails us that you may pay us directly.`
}

/** What happens next — the affidavit date and the release the same day. */
function nextLine(f: CallLetterFacts, fmt: CallFmt): string {
  const by = f.affidavitBy ? ` by ${fmt.day(f.affidavitBy)}` : ''
  return `Here’s what happens next: if ${f.gcName} doesn’t pay us, we file a lien affidavit on the property${by} and send you a copy within five days. I’d rather not — we’d rather pick up a check from ${f.gcName}. The moment we’re paid, you get a release the same day and a copy goes to ${f.gcName}.`
}

/** A direct payment: the owner's decision, counsel's sign-off first. */
function directPayLine(f: CallLetterFacts): string {
  return `That’s your decision on your contract with ${f.gcName} — not something the law makes you do. If you’d like to, call me back before you write anything and we’ll do it cleanly: a check payable only to ${f.us}, a release the same day, and a copy to ${f.gcName}. If ${f.gcName} will email us that you may pay us directly and deduct it, even better.`
}

/** The 10 percent, once they have answered. */
function tenLine(f: CallLetterFacts, s: CallState, fmt: CallFmt): string {
  const gc = f.gcName
  if (s.reserved === 'held') return `Please keep holding it until we send you a release.`
  if (s.reserved === 'released') {
    const against = releasedAgainstHold(s.releasedOn, s.completedOn)
    if (against && !against.inside) return `Texas asks owners to hold that ten percent for thirty days after the job is done — for you that was until ${fmt.day(against.holdEndsOn)}, so that part is done. There’s nothing there to hold.`
    const until = against ? ` — for you that was until ${fmt.day(against.holdEndsOn)}` : ''
    const went = s.releasedOn ? ` Since it went out on ${fmt.day(s.releasedOn)},` : ' If it went out before then,'
    return `Texas asks owners to hold that ten percent for thirty days after the job is done${until}.${went} the property can still be reached for that amount. I’m not saying you owe it; I’m telling you what the law says so nothing surprises you.`
  }
  if (s.reserved === 'never') return `Texas asks owners to hold ten percent back from the builder during the job and for thirty days after it’s done. When that wasn’t held, the property can still be reached for that amount. I’m not saying you owe it; I’m telling you what the law says so nothing surprises you.`
  return `If you find that ten percent is still with you, please keep it there until we send you a release; if it went to ${gc}, call me back with the date.`
}

export function callCard(f: CallLetterFacts, s: CallState, fmt: CallFmt): CallCard {
  const gc = f.gcName
  const signerFirst = firstName(f.signer)
  switch (s.step) {
    case 'open':
      return {
        step: 'open',
        title: '1 · open',
        say: `Thanks for calling about ${theNotice(f)}. First — you did nothing wrong by paying ${gc}. You didn’t hire us, and this is not a lawsuit. Tell me where things stand with ${gc} and I’ll tell you exactly what this means for you.`,
        cites: '',
        askLabel: 'They say…',
        replies: CALL_OPENINGS.map((o) => ({ key: `opening:${o.key}`, words: o.words(gc) })),
        final: false,
      }
    case 'paid':
      return {
        step: 'paid',
        title: 'paid in full',
        say: `Then what you already paid is between us and ${gc} — the law doesn’t ask you to pay twice for anything you paid before our notice reached you. ${tenQuestion(gc)}`,
        cites: '§ 53.084(a) · § 53.101',
        askLabel: 'They say…',
        replies: TEN_REPLIES,
        final: false,
      }
    case 'owes':
      return {
        step: 'owes',
        title: 'still owes the GC',
        say: `${holdLine(f)} ${tenQuestion(gc)}`,
        cites: f.instrument === 'retainage_53_057' ? '§ 53.081(c) · § 53.055 · § 53.101' : '§ 53.081 · § 53.101',
        askLabel: 'They say…',
        replies: TEN_REPLIES,
        final: false,
      }
    case 'sued':
      return {
        step: 'sued',
        title: 'am I being sued?',
        say: `No. You didn’t hire us and this isn’t a lawsuit — it’s the notice Texas requires when a builder hasn’t paid a sub, so you know before your next payment. You did nothing wrong. Where do things stand with ${gc} — all paid, or is there a last draw?`,
        cites: '§ 53.056',
        askLabel: 'They say…',
        replies: BALANCE_REPLIES(gc),
        final: false,
      }
    case 'gc_silent':
      return {
        step: 'gc_silent',
        title: 'the builder has gone quiet',
        say: `Then please don’t send ${gc} another payment that includes our ${f.amount}. If ${gc} stays quiet, we file the affidavit${f.affidavitBy ? ` by ${fmt.day(f.affidavitBy)}` : ''} and send you a copy — you’ll hear from us first. Is there anything you still owe ${gc}?`,
        cites: '§ 53.081 · § 53.052',
        askLabel: 'They say…',
        replies: BALANCE_REPLIES(gc),
        final: false,
      }
    case 'pay_us':
      return {
        step: 'pay_us',
        title: 'can I pay you?',
        say: `${directPayLine(f)} Before that — where do things stand with ${gc}: all paid, or is there a last draw?`,
        cites: 'counsel’s sign-off on this job first',
        askLabel: 'They say…',
        replies: BALANCE_REPLIES(gc),
        final: false,
      }
    case 'callback':
      return {
        step: 'callback',
        title: 'wants a call back',
        say: `Of course — I’ll have ${signerFirst} call you today. Can I get two things so ${signerFirst} has the picture? Where do things stand with ${gc} — all paid, or is there a last draw?`,
        cites: '',
        askLabel: 'They say…',
        replies: BALANCE_REPLIES(gc),
        final: false,
      }
    case 'ten':
      return {
        step: 'ten',
        title: 'the 10%',
        say: tenQuestion(gc),
        cites: '§ 53.101',
        askLabel: 'They say…',
        replies: TEN_REPLIES,
        final: false,
      }
    case 'next': {
      const ten = tenLine(f, s, fmt)
      return {
        step: 'next',
        title: s.reserved === 'released' && releasedAgainstHold(s.releasedOn, s.completedOn)?.inside ? 'the 10% went out early' : s.reserved === 'never' ? 'the 10% was never held' : 'what happens next',
        say: `${ten} ${nextLine(f, fmt)}`,
        cites: s.reserved === 'released' || s.reserved === 'never' ? '§ 53.101 · § 53.105 · § 53.052 · § 53.055' : '§ 53.052 · § 53.055',
        askLabel: 'They say…',
        replies: NEXT_REPLIES(signerFirst).filter((r) => !(r.key === 'pay_us_now' && s.wantsToPayUs) && !(r.key === 'callback' && s.callbackWanted)),
        final: false,
      }
    }
    case 'wrap': {
      const parts: string[] = []
      if (s.wantsToPayUs && !s.told.includes('pay_us')) parts.push(directPayLine(f))
      if (s.callbackWanted && !s.told.includes('callback')) parts.push(`I’ll have ${signerFirst} call you today.`)
      parts.push(`Thanks for calling — you’ll hear from us before anything else happens.`)
      return {
        step: 'wrap',
        title: 'wrap up',
        say: parts.join(' '),
        cites: s.wantsToPayUs ? 'counsel’s sign-off on this job first' : '',
        askLabel: 'Anything else they said?',
        replies: [],
        final: true,
      }
    }
  }
}

function go(s: CallState, step: CallStep): CallState {
  return { ...s, step, told: s.told.includes(step) ? s.told : [...s.told, step], history: [...s.history, s.step] }
}

/** A chip: jump to an opening from any card. */
export function callJump(s: CallState, opening: CallOpening): CallState {
  const next: CallState = { ...s, opening: s.opening ?? opening }
  if (opening === 'paid') return go({ ...next, owesGc: 'no', owesAmount: null }, 'paid')
  if (opening === 'owes') return go({ ...next, owesGc: 'yes' }, 'owes')
  if (opening === 'gc_silent') return go({ ...next, gcSilentToThem: true }, 'gc_silent')
  if (opening === 'pay_us') return go({ ...next, wantsToPayUs: true }, 'pay_us')
  if (opening === 'callback') return go({ ...next, callbackWanted: true }, 'callback')
  return go(next, 'sued')
}

/** The owner's reply on the current card, with whatever the card asked for beside it. */
export function callReply(s: CallState, key: string, inputs: CallReplyInputs = {}): CallState {
  if (key.startsWith('opening:')) return callJump(s, key.slice('opening:'.length) as CallOpening)
  const withContract = (t: CallState): CallState =>
    inputs.contractOpen === true ? { ...t, contractOpen: true, completedOn: null } : inputs.completedOn ? { ...t, contractOpen: false, completedOn: inputs.completedOn } : t
  switch (key) {
    case 'paid_all':
      return go({ ...s, owesGc: 'no', owesAmount: null }, 'paid')
    case 'still_owe':
      return go({ ...s, owesGc: 'yes', owesAmount: inputs.amount ?? null }, 'owes')
    case 'not_sure':
      return go({ ...s, owesGc: 'unknown', owesAmount: null }, 'ten')
    case 'ten_held':
      return go(withContract({ ...s, reserved: 'held', releasedOn: null }), 'next')
    case 'ten_released':
      return go(withContract({ ...s, reserved: 'released', releasedOn: inputs.releasedOn ?? null }), 'next')
    case 'ten_never':
      return go(withContract({ ...s, reserved: 'never', releasedOn: null }), 'next')
    case 'ten_unknown':
      return go({ ...s, reserved: 'unknown', releasedOn: null }, 'next')
    case 'pay_us_now':
      return go({ ...s, wantsToPayUs: true }, 'wrap')
    case 'callback':
      return go({ ...s, callbackWanted: true }, 'wrap')
    case 'wait':
      return go(s, 'wrap')
    default:
      return s
  }
}

/** Back: the previous card; the facts stay as typed (the next reply overwrites them). */
export function callBack(s: CallState): CallState {
  const prev = s.history[s.history.length - 1]
  if (!prev) return s
  return { ...s, step: prev, history: s.history.slice(0, -1) }
}

/** The call so far, as one sentence — the record read back. '' before anything is known. */
export function callSentence(f: CallLetterFacts, s: CallState, fmt: CallFmt): string {
  const who = f.ownerName.trim() || 'The owner'
  const gc = f.gcName
  const out: string[] = []
  if (s.owesGc === 'no') out.push(`${who} paid ${gc} in full.`)
  else if (s.owesGc === 'yes') out.push(`${who} still owes ${gc}${s.owesAmount != null ? ` about ${fmt.money(s.owesAmount)}` : ' something'}.`)
  else if (s.opening) out.push(`${who} isn’t sure what they still owe ${gc}.`)
  if (s.reserved === 'held') out.push('The 10% is still with them.')
  else if (s.reserved === 'released') {
    const against = releasedAgainstHold(s.releasedOn, s.completedOn)
    const when = s.releasedOn ? ` on ${fmt.day(s.releasedOn)}` : ''
    const tail = against ? (against.inside ? `, ${against.daysEarly} day${against.daysEarly === 1 ? '' : 's'} before the hold ended` : ', after the hold ended') : ''
    out.push(`They let the 10% go to ${gc}${when}${tail}.`)
  } else if (s.reserved === 'never') out.push('They never held the 10% back.')
  if (s.contractOpen === true) out.push(`${gc} is still on the job.`)
  else if (s.completedOn) out.push(`${gc} finished ${fmt.day(s.completedOn)}.`)
  if (s.gcSilentToThem) out.push(`${gc} isn’t answering them either.`)
  if (s.wantsToPayUs) out.push('They’d like to pay us directly — counsel’s sign-off first.')
  if (s.callbackWanted) out.push(`They’d like a call back from ${firstName(f.signer)}.`)
  return out.join(' ')
}

/** Counsel's pile from the answers so far. */
export function callPile(s: CallState, at = '1970-01-01T00:00:00Z'): AffidavitPile | null {
  return affidavitPileFor(callToOwnerCall(s, '', at))
}

/** What Save writes: v2.3767's record plus the conversation's facts. */
export function callToOwnerCall(s: CallState, takerName: string, at: string): OwnerCall {
  return {
    at,
    name: takerName,
    owesGc: s.owesGc,
    owesAmount: s.owesGc === 'yes' ? s.owesAmount : null,
    reserved: s.reserved,
    originalContractCompletedOn: s.contractOpen === false ? s.completedOn : null,
    note: s.note.trim(),
    releasedOn: s.reserved === 'released' ? s.releasedOn : null,
    wantsToPayUs: s.wantsToPayUs,
    gcSilentToThem: s.gcSilentToThem,
    callbackWanted: s.callbackWanted,
    told: s.told,
  }
}

/** Something is worth saving once the owner has said anything at all. */
export function callHasFacts(s: CallState): boolean {
  return s.opening != null || s.owesGc !== 'unknown' || s.reserved !== 'unknown' || s.contractOpen != null || s.note.trim() !== ''
}

/** "the residential § 53.056 notice mailed Sep 22" — the letter they are holding, in one phrase. */
export function holdingWords(f: CallLetterFacts, fmt: CallFmt): string {
  const kind =
    f.letterKind === 'retainage' ? 'the § 53.057 retainage notice' : f.letterKind === 'paid_out' ? 'our second letter (the paid-out letter) with the § 53.056 notice' : f.letterKind === 'unresponsive' ? 'our letter for a GC that is not answering, with the § 53.056 notice' : `the ${f.letterKind} § 53.056 notice`
  return `${kind} mailed ${fmt.day(f.mailedOn)}`
}

export const NEVER_SAY = ['the GC’s other jobs', '“not paying subs generally”', 'interest, fees or theft of service', '“the Code requires you to pay us”', 'a joint check', '“you are in default”'] as const
