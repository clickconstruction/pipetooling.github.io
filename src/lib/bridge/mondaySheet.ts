import type { Headline, HeadlineWeek, Light } from './headline'
import { shortK } from './headline'
import type { Move } from './thisWeek'

/**
 * The Monday sheet (Bridge redraw PR 8a): one screen, three lights, five
 * moves — the Bridge's reading as a sheet the owner can read on a phone or
 * get by email. Built from the page's own kernels; the HTML and text here
 * are what `bridge-sheet-email` mails. Pure: no React, no Supabase.
 */

export type SheetRow = { label: string; value: string }

export type MondaySheet = {
  title: string
  /** "the week of Oct 4–10, 2026" */
  weekLine: string
  contribution: { tone: Light['tone']; lead: string; sub: string; bars: HeadlineWeek[]; verdict: string }
  net: { tone: Light['tone']; lead: string; sub: string; rows: SheetRow[]; verdict: string }
  cash: { tone: Light['tone']; lead: string; sub: string; rows: SheetRow[]; verdict: string }
  moves: Move[]
  people: string[]
  /** The weakest link (link PR 11): the rule, the lit link with its weeks, the call, the three readings. Empty until the stages read. */
  link: string[]
  footer: string
}

export type MondaySheetInput = {
  todayLabel: string
  weekLabel: string
  headline: Headline | null
  net: Light
  cash: Light
  netRows: SheetRow[]
  cashRows: SheetRow[]
  moves: Move[]
  people: string[]
  link?: string[]
}

export const MONDAY_SHEET_MOVES = 5

const signed = (n: number): string => `${n >= 0 ? '+' : ''}${shortK(n)}`
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`

export function buildMondaySheet(input: MondaySheetInput): MondaySheet {
  const h = input.headline
  const tw = h?.thisWeek ?? null
  const contributionTone: Light['tone'] = !h || h.trend === 'thin' ? 'none' : h.trend === 'waiting' ? 'amber' : (tw?.recordedUsd ?? 0) >= 0 ? 'green' : 'red'
  const lead = tw && tw.recordedUsd != null ? `${tw.waiting ? '≈ ' : ''}${signed(tw.recordedUsd)}` : '—'
  const sub = tw ? `${hrs(tw.recordedHours)} recorded · ${tw.approvedUsd == null ? '—' : signed(tw.approvedUsd)} on the ${hrs(tw.approvedHours)} approved${tw.pendingHours > 0 ? ` · ${hrs(tw.pendingHours)} waiting` : ''}` : 'no week read yet'
  const verdictOf = (tone: Light['tone'], text: string): string => `${tone === 'green' ? 'Green' : tone === 'amber' ? 'Amber' : tone === 'red' ? 'Red' : 'Not read'}: ${text}`
  return {
    title: 'The Bridge · the Monday sheet',
    weekLine: `the week of ${input.weekLabel}, read ${input.todayLabel}`,
    contribution: { tone: contributionTone, lead, sub, bars: h?.weeks ?? [], verdict: verdictOf(contributionTone, h?.verdict ?? 'no field hours read yet.') },
    net: { tone: input.net.tone, lead: input.net.lead, sub: input.net.title, rows: input.netRows, verdict: verdictOf(input.net.tone, input.net.sentence || input.net.lead) },
    cash: { tone: input.cash.tone, lead: input.cash.lead, sub: input.cash.title, rows: input.cashRows, verdict: verdictOf(input.cash.tone, input.cash.sentence || input.cash.lead) },
    moves: input.moves.slice(0, MONDAY_SHEET_MOVES),
    people: input.people,
    link: input.link ?? [],
    footer: 'Same rules as the full page: earned = field hours × contract ÷ expected hours; net position = cash + owed to you − owed by you; cash = the bank today, bills on due dates, receipts on expected dates.',
  }
}

const TONE_HEX: Record<Light['tone'], string> = { green: '#1e7f4f', red: '#b42318', amber: '#9a6700', none: '#8a8f98' }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function tileHtml(title: string, t: { tone: Light['tone']; lead: string; sub: string; verdict: string }, body: string): string {
  return `<td valign="top" style="width:33%;padding:0 6px 12px 6px"><div style="border:1px solid #d9dde3;border-radius:10px;padding:14px 16px;background:#fff">
<div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5b6470"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${TONE_HEX[t.tone]};margin-right:6px"></span>${esc(title)}</div>
<div style="font-size:28px;font-weight:700;line-height:1.1;margin-top:6px;color:${t.tone === 'red' ? '#b42318' : t.tone === 'green' ? '#1e7f4f' : '#1f2328'}">${esc(t.lead)}</div>
<div style="font-size:13px;color:#5b6470;margin-top:4px">${esc(t.sub)}</div>
${body}
<div style="font-size:13px;margin-top:8px"><b>${esc(t.verdict.split(':')[0] ?? '')}:</b>${esc(t.verdict.slice((t.verdict.split(':')[0] ?? '').length + 1))}</div>
</div></td>`
}

function barsHtml(bars: HeadlineWeek[]): string {
  if (bars.length === 0) return ''
  const max = Math.max(1, ...bars.map((w) => Math.abs(w.recordedUsd ?? 0)))
  const cells = bars
    .map((w) => {
      const usd = w.recordedUsd ?? 0
      const h = Math.max(2, Math.round((Math.abs(usd) / max) * 40))
      const bg = w.waiting ? '#bfdbfe' : usd < 0 ? '#ef4444' : '#2563eb'
      return `<td valign="bottom" style="padding:0 2px;text-align:center"><div style="font-size:9px;color:#5b6470;white-space:nowrap">${esc(w.recordedUsd == null ? '—' : shortK(w.recordedUsd))}${w.waiting ? ' ≈' : ''}</div><div style="height:${h}px;background:${bg};border-radius:3px 3px 0 0"></div><div style="font-size:9px;color:#5b6470;white-space:nowrap">${esc(w.label)}</div></td>`
    })
    .join('')
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin-top:8px"><tr>${cells}</tr></table>`
}

function rowsHtml(rows: SheetRow[]): string {
  if (rows.length === 0) return ''
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin-top:8px;font-size:13px">${rows.map((r) => `<tr><td style="padding:2px 0;color:#1f2328">${esc(r.label)}</td><td align="right" style="padding:2px 0;font-weight:700;white-space:nowrap">${esc(r.value)}</td></tr>`).join('')}</table>`
}

/** The sheet as an email body: three tiles, the moves, the people. Inline styles, light, table-laid for mail clients. */
export function mondaySheetHtml(sheet: MondaySheet, fullPageUrl: string): string {
  const moves = sheet.moves.map((m, i) => `<tr><td style="padding:6px 0;border-top:1px solid #e5e8ec;vertical-align:top;width:20px;color:#5b6470;font-weight:700">${i + 1}</td><td style="padding:6px 0;border-top:1px solid #e5e8ec"><b>${esc(m.title)}</b> <span style="color:#5b6470">· ${esc(m.why)}</span></td><td align="right" style="padding:6px 0;border-top:1px solid #e5e8ec;white-space:nowrap;font-weight:700;color:${m.leverTone === 'green' ? '#1e7f4f' : '#5b6470'}">${esc(m.lever)}</td></tr>`).join('')
  const people = sheet.people.map((p) => `<tr><td style="padding:6px 0;border-top:1px solid #e5e8ec">${esc(p)}</td></tr>`).join('')
  const linkRows = sheet.link.map((p) => `<tr><td style="padding:6px 0;border-top:1px solid #e5e8ec">${esc(p)}</td></tr>`).join('')
  const linkTile = sheet.link.length ? `<div style="border:1px solid #d9dde3;border-radius:10px;padding:14px 16px;background:#fff;margin:0 6px 12px 6px"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5b6470;margin-bottom:6px">The weakest link</div><table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;font-size:13px">${linkRows}</table></div>` : ''
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2328">
<div style="max-width:960px;margin:0 auto;padding:20px 12px">
<div style="font-size:20px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">The Bridge</div>
<div style="font-size:13px;color:#5b6470;margin:2px 0 14px">${esc(sheet.weekLine)} · one screen, three lights, five moves</div>
<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%"><tr>
${tileHtml('Contribution per week', sheet.contribution, barsHtml(sheet.contribution.bars))}
${tileHtml('Net position · 8 weeks', sheet.net, rowsHtml(sheet.net.rows))}
${tileHtml('Cash · lowest point', sheet.cash, rowsHtml(sheet.cash.rows))}
</tr></table>
${linkTile}
<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%"><tr>
<td valign="top" style="width:50%;padding:0 6px 12px 6px"><div style="border:1px solid #d9dde3;border-radius:10px;padding:14px 16px;background:#fff"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5b6470;margin-bottom:6px">Five moves this week</div><table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;font-size:13px">${moves || '<tr><td style="color:#5b6470">nothing to move today</td></tr>'}</table></div></td>
<td valign="top" style="width:50%;padding:0 6px 12px 6px"><div style="border:1px solid #d9dde3;border-radius:10px;padding:14px 16px;background:#fff"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5b6470;margin-bottom:6px">People, this pay week</div><table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;font-size:13px">${people || '<tr><td style="color:#5b6470">no rows yet</td></tr>'}</table></div></td>
</tr></table>
<div style="font-size:12px;color:#5b6470;padding:0 6px">${esc(sheet.footer)} <a href="${esc(fullPageUrl)}" style="color:#1d4ed8">Open the full Bridge</a>.</div>
</div></body></html>`
}

/** The same sheet as plain text, for the mail's text part. */
export function mondaySheetText(sheet: MondaySheet, fullPageUrl: string): string {
  const tile = (title: string, t: { lead: string; sub: string; verdict: string }, rows: SheetRow[] = []): string => [`${title}: ${t.lead}`, `  ${t.sub}`, ...rows.map((r) => `  ${r.label}: ${r.value}`), `  ${t.verdict}`].join('\n')
  return [
    `${sheet.title} — ${sheet.weekLine}`,
    '',
    tile('Contribution per week', sheet.contribution),
    '',
    tile('Net position, 8 weeks', sheet.net, sheet.net.rows),
    '',
    tile('Cash, lowest point', sheet.cash, sheet.cash.rows),
    '',
    'Five moves this week:',
    ...(sheet.moves.length ? sheet.moves.map((m, i) => `  ${i + 1}. ${m.title} — ${m.why} (${m.lever})`) : ['  nothing to move today']),
    '',
    'People, this pay week:',
    ...(sheet.people.length ? sheet.people.map((p) => `  ${p}`) : ['  no rows yet']),
    ...(sheet.link.length ? ['', 'The weakest link:', ...sheet.link.map((p) => `  ${p}`)] : []),
    '',
    sheet.footer,
    `Open the full Bridge: ${fullPageUrl}`,
  ].join('\n')
}

export function mondaySheetSubject(sheet: MondaySheet): string {
  return `The Bridge, ${sheet.weekLine.replace(/, read .*$/, '')}: contribution ${sheet.contribution.lead}, net ${sheet.net.lead}, cash ${sheet.cash.lead}`
}

/** The people lines for the sheet: the field rows with a contribution, who waits, the office's billed and collected. */
export function peopleLines(v: { rows: ReadonlyArray<{ name: string; fieldHours: number; pendingHours: number; contributionUsd: number | null; contributionPerHour: number | null; billedUsd: number; collectedUsd: number }> } | null, max = 5): string[] {
  if (!v) return []
  const out: string[] = []
  const field = v.rows.filter((r) => r.contributionUsd != null && r.fieldHours > 0).sort((a, b) => (b.contributionUsd ?? 0) - (a.contributionUsd ?? 0))
  for (const r of field.slice(0, max)) out.push(`${r.name} · ${hrs(r.fieldHours)} · ${signed(r.contributionUsd ?? 0)}${r.contributionPerHour != null ? ` · $${Math.round(r.contributionPerHour)}/h` : ''}`)
  const waiting = v.rows.filter((r) => r.pendingHours > 0 && !(r.contributionUsd != null && r.fieldHours > 0))
  if (waiting.length > 0) out.push(`${waiting.map((r) => r.name.split(/\s+/)[0] ?? r.name).join(', ')}: hours waiting (${waiting.map((r) => hrs(r.pendingHours)).join(' · ')})`)
  for (const r of v.rows.filter((r) => r.billedUsd > 0 || r.collectedUsd > 0)) out.push(`${r.name} · billed ${shortK(r.billedUsd)} · collected ${shortK(r.collectedUsd)}`)
  return out
}
