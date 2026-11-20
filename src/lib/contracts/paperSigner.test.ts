import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PAPER_WORD_MAX, filedSignerName, isPartyPaperName, paperAudience, paperForWords, paperWord, partyFileWords, signerEmailWord, signerRowPatch } from '../../../supabase/functions/_shared/paperSigner'

// Every name and address here is made up.
const person = { person_name: 'Priya Nair', signer_name: null }

describe('the words a paper keeps', () => {
  it('a word is trimmed text, or none', () => {
    expect(paperWord('  Lena   Park ')).toBe('Lena Park')
    expect(paperWord('   ')).toBeNull()
    expect(paperWord(undefined)).toBeNull()
    expect(paperWord(7)).toBeNull()
    expect(paperWord('x'.repeat(PAPER_WORD_MAX + 5))).toHaveLength(PAPER_WORD_MAX)
  })

  it('an address is trimmed, or none when it is no address', () => {
    expect(signerEmailWord(' priya@example.com ')).toBe('priya@example.com')
    expect(signerEmailWord('nobody')).toBeNull()
    expect(signerEmailWord('@example.com')).toBeNull()
    expect(signerEmailWord(null)).toBeNull()
  })
})

describe('the name a paper’s signer takes when nobody was named', () => {
  it('is the person the paper is filed under', () => {
    expect(filedSignerName(' Priya Nair ')).toBe('Priya Nair')
  })

  it('is never a stored name: a trade company’s or a party’s', () => {
    expect(filedSignerName('gc-company:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d')).toBeNull()
    expect(filedSignerName('party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d')).toBeNull()
    expect(isPartyPaperName('party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d')).toBe(true)
    expect(isPartyPaperName('Priya Nair')).toBe(false)
    expect(filedSignerName('')).toBeNull()
  })
})

describe('what one send writes about the signer', () => {
  it('an emailed send keeps the name, the title and the address', () => {
    expect(signerRowPatch({ mode: 'email', body: { signer_name: ' Priya R. Nair ', signer_title: 'Lead installer' }, signerEmail: ' priya@example.com ', row: person })).toEqual({
      signer_name: 'Priya R. Nair',
      signer_title: 'Lead installer',
      signer_email: 'priya@example.com',
    })
  })

  it('with nobody named, the signer is the person the paper is filed under', () => {
    expect(signerRowPatch({ mode: 'email', body: {}, signerEmail: 'priya@example.com', row: person })).toEqual({ signer_name: 'Priya Nair', signer_email: 'priya@example.com' })
  })

  it('with nobody named, a name the paper already keeps stays', () => {
    expect(signerRowPatch({ mode: 'email', body: { signer_name: '  ' }, signerEmail: 'luis@example.com', row: { person_name: 'Ortega Mechanical', signer_name: 'Luis Ortega' } })).toEqual({
      signer_name: 'Luis Ortega',
      signer_email: 'luis@example.com',
    })
  })

  it('a request that names no title leaves the row’s alone, and one sent as nothing clears it', () => {
    expect(signerRowPatch({ mode: 'email', body: { signer_name: 'Priya Nair' }, signerEmail: 'priya@example.com', row: person })).not.toHaveProperty('signer_title')
    expect(signerRowPatch({ mode: 'email', body: { signer_name: 'Priya Nair', signer_title: '' }, signerEmail: 'priya@example.com', row: person }).signer_title).toBeNull()
  })

  it('a paper filed under a stored name takes no signer from it', () => {
    const company = { person_name: 'gc-company:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d', signer_name: null }
    expect(signerRowPatch({ mode: 'email', body: {}, signerEmail: 'office@example.com', row: company })).toEqual({ signer_email: 'office@example.com' })
    const party = { person_name: 'party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d', signer_name: null }
    expect(signerRowPatch({ mode: 'link', body: {}, signerEmail: null, row: party })).toEqual({})
  })

  it('a link made to hand over keeps no address, and only names a signer the paper never had', () => {
    expect(signerRowPatch({ mode: 'link', body: { signer_name: 'Someone Else', signer_title: 'Owner' }, signerEmail: '', row: person })).toEqual({ signer_name: 'Priya Nair' })
    expect(signerRowPatch({ mode: 'link', body: {}, signerEmail: 'priya@example.com', row: { person_name: 'Priya Nair', signer_name: 'Priya R. Nair' } })).toEqual({})
  })

  it('an address that is none is not written, so the table’s check is never met with one', () => {
    expect(signerRowPatch({ mode: 'email', body: { signer_name: 'Priya Nair' }, signerEmail: 'nobody', row: person })).toEqual({ signer_name: 'Priya Nair' })
  })
})

describe('the business a party’s signer signs for', () => {
  const party = { person_name: 'party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d', signer_name: null }

  it('is kept when the send names one, and cleared when it is sent as nothing', () => {
    expect(signerRowPatch({ mode: 'email', body: { signer_name: 'Lena Park', signing_for: ' Tallgrass Supply Co. ' }, signerEmail: 'lena@tallgrass.example', row: party })).toEqual({
      signer_name: 'Lena Park',
      signing_for: 'Tallgrass Supply Co.',
      signer_email: 'lena@tallgrass.example',
    })
    expect(signerRowPatch({ mode: 'email', body: { signer_name: 'Noor Haddad', signing_for: '' }, signerEmail: 'noor@haddadeng.example', row: party }).signing_for).toBeNull()
  })

  it('is left alone by a send that names none: a person’s own paper keeps what it has', () => {
    expect(signerRowPatch({ mode: 'email', body: { signer_name: 'Priya Nair' }, signerEmail: 'priya@example.com', row: person })).not.toHaveProperty('signing_for')
  })
})

describe('who a paper is for, in words a person may read', () => {
  const party = { person_name: 'party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d', party_name: 'Tallgrass Supply Co.', signer_name: 'Lena Park' }

  it('a person’s paper is for the person it is filed under', () => {
    expect(paperForWords({ person_name: ' Priya Nair ' })).toBe('Priya Nair')
    expect(partyFileWords({ person_name: 'Priya Nair' })).toBe('')
  })

  it('a party’s is for whoever signs, else the party, and never its stored name', () => {
    expect(paperForWords(party)).toBe('Lena Park')
    expect(paperForWords(party, 'Omar Reyes')).toBe('Omar Reyes')
    expect(paperForWords({ ...party, signer_name: null })).toBe('Tallgrass Supply Co.')
    expect(paperForWords({ person_name: party.person_name })).toBe('the signer')
  })

  it('a party’s file downloads under the business', () => {
    expect(partyFileWords(party)).toBe('Tallgrass Supply Co.')
    expect(partyFileWords({ ...party, party_name: null })).toBe('Lena Park')
    expect(partyFileWords({ person_name: party.person_name })).toBe('an outside party')
  })
})

describe('who a signer is to us, for the consent the ledger keeps', () => {
  const stored = { person_name: 'party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d' }

  it('a person’s own paper and a trade company’s are a sub’s, as they were', () => {
    expect(paperAudience({ person_name: 'Priya Nair' }, null)).toBe('sub')
    expect(paperAudience({ person_name: 'gc-company:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d' }, null)).toBe('sub')
  })

  it('a party’s follows what its contact points at', () => {
    expect(paperAudience(stored, { customer_id: 'c1' })).toBe('customer')
    expect(paperAudience(stored, { customer_contact_person_id: 'cp1' })).toBe('customer')
    expect(paperAudience(stored, { gc_company_id: 'g1' })).toBe('sub')
    expect(paperAudience(stored, { gc_company_person_id: 'gp1' })).toBe('sub')
    // A supply house, a vendor, someone on no list, and a contact that could not be read.
    expect(paperAudience(stored, {})).toBe('outside')
    expect(paperAudience(stored, null)).toBe('outside')
  })
})

describe('the audiences, held together', () => {
  const ROOT = resolve(__dirname, '../../..')
  const quoted = (text: string) => [...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)

  /** The list of the newest migration that restates the audience check. */
  const newestCheck = (): string[] => {
    const dir = join(ROOT, 'supabase/migrations')
    let found: string[] | null = null
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      const all = [...readFileSync(join(dir, file), 'utf8').matchAll(/esign_consents_audience_check\s+CHECK \(audience IN \(([^)]*)\)\)/g)]
      const last = all[all.length - 1]
      if (last) found = quoted(last[1]!)
    }
    if (!found) throw new Error('no migration states esign_consents_audience_check')
    return found
  }

  it('the table’s check, the functions’ union and the app’s union name the same audiences', () => {
    const check = newestCheck().sort()
    const shared = readFileSync(join(ROOT, 'supabase/functions/_shared/esignConsent.ts'), 'utf8')
    const union = quoted(/audience: ('[^\n]+)/.exec(shared)?.[1] ?? '').sort()
    const app = quoted(/export type EsignAudience = ([^\n]+)/.exec(readFileSync(join(ROOT, 'src/lib/esignConsent.ts'), 'utf8'))?.[1] ?? '').sort()
    expect(check).toEqual(['customer', 'gc', 'outside', 'sub'])
    expect(union).toEqual(check)
    expect(app).toEqual(check)
  })

  it('the function’s parse takes every audience the check takes', () => {
    const shared = readFileSync(join(ROOT, 'supabase/functions/_shared/esignConsent.ts'), 'utf8')
    const parse = /const audience = ([^\n]+)/.exec(shared)?.[1] ?? ''
    for (const audience of newestCheck()) expect(parse, audience).toContain(`r.audience === '${audience}'`)
  })
})
