import { describe, expect, it } from 'vitest'
import { agreementDoor } from './documents/agreementsLedger'
import {
  contractsDocCompanyOffRosterWords,
  contractsDocLanding,
  contractsDocLinkCompanies,
  contractsDocLinkId,
  contractsDocOffRosterWords,
  type ContractsDocLinkCompanyPaper,
  type ContractsDocLinkRow,
} from './contractsDocLink'

const SENT = '11111111-1111-4111-8111-111111111111'
const SIGNED = '22222222-2222-4222-8222-222222222222'
const UNSENT = '33333333-3333-4333-8333-333333333333'
const GONE = '44444444-4444-4444-8444-444444444444'
const OLD = '55555555-5555-4555-8555-555555555555'
const NOBODY = '66666666-6666-4666-8666-666666666666'

const documents: ContractsDocLinkRow[] = [
  { id: SENT, person_name: 'Pat Lee', document_name: 'Job Secrecy Agreement', status: 'sent' },
  { id: SIGNED, person_name: 'Pat Lee', document_name: 'W-9', status: 'signed' },
  { id: UNSENT, person_name: 'Sam Ortiz', document_name: 'Direct deposit', status: 'unsent' },
  { id: OLD, person_name: 'Lou Away', document_name: 'W-9', status: 'sent' },
  { id: NOBODY, person_name: 'Renamed Since', document_name: 'I-9', status: 'sent' },
]
const roster = { activeNames: ['Pat Lee', 'Sam Ortiz'], archivedNames: ['Lou Away'] }
const land = (docId: string | null, loaded = true) => contractsDocLanding({ docId, loaded, documents, ...roster })

describe('contractsDocLinkId', () => {
  it('reads an id off the address and nothing else', () => {
    expect(contractsDocLinkId(`?tab=contracts&doc=${SENT}`)).toBe(SENT)
    expect(contractsDocLinkId(`?tab=contracts&doc=${SENT.toUpperCase()}`)).toBe(SENT.toUpperCase())
    expect(contractsDocLinkId('?tab=contracts')).toBeNull()
    expect(contractsDocLinkId('?tab=contracts&doc=')).toBeNull()
    expect(contractsDocLinkId('?doc=not-an-id')).toBeNull()
    expect(contractsDocLinkId('?doc=------------------------------------')).toBeNull()
    expect(contractsDocLinkId('')).toBeNull()
    expect(contractsDocLinkId(null)).toBeNull()
  })

  it('reads the address Documents writes for a waiting paper', () => {
    const door = agreementDoor({ kind: 'person_agreement', source_id: SENT, state: 'waiting', job_id: null, facts: { status: 'sent' } })
    expect(door.kind).toBe('people-contracts')
    if (door.kind !== 'people-contracts') return
    expect(contractsDocLinkId(door.to.slice(door.to.indexOf('?')))).toBe(SENT)
  })
})

describe('contractsDocLanding', () => {
  it('does nothing with no id, and waits for the tab to read its papers', () => {
    expect(land(null)).toEqual({ kind: 'none' })
    expect(land(null, false)).toEqual({ kind: 'none' })
    expect(land(SENT, false)).toEqual({ kind: 'wait' })
    expect(land(SIGNED, false)).toEqual({ kind: 'wait' })
    expect(contractsDocLanding({ docId: SENT, loaded: true, documents, activeNames: [], archivedNames: [] })).toEqual({ kind: 'wait' })
  })

  it('opens the signed record for a signed paper, as the thank-you page expects', () => {
    expect(land(SIGNED)).toEqual({ kind: 'signed-record', documentId: SIGNED })
  })

  it('lands a paper that is not signed on its own row, never on the signed record', () => {
    expect(land(SENT)).toEqual({ kind: 'paper-row', documentId: SENT, personName: 'Pat Lee', archived: false })
    expect(land(UNSENT)).toEqual({ kind: 'paper-row', documentId: UNSENT, personName: 'Sam Ortiz', archived: false })
    expect(land(SENT.toUpperCase())).toEqual({ kind: 'paper-row', documentId: SENT, personName: 'Pat Lee', archived: false })
  })

  it('says so when the row sits in the Archived section', () => {
    expect(land(OLD)).toEqual({ kind: 'paper-row', documentId: OLD, personName: 'Lou Away', archived: true })
  })

  it('leaves an id the tab does not list to the signed record window, which reads it and says why', () => {
    expect(land(GONE)).toEqual({ kind: 'signed-record', documentId: GONE })
    expect(contractsDocLanding({ docId: SENT, loaded: true, documents: [], ...roster })).toEqual({ kind: 'signed-record', documentId: SENT })
  })

  it('names a paper whose person has no line on the tab', () => {
    const landing = land(NOBODY)
    expect(landing).toEqual({ kind: 'off-roster', personName: 'Renamed Since', documentName: 'I-9' })
    if (landing.kind !== 'off-roster') return
    expect(contractsDocOffRosterWords(landing)).toBe('I-9 is for Renamed Since. That name is not on the People list, so the paper has no line on this tab.')
    expect(contractsDocOffRosterWords({ personName: ' ', documentName: '' })).toBe('This paper has no name on it, so it has no line on this tab.')
  })
})

// A trade company's paper is no person's: the tab keeps it off `documents` and draws it under the company's row.
const CO_SENT = '77777777-7777-4777-8777-777777777777'
const CO_SIGNED = '88888888-8888-4888-8888-888888888888'
const CO_GC_ONLY = '99999999-9999-4999-8999-999999999999'
const CO_NO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MECH = 'c0000000-0000-4000-8000-000000000001'
const GC_ONLY = 'c0000000-0000-4000-8000-000000000002'

const companyPapers: ContractsDocLinkCompanyPaper[] = [
  { id: CO_SENT, companyId: MECH, document_name: 'Subcontractor agreement', status: 'sent' },
  { id: CO_SIGNED, companyId: MECH, document_name: 'W-9', status: 'signed' },
  { id: CO_GC_ONLY, companyId: GC_ONLY, document_name: 'Trade agreement', status: 'sent' },
  { id: CO_NO_ID, companyId: null, document_name: '', status: 'unsent' },
]
const companies = [
  { id: MECH, name: 'ZZ Sample Mechanical LLC', workerNames: ['Pat Lee', 'Sam Ortiz'] },
  { id: GC_ONLY, name: 'Juniper Mechanical LLC', workerNames: [] },
]
const landCompany = (docId: string, companiesLoaded = true) => contractsDocLanding({ docId, loaded: true, documents, ...roster, companyPapers, companies, companiesLoaded })

describe('contractsDocLanding · a trade company’s paper', () => {
  it('reads the address Documents writes for a company’s waiting paper', () => {
    const door = agreementDoor({ kind: 'company_agreement', source_id: CO_SENT, state: 'waiting', job_id: null, facts: { status: 'sent' } })
    expect(door.kind).toBe('people-contracts')
    if (door.kind !== 'people-contracts') return
    expect(contractsDocLinkId(door.to.slice(door.to.indexOf('?')))).toBe(CO_SENT)
  })

  it('opens a waiting paper under its company’s row, over the workers the row sits on', () => {
    expect(landCompany(CO_SENT)).toEqual({ kind: 'company-paper', documentId: CO_SENT, companyId: MECH, workerNames: ['Pat Lee', 'Sam Ortiz'] })
    expect(landCompany(CO_SENT.toUpperCase())).toEqual({ kind: 'company-paper', documentId: CO_SENT, companyId: MECH, workerNames: ['Pat Lee', 'Sam Ortiz'] })
  })

  it('waits for the companies: a read still out never answers that the company has no row', () => {
    expect(landCompany(CO_SENT, false)).toEqual({ kind: 'wait' })
    expect(landCompany(CO_GC_ONLY, false)).toEqual({ kind: 'wait' })
    // A person's paper does not wait for them.
    expect(landCompany(SENT, false)).toEqual({ kind: 'paper-row', documentId: SENT, personName: 'Pat Lee', archived: false })
  })

  it('says a company no one on the roster works at keeps its paper in GC mode', () => {
    const landing = landCompany(CO_GC_ONLY)
    expect(landing).toEqual({ kind: 'company-off-roster', companyName: 'Juniper Mechanical LLC', documentName: 'Trade agreement' })
    if (landing.kind !== 'company-off-roster') return
    expect(contractsDocCompanyOffRosterWords(landing)).toBe(
      'Trade agreement is with Juniper Mechanical LLC. No one on the People list works there, so the paper has no line on this tab. It is kept in GC mode.',
    )
    // A paper whose name carries no company, and a company the tab never read: the same words, with what is known.
    expect(landCompany(CO_NO_ID)).toEqual({ kind: 'company-off-roster', companyName: '', documentName: '' })
    expect(contractsDocCompanyOffRosterWords({ companyName: ' ', documentName: '' })).toBe(
      'This paper is with a trade company. No one on the People list works there, so the paper has no line on this tab. It is kept in GC mode.',
    )
  })

  it('still opens the signed record for a company’s signed paper, and never the signed record for one that waits', () => {
    expect(landCompany(CO_SIGNED)).toEqual({ kind: 'signed-record', documentId: CO_SIGNED })
    expect(landCompany(CO_SENT).kind).not.toBe('signed-record')
    expect(landCompany(CO_GC_ONLY).kind).not.toBe('signed-record')
  })

  it('a tab that keeps no company papers answers as it always did', () => {
    expect(land(CO_SENT)).toEqual({ kind: 'signed-record', documentId: CO_SENT })
  })
})

describe('contractsDocLinkCompanies', () => {
  it('gives each company the tab read the names under its row, and none to a company with no row', () => {
    const pieces = [
      { kind: 'person' as const, name: 'Amy Staff' },
      { kind: 'company' as const, group: { company: { id: MECH }, workers: [{ name: 'Pat Lee' }, { name: 'Sam Ortiz' }] } },
    ]
    expect(contractsDocLinkCompanies([{ id: MECH, name: 'ZZ Sample Mechanical LLC' }, { id: GC_ONLY, name: 'Juniper Mechanical LLC' }], pieces)).toEqual(companies)
  })
})
