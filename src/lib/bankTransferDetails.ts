/**
 * Bank transfer details (v2.3308): the company's ACH / wire remittance
 * details and the check mailing address, as one typed record. The numbers
 * live in Supabase (`company_bank_transfer_details`, one row) — never in
 * this public repo — so every reader parses an unknown payload through
 * `parseBankTransferDetails` and decides with `bankTransferDetailsComplete`
 * whether there is enough to show. Shared by the customer portal card, the
 * Accounts Receivable modal panel, and the Settings block.
 */

export type BankTransferDetails = {
  payeeName: string
  bankName: string
  /** One line under the bank name (why the customer's bank shows a partner bank's name). */
  bankNote: string
  routingNumber: string
  accountNumber: string
  accountKind: string
  beneficiaryAddress: string
  /** Where paper checks must go; empty hides the checks line. */
  checkMailingAddress: string
  showOnPortal: boolean
}

export const EMPTY_BANK_TRANSFER_DETAILS: BankTransferDetails = {
  payeeName: '',
  bankName: '',
  bankNote: '',
  routingNumber: '',
  accountNumber: '',
  accountKind: 'Checking',
  beneficiaryAddress: '',
  checkMailingAddress: '',
  showOnPortal: true,
}

/** The `company_bank_transfer_details` row as PostgREST returns it (and as the portal payload carries it). */
export type BankTransferDetailsRow = {
  payee_name?: unknown
  bank_name?: unknown
  bank_note?: unknown
  routing_number?: unknown
  account_number?: unknown
  account_kind?: unknown
  beneficiary_address?: unknown
  check_mailing_address?: unknown
  show_on_portal?: unknown
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v.trim() : fallback
}

/** Row (snake_case, unknown values) → typed record. Null / non-object → null. */
export function parseBankTransferDetails(raw: unknown): BankTransferDetails | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as BankTransferDetailsRow
  return {
    payeeName: str(r.payee_name),
    bankName: str(r.bank_name),
    bankNote: str(r.bank_note),
    routingNumber: str(r.routing_number).replace(/\s+/g, ''),
    accountNumber: str(r.account_number).replace(/\s+/g, ''),
    accountKind: str(r.account_kind, 'Checking') || 'Checking',
    beneficiaryAddress: str(r.beneficiary_address),
    checkMailingAddress: str(r.check_mailing_address),
    showOnPortal: r.show_on_portal !== false,
  }
}

/** The saved row's shape: every text column, so a blank clears. */
export type BankTransferDetailsSavedRow = {
  payee_name: string
  bank_name: string
  bank_note: string
  routing_number: string
  account_number: string
  account_kind: string
  beneficiary_address: string
  check_mailing_address: string
  show_on_portal: boolean
}

/** Typed record → the row the office saves (every column, so a blank clears). */
export function bankTransferDetailsToRow(d: BankTransferDetails): BankTransferDetailsSavedRow {
  return {
    payee_name: d.payeeName.trim(),
    bank_name: d.bankName.trim(),
    bank_note: d.bankNote.trim(),
    routing_number: d.routingNumber.replace(/\s+/g, ''),
    account_number: d.accountNumber.replace(/\s+/g, ''),
    account_kind: d.accountKind.trim() || 'Checking',
    beneficiary_address: d.beneficiaryAddress.trim(),
    check_mailing_address: d.checkMailingAddress.trim(),
    show_on_portal: d.showOnPortal,
  }
}

/** A US ABA routing number: nine digits whose checksum holds. */
export function routingNumberProblem(routing: string): string | null {
  const digits = routing.replace(/\s+/g, '')
  if (!digits) return null
  if (!/^\d{9}$/.test(digits)) return 'A routing number is nine digits.'
  const d = digits.split('').map(Number)
  const sum = 3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]! + d[8]!)
  return sum % 10 === 0 ? null : "That routing number doesn't check out — one digit is off."
}

/**
 * Enough to show a customer: the transfer half needs payee, routing and
 * account; the checks half needs only the mailing address. Either half is
 * enough for the block to exist.
 */
export function bankTransferDetailsComplete(d: BankTransferDetails | null): { transfer: boolean; checks: boolean } {
  if (!d) return { transfer: false, checks: false }
  const transfer = Boolean(d.payeeName && d.routingNumber && d.accountNumber)
  const checks = Boolean(d.checkMailingAddress)
  return { transfer, checks }
}

/** What the portal shows: the record when show_on_portal and at least one half is complete. */
export function bankTransferDetailsForPortal(d: BankTransferDetails | null): BankTransferDetails | null {
  if (!d || !d.showOnPortal) return null
  const c = bankTransferDetailsComplete(d)
  return c.transfer || c.checks ? d : null
}

/**
 * The memo the customer should put on the transfer so the deposit matches
 * on Accounts Receivable the day it lands: the customer's name, then the
 * open job numbers (deduped, in statement order). "Sam Sample · PLUM 1001, 0994".
 */
export function buildBankTransferMemo(customerName: string, bills: ReadonlyArray<{ jobNumber: string; serviceTag?: string | null }>): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const b of bills) {
    const n = (b.jobNumber ?? '').trim()
    if (!n || seen.has(n)) continue
    seen.add(n)
    parts.push(n)
  }
  const name = customerName.trim()
  if (parts.length === 0) return name
  const tag = (bills.find((b) => (b.jobNumber ?? '').trim() === parts[0])?.serviceTag ?? '').trim().toUpperCase()
  const jobs = `${tag ? `${tag} ` : ''}${parts.join(', ')}`
  return name ? `${name} · ${jobs}` : jobs
}

/** The checks sentence, from the mailing address alone. */
export function checkMailingSentence(address: string): string | null {
  const a = address.trim()
  if (!a) return null
  return `All checks must be mailed to ${a}. Checks sent anywhere else may need to be re-issued.`
}

/** The guard line every reading of the details carries. */
export function bankTransferGuardLine(phone: string): string {
  const p = phone.trim()
  return p
    ? `These details never change by email. If anyone sends you different bank details in our name, call ${p} before sending anything.`
    : 'These details never change by email. If anyone sends you different bank details in our name, call our office before sending anything.'
}

/** Digits in readable groups for the screen: 202511226605 → "2025 1122 6605". Copy uses the raw value. */
export function groupDigits(value: string): string {
  const v = value.replace(/\s+/g, '')
  if (!/^\d{6,}$/.test(v)) return v
  const groups: string[] = []
  let rest = v
  while (rest.length > 4) {
    groups.push(rest.slice(0, 4))
    rest = rest.slice(4)
  }
  groups.push(rest)
  return groups.join(' ')
}
