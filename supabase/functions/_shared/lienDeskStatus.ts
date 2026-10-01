/**
 * Where the liens stand (v2.4311): the Lien desk's Share. Who we are about to lien, for how
 * much, and by when, said once and rendered three ways: the text the share sheet sends, the
 * team email's HTML, and its plain twin.
 *
 * The browser builds the payload from the desk (`src/lib/jobs/lienDeskShare.ts`), shows the
 * text and previews the email with these renderers; `send-lien-desk-summary` parses the same
 * payload with `parseLienStatusPayload` and renders the same email on the server, so nothing
 * the browser typed reaches an inbox as HTML. Words follow `src/lib/plainWords.ts`: short
 * sentences, none with a dash, a semicolon or parentheses inside it.
 *
 * Pure: no Deno, no DOM. Email-safe markup: inline-styled tables, light colors only.
 */

import { APP_CALENDAR_TZ } from './appTimeZone.ts'

/** Where a notice stands on the desk: the five piles a notice sits in before it is mailed. */
export type LienStatusWhere = 'owner' | 'draft' | 'approval' | 'ready' | 'held'

export type LienStatusJob = {
  /** `jobs_ledger.id`; a one-GC message opens the desk on its first job. */
  jobId: string
  /** "878": the ledger number as the desk prints it. */
  number: string
  name: string
  /** The GC's name. Every job on the notice desk has one. */
  gc: string
  /** The months the notice names, 'YYYY-MM'. */
  months: string[]
  owed: number
  where: LienStatusWhere
  /** The earliest open § 53.056 deadline, 'YYYY-MM-DD'; '' when none is open. */
  byYmd: string
  /** Waiting for approval since, 'YYYY-MM-DD'; '' otherwise. */
  sinceYmd: string
}

/** What a § 53.052 affidavit still needs before it can be filed (the Affidavits tab's gates). */
export type LienStatusNeed = 'owner' | 'legal' | 'notice' | 'homestead'

export type LienStatusLien = {
  number: string
  name: string
  /** The GC's name; '' when we contracted with the owner. */
  gc: string
  owed: number
  /** The affidavit's last day, 'YYYY-MM-DD'; '' when unknown. */
  byYmd: string
  needs: LienStatusNeed[]
}

export type LienStatusPayload = {
  v: 1
  /** When the numbers were read: an ISO instant. */
  asOf: string
  /** Today in the app calendar, 'YYYY-MM-DD': the day counts are counted from it. */
  todayYmd: string
  /** null = the whole desk; else the one GC the message is about. */
  gc: string | null
  /** Every notice not yet mailed, in any order (the renderers sort). */
  jobs: LienStatusJob[]
  /** Affidavits still to file inside their window. */
  liens: LienStatusLien[]
  /** Jobs whose property kind is not set: their dates may come a month sooner. */
  kindsUnset: number
  /** Mailed notices whose certified tracking number is still owed. */
  trackingOwed: number
  /** Jobs whose lien window closed with nothing sent (the Calendar's Lien gone). */
  pastWindow: { jobs: number; owed: number }
  /** § 53.057 retainage notices still to send: the jobs, the retainage they hold, the first deadline. */
  retainage: { jobs: number; held: number; firstYmd: string }
}

/** How far ahead the notice desk lists a notice (the desk's LIEN_DESK_LEAD_DAYS). */
export const LIEN_STATUS_LEAD_DAYS = 30

/** The most a note on top of the email may hold. */
export const LIEN_STATUS_NOTE_MAX = 280

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const WHERE_WORDS: Record<LienStatusWhere, string> = {
  owner: 'needs the owner of record',
  draft: 'to draft',
  approval: 'waiting for approval',
  ready: 'approved for the next run',
  held: 'held for now',
}

function ymdMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** 'Oct 15' from '2026-10-15'; '' when malformed. */
export function lienStatusMonthDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ''
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`
}

function daysFrom(todayYmd: string, ymd: string): number | null {
  const a = ymdMs(todayYmd)
  const b = ymdMs(ymd)
  if (a == null || b == null) return null
  return Math.round((b - a) / 86_400_000)
}

/** 'Jul', 'Jul and Aug', 'Jul, Aug and Sep' from 'YYYY-MM' keys. */
export function lienStatusMonthsWords(keys: ReadonlyArray<string>): string {
  const names = [...keys]
    .sort()
    .map((k) => {
      const m = /^\d{4}-(\d{2})$/.exec(k)
      return (m && MONTHS[Number(m[1]) - 1]) || k
    })
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function money(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US')}`
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** 'Wed Oct 1, 2:14 PM' in the app calendar; '' when the instant is malformed. */
export function lienStatusAsOfWords(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ }).replace(',', '')
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
  return `${day}, ${time}`
}

/** 'in 14 days' · 'tomorrow' · 'today'. */
function inDaysWords(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

function byYmdOrder(a: { byYmd: string; owed: number }, b: { byYmd: string; owed: number }): number {
  if (a.byYmd !== b.byYmd) {
    if (!a.byYmd) return 1
    if (!b.byYmd) return -1
    return a.byYmd < b.byYmd ? -1 : 1
  }
  return b.owed - a.owed
}

export type LienStatusGcGroup = { name: string; jobs: LienStatusJob[]; owed: number; firstYmd: string }

/** The notices by GC, most money first; each GC's jobs soonest first, then biggest. */
export function lienStatusGroups(jobs: ReadonlyArray<LienStatusJob>): LienStatusGcGroup[] {
  const by = new Map<string, LienStatusJob[]>()
  for (const j of jobs) {
    const list = by.get(j.gc)
    if (list) list.push(j)
    else by.set(j.gc, [j])
  }
  return [...by.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort(byYmdOrder)
      return {
        name,
        jobs: sorted,
        owed: sorted.reduce((s, j) => s + j.owed, 0),
        firstYmd: sorted.find((j) => j.byYmd)?.byYmd ?? '',
      }
    })
    .sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name))
}

/** The facts every rendering leads with. */
export function lienStatusFacts(p: LienStatusPayload) {
  const owed = p.jobs.reduce((s, j) => s + j.owed, 0)
  const firstYmd = [...p.jobs].map((j) => j.byYmd).filter(Boolean).sort()[0] ?? ''
  const firstDays = firstYmd ? daysFrom(p.todayYmd, firstYmd) : null
  const sameDay = p.jobs.length > 0 && p.jobs.every((j) => j.byYmd === firstYmd)
  const waiting = p.jobs.filter((j) => j.where === 'approval').sort((a, b) => b.owed - a.owed)
  return { owed, firstYmd, firstDays, sameDay, waiting }
}

/** The desk's own link: the desk, or for one GC the desk open on its first job. */
export function lienStatusDeskPath(p: Pick<LienStatusPayload, 'gc' | 'jobs'>): string {
  const base = '/jobs?tab=stages&liendesk=1'
  if (!p.gc) return base
  const first = [...p.jobs].sort(byYmdOrder)[0]
  return first ? `${base}&liendeskJob=${encodeURIComponent(first.jobId)}` : base
}

/** What the link line under the message says. */
export function lienStatusLinkLabel(p: Pick<LienStatusPayload, 'gc' | 'jobs'>): string {
  const first = p.gc ? [...p.jobs].sort(byYmdOrder)[0] : null
  return first ? `Open the Lien desk on job ${first.number}:` : 'Open the Lien desk:'
}

export function lienStatusSubject(p: LienStatusPayload): string {
  const today = lienStatusMonthDay(p.todayYmd)
  const lead = p.gc ? `${p.gc} liens, ${today}` : `Liens, ${today}`
  if (p.jobs.length === 0) return `${lead}: no notice due in the next ${LIEN_STATUS_LEAD_DAYS} days`
  const f = lienStatusFacts(p)
  return `${lead}: ${count(p.jobs.length, 'notice', 'notices')} due, ${money(f.owed)}${f.firstYmd ? `, first by ${lienStatusMonthDay(f.firstYmd)}` : ''}`
}

/** The headline sentences: what we are about to do, the money, and the first date. */
function headline(p: LienStatusPayload): string[] {
  const n = p.jobs.length
  const f = lienStatusFacts(p)
  if (n === 0) return [p.gc ? `No lien notice is due on ${p.gc} jobs in the next ${LIEN_STATUS_LEAD_DAYS} days.` : `No lien notice is due in the next ${LIEN_STATUS_LEAD_DAYS} days.`]
  const whose = p.gc ? `${p.gc} ` : ''
  const out = [
    n === 1 ? `We are about to send a lien notice on 1 ${whose}job.` : `We are about to send lien notices on ${n} ${whose}jobs.`,
    `${money(f.owed)} is owed on ${n === 1 ? 'it' : 'them'}.`,
  ]
  if (f.firstYmd && f.firstDays != null) {
    const day = lienStatusMonthDay(f.firstYmd)
    const when = f.firstDays <= 1 ? `${inDaysWords(f.firstDays)}, ${day}` : `by ${day}, ${inDaysWords(f.firstDays)}`
    if (p.gc && f.sameDay) out.push(n === 1 ? `It must be mailed ${when}.` : `All ${n} must be mailed ${when}.`)
    else out.push(`The first must be mailed ${when}.`)
  }
  return out
}

function lienNeedsSentence(l: LienStatusLien): string {
  const fixable = l.needs.filter((k) => k === 'owner' || k === 'legal')
  const parts: string[] = []
  if (fixable.length) parts.push(`It needs ${fixable.map((k) => (k === 'owner' ? 'the owner of record' : 'the legal description')).join(' and ')}.`)
  if (l.needs.includes('notice')) parts.push('No notice was sent for its work month.')
  if (l.needs.includes('homestead')) parts.push('It is a homestead, so counsel decides.')
  return parts.length ? parts.join(' ') : 'It is ready to file.'
}

function liensLine(liens: ReadonlyArray<LienStatusLien>): string {
  if (liens.length === 0) return ''
  const owed = liens.reduce((s, l) => s + l.owed, 0)
  const first = liens.map((l) => l.byYmd).filter(Boolean).sort()[0]
  const ready = liens.filter((l) => l.needs.length === 0).length
  const readyWords =
    ready === 0 ? 'None is ready to file yet.' : ready === liens.length ? (liens.length === 1 ? 'It is ready to file.' : `All ${liens.length} are ready to file.`) : `${ready} ${ready === 1 ? 'is' : 'are'} ready to file.`
  return `Liens to file: ${count(liens.length, 'job', 'jobs')}, ${money(owed)}${first ? `, the first by ${lienStatusMonthDay(first)}` : ''}. ${readyWords}`
}

function retainageLine(p: LienStatusPayload): string {
  const r = p.retainage
  if (!r.jobs) return ''
  return `Retainage notices to send: ${count(r.jobs, 'job', 'jobs')}, ${money(r.held)} held${r.firstYmd ? `, the first by ${lienStatusMonthDay(r.firstYmd)}` : ''}.`
}

function toDoSentences(p: LienStatusPayload): string[] {
  const draft = p.jobs.filter((j) => j.where === 'draft').length
  const owners = p.jobs.filter((j) => j.where === 'owner').length
  const out: string[] = []
  if (draft) out.push(`Draft ${count(draft, 'notice', 'notices')}.`)
  if (owners) out.push(`Find ${count(owners, 'owner', 'owners')} of record.`)
  if (p.kindsUnset) out.push(`Set the property kind on ${count(p.kindsUnset, 'job', 'jobs')}.`)
  if (p.trackingOwed) out.push(`Type the tracking number on ${count(p.trackingOwed, 'mailed notice', 'mailed notices')}.`)
  return out
}

function stillToDoLine(p: LienStatusPayload): string {
  const s = toDoSentences(p)
  if (s.length === 0) return ''
  return `Still to do: ${s[0]![0]!.toLowerCase()}${s[0]!.slice(1)}${s.length > 1 ? ` ${s.slice(1).join(' ')}` : ''}`
}

function jobLine(j: LienStatusJob, firstYmd: string): string {
  const months = lienStatusMonthsWords(j.months)
  const later = j.byYmd && j.byYmd !== firstYmd ? `, mail by ${lienStatusMonthDay(j.byYmd)}` : ''
  return `• ${j.number} ${j.name}${months ? `, ${months}` : ''}, ${money(j.owed)}, ${WHERE_WORDS[j.where]}${later}`
}

function kindsSentence(p: LienStatusPayload): string {
  if (!p.kindsUnset || !p.gc) return ''
  const k = p.kindsUnset
  return `${k} ${p.gc} ${k === 1 ? 'job has' : 'jobs have'} no property kind set. ${k === 1 ? 'If it is a home, its dates come' : 'If any is a home, its dates come'} a month sooner.`
}

function pastWindowSentence(p: LienStatusPayload, gcScope: boolean): string {
  const { jobs, owed } = p.pastWindow
  if (!jobs) return ''
  if (gcScope) return `${count(jobs, 'more job', 'more jobs')} passed ${jobs === 1 ? 'its' : 'their'} lien window. ${money(owed)} is still owed there, with no lien.`
  return `${count(jobs, 'job', 'jobs')} passed ${jobs === 1 ? 'its' : 'their'} lien window. ${money(owed)} is still owed on them. Collections has them.`
}

/** The text the share sheet sends (the link rides beside it as the share's url). */
export function lienStatusText(p: LienStatusPayload): string {
  const L: string[] = [`${p.gc ? `${p.gc} liens` : 'Liens'}, ${lienStatusAsOfWords(p.asOf)}`, '']
  L.push(...headline(p))
  const f = lienStatusFacts(p)
  if (p.gc) {
    if (p.jobs.length) {
      L.push('')
      for (const j of lienStatusGroups(p.jobs).flatMap((g) => g.jobs)) L.push(jobLine(j, f.firstYmd))
    }
    const extra = [kindsSentence(p), liensLine(p.liens), retainageLine(p), pastWindowSentence(p, true)].filter(Boolean)
    if (extra.length) L.push('', ...extra)
  } else {
    if (f.waiting.length) {
      L.push('', 'Waiting for approval:')
      for (const j of f.waiting) L.push(`• ${j.name}, ${j.gc}, ${money(j.owed)}`)
    }
    const ready = p.jobs.filter((j) => j.where === 'ready')
    const held = p.jobs.filter((j) => j.where === 'held')
    if (ready.length || held.length) L.push('')
    if (ready.length) L.push(`Approved for the next run: ${count(ready.length, 'notice', 'notices')}, ${money(ready.reduce((s, j) => s + j.owed, 0))}.`)
    if (held.length) L.push(`Held for now: ${count(held.length, 'notice', 'notices')}, ${money(held.reduce((s, j) => s + j.owed, 0))}.`)
    const groups = lienStatusGroups(p.jobs)
    if (groups.length) {
      L.push('', 'By GC:')
      for (const g of groups.slice(0, 6)) L.push(`• ${g.name}, ${count(g.jobs.length, 'job', 'jobs')}, ${money(g.owed)}`)
      const rest = groups.slice(6)
      if (rest.length) {
        const n = rest.reduce((s, g) => s + g.jobs.length, 0)
        L.push(`• ${count(rest.length, 'more GC', 'more GCs')}, ${count(n, 'job', 'jobs')}, ${money(rest.reduce((s, g) => s + g.owed, 0))}`)
      }
    }
    const extra = [stillToDoLine(p), liensLine(p.liens), retainageLine(p)].filter(Boolean)
    if (extra.length) L.push('', ...extra)
  }
  L.push('', lienStatusLinkLabel(p))
  return L.join('\n')
}

export type LienStatusEmailOptions = {
  /** The app origin the links point at (the function passes APP_ORIGIN; the preview, this page's). */
  appUrl: string
  /** Who sent it: the footer, the note's name, and Reply to. */
  senderName: string
  /** The sender's note on top; '' for none. */
  note?: string
  /** The reader approves notices: "Waiting for your approval". */
  readerIsLeader?: boolean
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function deskUrl(p: LienStatusPayload, appUrl: string): string {
  return `${appUrl.replace(/\/$/, '')}${lienStatusDeskPath(p)}`
}

/** The plain twin of the email. */
export function lienStatusEmailText(p: LienStatusPayload, o: LienStatusEmailOptions): string {
  const f = lienStatusFacts(p)
  const L: string[] = []
  const note = (o.note ?? '').trim()
  if (note) L.push(`${o.senderName} wrote: ${note}`, '')
  L.push(`${p.gc ?? 'Lien desk'}, as of ${lienStatusAsOfWords(p.asOf)}`, '', ...headline(p))
  if (f.waiting.length) {
    L.push('', o.readerIsLeader ? 'Waiting for your approval:' : 'Waiting for approval:')
    for (const j of f.waiting) L.push(`• ${j.number} ${j.name}, ${j.gc}, ${lienStatusMonthsWords(j.months)}, ${money(j.owed)}${j.sinceYmd ? `, since ${lienStatusMonthDay(j.sinceYmd)}` : ''}`)
  }
  const groups = lienStatusGroups(p.jobs)
  if (groups.length) {
    L.push('', 'By GC:')
    for (const g of groups) {
      L.push(`${g.name}, ${count(g.jobs.length, 'job', 'jobs')}, ${money(g.owed)}${g.firstYmd ? `, first by ${lienStatusMonthDay(g.firstYmd)}` : ''}`)
      for (const j of g.jobs) L.push(`  ${jobLine(j, g.firstYmd)}`)
    }
  }
  if (p.liens.length) {
    L.push('', liensLine(p.liens))
    for (const l of p.liens) L.push(`• ${l.number} ${l.name}, ${money(l.owed)}. ${l.gc ? '' : 'We contracted with the owner. '}${lienNeedsSentence(l)}`)
  }
  const ret = retainageLine(p)
  if (ret) L.push('', ret)
  const todo = toDoSentences(p)
  const kinds = kindsSentence(p)
  if (todo.length || kinds) L.push('', 'Still to do:', ...todo.map((s) => `• ${s}`), ...(kinds ? [kinds] : []))
  const past = pastWindowSentence(p, Boolean(p.gc))
  if (past) L.push('', past)
  L.push('', `Open the Lien desk: ${deskUrl(p, o.appUrl)}`, '', `${o.senderName} sent this from the Lien desk in ClickTooling. Reply to write back to ${o.senderName}. These numbers are from ${lienStatusAsOfWords(p.asOf)}. The desk always has today’s.`)
  return L.join('\n')
}

const INK = '#1c1917'
const MUTED = '#57534e'
const FAINT = '#a8a29e'
const RULE = '#e7e5e4'
const ROW_RULE = '#f0efee'

function tile(value: string, label: string, tone: 'plain' | 'amber' | 'blue'): string {
  const c = tone === 'amber' ? { bg: '#fffbeb', border: '#fcd34d', ink: '#92400e' } : tone === 'blue' ? { bg: '#eff6ff', border: '#93c5fd', ink: '#1e40af' } : { bg: '#ffffff', border: RULE, ink: INK }
  return `<td width="33%" style="padding:0 4px;vertical-align:top;"><div style="background:${c.bg};border:1px solid ${c.border};border-radius:8px;padding:10px 12px;">
    <div style="font-size:19px;font-weight:bold;color:${c.ink};">${esc(value)}</div>
    <div style="font-size:12px;color:${tone === 'plain' ? MUTED : c.ink};">${esc(label)}</div>
  </div></td>`
}

function sectionTitle(text: string): string {
  return `<div style="font-size:15px;font-weight:bold;color:${INK};margin:22px 0 6px;">${esc(text)}</div>`
}

/** The email's HTML: the same facts as the text, with every job under its GC. */
export function lienStatusEmailHtml(p: LienStatusPayload, o: LienStatusEmailOptions): string {
  const f = lienStatusFacts(p)
  const note = (o.note ?? '').trim()
  const url = esc(deskUrl(p, o.appUrl))
  const groups = lienStatusGroups(p.jobs)
  const tiles = p.jobs.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:14px 0 0;"><tr>
        ${tile(money(f.owed), p.jobs.length === 1 ? 'owed on that job' : 'owed on those jobs', 'plain')}
        ${f.firstYmd && f.firstDays != null ? tile(lienStatusMonthDay(f.firstYmd), `first mail-by date, ${inDaysWords(f.firstDays)}`, 'amber') : tile('—', 'no mail-by date open', 'plain')}
        ${tile(f.waiting.length ? `${f.waiting.length} · ${money(f.waiting.reduce((s, j) => s + j.owed, 0))}` : '0', o.readerIsLeader ? 'wait for your approval' : 'wait for approval', f.waiting.length ? 'blue' : 'plain')}
      </tr></table>`
    : ''
  const waiting = f.waiting.length
    ? `${sectionTitle(o.readerIsLeader ? 'Waiting for your approval' : 'Waiting for approval')}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid ${RULE};">
        ${f.waiting
          .map(
            (j) => `<tr>
          <td style="padding:8px 10px;border-top:1px solid ${RULE};font-size:13px;color:${INK};"><b>${esc(j.number)} ${esc(j.name)}</b><div style="font-size:12px;color:${MUTED};">${esc(j.gc)}${j.months.length ? ` &middot; ${esc(lienStatusMonthsWords(j.months))} work` : ''}</div></td>
          <td style="padding:8px 10px;border-top:1px solid ${RULE};font-size:13px;text-align:right;font-weight:bold;white-space:nowrap;color:${INK};">${money(j.owed)}</td>
          <td style="padding:8px 10px;border-top:1px solid ${RULE};font-size:12px;color:${MUTED};white-space:nowrap;">${j.sinceYmd ? `since ${esc(lienStatusMonthDay(j.sinceYmd))}` : ''}</td>
        </tr>`,
          )
          .join('')}
      </table>`
    : ''
  const byGc = groups.length
    ? `${sectionTitle('By GC')}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid ${RULE};">
        ${groups
          .map(
            (g) => `<tr>
          <td style="padding:8px 10px;background:#fafaf9;border-top:1px solid ${RULE};font-size:13px;color:${INK};"><b>${esc(g.name)}</b> <span style="font-size:12px;color:${MUTED};">${esc(count(g.jobs.length, 'job', 'jobs'))}${g.firstYmd ? ` &middot; ${g.jobs.every((j) => j.byYmd === g.firstYmd) ? 'mail by' : 'first by'} ${esc(lienStatusMonthDay(g.firstYmd))}` : ''}</span></td>
          <td style="padding:8px 10px;background:#fafaf9;border-top:1px solid ${RULE};font-size:13px;text-align:right;font-weight:bold;white-space:nowrap;color:${INK};">${money(g.owed)}</td>
        </tr>${g.jobs
              .map(
                (j) => `<tr>
          <td style="padding:6px 10px 6px 22px;border-top:1px solid ${ROW_RULE};font-size:13px;color:${INK};">${esc(j.number)} ${esc(j.name)} <span style="font-size:12px;color:${MUTED};">${esc([lienStatusMonthsWords(j.months), WHERE_WORDS[j.where], j.byYmd && j.byYmd !== g.firstYmd ? `mail by ${lienStatusMonthDay(j.byYmd)}` : ''].filter(Boolean).join(' · '))}</span></td>
          <td style="padding:6px 10px;border-top:1px solid ${ROW_RULE};font-size:13px;text-align:right;white-space:nowrap;color:${MUTED};">${money(j.owed)}</td>
        </tr>`,
              )
              .join('')}`,
          )
          .join('')}
      </table>`
    : ''
  const liens = p.liens.length
    ? `${sectionTitle('Liens to file')}
      <p style="margin:0 0 6px;font-size:13.5px;line-height:1.5;color:#44403c;">${esc(liensLine(p.liens).replace(/^Liens to file: /, ''))}</p>
      ${p.liens.map((l) => `<div style="font-size:13px;line-height:1.6;color:#44403c;">&bull; ${esc(l.number)} ${esc(l.name)}, ${money(l.owed)}. ${l.gc ? '' : 'We contracted with the owner. '}${esc(lienNeedsSentence(l))}</div>`).join('')}`
    : ''
  const retText = retainageLine(p)
  const retainage = retText ? `${sectionTitle('Retainage notices')}<p style="margin:0;font-size:13.5px;line-height:1.5;color:#44403c;">${esc(retText.replace(/^Retainage notices to send: /, ''))}</p>` : ''
  const todo = toDoSentences(p)
  const kinds = kindsSentence(p)
  const toDo = todo.length || kinds ? `${sectionTitle('Still to do')}${todo.map((s) => `<div style="font-size:13px;line-height:1.6;color:#44403c;">&bull; ${esc(s)}</div>`).join('')}${kinds ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#44403c;">${esc(kinds)}</p>` : ''}` : ''
  const pastText = pastWindowSentence(p, Boolean(p.gc))
  const past = pastText ? `${sectionTitle('Past the window')}<p style="margin:0;font-size:13.5px;line-height:1.5;color:#44403c;">${esc(pastText)}</p>` : ''
  const lines = headline(p)
  return `
  <div style="background:#f5f5f4;padding:16px;">
    <div style="margin:0 auto;max-width:640px;background:#ffffff;border:1px solid ${RULE};border-radius:8px;padding:24px 26px;font-family:Arial,Helvetica,sans-serif;color:${INK};">
      ${note ? `<div style="background:#eff6ff;border-radius:8px;padding:10px 13px;margin:0 0 18px;font-size:14px;line-height:1.45;color:#1e3a8a;"><b>${esc(o.senderName)} wrote:</b> ${esc(note)}</div>` : ''}
      <div style="font-size:10.5px;font-weight:bold;letter-spacing:0.08em;color:${MUTED};text-transform:uppercase;">${esc(p.gc ?? 'Lien desk')} &middot; as of ${esc(lienStatusAsOfWords(p.asOf))}</div>
      <h1 style="margin:6px 0 4px;font-size:22px;line-height:1.25;color:${INK};">${esc(lines[0])}</h1>
      ${lines.length > 1 ? `<p style="margin:0;font-size:14px;line-height:1.5;color:#44403c;">${esc(lines.slice(1).join(' '))}</p>` : ''}
      <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${MUTED};">A notice keeps our right to a lien on a month of work. It goes to the owner of record and the GC.</p>
      ${tiles}
      ${waiting}
      <p style="margin:16px 0 0;"><a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;border-radius:6px;padding:10px 18px;font-weight:bold;text-decoration:none;font-size:14px;">Open the Lien desk</a></p>
      ${byGc}
      ${liens}
      ${retainage}
      ${toDo}
      ${past}
      <p style="margin:22px 0 0;padding-top:12px;border-top:1px solid ${RULE};font-size:11.5px;line-height:1.5;color:${FAINT};">${esc(o.senderName)} sent this from the Lien desk in ClickTooling. Reply to write back to ${esc(o.senderName)}. These numbers are from ${esc(lienStatusAsOfWords(p.asOf))}. The desk always has today’s.</p>
    </div>
  </div>`
}

const UUIDISH = /^[0-9a-f-]{8,40}$/i
const YMD = /^\d{4}-\d{2}-\d{2}$/
const YM = /^\d{4}-\d{2}$/
const WHERES: ReadonlySet<string> = new Set(['owner', 'draft', 'approval', 'ready', 'held'])
const NEEDS: ReadonlySet<string> = new Set(['owner', 'legal', 'notice', 'homestead'])

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' ? v.trim().slice(0, max) : null
}
function amount(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e10 ? v : null
}
function whole(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100_000 ? v : null
}
function ymdOrBlank(v: unknown): string | null {
  const s = str(v, 10)
  return s === null ? null : s === '' || YMD.test(s) ? s : null
}

/**
 * The server's reading of a payload the browser sent: every field typed and capped, or null.
 * The renderers escape every string as well; this keeps the email the shape the desk drew.
 */
export function parseLienStatusPayload(raw: unknown): LienStatusPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.v !== 1) return null
  const asOf = str(r.asOf, 40)
  const todayYmd = str(r.todayYmd, 10)
  if (!asOf || Number.isNaN(new Date(asOf).getTime()) || !todayYmd || !YMD.test(todayYmd)) return null
  const gc = r.gc == null ? null : str(r.gc, 160)
  if (gc === '') return null
  if (!Array.isArray(r.jobs) || r.jobs.length > 500 || !Array.isArray(r.liens) || r.liens.length > 200) return null
  const jobs: LienStatusJob[] = []
  for (const x of r.jobs) {
    if (!x || typeof x !== 'object') return null
    const j = x as Record<string, unknown>
    const jobId = str(j.jobId, 40)
    const number = str(j.number, 40)
    const name = str(j.name, 160)
    const gcName = str(j.gc, 160)
    const owed = amount(j.owed)
    const where = str(j.where, 12)
    const byYmd = ymdOrBlank(j.byYmd)
    const sinceYmd = ymdOrBlank(j.sinceYmd)
    const months = Array.isArray(j.months) && j.months.length <= 24 && j.months.every((m) => typeof m === 'string' && YM.test(m)) ? (j.months as string[]) : null
    if (!jobId || !UUIDISH.test(jobId) || number === null || name === null || gcName === null || owed === null || !where || !WHERES.has(where) || byYmd === null || sinceYmd === null || !months) return null
    jobs.push({ jobId, number, name, gc: gcName, months, owed, where: where as LienStatusWhere, byYmd, sinceYmd })
  }
  const liens: LienStatusLien[] = []
  for (const x of r.liens) {
    if (!x || typeof x !== 'object') return null
    const l = x as Record<string, unknown>
    const number = str(l.number, 40)
    const name = str(l.name, 160)
    const gcName = str(l.gc, 160)
    const owed = amount(l.owed)
    const byYmd = ymdOrBlank(l.byYmd)
    const needs = Array.isArray(l.needs) && l.needs.length <= 4 && l.needs.every((n) => typeof n === 'string' && NEEDS.has(n)) ? (l.needs as LienStatusNeed[]) : null
    if (number === null || name === null || gcName === null || owed === null || byYmd === null || !needs) return null
    liens.push({ number, name, gc: gcName, owed, byYmd, needs })
  }
  const kindsUnset = whole(r.kindsUnset)
  const trackingOwed = whole(r.trackingOwed)
  const pw = r.pastWindow && typeof r.pastWindow === 'object' ? (r.pastWindow as Record<string, unknown>) : null
  const pastJobs = pw ? whole(pw.jobs) : null
  const pastOwed = pw ? amount(pw.owed) : null
  const rt = r.retainage && typeof r.retainage === 'object' ? (r.retainage as Record<string, unknown>) : null
  const retJobs = rt ? whole(rt.jobs) : null
  const retHeld = rt ? amount(rt.held) : null
  const retFirst = rt ? ymdOrBlank(rt.firstYmd) : null
  if (kindsUnset === null || trackingOwed === null || pastJobs === null || pastOwed === null || retJobs === null || retHeld === null || retFirst === null) return null
  return { v: 1, asOf, todayYmd, gc, jobs, liens, kindsUnset, trackingOwed, pastWindow: { jobs: pastJobs, owed: pastOwed }, retainage: { jobs: retJobs, held: retHeld, firstYmd: retFirst } }
}
