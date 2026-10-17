/**
 * The person we call, and the company under them (v2.5601, punch list #117). Every prospect is a
 * person we call, sometimes at a company: a homeowner on Jobs to GC, an estimator at a sub, a GC's
 * project manager. The form gathers the person first and the company under them, and the card's
 * title is whichever is the record. The row keeps `company_name` as the title for every reader
 * (the deck, the list, the doubles, the ZZ rule): a person on their own has their name there and
 * `is_person` true; `contact_name` is always the person. Everything here is pure.
 */
import { PROSPECT_LANGS } from './prospectKinds'

export type OkToText = 'not_asked' | 'yes' | 'no'

export const OK_TO_TEXT_CHOICES: readonly { value: OkToText; label: string }[] = [
  { value: 'not_asked', label: 'Not asked' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

export function okToTextOf(value: unknown): OkToText {
  return value === 'yes' || value === 'no' ? value : 'not_asked'
}

export interface PersonFields {
  name: string
  title: string
  cell: string
  email: string
  lang: 'en' | 'es' | ''
  okToText: OkToText
}

export interface CompanyFields {
  company: string
  officePhone: string
  address: string
  website: string
  alsoReach: string
  /** v2.5604: the Google Maps profile link, and a sub's license. */
  mapsUrl: string
  license: string
}

export const EMPTY_PERSON: PersonFields = { name: '', title: '', cell: '', email: '', lang: '', okToText: 'not_asked' }
export const EMPTY_COMPANY: CompanyFields = { company: '', officePhone: '', address: '', website: '', alsoReach: '', mapsUrl: '', license: '' }

/** The row's columns the two blocks read and write. */
export interface PersonRow {
  company_name: string | null
  contact_name: string | null
  contact_title: string | null
  contact_phone: string | null
  phone_number: string | null
  email: string | null
  address: string | null
  links_to_website: string | null
  lang: string | null
  ok_to_text: string | null
  is_person: boolean
  also_reach: string | null
  maps_url: string | null
  license: string | null
}

const s = (v: string | null | undefined) => (v ?? '').trim()

/** The form's two blocks from a row: a person on their own has an empty company block. */
export function blocksFromRow(row: PersonRow): { person: PersonFields; company: CompanyFields } {
  const person: PersonFields = {
    name: row.is_person ? s(row.company_name) || s(row.contact_name) : s(row.contact_name),
    title: s(row.contact_title),
    cell: s(row.contact_phone),
    email: s(row.email),
    lang: row.lang === 'en' || row.lang === 'es' ? row.lang : '',
    okToText: okToTextOf(row.ok_to_text),
  }
  const company: CompanyFields = {
    company: row.is_person ? '' : s(row.company_name),
    officePhone: s(row.phone_number),
    address: s(row.address),
    website: s(row.links_to_website),
    alsoReach: s(row.also_reach),
    mapsUrl: s(row.maps_url),
    license: s(row.license),
  }
  return { person, company }
}

/** What the two blocks write: `PersonRow` with the texting fact never null. */
export type PersonWrite = Omit<PersonRow, 'ok_to_text'> & { ok_to_text: OkToText }

/** What the two blocks write: the person is the record when the company block is empty. */
export function rowFromBlocks(person: PersonFields, company: CompanyFields): PersonWrite {
  const isPerson = s(company.company) === '' && s(person.name) !== ''
  return {
    company_name: (isPerson ? s(person.name) : s(company.company)) || null,
    contact_name: s(person.name) || null,
    contact_title: s(person.title) || null,
    contact_phone: s(person.cell) || null,
    phone_number: s(company.officePhone) || null,
    email: s(person.email) || null,
    address: s(company.address) || null,
    links_to_website: s(company.website) || null,
    lang: person.lang || null,
    ok_to_text: person.okToText,
    is_person: isPerson,
    also_reach: s(company.alsoReach) || null,
    maps_url: s(company.mapsUrl) || null,
    license: s(company.license) || null,
  }
}

/** What holds a save: a name for the person or the company. */
export function blocksProblem(person: PersonFields, company: CompanyFields): string | null {
  if (s(person.name) === '' && s(company.company) === '') return 'Give the person or the company a name.'
  return null
}

/** The card's title: the company, or the person on their own. */
export function prospectTitle(row: Pick<PersonRow, 'company_name' | 'contact_name'>): string {
  return s(row.company_name) || s(row.contact_name) || '(no name)'
}

export function langWords(lang: string | null | undefined): string {
  return PROSPECT_LANGS.find((l) => l.lang === lang)?.label ?? ''
}

/** The card's person line: the person (unless they are the title), their title, their language. */
export function personLineParts(row: Pick<PersonRow, 'contact_name' | 'contact_title' | 'lang' | 'is_person'>): string[] {
  return [row.is_person ? '' : s(row.contact_name), s(row.contact_title), langWords(row.lang)].filter(Boolean)
}

/** The texting fact on the card. */
export function textAskWords(ok: OkToText): { words: string; tone: 'quiet' | 'yes' | 'no' } {
  if (ok === 'yes') return { words: 'OK to text', tone: 'yes' }
  if (ok === 'no') return { words: 'no texts', tone: 'no' }
  return { words: 'text? not asked', tone: 'quiet' }
}

/** The number the phone button dials (the cell first), and the other one when both are known. */
export function callNumbers(row: Pick<PersonRow, 'contact_phone' | 'phone_number'>): { call: string | null; other: { label: 'office' | 'cell'; number: string } | null } {
  const cell = s(row.contact_phone)
  const office = s(row.phone_number)
  if (cell && office) return { call: cell, other: { label: 'office', number: office } }
  if (cell) return { call: cell, other: null }
  if (office) return { call: office, other: null }
  return { call: null, other: null }
}
