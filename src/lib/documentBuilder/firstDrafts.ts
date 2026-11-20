/**
 * A builder's first draft (punch list #404, step 2): the contents the **Load the first draft** press writes into the
 * database for a builder that has none. The migration writes no words, so this is where a builder's first words come
 * from. They are placeholders, made to be typed over in the app, and no attorney or insurance agent has read them.
 *
 * The insurance sheet's first draft carries the company's own name where the file has a made-up one, since the
 * sheet goes out under the company's name. Its address lines start as words to type over when the company's record
 * holds no address, and a sheet cannot be published while one is left.
 *
 * Pure: no React, no supabase.
 */
import type { DocumentBuilderEntry } from './builders'
import { INSURANCE_SHEET_FIXTURE } from './insuranceSheet.fixture'
import { SECRECY_PAPER_FIXTURE } from './secrecyPaper.fixture'
import { SHEET_NEW, type SheetDef } from './sheet'

/** The company a first draft is for: its name, its legal name and its address as one or two lines. */
export type FirstDraftCompany = { name: string; legalName: string; address: string }

function insuranceFirstDraft(company?: FirstDraftCompany): SheetDef {
  if (!company) return INSURANCE_SHEET_FIXTURE
  const lines = company.address
    .split(/\n|,(?=[^,]*,[^,]*$)/)
    .map((l) => l.trim())
    .filter(Boolean)
  const addr1 = lines[0] ?? SHEET_NEW.address1
  const addr2 = lines.slice(1).join(', ') || SHEET_NEW.address2
  return { ...INSURANCE_SHEET_FIXTURE, fields: { ...INSURANCE_SHEET_FIXTURE.fields, co: company.name, addr1, addr2, hName: company.legalName || company.name, hAddr1: addr1, hAddr2: addr2 } }
}

const FIRST_DRAFTS: Record<string, (company?: FirstDraftCompany) => unknown> = {
  'sub-nda': () => SECRECY_PAPER_FIXTURE,
  insurance: insuranceFirstDraft,
}

/** The first draft for a builder, or null for a builder with none written yet. */
export function firstDraftOf(entry: DocumentBuilderEntry, company?: FirstDraftCompany): unknown | null {
  const make = FIRST_DRAFTS[entry.id]
  return make ? make(company) : null
}
