/**
 * Who at the office the collections law firm calls (v2.4755, the owner's ask of
 * 2026-10-06: *this way lawyers can call someone at any time*). The office number
 * with the assistants to ask for, and the controller's own line for when the
 * office does not answer. Built from the users table by role, so a new assistant
 * or a changed number reaches the firm's page on its next open. Pure; no imports,
 * so the `legal-portal` function, the firm's page, its print and the Legal desk
 * read one rule. `src/lib/legal/legalOfficeContacts.ts` is the client's door.
 */

export type LegalOfficeContacts = {
  /** The office line — the portal letterhead's company phone. */
  phone: string
  /** The active office assistants' names, by name. */
  assistants: string[]
  /** The active controllers, by name; a phone of null is a gap the desk names. */
  controllers: Array<{ name: string; phone: string | null }>
}

export const LEGAL_OFFICE_CONTACT_ROLES = ['assistant', 'controller'] as const

/** The users rows → the firm's contacts. Rows arrive filtered to real, unarchived accounts in the two roles. */
export function officeContactsFromUsers(rows: ReadonlyArray<{ name: string | null; phone: string | null; role: string }>, companyPhone: string): LegalOfficeContacts {
  const named = rows.filter((r) => (r.name ?? '').trim()).map((r) => ({ name: (r.name ?? '').trim(), phone: (r.phone ?? '').trim() || null, role: r.role }))
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
  return {
    phone: companyPhone.trim(),
    assistants: named.filter((r) => r.role === 'assistant').sort(byName).map((r) => r.name),
    controllers: named.filter((r) => r.role === 'controller').sort(byName).map((r) => ({ name: r.name, phone: r.phone })),
  }
}

export function emptyOfficeContacts(companyPhone = ''): LegalOfficeContacts {
  return { phone: companyPhone.trim(), assistants: [], controllers: [] }
}

function phoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d
}

/** `(617) 939-6295` for a ten-digit number, with or without the leading 1; anything else as typed. */
export function formatUsPhone(raw: string): string {
  const d = phoneDigits(raw)
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw.trim()
}

/** The tap-to-call link: `tel:+16179396295` for a US number; the digits as typed otherwise. */
export function telHref(raw: string): string {
  const d = phoneDigits(raw)
  return d.length === 10 ? `tel:+1${d}` : `tel:${raw.replace(/[^\d+]/g, '')}`
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

/** `ask for Robin`, `ask for Robin or Casey`, `ask for Robin, Casey or Lee`; '' with nobody. */
export function askForWords(names: ReadonlyArray<string>): string {
  const firsts = [...new Set(names.map(firstName).filter(Boolean))]
  if (firsts.length === 0) return ''
  if (firsts.length === 1) return `ask for ${firsts[0]}`
  return `ask for ${firsts.slice(0, -1).join(', ')} or ${firsts[firsts.length - 1]}`
}

export type LegalOfficeContactLine = {
  /** `Office` · `Controller · settlements and payments` */
  role: string
  /** The person, '' for the office line. */
  name: string
  phoneWords: string
  href: string
  /** `ask for Robin or Casey` on the office line; '' otherwise. */
  note: string
}

/** The strip's lines: the office line when the company has a phone, then each controller with one. */
export function legalOfficeContactLines(c: LegalOfficeContacts): LegalOfficeContactLine[] {
  const lines: LegalOfficeContactLine[] = []
  if (c.phone) lines.push({ role: 'Office', name: '', phoneWords: formatUsPhone(c.phone), href: telHref(c.phone), note: askForWords(c.assistants) })
  for (const k of c.controllers) {
    if (!k.phone) continue
    lines.push({ role: 'Controller · settlements and payments', name: k.name, phoneWords: formatUsPhone(k.phone), href: telHref(k.phone), note: '' })
  }
  return lines
}

/** What each number is for — never a promise the office may not keep. '' when there is no line at all. */
export function legalOfficeContactsHoursLine(c: LegalOfficeContacts): string {
  const lines = legalOfficeContactLines(c)
  if (lines.length === 0) return ''
  const ctrl = c.controllers.find((k) => k.phone)
  if (!c.phone && ctrl) return `${firstName(ctrl.name)} answers for the office.`
  return ctrl ? `The office in business hours. ${firstName(ctrl.name)} when the office does not answer.` : 'The office in business hours.'
}

/** The same contacts as two lines for the printed packet's letterhead. */
export function legalOfficeContactPrintLines(c: LegalOfficeContacts): string[] {
  const out: string[] = []
  if (c.phone) out.push(`Reach the office: ${formatUsPhone(c.phone)}${c.assistants.length ? `, ${askForWords(c.assistants)}` : ''}`)
  for (const k of c.controllers) if (k.phone) out.push(`Controller ${k.name} ${formatUsPhone(k.phone)}`)
  return out
}

/** What the Legal desk's firm window says when the firm's page cannot name a controller; null when it can. */
export function legalOfficeContactsGap(c: LegalOfficeContacts): string | null {
  if (c.controllers.length === 0) return 'No controller on file — the firm’s page shows the office number alone.'
  if (c.controllers.some((k) => k.phone)) return null
  const names = c.controllers.map((k) => k.name).join(' and ')
  return `${names} ${c.controllers.length === 1 ? 'has' : 'have'} no phone on file — the firm’s page shows the office number alone.`
}
