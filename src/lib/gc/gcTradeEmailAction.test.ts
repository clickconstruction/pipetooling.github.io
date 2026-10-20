import { describe, expect, it } from 'vitest'
import { buildGcTradeEmail, TRADE_EMAIL_WORDS, type GcTradeEmailInput } from '../../../supabase/functions/_shared/gcTradeEmail'

/** A company's master agreement (B6-b-i): its own step is the signing link, the portal a line under it. */
const msa: GcTradeEmailInput = {
  lang: 'en',
  recipients: ['Dana Ruiz'],
  company: 'GC test trade company, delete me',
  subject: 'Your master agreement with Click Construction',
  lines: ['Here is our master agreement. You sign it once, and it covers every job you do for us.', 'After that, each job is a short statement of work.'],
  linkUrl: 'https://pipetooling.github.io/t/portal-token',
  action: { label: 'Read and sign', url: 'https://pipetooling.github.io/contract/accept?t=sign&x=1' },
  signer: 'Rosa Office',
  gc: 'Click Construction',
}

describe('a trade email with its own step (the frame’s action, B6-b-i)', () => {
  it('leads with the action, then the portal as a line with its footnote', () => {
    const { text, html } = buildGcTradeEmail(msa)
    expect(text.split('\n')).toEqual([
      'Hello Dana,',
      '',
      'Here is our master agreement. You sign it once, and it covers every job you do for us.',
      '',
      'After that, each job is a short statement of work.',
      '',
      'Read and sign: https://pipetooling.github.io/contract/accept?t=sign&x=1',
      '',
      'Open your portal: https://pipetooling.github.io/t/portal-token',
      '',
      TRADE_EMAIL_WORDS.linkYours.en,
      '',
      'Thank you,',
      'Rosa Office',
      'Click Construction',
    ])
    // The ink button is the action's, its link escaped; the portal is a quiet line under it.
    expect(html).toContain('href="https://pipetooling.github.io/contract/accept?t=sign&amp;x=1"')
    expect(html).toContain('>Read and sign</a>')
    expect(html).toContain('Open your portal: <a href="https://pipetooling.github.io/t/portal-token"')
    expect(html).toContain(TRADE_EMAIL_WORDS.linkYours.en)
    expect(html.indexOf('Read and sign')).toBeLessThan(html.indexOf('Open your portal'))
  })

  it('with no portal link, has neither the portal line nor its footnote', () => {
    const { text, html } = buildGcTradeEmail({ ...msa, linkUrl: null })
    expect(text).not.toContain('Open your portal')
    expect(text).not.toContain(TRADE_EMAIL_WORDS.linkYours.en)
    expect(html).not.toContain('Open your portal')
    expect(html).not.toContain(TRADE_EMAIL_WORDS.linkYours.en)
    expect(text).toContain('Read and sign: https://pipetooling.github.io/contract/accept?t=sign&x=1')
  })

  it('in Spanish, the portal’s words are Spanish and the caller’s label stands', () => {
    const { text } = buildGcTradeEmail({ ...msa, lang: 'es', action: { label: 'Leer y firmar', url: msa.action!.url } })
    expect(text.startsWith('Hola Dana:')).toBe(true)
    expect(text).toContain('Leer y firmar: https://pipetooling.github.io/contract/accept?t=sign&x=1')
    expect(text).toContain(`${TRADE_EMAIL_WORDS.openPortal.es}: https://pipetooling.github.io/t/portal-token`)
    expect(text).toContain(TRADE_EMAIL_WORDS.thanks.es)
  })

  it('escapes the action’s words and refuses a link that is not https', () => {
    const { html } = buildGcTradeEmail({ ...msa, action: { label: 'Sign <now> & "here"', url: 'https://x.test/a?b=<c>' } })
    expect(html).toContain('>Sign &lt;now&gt; &amp; &quot;here&quot;</a>')
    expect(html).toContain('href="https://x.test/a?b=&lt;c&gt;"')
    expect(() => buildGcTradeEmail({ ...msa, action: { label: 'Read and sign', url: 'http://x.test/a' } })).toThrow('An action link must be https.')
    expect(() => buildGcTradeEmail({ ...msa, action: { label: 'Read and sign', url: 'javascript:alert(1)' } })).toThrow('An action link must be https.')
  })

  it('an email with no action still needs its portal link', () => {
    expect(() => buildGcTradeEmail({ ...msa, action: undefined, linkUrl: null })).toThrow('A trade email needs its portal link or an action.')
  })
})
