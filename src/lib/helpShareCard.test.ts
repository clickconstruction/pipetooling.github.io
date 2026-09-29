import { describe, expect, it } from 'vitest'
import { HELP_SHARE_PREVIEW_AGENTS, HELP_SHARE_REDIRECT_MS, helpGuideAppPath, helpShareCardFit, helpShareCardLines, helpShareCardPath, helpShareCardSvg, helpShareDescription, helpSharePageHtml, helpShareTitle, helpShareUrl } from './helpShareCard'

describe('helpShareUrl / helpGuideAppPath / helpShareTitle', () => {
  it('builds the pretty share path with a trailing slash and the app bounce', () => {
    expect(helpShareUrl('https://clicktooling.com/', 'split-a-job-into-stages')).toBe('https://clicktooling.com/g/split-a-job-into-stages/')
    expect(helpGuideAppPath('split-a-job-into-stages')).toBe('/help?g=split-a-job-into-stages')
    expect(helpShareTitle('split a job into stages and bill stage by stage')).toBe('How do I split a job into stages and bill stage by stage?')
  })
})

describe('helpShareDescription', () => {
  it('takes the first paragraph, strips tokens and markdown, and cuts at a sentence', () => {
    const body = `A job's line items **are** its stages. Each line item says what kind of stage it is — {{button:gray|Order}}, {{button:amber|Any}}, or {{button:outline|—}} — on the second line under its name in **① Line Items**, and the draws in **② Invoices** follow from that. Everything happens on the job's **Bill** tab.

## The three kinds

- {{button:gray|Order}} — a numbered stage.`
    const d = helpShareDescription(body, 140)
    expect(d).toBe("A job's line items are its stages. Each line item says what kind of stage it is — Order, Any, or — — on the second line under its name in ① Line Items, and the draws in ② Invoices follow from that.".slice(0, 140).replace(/\s+\S*$/, '') + '…')
    expect(d.length).toBeLessThanOrEqual(141)
    expect(d).not.toContain('{{')
    expect(d).not.toContain('**')
  })

  it('skips a leading recording token, a heading and an example block', () => {
    const body = `{{gif:x.gif|A clip}}

:::example Something
Rough In $3,000
:::

## Heading

Short and sweet. Second sentence.`
    expect(helpShareDescription(body)).toBe('Short and sweet. Second sentence.')
  })
})

describe('helpSharePageHtml', () => {
  it('carries the card tags, the noindex, the absolute image — escaped — and is a landing page whose redirect spares a preview agent (v2.4190)', () => {
    const html = helpSharePageHtml({ slug: 'bid-one-project-to-multiple-gcs', title: 'bid one project to multiple GCs', description: 'Send one bid to several "GCs" & track each.', origin: 'https://clicktooling.com/', category: 'Bids' })
    expect(html).toContain('<meta property="og:title" content="How do I bid one project to multiple GCs?">')
    expect(html).toContain('<meta property="og:description" content="Send one bid to several &quot;GCs&quot; &amp; track each.">')
    expect(html).toContain('<meta property="og:image" content="https://clicktooling.com/og-card.png">') // no card drawn → the site card
    expect(html).toContain('<meta property="og:image:alt" content="How do I bid one project to multiple GCs?">')
    expect(html).toContain('<meta property="og:url" content="https://clicktooling.com/g/bid-one-project-to-multiple-gcs/">')
    expect(html).toContain('<link rel="canonical" href="https://clicktooling.com/g/bid-one-project-to-multiple-gcs/">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain('<meta name="robots" content="noindex">')
    // a real page for whoever reads it
    expect(html).toContain('<h1>How do I bid one project to multiple GCs?</h1>')
    expect(html).toContain('ClickTooling help · Bids')
    expect(html).toContain('href="https://clicktooling.com/help?g=bid-one-project-to-multiple-gcs" data-open-app')
    // the redirect: no meta refresh, after load, after the delay, never for a preview agent, never hidden
    expect(html).not.toContain('http-equiv="refresh"')
    expect(html).toContain('window.location.replace(app)')
    expect(html).toContain(`setTimeout(go,${HELP_SHARE_REDIRECT_MS})`)
    expect(html).toContain("if(document.visibilityState==='hidden')return")
    expect(html).toContain(HELP_SHARE_PREVIEW_AGENTS.toString())
    for (const ua of ['facebookexternalhit/1.1 Facebot Twitterbot/1.0', 'Mozilla/5.0 (compatible; Applebot/0.1)', 'Slackbot-LinkExpanding 1.0', 'WhatsApp/2.23', 'LinkPresentation/1.0']) expect(HELP_SHARE_PREVIEW_AGENTS.test(ua)).toBe(true)
    expect(HELP_SHARE_PREVIEW_AGENTS.test('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1')).toBe(false)
  })

  it('points the card tags at the guide’s own card when the build drew one', () => {
    const html = helpSharePageHtml({ slug: 'x', title: 'x', description: '', origin: 'https://clicktooling.com', image: helpShareCardPath('x') })
    expect(html).toContain('<meta property="og:image" content="https://clicktooling.com/g/x/card.png">')
    expect(html).toContain('<meta name="twitter:image" content="https://clicktooling.com/g/x/card.png">')
    expect(html).toContain('<p>A ClickTooling help guide.</p>')
  })
})

describe('the guide’s own card (v2.4190)', () => {
  it('wraps the question to the card at the biggest size that fits four lines', () => {
    expect(helpShareCardFit('How do I bill a customer?')).toEqual({ fontSize: 66, lines: ['How do I bill a customer?'] })
    const long = helpShareCardFit('How do I answer an owner who calls about a lien letter and record where they stand for counsel?')
    expect(long.fontSize).toBe(66)
    expect(long.lines.length).toBeLessThanOrEqual(4)
    expect(long.lines.join(' ')).toBe('How do I answer an owner who calls about a lien letter and record where they stand for counsel?')
    for (const l of long.lines) expect(l.length).toBeLessThanOrEqual(Math.floor(1040 / (66 * 0.56)))
    expect(helpShareCardLines('supercalifragilisticexpialidocious-word another', 66, 200)).toEqual(['supercalifragilisticexpialidocious-word', 'another'])
  })

  it('draws the dark card with the wordmark, the eyebrow, the escaped question and the share address', () => {
    const svg = helpShareCardSvg({ title: 'bid one project to multiple GCs & "win"', category: 'Bids', slug: 'bid-one-project-to-multiple-gcs' })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"')).toBe(true)
    expect(svg).toContain('fill="#0f172a"')
    expect(svg).toContain('Click<tspan fill="#60a5fa">Tooling</tspan>')
    expect(svg).toContain('HELP GUIDE · BIDS')
    expect(svg).toContain('How do I bid one project to multiple GCs &amp; &quot;win&quot;?')
    expect(svg).toContain('clicktooling.com/g/bid-one-project-to-multiple-gcs/')
    expect(svg).not.toContain('<script')
  })
})
