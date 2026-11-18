import { describe, expect, it, vi } from 'vitest'
import { lienMailProof, type LienMailProofEnvelope } from './lienMailProof'
import { lienMailProofDoor, lienMailProofDoorPress, lienMailProofLack, lienMailProofLandingFocus, lienMailProofOwnerGap, lienMailProofPlaces, lienMailProofSelectors, lienMailProofServeLanding, lienMailProofWindowSpot, lienMailProofWindowTab, type LienMailProofDoorFacts } from './lienMailProofDoor'

const everywhere: LienMailProofDoorFacts = { ownerGap: null, served: false, can: { property: true, serve: true, lien_window: true } }
const send = (recipient: string, over: Record<string, unknown> = {}) => ({ recipient, method: 'certified_mail', tracking: '', sent_on: '2026-11-17', ...over })
const affidavit = (sends: unknown[], servedAt: string | null = null) => lienMailProof({ kind: 'affidavit', sends, documentUrl: 'https://drive.example/scan', servedAt, hasContractor: true })!
const copy = (envelopes: LienMailProofEnvelope[], recipient: string) => envelopes.find((e) => e.recipient === recipient)!

describe('the press on a recipient’s card', () => {
  it('walks a filed lien’s copy through every state, one lack at a time', () => {
    // Nothing mailed and no owner on the property record: the owner comes first, on the owner's card alone.
    const blank = affidavit([])
    const noOwner = { ...everywhere, ownerGap: 'owner' as const }
    expect(lienMailProofDoor('affidavit', copy(blank.envelopes, 'owner'), noOwner)).toEqual({ recipient: 'owner', lack: 'owner', place: 'property', label: 'Enter the owner of record ›' })
    expect(lienMailProofDoor('affidavit', copy(blank.envelopes, 'original_contractor'), noOwner)).toMatchObject({ lack: 'print', place: 'serve' })
    // The name is there and the address is not: the press names the address.
    expect(lienMailProofDoor('affidavit', copy(blank.envelopes, 'owner'), { ...everywhere, ownerGap: 'owner_address' })).toEqual({ recipient: 'owner', lack: 'owner_address', place: 'property', label: 'Enter the owner’s mailing address ›' })
    // Owner on file, nothing printed: the print, named as the press it lands on. It read Mail this copy › for a day.
    expect(lienMailProofDoor('affidavit', copy(blank.envelopes, 'owner'), everywhere)).toEqual({ recipient: 'owner', lack: 'print', place: 'serve', label: 'Print the copies to mail ›' })
    // The copies are printed and no number is typed: the same card reads the other half (`lienServeStage.ts`).
    expect(lienMailProofDoor('affidavit', copy(blank.envelopes, 'owner'), { ...everywhere, printed: true })).toEqual({ recipient: 'owner', lack: 'number', place: 'serve', label: 'Enter the mail number ›' })
    // The day is on record with no number: the number, in the Lien window, since a served lien has left the copies window.
    const served = affidavit([], '2026-11-18')
    expect(copy(served.envelopes, 'owner').line).toBe('Mailed, no number yet')
    expect(lienMailProofDoor('affidavit', copy(served.envelopes, 'owner'), { ...everywhere, served: true })).toEqual({ recipient: 'owner', lack: 'number', place: 'lien_window', label: 'Enter the mail number ›' })
    // A number with no receipt.
    const numbered = affidavit([send('owner', { tracking: '9507 01' })], '2026-11-18')
    expect(lienMailProofDoor('affidavit', copy(numbered.envelopes, 'owner'), { ...everywhere, served: true })).toEqual({ recipient: 'owner', lack: 'receipt', place: 'lien_window', label: 'Add the receipt ›' })
    // The same lack before the day is recorded is still worked in the copies window.
    const early = affidavit([send('owner', { tracking: '9507 01' })])
    expect(lienMailProofDoor('affidavit', copy(early.envelopes, 'owner'), everywhere)).toMatchObject({ lack: 'receipt', place: 'serve' })
    // Number and receipt on file: nothing is lacking, so there is no press.
    const whole = affidavit([send('owner', { tracking: '9507 01', receipt_url: 'https://drive.example/r1' })], '2026-11-18')
    expect(lienMailProofDoor('affidavit', copy(whole.envelopes, 'owner'), { ...everywhere, served: true })).toBeNull()
    // The contractor's card keeps its own press beside a finished owner's.
    expect(lienMailProofDoor('affidavit', copy(whole.envelopes, 'original_contractor'), { ...everywhere, served: true })).toMatchObject({ recipient: 'original_contractor', lack: 'number' })
  })

  it('reads a receipt with no number as a number still owed', () => {
    const p = affidavit([send('owner', { receipt_url: 'https://drive.example/r1' })])
    expect(lienMailProofLack(copy(p.envelopes, 'owner'), everywhere)).toBe('number')
  })

  it('sends a notice’s lack to its Lien window, and asks nothing of a copy that owes no proof', () => {
    const p = lienMailProof({ kind: 'notice_53_056', sends: [send('owner', { tracking: '9507 01' }), send('original_contractor')], mailedCopies: [] })!
    expect(lienMailProofDoor('notice', copy(p.envelopes, 'owner'), everywhere)).toEqual({ recipient: 'owner', lack: 'receipt', place: 'lien_window', label: 'Add the receipt ›' })
    expect(lienMailProofDoor('notice', copy(p.envelopes, 'original_contractor'), everywhere)).toMatchObject({ lack: 'number', place: 'lien_window' })
    const quiet = lienMailProof({ kind: 'notice_53_056', sends: [send('owner', { method: 'email', tracking: 'msg_1' }), send('original_contractor', { via: 'docsmit', piece_id: 'p1' }), ], mailedCopies: [] })!
    expect(quiet.envelopes.map((e) => lienMailProofDoor('notice', e, everywhere))).toEqual([null, null])
    // Plain mail has no number to type, and still has a receipt to keep.
    const plain = lienMailProof({ kind: 'retainage_53_057', sends: [send('owner', { method: 'mail' })] })!
    expect(lienMailProofDoor('retainage', copy(plain.envelopes, 'owner'), everywhere)).toMatchObject({ lack: 'receipt', place: 'lien_window' })
  })

  it('gives a viewer who cannot do the act no press, and falls back to the next place that is open', () => {
    const blank = affidavit([])
    const owner = copy(blank.envelopes, 'owner')
    expect(lienMailProofDoor('affidavit', owner, { ...everywhere, can: {} })).toBeNull()
    expect(lienMailProofDoor('affidavit', owner, { ...everywhere, ownerGap: 'owner', can: { serve: true, lien_window: true } })).toBeNull()
    // No copies window on this screen (the job's own Lien window): its own print press takes the print.
    expect(lienMailProofDoor('affidavit', owner, { ...everywhere, can: { lien_window: true } })).toMatchObject({ lack: 'print', place: 'lien_window' })
  })

  it('names the places in order and the spot the Lien window lands on', () => {
    expect(lienMailProofPlaces('affidavit', 'owner', false)).toEqual(['property'])
    expect(lienMailProofPlaces('affidavit', 'print', false)).toEqual(['serve', 'lien_window'])
    expect(lienMailProofPlaces('affidavit', 'receipt', true)).toEqual(['lien_window'])
    expect(lienMailProofPlaces('notice', 'number', false)).toEqual(['lien_window'])
    expect(lienMailProofWindowSpot({ paper: 'affidavit', lack: 'print' })).toBe('print')
    expect(lienMailProofWindowSpot({ paper: 'affidavit', lack: 'number' })).toBe('service')
    expect(lienMailProofWindowSpot({ paper: 'affidavit', lack: 'receipt' })).toBe('copy')
    expect(lienMailProofWindowSpot({ paper: 'notice', lack: 'number' })).toBe('row')
    expect(lienMailProofWindowSpot({ paper: 'retainage', lack: 'receipt' })).toBe('copy')
    // In the copies window a print lands on the print half, and anything else on the copy's own line.
    expect(lienMailProofServeLanding({ jobId: 'j1', recipient: 'owner', lack: 'print' })).toEqual({ part: 'print' })
    expect(lienMailProofServeLanding({ jobId: 'j1', recipient: 'owner', lack: 'number' })).toEqual({ part: 'numbers', jobId: 'j1', recipient: 'owner', cursor: true })
    expect(lienMailProofServeLanding({ jobId: 'j1', recipient: 'original_contractor', lack: 'receipt' })).toEqual({ part: 'numbers', jobId: 'j1', recipient: 'original_contractor', cursor: false })
    expect(lienMailProofSelectors.filingCopy('f1', 'original_contractor')).toBe('[data-lien-filing-row="f1"] [data-lien-mail-proof-envelope="original_contractor"]')
    expect([lienMailProofLandingFocus('number'), lienMailProofLandingFocus('receipt'), lienMailProofLandingFocus('print')]).toEqual(['input[type="text"]', 'button', null])
    expect([lienMailProofWindowTab('affidavit'), lienMailProofWindowTab('notice'), lienMailProofWindowTab('retainage')]).toEqual(['affidavit', 'notice', 'notice'])
  })

  it('reads the owner’s gap off the property record: the name first, then the address', () => {
    expect(lienMailProofOwnerGap({ name: '', mailingAddress: '12 Elm St' })).toBe('owner')
    expect(lienMailProofOwnerGap({ name: 'Maple Row LLC', mailingAddress: ' ' })).toBe('owner_address')
    expect(lienMailProofOwnerGap({ name: 'Maple Row LLC', mailingAddress: '12 Elm St' })).toBeNull()
  })

  it('wires a card’s press: it closes the window first, then opens the place with what to land on', () => {
    const order: string[] = []
    const serve = vi.fn(() => order.push('serve'))
    const lienWindow = vi.fn(() => order.push('lien_window'))
    const facts = { jobId: 'j1', filingId: 'f1', paper: 'affidavit' as const, served: false, ownerGap: null }
    const pressFor = lienMailProofDoorPress(facts, { serve, lien_window: lienWindow }, () => order.push('close'))
    const blank = affidavit([])
    const press = pressFor(copy(blank.envelopes, 'original_contractor'))!
    expect(press.label).toBe('Print the copies to mail ›')
    press.onPress()
    expect(order).toEqual(['close', 'serve'])
    expect(serve).toHaveBeenCalledWith({ jobId: 'j1', filingId: 'f1', paper: 'affidavit', recipient: 'original_contractor', lack: 'print' })
    // No opener for the property record on this screen: the owner's gap gets no press, and nothing else is offered in its place.
    expect(lienMailProofDoorPress({ ...facts, ownerGap: 'owner' }, { serve, lien_window: lienWindow })(copy(blank.envelopes, 'owner'))).toBeNull()
    // No openers at all: a reader, with no press on any card.
    expect(blank.envelopes.map(lienMailProofDoorPress(facts, {}))).toEqual([null, null])
  })
})
