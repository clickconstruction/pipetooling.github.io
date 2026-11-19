import { describe, expect, it } from 'vitest'
import { agreementDoor } from './documents/agreementsLedger'
import { contractsDocLanding, contractsDocLinkId, contractsDocOffRosterWords, type ContractsDocLinkRow } from './contractsDocLink'

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
