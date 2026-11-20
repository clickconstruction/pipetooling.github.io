import { describe, expect, it } from 'vitest'
import { PAPER_WORD_MAX, filedSignerName, isPartyPaperName, paperWord, signerEmailWord, signerRowPatch } from '../../../supabase/functions/_shared/paperSigner'

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
