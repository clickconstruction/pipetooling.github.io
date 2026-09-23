import { describe, expect, it } from 'vitest'
import { envelopeKey, runCopies, runEnvelopes } from './runEnvelopes'
import type { RunNotice } from './lienDeskRun'

const fields = { noticeDate: '2026-09-22', projectDescription: '', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Dudley Mason', contractedWithIfDifferent: '', claimAmount: '0.00', contactPerson: 'Robert', claimantAddress: '' }

function notice(itemId: string, jobId: string, label: string, owner: { name: string; address: string; email?: string }, gc = { name: 'RMC- Dudley Mason', address: '100 Builder Way, San Antonio, TX 78230', email: 'ap@dudley.test' }): RunNotice {
  return {
    itemId, jobId, kind: 'notice_53_056', label, jobNumber: label.split(' ')[0]!, months: ['2026-07'], amount: 9_400, fields, extras: {}, coverNote: 'note', coverLetter: null, ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: owner.name, address: owner.address, email: owner.email ?? '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: gc.name, address: gc.address, email: gc.email, method: 'certified_mail', tracking: '' },
    ],
  }
}

describe('envelopeKey', () => {
  it('is one party at one address — case, punctuation and spacing do not make a second envelope', () => {
    expect(envelopeKey('Elbel Holdings LLC', '4 Example Way, Schertz, TX')).toBe(envelopeKey('ELBEL HOLDINGS, L.L.C.', '4 Example Way  Schertz TX'))
    expect(envelopeKey('Elbel Holdings LLC', '4 Example Way')).not.toBe(envelopeKey('Elbel Holdings LLC', '5 Example Way'))
  })
  it('is empty when the name or the address is missing — those never merge', () => {
    expect(envelopeKey('', '4 Example Way')).toBe('')
    expect(envelopeKey('Someone', '')).toBe('')
  })
})

describe('runEnvelopes', () => {
  it('two notices to one owner at one address share an envelope, and the original contractor gets one envelope with every notice inside', () => {
    const a = notice('i1', 'j1016', '1016 · Dudley (Lenox)', { name: 'Lenox Hill Owner LP', address: '9703 Lenox Hl, San Antonio, TX 78240' })
    const b = notice('i2', 'j1031', '1031 · Dudley (Lenox II)', { name: 'lenox hill owner, lp', address: '9703 Lenox Hl San Antonio TX 78240' })
    const c = notice('i3', 'j706', '706 · Dudley (Vance)', { name: 'Vance Jackson LLC', address: '1 Vance Jackson Rd, San Antonio, TX' })
    const envs = runEnvelopes([a, b, c])
    expect(runCopies([a, b, c])).toBe(6)
    expect(envs.map((e) => [e.n, e.label, e.name, e.contents.map((x) => x.notice.label)])).toEqual([
      [1, 'Owner of record', 'Lenox Hill Owner LP', ['1016 · Dudley (Lenox)', '1031 · Dudley (Lenox II)']],
      [2, 'Original contractor', 'RMC- Dudley Mason', ['1016 · Dudley (Lenox)', '1031 · Dudley (Lenox II)', '706 · Dudley (Vance)']],
      [3, 'Owner of record', 'Vance Jackson LLC', ['706 · Dudley (Vance)']],
    ])
    // every content remembers where it sits in the notices, so a patch on the envelope reaches each recipient
    expect(envs[1]!.contents.map((x) => [x.noticeIndex, x.recipientIndex])).toEqual([[0, 1], [1, 1], [2, 1]])
  })

  it('a recipient with no name or no address is its own envelope, never merged with another blank', () => {
    const a = notice('i1', 'j1', '1 · A', { name: '', address: '' })
    const b = notice('i2', 'j2', '2 · B', { name: '', address: '' })
    const envs = runEnvelopes([a, b])
    expect(envs).toHaveLength(3)
    expect(envs.filter((e) => e.label === 'Owner of record')).toHaveLength(2)
  })

  it('the envelope carries the first email on file among the notices inside, and the first method and tracking', () => {
    const a = notice('i1', 'j1', '1 · A', { name: 'Owner LP', address: '1 Main St' })
    const b = notice('i2', 'j2', '2 · B', { name: 'Owner LP', address: '1 Main St', email: 'owner@lp.test' })
    a.recipients[0]!.tracking = '9407 1'
    const env = runEnvelopes([a, b])[0]!
    expect(env.email).toBe('owner@lp.test')
    expect(env.tracking).toBe('9407 1')
    expect(env.method).toBe('certified_mail')
  })
})
