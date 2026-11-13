import { STRIP_LEGEND, type FlowStrip } from './flowStrip'
import { WEEK_CALL_MOVES, type WeekBar, type WeekCallModel, type WeekMove, type WeekTile, type WeekTone } from './weekCall'

/**
 * The Monday email is the Bridge's first screen (v2.6888, punch list #303, PR 5).
 *
 * Until that version the weekly send mailed the Monday sheet: three lights, five moves, the
 * people and a block of readings, a second reading of the company that the page itself stopped
 * showing in v2.6840. Now the mail is what the page opens on: the three tiles, the strip of
 * pipe, and the card *What to do now* with its moves. The words and the numbers are
 * `buildWeekCall`'s and `buildFlowStrip`'s, so the mail and the page cannot say two things.
 *
 * The mail speaks of no call (punch list #334, PR 11): the page stopped making one, so the mail
 * names its card as the page does, puts no person on a move, asks nothing about Friday and shows
 * no last call. Its one press opens the Bridge.
 *
 * Pure: no React, no Supabase. Copied to the edge functions, where `bridge-weekly-sheet` builds
 * it on Monday morning from the page's reads (`buildWeekMailFromReads`, `sheetBuild.ts`).
 */

export type WeekMail = {
  /** "Nov 8–14, 2026": the pay week it was built in. */
  weekLabel: string
  /** "Nov 9": the day it was built. */
  todayLabel: string
  model: WeekCallModel
  /** The five steps as one pipe; null when it was not built. */
  strip: FlowStrip | null
  /**
   * What Market's amount is made of, one short part for the bids and one for the estimates (`MarketWorth.parts`,
   * punch list #318): "bids $22k at 7% won". Empty or absent while Market still reads the dollars that came in.
   */
  marketParts?: ReadonlyArray<string>
  /**
   * What the Bridge leaves out, in the page's own sentence under its name (`leftOutWords`): "Leaves out Oak Hollow."
   * Empty or absent when nothing is left out, and then the mail says nothing of it.
   */
  leftOut?: string
  /** What could not be read when it was built, in plain words; empty when everything came back. */
  gaps: string[]
}

export const WEEK_MAIL_WORDS = {
  title: 'The Bridge',
  /** The one press. */
  open: 'Open the Bridge',
  steps: 'The five steps',
  /** Over the two parts of the Market amount, under the pipe. */
  marketWorth: 'What Market is worth',
  slowest: 'the slowest step',
  foot: 'This is the Bridge’s first screen, as it read when this was built.',
  sent: 'It goes out Monday at 6 AM Central. The switch is on the Bridge, behind The flow.',
} as const

/** "the week of Nov 8–14, 2026, read Nov 9" */
export function weekMailLine(mail: Pick<WeekMail, 'weekLabel' | 'todayLabel'>): string {
  return `the week of ${mail.weekLabel}, read ${mail.todayLabel}`
}

/** The moves the mail lists: the first three, as the card shows at a desk. */
export function weekMailMoves(model: WeekCallModel): WeekMove[] {
  return model.card.moves.slice(0, WEEK_CALL_MOVES)
}

/** What could not be read, in one sentence; empty when everything came back. */
export function weekMailGapsLine(gaps: ReadonlyArray<string>): string {
  return gaps.length ? `Not read when this was built: ${gaps.join(', ')}. The rest reads without it.` : ''
}

/** What the Bridge leaves out, under the mail's name as under the page's; empty when nothing is left out. */
export function weekMailLeftOutLine(mail: Pick<WeekMail, 'leftOut'>): string {
  return (mail.leftOut ?? '').trim()
}

/** What Market's amount is made of, in one line under the pipe; empty while Market still reads the dollars that came in. */
export function weekMailMarketLine(mail: Pick<WeekMail, 'marketParts'>): string {
  const parts = mail.marketParts ?? []
  if (parts.length === 0) return ''
  // One sentence a part, since a part can carry a comma of its own ("…, a thin count").
  const [first, ...rest] = parts
  return [`${WEEK_MAIL_WORDS.marketWorth}: ${first}.`, ...rest.map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1)}.`)].join(' ')
}

/** The subject: the card's lead, then cash, then what the field made. */
export function weekMailSubject(mail: WeekMail): string {
  const tile = (id: WeekTile['id']): WeekTile | undefined => mail.model.tiles.find((t) => t.id === id)
  const cash = tile('cash')
  const made = tile('made')
  const parts = [mail.model.card.lead]
  if (cash) parts.push(cash.wide ? `${cash.value}.` : `Cash low point ${cash.value}.`)
  if (made) parts.push(`${made.label} ${made.value}.`)
  return `The Bridge, the week of ${mail.weekLabel.replace(/, \d{4}$/, '')}: ${parts.join(' ')}`
}

// ── the HTML ───────────────────────────────────────────────────────────────

/** The mail's content is at most this wide: three tiles, or two halves, fill it edge to edge under the full-width cards. */
export const WEEK_MAIL_WIDTH_PX = 720
export const WEEK_MAIL_TILE_PX = 240
export const WEEK_MAIL_HALF_PX = 360
/** Under this wide the media query lets each tile fill the screen, where a mail app keeps the `<style>`. */
export const WEEK_MAIL_STACK_PX = 620

const INK = '#1f2328'
const MUTED = '#5b6470'
const LINE = '#d9dde3'
const RULE = '#e5e8ec'
const TONE_HEX: Record<WeekTone, string> = { plain: INK, green: '#1e7f4f', red: '#b42318', amber: '#9a6700' }
const KICKER = `font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED}`

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const card = (inner: string, border = `1px solid ${LINE}`, background = '#fff'): string => `<div style="border:${border};border-radius:10px;padding:12px 14px;background:${background}">${inner}</div>`
/** A full-width block of the mail. */
const block = (inner: string): string => `<div style="padding:0 6px 12px 6px">${inner}</div>`
/** A column: an inline block at most `maxPx` wide, so a row of them wraps on a narrow screen, with Outlook's cell around it. */
const col = (maxPx: number, inner: string): string => `<!--[if mso]><td width="${maxPx}" valign="top"><![endif]--><div class="col" style="display:inline-block;vertical-align:top;width:100%;max-width:${maxPx}px;font-size:14px;text-align:left">${block(inner)}</div><!--[if mso]></td><![endif]-->`
const row = (cols: string[]): string => `<div style="font-size:0;text-align:center"><!--[if mso]><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><![endif]-->${cols.join('')}<!--[if mso]></tr></table><![endif]--></div>`

/** The eight pay weeks: this week full blue, a closed week lighter, a week whose hours still wait the lightest. */
function barsHtml(bars: ReadonlyArray<WeekBar> | undefined): string {
  if (!bars || bars.length === 0) return ''
  const cells = bars
    .map((b) => {
      const h = Math.max(3, Math.round(b.share * 30))
      const bg = b.waiting ? '#bfdbfe' : b.current ? '#2563eb' : '#87a9f4'
      return `<td valign="bottom" title="${esc(b.label)}" style="padding:0 1px;height:30px"><div style="height:${h}px;background:${bg};border-radius:2px 2px 0 0;font-size:0;line-height:0">&nbsp;</div></td>`
    })
    .join('')
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:240px;table-layout:fixed;margin-top:6px"><tr>${cells}</tr></table>`
}

function tileHtml(t: WeekTile): string {
  const red = t.tone === 'red'
  return card(
    `<div style="${KICKER}">${esc(t.label)}</div>
<div style="font-size:${t.wide ? 22 : 26}px;font-weight:800;line-height:1.15;margin-top:4px;color:${TONE_HEX[t.tone]}">${esc(t.value)}</div>${barsHtml(t.bars)}
<div style="font-size:13px;color:${MUTED};margin-top:4px">${esc(t.sub)}</div>${t.note ? `\n<div style="font-size:12px;color:${MUTED};margin-top:2px">${esc(t.note)}</div>` : ''}`,
    `1px solid ${red ? '#f1b5ae' : LINE}`,
    red ? '#fef3f2' : '#fff',
  )
}

const STRIP_PIPE_PX = 30
const STRIP_PILE_PX = 16

/**
 * The strip of pipe as a table, since a mail app draws no SVG: each step is a cell, the pipe sits on one bottom line
 * and is as tall as the step is wide on the page, and the block of waiting work sits on top of it.
 */
function stripHtml(strip: FlowStrip, marketLine: string): string {
  const share = `${(100 / Math.max(1, strip.sections.length)).toFixed(2)}%`
  const pipe = strip.sections
    .map((s) => {
      const h = Math.max(4, Math.round(s.thick * STRIP_PIPE_PX))
      const pile = s.pile > 0 ? Math.max(2, Math.round(s.pile * STRIP_PILE_PX)) : 0
      const bg = s.lit ? '#dc2626' : s.paceUsd == null ? '#eceef1' : '#c9cfd7'
      const blockHtml = pile > 0 ? `<div style="width:60%;margin:0 auto 1px;height:${pile}px;background:${s.lit ? '#e98b85' : '#a3abb6'};border-radius:2px;font-size:0;line-height:0">&nbsp;</div>` : ''
      return `<td valign="bottom" width="${share}" style="height:${STRIP_PIPE_PX + STRIP_PILE_PX + 2}px;padding:0">${blockHtml}<div style="height:${h}px;background:${bg};font-size:0;line-height:0">&nbsp;</div></td>`
    })
    .join('')
  const words = strip.sections
    .map((s) => {
      const color = s.lit ? '#b42318' : INK
      const sub = s.lit ? '#b42318' : MUTED
      return `<td valign="top" align="center" width="${share}" style="padding:4px 2px 0;font-size:12px;line-height:1.25"><b style="color:${color}">${esc(s.name)}</b><div style="font-size:11px;color:${sub}">${esc(s.paceText)}</div>${s.weeksText ? `<div style="font-size:11px;color:${sub};font-weight:${s.lit ? 700 : 400}">${esc(s.weeksText)}</div>` : ''}</td>`
    })
    .join('')
  return card(
    `<div style="font-size:12px;color:${MUTED};margin-bottom:2px">${esc(STRIP_LEGEND.long)}</div>
<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed"><tr>${pipe}</tr><tr>${words}</tr></table>${marketLine ? `\n<div style="font-size:12px;color:${MUTED};margin-top:6px">${esc(marketLine)}</div>` : ''}`,
  )
}

function movesHtml(moves: ReadonlyArray<WeekMove>): string {
  if (moves.length === 0) return ''
  const cell = `padding:8px 0;border-top:1px solid ${RULE};vertical-align:top`
  const rows = moves.map((m, i) => `<tr><td style="${cell};width:20px;color:${MUTED};font-weight:700">${i + 1}</td><td style="${cell}"><b>${esc(m.title)}</b>${m.why ? `<div style="color:${MUTED};margin-top:2px">${esc(m.why)}</div>` : ''}</td></tr>`).join('')
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;font-size:14px;margin-top:8px">${rows}</table>`
}

/** The card What to do now: its lead, its line, its moves and the one press. */
function cardHtml(model: WeekCallModel, url: string): string {
  const c = model.card
  const border = c.tone === 'lit' ? '#dc2626' : '#aab1bb'
  return card(
    `<div style="${KICKER}">${esc(c.label)}</div>
<div style="font-size:20px;font-weight:800;line-height:1.25;margin-top:2px;color:${INK}">${esc(c.lead)}</div>${c.line ? `\n<div style="font-size:14px;color:${MUTED};margin-top:4px">${esc(c.line)}</div>` : ''}
${movesHtml(weekMailMoves(model))}
<div style="margin-top:12px"><a href="${esc(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:10px;padding:12px 18px">${esc(WEEK_MAIL_WORDS.open)}</a></div>`,
    `2px solid ${border}`,
  )
}

/**
 * The first screen as an email body: the tiles, the strip, the card. Inline styles, light. In a week cash leads its
 * tile takes the whole row and the strip goes under the card, as on the page.
 */
export function weekMailHtml(mail: WeekMail, bridgeUrl: string): string {
  const { model } = mail
  const wide = model.tiles.filter((t) => t.wide)
  const rest = model.tiles.filter((t) => !t.wide)
  const tiles = `${wide.map((t) => block(tileHtml(t))).join('')}${row(rest.map((t) => col(wide.length ? WEEK_MAIL_HALF_PX : WEEK_MAIL_TILE_PX, tileHtml(t))))}`
  const strip = mail.strip ? block(stripHtml(mail.strip, weekMailMarketLine(mail))) : ''
  const gaps = weekMailGapsLine(mail.gaps)
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media (max-width:${WEEK_MAIL_STACK_PX}px){.col{max-width:100%!important}}</style></head><body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${INK}">
<div style="max-width:${WEEK_MAIL_WIDTH_PX}px;margin:0 auto;padding:20px 12px">
<div style="padding:0 6px"><div style="font-size:20px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${WEEK_MAIL_WORDS.title}</div>
<div style="font-size:13px;color:${MUTED};margin:2px 0 14px">${esc(weekMailLine(mail))}${weekMailLeftOutLine(mail) ? `<br>${esc(weekMailLeftOutLine(mail))}` : ''}</div></div>
${tiles}
${model.cashLeads ? '' : strip}${block(cardHtml(model, bridgeUrl))}${model.cashLeads ? strip : ''}
${gaps ? `<div style="font-size:12px;color:#b42318;padding:0 6px 8px">${esc(gaps)}</div>` : ''}<div style="font-size:12px;color:${MUTED};padding:0 6px">${esc(WEEK_MAIL_WORDS.foot)} ${esc(WEEK_MAIL_WORDS.sent)} <a href="${esc(bridgeUrl)}" style="color:#1d4ed8">Open the Bridge</a>.</div>
</div></body></html>`
}

// ── the text ───────────────────────────────────────────────────────────────

/** The same mail as plain text, for the mail's text part, in the HTML's order. */
export function weekMailText(mail: WeekMail, bridgeUrl: string): string {
  const { model } = mail
  const c = model.card
  const tiles = model.tiles.flatMap((t) => [`${t.label}: ${t.value}`, `  ${t.sub}`, ...(t.note ? [`  ${t.note}`] : [])])
  const strip = mail.strip
    ? ['', `${WEEK_MAIL_WORDS.steps}. ${STRIP_LEGEND.long}`, ...mail.strip.sections.map((s) => `  ${s.name}: ${s.paceText}${s.weeksText ? `, ${s.weeksText}` : ''}${s.lit ? `, ${WEEK_MAIL_WORDS.slowest}` : ''}`), ...(weekMailMarketLine(mail) ? [`  ${weekMailMarketLine(mail)}`] : [])]
    : []
  const moves = weekMailMoves(model).map((m, i) => `  ${i + 1}. ${m.title}${m.why ? ` ${m.why}` : ''}`)
  const what = ['', c.label, c.lead, ...(c.line ? [c.line] : []), ...moves, `${WEEK_MAIL_WORDS.open}: ${bridgeUrl}`]
  const gaps = weekMailGapsLine(mail.gaps)
  return [
    `${WEEK_MAIL_WORDS.title}, ${weekMailLine(mail)}`,
    ...(weekMailLeftOutLine(mail) ? [weekMailLeftOutLine(mail)] : []),
    '',
    ...tiles,
    ...(model.cashLeads ? [] : strip),
    ...what,
    ...(model.cashLeads ? strip : []),
    ...(gaps ? ['', gaps] : []),
    '',
    `${WEEK_MAIL_WORDS.foot} ${WEEK_MAIL_WORDS.sent}`,
  ].join('\n')
}
