import { describe, expect, it } from 'vitest'
import { parsePaperDef } from './definition'
import { customerBuilderWords, placeCustomerBuilders, type CustomerBuilder } from './customerPageBuilders'
import { SAMPLE_BUILDER_SEND_ID, sampleBuilderSendWords, sampleCustomerBuilders, sampleCustomerPageAnswer, withSampleBuilders } from './gcSendSample'
import { SECRECY_PAPER_FIXTURE } from './secrecyPaper.fixture'

describe('the Sub NDA on the sample GC’s page (What customers see)', () => {
  it('is one builder about all their jobs, at revision 1, not opened yet, on the placeholder words', () => {
    const got = sampleCustomerBuilders()
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({ sendId: SAMPLE_BUILDER_SEND_ID, builderKey: 'sub-nda', aboutJobId: null, aboutJob: null, revision: 1, openedOn: null, opened: false, changed: false })
    expect(got[0]?.def.title).toBe(SECRECY_PAPER_FIXTURE.title)
    expect(got[0]?.def.topics.map((t) => t.key)).toEqual(SECRECY_PAPER_FIXTURE.topics.map((t) => t.key))
  })

  it('goes through the page\u2019s own parse, in the shape the customer portal answers', () => {
    const answer = sampleCustomerPageAnswer()
    expect(Object.keys(answer[0] ?? {}).sort()).toEqual(['aboutJob', 'aboutJobId', 'builderKey', 'changed', 'contents', 'opened', 'openedOn', 'revision', 'sendId'])
    // The contents read as a paper after a trip through JSON, as an answer from the function would.
    expect(parsePaperDef(JSON.parse(JSON.stringify(answer[0]?.contents))).ok).toBe(true)
  })

  it('leads the page, with the block’s own words and the New chip', () => {
    const [one] = sampleCustomerBuilders() as [CustomerBuilder]
    expect(placeCustomerBuilders([one], ['j1', 'j2'])).toEqual({ top: [one], byJob: [] })
    expect(customerBuilderWords(one, 'Made-up Plumbing')).toMatchObject({ title: 'Secrecy on your jobs', chip: { tone: 'new', words: 'New' }, open: 'Open the Sub NDA builder' })
  })

  it('is laid over an answer with no builder, and leaves an answer that has one alone', () => {
    const bare = { customerName: 'Sample Contracting', builders: [] as CustomerBuilder[] }
    const laid = withSampleBuilders(bare)
    expect(laid).not.toBe(bare)
    expect(laid.customerName).toBe('Sample Contracting')
    expect(laid.builders.map((b) => b.sendId)).toEqual([SAMPLE_BUILDER_SEND_ID])
    expect(bare.builders).toEqual([])

    const theirs = { builders: [{ ...(sampleCustomerBuilders()[0] as CustomerBuilder), sendId: 'from-the-function' }] }
    expect(withSampleBuilders(theirs)).toBe(theirs)
  })
})

describe('the sample email a GC gets', () => {
  it('is the first send’s own words, about all their jobs, on the note a send starts with', () => {
    expect(sampleBuilderSendWords('Made-up Plumbing')).toEqual({
      subject: 'Secrecy on your jobs with Made-up Plumbing',
      lines: ['Here is how we bind the people we bring onto your jobs. Tell me what you would change.', 'It is on your page.', 'You can look. Nothing is sent from it.'],
    })
  })
})
