import { formatLegalMoney, type LegalPacket, type LegalJobLine } from './legalPacket'
import type { LegalEnvelope } from './legalLienPaper'
import { firmAgreementWords } from './legalFirmWords'
import { courtWords, lienForeclosureLine } from './jpVenue'

import { demandDate } from '../jobsDocuments/demandLetter'
import { lienMoveWords, type LienTimelineStep } from '../jobs/lienTimeline'
import { lienStopPaperKind } from '../jobs/lienStopPaper'
import { workMonthLabel } from '../jobs/forecastWorkMonths'

/**
 * A stop as evidence (v2.4800, the owner's ask): what the stop window shows on counsel's portal and on
 * the office's Legal desk, where nobody sends our paper. The left side is the record — the
 * envelope as it went out, what that paper does for the claim under the statute, and for the
 * suit the filing checklist with what is on file and what is not — from the packet the page
 * already holds. The portal gets no sends and no document link (the edge function withholds
 * them), so a card says the office holds them rather than showing less in silence.
 */

export interface LienStopRecordCard {
  key: string
  /** The exhibit letter on the paper, when the row is an envelope. */
  letter: string | null
  title: string
  sub: string | null
  rows: Array<[string, string]>
  /** The stored document, when the reader may open it. */
  href: string | null
}

export interface LienStopChecklistRow {
  key: string
  letter: string
  title: string
  detail: string
  /** `not_needed`: the law does not ask for it here — an original contractor owes no § 53.056 notice. */
  status: 'on_file' | 'not_on_file' | 'not_needed'
  statusWords: string
}

export interface LienStopCounselView {
  title: string
  line: string
  cards: LienStopRecordCard[]
  /** The suit's filing checklist; null on every other stop. */
  checklist: LienStopChecklistRow[] | null
  checklistNote: string | null
  /** What this paper does for the claim — null on a stop with no paper. */
  does: string | null
  /** The rule in one sentence. */
  rule: string
  /** The stop after this one, in words. */
  follows: string | null
  /** The suit's venue line; null elsewhere. */
  venue: string | null
  /** `OURS · DONE`, `COUNSEL`, `THE OWNER`. */
  move: string
  /** The whole view as plain text, for the clipboard. */
  text: string
}

export interface LienStopCounselInput {
  step: LienTimelineStep
  steps: ReadonlyArray<LienTimelineStep>
  packet: Pick<LegalPacket, 'account' | 'paper' | 'todayYmd'>
  jobId: string
  /** The portal withholds sends and document links; the office's desk has them. */
  voice: 'firm' | 'office'
}

const RULES: Record<LienTimelineStep['kind'], string> = {
  last_work: '§ 53.003: the month of the work sets every notice day; the last day of work sets the affidavit’s.',
  notice: '§ 53.056: each month’s notice to the owner and the original contractor by the 15th of the third month after the work, the second on a residence; served by certified mail, the mailing date is the date of notice.',
  retainage: '§ 53.057: a claimant with retainage gives notice to the owner within 30 days after the claimant’s contract is completed, terminated or abandoned.',
  affidavit: '§ 53.052: the affidavit is filed with the county clerk by the 15th of the fourth month after the last work, the third on a residence.',
  serve: '§ 53.055: a copy of the filed affidavit to the owner and the original contractor within five days of filing.',
  hold: '§ 53.101: the owner retains 10 % of the contract price for 30 days after the original contract completes.',
  suit: '§ 53.158: suit within one year after the last day a claimant may file the affidavit, or one year after completion, termination or abandonment, whichever is later.',
  release: '§ 53.152: once paid, the claimant furnishes a release of the lien within ten days of a request.',
  demand: 'CPRC § 38.001: a claim presented to the debtor; attorney’s fees follow when it is not paid within 30 days (§ 38.002).',
}

const DOES: Partial<Record<LienTimelineStep['kind'], string>> = {
  notice: 'Received in time, the notice traps the funds: the owner may withhold the amount from the original contractor’s next draw (§ 53.081), and payments made anyway can follow the property once a lien is perfected (§ 53.084). It is the first of the two papers a sub’s lien needs.',
  retainage: 'The notice holds the owner to the 10 % reserved funds (§ 53.101) for the claimant’s share, to the extent of the retainage, once the affidavit is on file (§ 53.105).',
  affidavit: 'The filed affidavit perfects the lien on the property for the amount sworn. Recorded in the county of the work, it is the paper a foreclosure suit stands on.',
  serve: 'Service of the filed affidavit on the owner and the original contractor keeps the lien good against them; without it the affidavit is filed but not noticed.',
  release: 'The release of record clears the lien from the property once the claim is paid; the owner can demand it within ten days.',
  demand: 'Presentment of the claim starts the 30 days after which attorney’s fees are recoverable on a contract claim.',
}

function envelopeForStop(step: LienTimelineStep, envelopes: ReadonlyArray<LegalEnvelope>, jobId: string): LegalEnvelope | null {
  const mine = envelopes.filter((e) => e.shares.some((s) => s.jobId === jobId))
  switch (step.kind) {
    case 'notice':
      return mine.find((e) => e.kind === 'notice_53_056' && !e.letterTwo && (!step.monthKey || e.months.some((m) => m.key === step.monthKey))) ?? null
    case 'retainage':
      return mine.find((e) => e.kind === 'retainage_53_057') ?? null
    case 'affidavit':
    case 'serve':
      return mine.find((e) => e.kind === 'affidavit') ?? null
    case 'release':
      return mine.find((e) => e.kind === 'release_of_record') ?? null
    default:
      return null
  }
}

function propertyWords(job: Pick<LegalJobLine, 'property'> | undefined): string {
  const p = job?.property
  if (!p) return ''
  const kind = p.propertyKind === 'residential' ? (p.homestead ? 'residential, a homestead' : 'residential, not a homestead') : p.propertyKind ? 'commercial' : 'kind not set'
  return [p.address, p.county ? `${p.county} County` : '', kind].filter(Boolean).join(' · ')
}

function dayWords(ymd: string | null): string {
  return ymd ? demandDate(ymd) : '—'
}

/** The envelope as it went out — the record card the window leads with. */
export function envelopeRecordCard(e: LegalEnvelope, job: Pick<LegalJobLine, 'property'> | undefined, jobId: string, voice: 'firm' | 'office'): LienStopRecordCard {
  const share = e.shares.find((s) => s.jobId === jobId)
  const methods = [...new Set(e.sends.map((s) => s.methodLabel).filter(Boolean))]
  const recipients = e.sends.length ? [...new Set(e.sends.map((s) => s.recipientLabel))].join(' · ') : 'the owner of record · the original contractor'
  const rows: Array<[string, string]> = []
  if (e.kind === 'affidavit' || e.kind === 'release_of_record') {
    rows.push(['Filed', e.filedYmd ? `${dayWords(e.filedYmd)}${e.county ? ` · ${e.county} County` : ''}${e.recordingNumber ? ` · No. ${e.recordingNumber}` : ''}` : 'not filed'])
    if (e.kind === 'affidavit') rows.push(['Served', e.servedYmd ? dayWords(e.servedYmd) : e.serveDueYmd ? `not yet · due ${dayWords(e.serveDueYmd)}` : 'not yet'])
  } else {
    rows.push(['Went out', `${dayWords(e.wentOutYmd)}${e.byHand ? ' · by hand' : ''}${methods.length ? ` · ${methods.join(', ')}` : voice === 'firm' ? ' · method on the office’s record' : ''}`])
    rows.push(['To', recipients])
  }
  if (e.months.length) rows.push(['Covers', e.months.map((m) => m.label + (m.asInformation ? ' (for information)' : '')).join(', ')])
  const prop = propertyWords(job)
  if (prop) rows.push(['Property', prop])
  rows.push(['Document', e.documentUrl ? 'the stored document' : voice === 'firm' ? 'held by the office' : 'none stored'])
  return {
    key: e.key,
    letter: e.letter,
    title: `${e.kindLabel} · Exhibit ${e.letter}`,
    sub: share ? `this job’s share ${formatLegalMoney(share.amount)}${e.shares.length > 1 ? ` of ${formatLegalMoney(e.claim)} on one paper` : ''}` : null,
    rows,
    href: e.documentUrl || null,
  }
}

/** The suit’s filing checklist: the notices, the affidavit, its service, the agreement, the sworn account and the property record, lettered in that order. */
export function lienSuitChecklist(packet: Pick<LegalPacket, 'account' | 'paper'>, jobId: string, steps: ReadonlyArray<LienTimelineStep>): LienStopChecklistRow[] {
  const job = packet.account.jobs.find((j) => j.jobId === jobId)
  const mine = packet.paper.envelopes.filter((e) => e.shares.some((s) => s.jobId === jobId))
  const rows: LienStopChecklistRow[] = []
  const notices = mine.filter((e) => e.kind === 'notice_53_056' && !e.letterTwo)
  if (notices.length) {
    for (const e of notices) rows.push({ key: `notice:${e.key}`, letter: '', title: '§ 53.056 notice', detail: `${e.months.map((m) => m.label).join(', ')} · mailed ${dayWords(e.wentOutYmd)}${e.sends.length ? `, ${[...new Set(e.sends.map((s) => s.methodLabel))].join(', ')}` : ''}`, status: 'on_file', statusWords: 'as mailed' })
  } else {
    const notRequired = steps.find((s) => s.kind === 'notice' && s.state === 'done' && /not required/.test(s.words))
    const open = steps.filter((s) => s.kind === 'notice' && s.state !== 'done')
    rows.push(notRequired
      ? { key: 'notice', letter: '', title: '§ 53.056 notice', detail: notRequired.words, status: 'not_needed', statusWords: 'not needed' }
      : { key: 'notice', letter: '', title: '§ 53.056 notice', detail: open.length ? `none mailed yet · ${open.map((s) => s.label.replace('§ 53.056 · ', '')).join(', ')} ${open.length === 1 ? 'is' : 'are'} on the office’s path` : 'none mailed', status: 'not_on_file', statusWords: 'not on file' })
  }
  const aff = mine.find((e) => e.kind === 'affidavit')
  const affStep = steps.find((s) => s.kind === 'affidavit')
  rows.push(aff?.filedYmd
    ? { key: 'affidavit', letter: '', title: 'Affidavit of lien', detail: `filed ${dayWords(aff.filedYmd)}${aff.county ? ` · ${aff.county} County` : ''}${aff.recordingNumber ? ` · No. ${aff.recordingNumber}` : ''}`, status: 'on_file', statusWords: 'filed' }
    : affStep?.state === 'missed'
      ? { key: 'affidavit', letter: '', title: 'Affidavit of lien', detail: `the window closed ${affStep.dateWords} with nothing filed · the lien is gone, the money is still owed`, status: 'not_on_file', statusWords: 'window closed' }
      : { key: 'affidavit', letter: '', title: 'Affidavit of lien', detail: `not filed yet${affStep?.dateWords && affStep.dateWords !== '—' ? ` · the office’s day is ${affStep.dateWords}` : ''}${affStep?.opensWords ? ` · ${affStep.opensWords}` : ''}`, status: 'not_on_file', statusWords: 'not on file' })
  rows.push(aff?.servedYmd
    ? { key: 'serve', letter: '', title: 'Proof of service of the affidavit', detail: `served ${dayWords(aff.servedYmd)} on the owner and the original contractor`, status: 'on_file', statusWords: 'served' }
    : { key: 'serve', letter: '', title: 'Proof of service of the affidavit', detail: aff?.filedYmd ? `not served yet${aff.serveDueYmd ? ` · due ${dayWords(aff.serveDueYmd)}` : ''}` : 'a copy to the owner and the original contractor within five days of filing', status: 'not_on_file', statusWords: 'not on file' })
  if (job) {
    const a = firmAgreementWords(job.contract)
    rows.push({ key: 'agreement', letter: '', title: 'The agreement', detail: a.words, status: a.missing ? 'not_on_file' : 'on_file', statusWords: a.missing ? 'not on file' : 'on file' })
    rows.push(job.swornMissing.length
      ? { key: 'sworn', letter: '', title: 'Sworn account', detail: `needs ${job.swornMissing.join(', ')}`, status: 'not_on_file', statusWords: 'not on file' }
      : { key: 'sworn', letter: '', title: 'Sworn account', detail: `the bills, the pay page and the ledger · ${formatLegalMoney(job.balance)} open${job.agingDays != null ? `, ${job.agingDays} days` : ''}`, status: 'on_file', statusWords: 'holds' })
    const p = job.property
    const missing = [!p.owner ? 'the owner of record' : '', !p.legalDescription ? 'the legal description' : '', !p.county ? 'the county' : ''].filter(Boolean)
    rows.push(missing.length
      ? { key: 'property', letter: '', title: 'Property record', detail: `missing ${missing.join(', ')}`, status: 'not_on_file', statusWords: 'not on file' }
      : { key: 'property', letter: '', title: 'Property record', detail: `owner of record ${p.owner} · legal description on file · ${p.county} County`, status: 'on_file', statusWords: 'on file' })
  }
  return rows.map((r, i) => ({ ...r, letter: String.fromCharCode(65 + i) }))
}

function moveWords(step: LienTimelineStep): string {
  if (step.state === 'done') return `${step.move ? lienMoveWords(step.move).toUpperCase() : 'OURS'} · DONE`
  if (step.state === 'missed') return 'MISSED'
  return step.move ? (step.move === 'ours' ? 'OURS' : lienMoveWords(step.move).toUpperCase()) : 'OURS'
}

function titleFor(step: LienTimelineStep, e: LegalEnvelope | null): string {
  switch (step.kind) {
    case 'last_work':
      return 'The last day of work'
    case 'notice':
      return e ? `The ${e.months.map((m) => m.label).join(' and ')} notice, as mailed` : step.monthKey ? `The ${workMonthLabel(step.monthKey)} notice` : 'The § 53.056 notice'
    case 'retainage':
      return e ? 'The retainage notice, as mailed' : 'The § 53.057 retainage notice'
    case 'affidavit':
      return e?.filedYmd ? 'The affidavit of lien, as filed' : 'The affidavit of lien'
    case 'serve':
      return 'Service of the affidavit'
    case 'hold':
      return 'The owner’s 10 % hold'
    case 'suit':
      return 'Suit to foreclose the lien'
    case 'release':
      return 'The release of record'
    case 'demand':
      return 'The demand letter'
  }
}

function lineFor(step: LienTimelineStep, e: LegalEnvelope | null): string {
  const standing = [step.opensWords || '', step.dateWords && step.dateWords !== '—' ? step.dateWords : '', step.words || ''].filter(Boolean).join(' · ')
  if (step.kind === 'notice' && e?.wentOutYmd) return `Mailed ${dayWords(e.wentOutYmd)}${step.date ? `; its day was ${demandDate(step.date)}` : ''}.${e.months.length > 1 ? ' Both months went on one notice.' : ''}`
  if (step.kind === 'suit') return `The lien lapses ${step.date ? demandDate(step.date) : step.dateWords}. ${step.words ? step.words.charAt(0).toUpperCase() + step.words.slice(1) + '.' : ''}`.trim()
  return standing
}

export function lienStopCounselView({ step, steps, packet, jobId, voice }: LienStopCounselInput): LienStopCounselView {
  const job = packet.account.jobs.find((j) => j.jobId === jobId)
  const e = envelopeForStop(step, packet.paper.envelopes, jobId)
  const kind = lienStopPaperKind(step)
  const cards: LienStopRecordCard[] = e ? [envelopeRecordCard(e, job, jobId, voice)] : []
  const i = steps.findIndex((s) => s.key === step.key)
  const next = i >= 0 ? steps[i + 1] : undefined
  const follows = next ? `${next.label}${next.dateWords && next.dateWords !== '—' ? ` · ${next.dateWords}` : ''}${next.words ? ` · ${next.words}` : ''}` : null
  const checklist = step.kind === 'suit' ? lienSuitChecklist(packet, jobId, steps) : null
  const notOn = checklist ? checklist.filter((r) => r.status === 'not_on_file').length : 0
  const checklistNote = checklist ? (notOn ? `${notOn} of ${checklist.length} ${notOn === 1 ? 'is' : 'are'} not on file yet. The list is the one the packet prints as exhibits.` : 'Every line is on file. The list is the one the packet prints as exhibits.') : null
  const venue = step.kind === 'suit' && job ? `${lienForeclosureLine([job.property.county])} The money claim alone: ${courtWords({ county: job.property.county, precinct: job.property.precinctNote || job.property.precinct || null })}.` : null
  const title = titleFor(step, e)
  const line = lineFor(step, e)
  const does = kind === 'none' ? null : (DOES[step.kind] ?? null)
  const rule = RULES[step.kind]
  const move = moveWords(step)
  const text = [
    `${step.label} — ${title}`,
    line,
    '',
    ...cards.flatMap((c) => [`${c.title}${c.sub ? ` · ${c.sub}` : ''}`, ...c.rows.map(([k, v]) => `  ${k}: ${v}`), '']),
    ...(checklist ? [`What the filing needs`, ...checklist.map((r) => `  ${r.letter}. ${r.title} — ${r.detail} [${r.statusWords}]`), ''] : []),
    ...(does ? [does, ''] : []),
    `Rule: ${rule}`,
    ...(follows ? [`Then: ${follows}`] : []),
    ...(venue ? [`Venue: ${venue}`] : []),
  ].join('\n').trim()
  return { title, line, cards, checklist, checklistNote, does, rule, follows, venue, move, text }
}
