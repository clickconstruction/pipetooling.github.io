/**
 * What goes to the firm behind the packet (v2.5761): each exhibit as the firm's own packet letters it
 * (`exhibitHome`, one rule for both sides), with a few plain lines of what is inside and the desk tab that holds
 * the full rows. The desk draws these as folds under Fees & steps.
 */
import { exhibitHome } from './legalFirmPacketPrint'
import { formatLegalMoney, type LegalPacket } from './legalPacket'

export type ExhibitTab = 'account' | 'paper' | 'their_word' | 'evidence'
export type ExhibitDetail = {
  letter: string
  title: string
  count: number
  /** The firm's section, e.g. `A · Statement of account`. */
  section: string
  tab: ExhibitTab
  /** A few lines of what is inside, oldest first; `more` is what the lines leave out. */
  lines: string[]
  more: number
}

export type ExhibitSource = {
  exhibits: LegalPacket['exhibits']
  account: { ledger: ReadonlyArray<Pick<LegalPacket['account']['ledger'][number], 'ymd' | 'jobLabel' | 'kind' | 'text' | 'amount'>>; properties: ReadonlyArray<{ address: string; owner: string; source: string }> }
  paper: {
    agreements: ReadonlyArray<{ jobLabel: string; coverage: { kind: string; signerName?: string | null; source?: string } }>
    demandLetters: ReadonlyArray<Pick<LegalPacket['paper']['demandLetters'][number], 'jobLabel' | 'sentYmd' | 'method' | 'tracking' | 'amount'>>
    lienFilings: ReadonlyArray<Pick<LegalPacket['paper']['lienFilings'][number], 'jobLabel' | 'kind' | 'filedYmd' | 'wentOutYmd' | 'county'>>
  }
  theirWord: { timeline: ReadonlyArray<Pick<LegalPacket['theirWord']['timeline'][number], 'ymd' | 'text' | 'shared' | 'jobLabel'>> }
  evidence: ReadonlyArray<Pick<LegalPacket['evidence'][number], 'jobLabel' | 'reports' | 'sessions' | 'hours'>>
}

export const EXHIBIT_LINES_SHOWN = 6

const day = (ymd: string | null | undefined): string => (ymd && ymd.length >= 10 ? `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}/${ymd.slice(2, 4)}` : '—')

function tabFor(title: string): ExhibitTab {
  const t = title.toLowerCase()
  if (t.startsWith('what was said')) return 'their_word'
  if (t.startsWith('field reports')) return 'evidence'
  if (t.startsWith('signed agreements') || t.startsWith('final demand') || t.startsWith('lien notices')) return 'paper'
  return 'account'
}

function linesFor(title: string, p: ExhibitSource): string[] {
  const t = title.toLowerCase()
  if (t.startsWith('invoices')) return p.account.ledger.map((e) => `${day(e.ymd)} · ${e.jobLabel} · ${e.text} · ${formatLegalMoney(Math.abs(e.amount))}`)
  if (t.startsWith('property')) return p.account.properties.filter((x) => x.source !== 'job_address').map((x) => `${x.address}${x.owner ? ` · owner ${x.owner}` : ''}`)
  if (t.startsWith('signed agreements')) return p.paper.agreements.filter((a) => a.coverage.kind === 'signed').map((a) => `${a.jobLabel} · signed${a.coverage.signerName ? ` by ${a.coverage.signerName}` : ''}${a.coverage.source ? ` (${a.coverage.source})` : ''}`)
  if (t.startsWith('final demand')) return p.paper.demandLetters.filter((d) => d.sentYmd).map((d) => `${day(d.sentYmd)} · ${d.jobLabel} · ${d.method}${d.tracking ? ` · ${d.tracking}` : ''} · ${formatLegalMoney(d.amount)}`)
  if (t.startsWith('lien notices')) return p.paper.lienFilings.map((f) => `${day(f.filedYmd ?? f.wentOutYmd)} · ${f.jobLabel} · ${f.kind}${f.filedYmd ? ' filed' : ''}${f.county ? ` · ${f.county}` : ''}`)
  if (t.startsWith('what was said')) return p.theirWord.timeline.filter((e) => e.shared).map((e) => `${day(e.ymd)}${e.jobLabel ? ` · ${e.jobLabel}` : ''} · ${e.text}`)
  if (t.startsWith('field reports')) return p.evidence.filter((e) => e.reports + e.sessions > 0).map((e) => `${e.jobLabel} · ${e.reports} report${e.reports === 1 ? '' : 's'} · ${e.sessions} clock session${e.sessions === 1 ? '' : 's'}${e.hours ? ` · ${Math.round(e.hours)} h` : ''}`)
  return []
}

/** In the firm's order: by section letter, the packet's own order within a letter (so the two A exhibits sit together). */
export function exhibitDetails(p: ExhibitSource): ExhibitDetail[] {
  return p.exhibits
    .map((x, i) => {
      const all = linesFor(x.title, p)
      return { i, d: { letter: x.letter, title: x.title, count: x.count, section: exhibitHome(x.title) || x.letter, tab: tabFor(x.title), lines: all.slice(0, EXHIBIT_LINES_SHOWN), more: Math.max(0, all.length - EXHIBIT_LINES_SHOWN) } }
    })
    .sort((a, b) => a.d.section.charCodeAt(0) - b.d.section.charCodeAt(0) || a.i - b.i)
    .map((x) => x.d)
}

/** The one line over the folds: how much goes, in how many exhibits. */
export function exhibitsSummaryWords(details: ReadonlyArray<Pick<ExhibitDetail, 'count'>>): string {
  if (details.length === 0) return 'Nothing goes with the packet yet. The exhibits fill as bills, papers, contacts and field evidence land.'
  const records = details.reduce((s, d) => s + d.count, 0)
  return `${records} record${records === 1 ? ' goes' : 's go'} with the packet, in ${details.length} exhibit${details.length === 1 ? '' : 's'}, lettered the way the firm's packet letters them. Open one to see what is in it. The tabs above hold every row.`
}
