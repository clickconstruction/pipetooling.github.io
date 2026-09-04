import { describe, expect, it } from 'vitest'
import {
  buildContractSigningEmail,
  clampContractEmailIntro,
  clampContractEmailSubject,
  contractSigningEmailDefaultSubject,
  formatYmdForContractEmail,
  portalUrlForDisplay,
  splitIntroParagraphs,
  type ContractSigningEmailInput,
} from './contractSigningEmail'

const base: ContractSigningEmailInput = {
  documentName: 'Master Subcontract Agreement',
  personName: 'Misses Taunya <TESTING>',
  acceptUrl: 'https://clicktooling.com/contract/accept?t=abc123',
  expiresYmd: '2026-09-18',
  sentYmd: '2026-09-04',
  subjectOverride: '',
  introPlain: '',
  sender: { name: 'Robert Douglas', email: 'robert@clickplumbing.com' },
  portalUrl: 'https://my.clickplumbing.com/misses-taunya-testing',
  officePhone: null,
}

describe('buildContractSigningEmail', () => {
  it('files well by default: the subject names the document and the company, never the signer', () => {
    const m = buildContractSigningEmail(base)
    expect(m.subject).toBe('Please sign: Master Subcontract Agreement · Click Plumbing and Electrical')
    expect(m.subject).not.toContain('Taunya')
    expect(m.fromName).toBe('Click Plumbing and Electrical')
    expect(m.replyTo).toBe('robert@clickplumbing.com')
  })

  it('renders the paper: wordmark, the document, the sender, three steps, the button, expiry, portal band, Spanish line', () => {
    const { html, text } = buildContractSigningEmail(base)
    expect(html).toContain('CLICK<span style="color:#b0662f">.</span>')
    expect(html).toContain('<h1')
    expect(html).toContain('Master Subcontract Agreement')
    expect(html).toContain('Sent to you by Robert Douglas · Click Plumbing and Electrical')
    expect(html).toContain('For Misses Taunya &lt;TESTING&gt;')
    expect(html).toContain('Read the agreement (about 2 minutes)')
    expect(html).toContain('Type or draw your signature')
    expect(html).toContain('bgcolor="#16283c"')
    expect(html).toContain('>Read and sign</a>')
    expect(html).toContain('works until Sep 18, 2026')
    expect(html).toContain('it stays on your page.</strong> my.clickplumbing.com/misses-taunya-testing keeps your jobs')
    expect(html).toContain('<strong>Español</strong>')
    expect(html).toContain('Reply to this email to reach Robert, or call or text the office.')
    expect(html).toContain('color-scheme" content="light only"')
    expect(html).not.toContain('display:flex')
    expect(text).toContain('1. Open the page below')
    expect(text).toContain('Read and sign:\nhttps://clicktooling.com/contract/accept?t=abc123\nThis link works until Sep 18, 2026.')
    expect(text).toContain('¿Prefiere español?')
  })

  it('uses the default opening line when the staff member typed nothing, and their words when they did', () => {
    expect(buildContractSigningEmail(base).html).toContain('Here is your agreement to read and sign.')
    const m = buildContractSigningEmail({ ...base, introPlain: 'Taunya, here is the agreement we talked about.\nSign once, it covers every job.\n\nThanks!' })
    expect(m.html).toContain('Taunya, here is the agreement we talked about.<br />Sign once, it covers every job.')
    expect(m.html).toContain('>Thanks!</p>')
    expect(m.html).not.toContain('Here is your agreement to read and sign.')
    expect(m.text).toContain('Taunya, here is the agreement we talked about.\nSign once, it covers every job.\n\nThanks!')
  })

  it('honors the per-send subject and escapes it', () => {
    const m = buildContractSigningEmail({ ...base, subjectOverride: 'W-9 & Handbook <today>' })
    expect(m.subject).toBe('W-9 & Handbook <today>')
    expect(m.html).toContain('<title>W-9 &amp; Handbook &lt;today&gt;</title>')
  })

  it('falls back gracefully: no portal, no sender, no expiry, a phone', () => {
    const m = buildContractSigningEmail({ ...base, portalUrl: null, sender: null, expiresYmd: null, officePhone: '512-360-0599' })
    expect(m.replyTo).toBeNull()
    expect(m.html).toContain('we keep the copy on file.</strong> You never have to send it again.')
    expect(m.html).toContain('Sent to you by Click Plumbing and Electrical')
    expect(m.html).not.toContain('works until')
    expect(m.html).toContain('Questions? Call or text the office at 512-360-0599.')
    expect(m.text).not.toContain('This link works until')
  })

  it('never lets an accept-url paragraph or unescaped markup through', () => {
    const m = buildContractSigningEmail({ ...base, introPlain: '<script>alert(1)</script>' })
    expect(m.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(m.html).not.toContain('<script>')
  })
})

describe('helpers', () => {
  it('clamps subject and intro and strips control characters', () => {
    expect(clampContractEmailSubject('  x '.repeat(80))).toHaveLength(200)
    expect(clampContractEmailIntro('ab\nc')).toBe('ab\nc')
    expect(clampContractEmailIntro(42)).toBe('')
    expect(contractSigningEmailDefaultSubject('  ')).toBe('Please sign: your agreement · Click Plumbing and Electrical')
  })

  it('formats civil dates and portal addresses for reading', () => {
    expect(formatYmdForContractEmail('2026-09-18')).toBe('Sep 18, 2026')
    expect(formatYmdForContractEmail('2026-09-18T05:00:00Z')).toBe('Sep 18, 2026')
    expect(formatYmdForContractEmail('nope')).toBeNull()
    expect(portalUrlForDisplay('https://my.clickplumbing.com/dv-mechanical/')).toBe('my.clickplumbing.com/dv-mechanical')
    expect(splitIntroParagraphs('a\r\n\r\nb\nc\n\n\n')).toEqual(['a', 'b\nc'])
  })
})
