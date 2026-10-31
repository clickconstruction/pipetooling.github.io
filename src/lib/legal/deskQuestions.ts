/**
 * The Legal Desk's four questions (v2.5757): each card answers its own question first, then says why in one or
 * two plain sentences. Read from the packet the desk already builds; no new read. The office print's totals read
 * the same answers, so the desk and the paper say one thing.
 */
import { formatLegalMoney, type LegalPacket, type LegalWorthVerdict } from './legalPacket'
import { counselReadLine, counselTriesWords, type CounselRead } from './counselRead'
import { moneyBarDayWords } from './moneyBars'

export type DeskQuestionTone = 'ok' | 'warn' | 'stop'
export type DeskQuestion = { label: string; answer: string; why: string; chip?: { text: string; tone: DeskQuestionTone } }

function jobsWords(labels: ReadonlyArray<string>): string {
  if (labels.length === 1) return `Job ${labels[0]}`
  return `Jobs ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/**
 * Punch list #218 PR 2: the attorney's read of how the case tries rides the answer as a chip (*hard to try* amber,
 * *easy to try* green) and the why ends with whose read it is and their line. No read, no chip: the answer reads as before.
 */
export function canWeSue(packet: Pick<LegalPacket, 'theory' | 'account'>, read: CounselRead | null = null): DeskQuestion {
  const label = 'Can we sue?'
  const jobs = packet.account.jobs
  const withRead = (q: DeskQuestion): DeskQuestion =>
    read ? { ...q, why: `${q.why} ${counselReadLine(read, (ymd) => moneyBarDayWords(ymd) || ymd, 'office')}`, chip: { text: counselTriesWords(read.tries), tone: read.tries === 'hard' ? 'warn' : 'ok' } } : q
  switch (packet.theory.key) {
    case 'contract':
      return withRead({ label, answer: 'Yes', why: 'They signed an agreement. That is the strongest case we can bring.' })
    case 'sworn': {
      const short = jobs.filter((j) => j.swornMissing.length > 0).map((j) => j.label)
      if (short.length === 0) return withRead({ label, answer: 'Yes', why: 'As a sworn account. They got the bill, GPS puts our crew on site, and nobody disputed it.' })
      return withRead({
        label,
        answer: `Yes, on ${jobs.length - short.length} of ${jobs.length} jobs`,
        why: `As a sworn account. ${jobsWords(short)} still ${short.length === 1 ? 'needs' : 'need'} a signed agreement or field proof.`,
      })
    }
    case 'lien':
      return withRead({ label, answer: 'Only on the lien', why: 'No agreement or sworn account yet. The property record is complete and a lien window is open.' })
    default:
      return withRead({ label, answer: 'Not yet', why: 'Nothing an attorney can take to court. The list below says what is missing.' })
  }
}

export function howMuch(packet: Pick<LegalPacket, 'account' | 'worth'>): DeskQuestion {
  const n = packet.account.jobs.length
  const days = packet.account.totals.oldestDays
  const owed = `Owed on ${n} job${n === 1 ? '' : 's'}.`
  // v2.5849 (punch list #171 step 2): the claim leads when the GC holds retainage; the open bills read inside it.
  // v2.6103 (punch list #213): only the retainage no sent bill asks for is added, and the sentence says which part that is.
  const w = packet.worth
  const oldest = days == null ? '' : ` The oldest bill is ${days} days old.`
  if (w.claim > w.balance + 0.005) {
    const onBills = w.retainageOnBills > 0.005 ? ` Another ${formatLegalMoney(w.retainageOnBills)} of the retainage held is already on a bill.` : ''
    const inside = `Open bills ${formatLegalMoney(w.balance)} inside it, plus retainage ${formatLegalMoney(w.retainageAdded)} that no bill asks for yet.${onBills}`
    return { label: 'How much?', answer: formatLegalMoney(w.claim), why: `${inside}${oldest}`, chip: { text: 'the claim', tone: 'ok' } }
  }
  const carried = w.retainageHeld > 0.005 ? ` The retainage held ${formatLegalMoney(w.retainageHeld)} is already inside the open bills.` : ''
  return { label: 'How much?', answer: formatLegalMoney(w.balance), why: `${owed}${carried}${oldest}` }
}

const VERDICT_TONE: Record<LegalWorthVerdict, DeskQuestionTone> = { 'worth it': 'ok', marginal: 'warn', 'not worth it': 'stop' }

export function whatsLeftForUs(packet: Pick<LegalPacket, 'worth'>): DeskQuestion {
  const w = packet.worth
  const cut = `The firm takes ${Math.round(w.contingencyPct * 100)}%, or ${formatLegalMoney(w.fee)}${w.claim > w.balance + 0.005 ? ' of the claim' : ''}, and filing costs ${formatLegalMoney(w.filingCost)}.`
  return { label: "What's left for us?", answer: formatLegalMoney(w.net), why: cut, chip: { text: w.verdict, tone: VERDICT_TONE[w.verdict] } }
}

/** One flag of `LegalWorth.flags`, read as a short answer and the reason it hurts. An unknown flag reads as itself. */
function flagWords(flag: string): { answer: string; why: string } {
  if (flag.includes('no money')) return { answer: 'They say they cannot pay', why: 'A note says they have no money. A win may not collect.' }
  if (flag.startsWith('dispute')) return { answer: 'They dispute the work', why: 'The firm will have to prove the work was done.' }
  const broken = /^(\d+) broken promise/.exec(flag)
  if (broken) return { answer: `${broken[1]} broken promise${broken[1] === '1' ? '' : 's'}`, why: 'They promised to pay and did not.' }
  if (flag.startsWith('payer is a name only')) return { answer: 'We only have a name', why: 'No customer record. The firm needs a legal name and address to sue.' }
  return { answer: flag, why: '' }
}

export function whatCouldGoWrong(packet: Pick<LegalPacket, 'worth' | 'theory'>): DeskQuestion {
  const label = 'What could go wrong?'
  const flags = packet.worth.flags.map(flagWords)
  // With nothing to plead, the case itself is what goes wrong: never "nothing we know of" beside "Not yet".
  if (packet.theory.key === 'none') flags.unshift({ answer: 'No case yet', why: 'An attorney has nothing to take to court until the list below is fixed.' })
  if (flags.length === 0) return { label, answer: 'Nothing we know of', why: 'No dispute, no broken promise and no note saying they cannot pay.' }
  const [one] = flags
  if (flags.length === 1 && one) return { label, answer: one.answer, why: one.why }
  return { label, answer: `${flags.length} things`, why: flags.map((f) => (f.why ? `${f.answer}. ${f.why}` : `${f.answer}.`)).join(' ') }
}

export function deskQuestions(packet: Pick<LegalPacket, 'theory' | 'account' | 'worth'>, read: CounselRead | null = null): DeskQuestion[] {
  return [canWeSue(packet, read), howMuch(packet), whatsLeftForUs(packet), whatCouldGoWrong(packet)]
}
