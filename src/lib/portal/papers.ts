/**
 * Messages, cut 8 (the portals): the customer's Papers tab, and what the office reads back about the page, lifted from
 * the Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178: `portalPapersHtml`,
 * `portalWords`; shape B, v1.162).
 *
 * Papers: *Signed*, each with its day and a copy to read; *Waiting on you* in orange with its presses; *Comes later*,
 * so the page never looks empty. Changed from the prototype: every name and day is in their language (the master
 * agreement read English on the Spanish page); the contract waiting on them says its sign-by day rather than the
 * office's history line; the contract takes *Read and sign* only, since main's portal declines only change orders;
 * *Comes later* drops a kind once one has come, so a job with three paid applications no longer promises them later.
 *
 * The read-back (`portalWords`) is the office's, in English: when they last opened the page, and for each paper we
 * sent whether they opened it. Helpers read it for the thread header's portal pill, the step card's *So far*, Follow
 * up's two portal rows and By company's Portal column. Changed from the prototype: a view belongs to one paper by its
 * id, so with two change orders out the office can tell which one was opened, and the last open is the time main's
 * `customer-portal` already counts (`OfficeViewStats.lastOpenedAt`). Pure.
 */

import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { weekdayDate } from '../gc/words'
import { openChanges, signedChanges, type CustomerChange } from './moneyLines'
import { changeAmount, changeDays, CODE_WORDS, pWeekday, signedMoney, typed, type PageWords, type PortalLang } from './pageWords'

/** Our contract on the job as their page has it (main's `PortalGcContract`, its day and signer only). */
export type CustomerContract = { state: 'toSign'; signBy: string } | { state: 'signed'; signedOn: string; signer: string | null }

export interface CustomerPapersIn {
  /** The master agreement, once signed. Only a repeat customer signs one. */
  agreement: { signedOn: string } | null
  contract: CustomerContract | null
  changes: CustomerChange[]
  /** What has come so far, for *Comes later*. */
  arrived: { payApps: number; waivers: number; binder: boolean }
}

export interface SignedPaperRow {
  title: string
  /** What it is, for a change order. */
  detail: string | null
  /** "signed Sat Sep 19", then the signer or the amount. */
  sub: string[]
  read: string
}

export interface WaitingPaperRow {
  title: string
  detail: string | null
  sub: string[]
  changeId: string | null
  buttons: { label: string; primary: boolean; press: 'sign' | 'signChange' | 'declineChange' }[]
}

export interface CustomerPapers {
  signed: { title: string; rows: SignedPaperRow[]; empty: string | null }
  waiting: { title: string; rows: WaitingPaperRow[] } | null
  later: { title: string; rows: { title: string; when: string }[] } | null
  footer: string
}

export function customerPapers(lang: PortalLang, input: CustomerPapersIn, words: PageWords = CODE_WORDS): CustomerPapers {
  const read = words.say(lang, 'readCopy')
  const signed: SignedPaperRow[] = []
  if (input.agreement) {
    signed.push({ title: words.paper(lang, 'msa').label, detail: null, sub: [words.say(lang, 'signedOn', { day: pWeekday(lang, input.agreement.signedOn) })], read })
  }
  if (input.contract?.state === 'signed') {
    const sub = [words.say(lang, 'signedOn', { day: pWeekday(lang, input.contract.signedOn) })]
    if (input.contract.signer) sub.push(input.contract.signer)
    signed.push({ title: words.paper(lang, 'contract').label, detail: null, sub, read })
  }
  for (const x of signedChanges(input.changes)) {
    const sub = x.signedOn ? [words.say(lang, 'signedOn', { day: pWeekday(lang, x.signedOn) })] : []
    sub.push(signedMoney(x.price))
    signed.push({ title: words.say(lang, 'changeOrderN', { n: x.number }), detail: typed(lang, x.description) || null, sub, read })
  }

  const waiting: WaitingPaperRow[] = []
  if (input.contract?.state === 'toSign') {
    waiting.push({
      title: words.paper(lang, 'contract').label,
      detail: null,
      sub: [words.say(lang, 'signBy', { day: pWeekday(lang, input.contract.signBy) })],
      changeId: null,
      buttons: [{ label: words.say(lang, 'readAndSign'), primary: true, press: 'sign' }],
    })
  }
  for (const x of openChanges(input.changes)) {
    waiting.push({
      title: words.say(lang, 'changeOrderN', { n: x.number }),
      detail: typed(lang, x.description) || null,
      sub: [changeAmount(lang, x.price, words), changeDays(lang, x.days, words)],
      changeId: x.id,
      buttons: [
        { label: words.say(lang, 'readAndSign'), primary: true, press: 'signChange' },
        { label: words.say(lang, 'decline'), primary: false, press: 'declineChange' },
      ],
    })
  }

  const later: { title: string; when: string }[] = []
  if (input.arrived.payApps === 0) later.push({ title: words.say(lang, 'laterPayApps'), when: words.say(lang, 'laterPayAppsWhen') })
  if (input.arrived.waivers === 0) later.push({ title: words.say(lang, 'laterWaivers'), when: words.say(lang, 'laterWaiversWhen') })
  if (!input.arrived.binder) later.push({ title: words.say(lang, 'laterBinder'), when: words.say(lang, 'laterBinderWhen') })

  return {
    signed: { title: words.say(lang, 'signedTitle'), rows: signed, empty: signed.length ? null : words.say(lang, 'nothingYetShort') },
    waiting: waiting.length ? { title: words.say(lang, 'waitingOnYou'), rows: waiting } : null,
    later: later.length ? { title: words.say(lang, 'comesLater'), rows: later } : null,
    footer: words.say(lang, 'everyPaper'),
  }
}

/**
 * A paper of ours that went to them through the page, and when they first opened it there (`public_page_views` keyed
 * by the paper's id). One shape for every reader: the read-back below, the step card's *So far*, Follow up's portal
 * rows (a paper two days out and not answered: never opened, or opened and left) and By company's Portal column.
 */
export interface PaperView {
  id: string
  kind: 'contract' | 'changeOrder' | 'payApp'
  /** The office's name for it, as a row title: "Our contract", "Change order 2", "Pay application 4". */
  title: string
  /** What it is, for a change order: "a sink in exam 3". */
  detail: string | null
  sentAt: string
  /** Signed or declined. A pay application is never answered here; it is paid. */
  answered: boolean
  viewedAt: string | null
  /** The job it went on, when the reader knows it. */
  jobId?: string
}

/** The paper's name inside a sentence: "the contract", "change order 2", "the pay application". */
export function paperViewLabel(p: PaperView): string {
  if (p.kind === 'contract') return 'the contract'
  if (p.kind === 'payApp') return 'the pay application'
  return p.title.replace(/^./, (c) => c.toLowerCase())
}

export interface PortalReadBack {
  /** "opened Tue Sep 29 9:14 AM", then one piece per paper. */
  words: string[]
  /** The papers they have not opened, for the pill's "2 unopened". */
  unopened: number
}

const clock = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' })

/** "Tue Sep 29 9:14 AM", in the office's time zone. Some ICU builds put a narrow space before AM; it reads as a space. */
export function openedAtWords(iso: string): string {
  return `${weekdayDate(calendarYmdInAppTzFromIso(iso))} ${clock.format(new Date(iso)).replace(/\s+/g, ' ')}`
}

/**
 * What the office reads back about a customer's page: null when they never opened it (everything we sent still went by
 * email). A contract or a pay application they opened reads "read the …"; a change order reads "opened change order 2".
 * A change order they answered drops out; the contract stays, signed or not, as the prototype's pill had it.
 */
export function portalWords(lastOpenedAt: string | null, papers: PaperView[]): PortalReadBack | null {
  if (!lastOpenedAt) return null
  const words = [`opened ${openedAtWords(lastOpenedAt)}`]
  let unopened = 0
  for (const p of papers) {
    if (p.kind === 'changeOrder' && p.answered) continue
    const label = paperViewLabel(p)
    if (!p.viewedAt) {
      unopened++
      words.push(`has not opened ${label}`)
    } else words.push(p.kind === 'changeOrder' ? `opened ${label}` : `read ${label}`)
  }
  return { words, unopened }
}

/** A paper sent to a customer, as `customer_portal_papers` reads it for the office: its non-money half, never a dollar. */
export interface CustomerPaperRow {
  customer_id: string
  project_id: string
  job: string
  paper_kind: 'contract' | 'change_order' | 'pay_app'
  paper_id: string
  number: number | null
  description: string | null
  sent_on: string
  answered: boolean
  first_opened_at: string | null
}

/** A customer's page as `customer_portal_views` reads it: its row with no paper. */
export interface CustomerPageViewRow {
  customer_id: string
  paper_kind: string | null
  last_opened_at: string
  opens: number
}

/** What the office reads back about one customer's page: the last open of the page, and every paper sent. */
export interface CustomerReadBack {
  lastOpenedAt: string | null
  opens: number
  papers: PaperView[]
}

const PAPER_ORDER: Record<PaperView['kind'], number> = { contract: 0, changeOrder: 1, payApp: 2 }

function paperViewOf(r: CustomerPaperRow): PaperView {
  const base = { id: r.paper_id, sentAt: r.sent_on, answered: r.answered, viewedAt: r.first_opened_at, jobId: r.project_id }
  if (r.paper_kind === 'contract') return { ...base, kind: 'contract', title: 'Our contract', detail: r.job }
  if (r.paper_kind === 'change_order') return { ...base, kind: 'changeOrder', title: `Change order ${r.number ?? ''}`.trim(), detail: r.description }
  return { ...base, kind: 'payApp', title: `Pay application ${r.number ?? ''}`.trim(), detail: r.job }
}

/**
 * The read-back for each customer named: the page's last outside open and every paper sent, contract first, then
 * change orders, then pay applications, each in the order it went. A customer with no opens and no papers still has
 * an entry, so a row can say "never opened".
 */
export function customerPaperViews(customerIds: readonly string[], papers: readonly CustomerPaperRow[], pages: readonly CustomerPageViewRow[]): Map<string, CustomerReadBack> {
  const out = new Map<string, CustomerReadBack>()
  for (const id of customerIds) out.set(id, { lastOpenedAt: null, opens: 0, papers: [] })
  for (const page of pages) {
    if (page.paper_kind !== null) continue
    const entry = out.get(page.customer_id)
    if (entry) {
      entry.lastOpenedAt = page.last_opened_at
      entry.opens = page.opens
    }
  }
  for (const row of papers) out.get(row.customer_id)?.papers.push(paperViewOf(row))
  for (const entry of out.values()) {
    entry.papers.sort((a, b) => PAPER_ORDER[a.kind] - PAPER_ORDER[b.kind] || (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0))
  }
  return out
}

/**
 * The papers the portal pill names, as the prototype's did: our contract on each job, each change order still waiting
 * on them, and the newest pay application on each job. `portalWords(lastOpenedAt, pillPapers(papers))` words the pill.
 */
export function pillPapers(papers: readonly PaperView[]): PaperView[] {
  const newestPayApp = new Map<string, PaperView>()
  for (const p of papers) {
    if (p.kind !== 'payApp') continue
    const key = p.jobId ?? ''
    const held = newestPayApp.get(key)
    if (!held || p.sentAt > held.sentAt) newestPayApp.set(key, p)
  }
  return papers.filter((p) => p.kind === 'contract' || (p.kind === 'changeOrder' && !p.answered) || newestPayApp.get(p.jobId ?? '') === p)
}

/** Follow up's portal rows read these: a paper we sent that waits on their signature (never a pay application). */
export function papersWaitingOnThem(papers: readonly PaperView[]): PaperView[] {
  return papers.filter((p) => !p.answered && p.kind !== 'payApp')
}
