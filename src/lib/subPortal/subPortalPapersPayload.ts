/**
 * The `papers` block of the sub portal's payload, read defensively (punch list #371, step 2). The function builds it
 * (`supabase/functions/_shared/subPortalPapers.ts`); the page trusts nothing about its shape. A block that is
 * missing or malformed reads as null, and the page then shows no Statements view at all: a sub never sees half a paper.
 *
 * Pure: no React, no fetch.
 */
import type { PaperConfirm, PaperContext, PaperMoneyLine, PaperSheet } from '../../../supabase/functions/_shared/subPapers'
import type { PortalWrongNote, SubPortalPapers } from '../../../supabase/functions/_shared/subPortalPapers'

export type { SubPortalPapers }
export type SubPortalPapersReady = Extract<SubPortalPapers, { ok: true }>

const isObj = (v: unknown): v is Record<string, unknown> => v != null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const strs = (v: unknown): string[] | null => (Array.isArray(v) && v.every(isStr) ? v : null)

function parseMoney(raw: unknown): PaperMoneyLine | null {
  if (!isObj(raw) || !isStr(raw.id) || !isNum(raw.amount) || !isStr(raw.ymd) || !isStr(raw.at) || !isStr(raw.how) || !isStr(raw.memo)) return null
  return {
    id: raw.id,
    amount: raw.amount,
    ymd: raw.ymd,
    recorded: raw.recorded === true,
    at: raw.at,
    how: raw.how,
    memo: raw.memo,
    sendingId: isStr(raw.sendingId) ? raw.sendingId : null,
    sendingNo: isNum(raw.sendingNo) ? raw.sendingNo : null,
    fromCredit: raw.fromCredit === true,
    creditKept: isNum(raw.creditKept) ? raw.creditKept : 0,
    clientDirect: raw.clientDirect === true,
  }
}

function parseSheet(raw: unknown): PaperSheet | null {
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.number) || !isStr(raw.jobNumber) || !isStr(raw.jobName) || !isStr(raw.address) || !isStr(raw.day)) return null
  if (!Array.isArray(raw.lines) || !Array.isArray(raw.money)) return null
  const lines: Array<{ label: string; amount: number }> = []
  for (const l of raw.lines) {
    if (!isObj(l) || !isStr(l.label) || !isNum(l.amount)) return null
    lines.push({ label: l.label, amount: l.amount })
  }
  const money: PaperMoneyLine[] = []
  for (const m of raw.money) {
    const line = parseMoney(m)
    if (!line) return null
    money.push(line)
  }
  // A confirm is read as defensively as the rest: one that is not whole is no confirm, and the sheet still shows.
  return { id: raw.id, number: raw.number, revision: isNum(raw.revision) && raw.revision >= 1 ? raw.revision : 1, replacesCopyOf: isStr(raw.replacesCopyOf) ? raw.replacesCopyOf : '', jobNumber: raw.jobNumber, jobName: raw.jobName, address: raw.address, day: raw.day, lines, money, confirm: parseConfirm(raw.confirm) }
}

/** A sub's confirm of a work statement, as the function hands it back: the revision, what it came to, the day and where from. */
export function parseConfirm(raw: unknown): PaperConfirm | null {
  if (!isObj(raw) || !isNum(raw.revision) || raw.revision < 1 || !isNum(raw.amount) || !isStr(raw.at) || !isStr(raw.from)) return null
  return { revision: raw.revision, amount: raw.amount, at: raw.at, from: raw.from }
}

function parseCtx(raw: unknown): PaperContext | null {
  if (!isObj(raw) || !isObj(raw.company) || !isObj(raw.sub)) return null
  const companyLines = strs(raw.company.lines)
  const subLines = strs(raw.sub.lines)
  if (!isStr(raw.company.name) || !companyLines || !isStr(raw.sub.name) || !subLines || !isStr(raw.today) || !/^\d{4}-\d{2}-\d{2}$/.test(raw.today) || !isStr(raw.preparedAt) || !isStr(raw.zone)) return null
  return { company: { name: raw.company.name, lines: companyLines }, sub: { name: raw.sub.name, lines: subLines }, today: raw.today, preparedAt: raw.preparedAt, zone: raw.zone }
}

/** The block as the page reads it, or null when there is none to show. One bad sheet drops the whole block. */
export function parseSubPortalPapers(raw: unknown): SubPortalPapers | null {
  if (!isObj(raw)) return null
  const officePhone = isStr(raw.officePhone) ? raw.officePhone.trim() : ''
  if (raw.ok === false) return { ok: false, officePhone }
  if (raw.ok !== true || !Array.isArray(raw.sheets) || !isNum(raw.stillOpen)) return null
  const ctx = parseCtx(raw.ctx)
  if (!ctx) return null
  const sheets: PaperSheet[] = []
  for (const s of raw.sheets) {
    const sheet = parseSheet(s)
    if (!sheet) return null
    sheets.push(sheet)
  }
  const numbers: Extract<SubPortalPapers, { ok: true }>['numbers'] = {}
  if (isObj(raw.numbers)) {
    for (const [id, n] of Object.entries(raw.numbers)) {
      if (isObj(n) && isStr(n.number) && n.number) numbers[id] = { number: n.number, revision: isNum(n.revision) ? n.revision : 1, issuedOn: isStr(n.issuedOn) ? n.issuedOn : '', asIssued: n.asIssued === true }
    }
  }
  const received: Record<string, string> = {}
  if (isObj(raw.received)) for (const [key, day] of Object.entries(raw.received)) if (isStr(day)) received[key] = day
  const wrong: PortalWrongNote[] = []
  if (Array.isArray(raw.wrong)) {
    for (const w of raw.wrong) {
      if (isObj(w) && (w.about === 'statement' || w.about === 'payment') && isStr(w.key) && w.key) wrong.push({ about: w.about, key: w.key, day: isStr(w.day) ? w.day : '', note: isStr(w.note) ? w.note : '' })
    }
  }
  return { ok: true, ctx, sheets, numbers, received, wrong, stillOpen: raw.stillOpen, sharedSheets: isNum(raw.sharedSheets) ? raw.sharedSheets : 0, officePhone }
}

/** What the function answers to *Got it* or *Something is wrong*, read as defensively as the block. */
export function parseSubPortalAnswer(raw: unknown): { received?: Record<string, string>; wrong?: PortalWrongNote | null; confirmed?: Record<string, PaperConfirm> } {
  if (!isObj(raw)) return {}
  const confirmed: Record<string, PaperConfirm> = {}
  if (isObj(raw.confirmed)) {
    for (const [sheetId, c] of Object.entries(raw.confirmed)) {
      const confirm = parseConfirm(c)
      if (confirm) confirmed[sheetId] = confirm
    }
  }
  const received: Record<string, string> = {}
  if (isObj(raw.received)) for (const [key, day] of Object.entries(raw.received)) if (isStr(day)) received[key] = day
  const w = raw.wrong
  const wrong: PortalWrongNote | null = isObj(w) && (w.about === 'statement' || w.about === 'payment') && isStr(w.key) && w.key ? { about: w.about, key: w.key, day: isStr(w.day) ? w.day : '', note: isStr(w.note) ? w.note : '' } : null
  return { ...(Object.keys(received).length > 0 ? { received } : {}), ...(wrong ? { wrong } : {}), ...(Object.keys(confirmed).length > 0 ? { confirmed } : {}) }
}
