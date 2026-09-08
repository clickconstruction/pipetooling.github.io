import { describe, expect, it } from 'vitest'
import { helpGuideAppPath, helpShareDescription, helpSharePageHtml, helpShareTitle, helpShareUrl } from './helpShareCard'

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
  it('carries the card tags, the noindex, the absolute image, and the bounce — escaped', () => {
    const html = helpSharePageHtml({ slug: 'bid-one-project-to-multiple-gcs', title: 'bid one project to multiple GCs', description: 'Send one bid to several "GCs" & track each.', origin: 'https://clicktooling.com' })
    expect(html).toContain('<meta property="og:title" content="How do I bid one project to multiple GCs?">')
    expect(html).toContain('<meta property="og:description" content="Send one bid to several &quot;GCs&quot; &amp; track each.">')
    expect(html).toContain('<meta property="og:image" content="https://clicktooling.com/og-card.png">')
    expect(html).toContain('<meta property="og:url" content="https://clicktooling.com/g/bid-one-project-to-multiple-gcs/">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).toContain('content="0;url=https://clicktooling.com/help?g=bid-one-project-to-multiple-gcs"')
    expect(html).toContain('window.location.replace("https://clicktooling.com/help?g=bid-one-project-to-multiple-gcs")')
  })
})
