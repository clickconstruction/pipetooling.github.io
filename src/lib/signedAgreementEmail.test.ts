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
  it('subject leads with who signed and how much; the work only when someone named it', () => {
    expect(sharedBuild(base).subject).toBe('Knight Contracting signed — $56,343 · Hunter Road Sound Studio')
    const est = { ...base, kind: 'estimate' as const, optionName: null, customerName: null, signerName: 'Dana Ruiz', totalCents: 425_000 }
    expect(sharedBuild({ ...est, title: 'Second-floor rough-in' }).subject).toBe('Dana Ruiz signed — $4,250 · Second-floor rough-in')
    // The app's default title repeats the signer — left out of the subject, the heading and the text.
    const plain = sharedBuild({ ...est, title: 'Estimate for Dana Ruiz' })
    expect(plain.subject).toBe('Dana Ruiz signed — $4,250')
    expect(plain.text.startsWith('Dana Ruiz accepted the estimate.\n')).toBe(true)
    expect(plain.html).not.toContain('Estimate for Dana Ruiz')
  })
  it('the inbox preview line is the job status', () => {
    const m = sharedBuild({ ...base, job: { id: 'job-1', hcpNumber: '1234' }, autoCreateOn: true })
    expect(m.html).toMatch(/<body[^>]*><div style="display:none[^"]*">Job J1234 was created automatically\.<\/div>/)
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
