import { describe, expect, it } from 'vitest'
import { buildSignedAgreementEmail as appBuild, signedAgreementRecordLabel } from './signedAgreementEmail'
import { buildSignedAgreementEmail as sharedBuild, type SignedAgreementEmailInput } from '../../supabase/functions/_shared/signedAgreementEmail'

const base: SignedAgreementEmailInput = {
  kind: 'bid',
  estimateNumber: 412,
  title: 'Hunter Road Sound Studio',
  projectAddress: '2530 Hunter Rd, San Marcos, TX',
  customerName: 'Knight Contracting',
  signerName: 'Mark Knight',
  optionName: 'To Plans',
  totalCents: 5_634_300,
  signedAtLabel: 'Sept 4, 2026 · 9:12 AM',
  origin: 'https://clicktooling.com/',
  job: null,
  autoCreateOn: false,
}

describe('signedAgreementEmail (v2.2743)', () => {
  it('subject is fileable and starts with the stream prefix', () => {
    expect(sharedBuild(base).subject).toBe('Signed — Hunter Road Sound Studio — $56,343 (Bid room proposal #412)')
    expect(sharedBuild({ ...base, kind: 'estimate', optionName: null }).subject).toBe('Signed — Hunter Road Sound Studio — $56,343 (Estimate #412)')
  })
  it('no job → Create the job button pointing at the record deep link', () => {
    const m = sharedBuild(base)
    expect(m.html).toContain('Create the job')
    expect(m.html).toContain('https://clicktooling.com/estimates/412?createJob=1')
    expect(m.text).toContain('No job yet — create it from the record when the work is ready.')
  })
  it('job present → Open job J#### button; auto-create wording when the toggle is on', () => {
    const m = sharedBuild({ ...base, job: { id: 'job-1', hcpNumber: '1234' }, autoCreateOn: true })
    expect(m.html).toContain('Open job J1234')
    expect(m.html).toContain('https://clicktooling.com/jobs?edit=job-1')
    expect(m.text).toContain('Job J1234 was created automatically.')
    expect(m.html).not.toContain('Create the job')
  })
  it('auto-create on but no job → says so honestly', () => {
    expect(sharedBuild({ ...base, autoCreateOn: true }).text).toContain('automatic creation did not run')
  })
  it('mail-safe: bgcolor buttons, light-only, escaped text', () => {
    const m = sharedBuild({ ...base, title: 'A <B> & "C"' })
    expect(m.html).toContain('<td bgcolor="#3b82f6"')
    expect(m.html).toContain('color-scheme" content="light only"')
    expect(m.html).toContain('A &lt;B&gt; &amp; &quot;C&quot;')
    expect(m.html).not.toContain('display:flex')
  })
  it('app twin is byte-identical to the shared builder', () => {
    for (const input of [base, { ...base, kind: 'estimate' as const, optionName: null, job: { id: 'j', hcpNumber: 'J77' }, autoCreateOn: true }]) {
      const a = appBuild(input)
      const s = sharedBuild(input)
      expect(a.subject).toBe(s.subject)
      expect(a.text).toBe(s.text)
      expect(a.html).toBe(s.html)
    }
    expect(signedAgreementRecordLabel('bid', 9)).toBe('Bid room proposal #9')
  })
})
