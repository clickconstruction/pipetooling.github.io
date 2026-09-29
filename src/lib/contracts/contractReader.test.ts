// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { CUSTOMER_CONTRACT_CATALOG } from './customerContractCatalog'
import { READER_HIT_ATTR, findWordingInDocument, readerSampleLine, readerSurfacesFor, wordingNeedle, wordingNeedles } from './contractReader'

const entry = (id: string) => {
  const e = CUSTOMER_CONTRACT_CATALOG.find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e
}

describe('contractReader', () => {
  it('lists the pages, emails and papers a card is seen on, in the card’s order, and nothing for a card seen nowhere', () => {
    expect(readerSurfacesFor(entry('job-standard-terms')).map((s) => `${s.stepId}:${s.step.render.kind}`)).toEqual(['job-contract-page:page', 'job-contract-email:email', 'job-contract-signed:page'])
    expect(readerSurfacesFor(entry('demand-letter')).map((s) => s.step.render.kind)).toEqual(['paper'])
    expect(readerSurfacesFor(entry('bid-closing'))).toEqual([])
    expect(readerSurfacesFor(entry('esign-consent')).map((s) => s.journeyId)).toEqual(['homeowner', 'homeowner', 'gc', 'homeowner'])
  })

  it('every card with a surface has one the reader can show', () => {
    const shown = CUSTOMER_CONTRACT_CATALOG.filter((e) => readerSurfacesFor(e).length > 0).map((e) => e.id)
    expect(shown).toContain('estimate-terms')
    expect(shown).toContain('bid-terms')
    expect(shown).toContain('owner-lien-notice')
    expect(shown).not.toContain('bid-letter-fixed')
  })

  it('names the sample the page shows: the homeowner, the estimate, the job, the GC', () => {
    expect(readerSampleLine({ journeyId: 'homeowner', stepId: 'job-contract-page' })).toBe('Sam Sample · 100 Sample St, Kyle, TX 78640 · Job 1042 · $1,850.00')
    expect(readerSampleLine({ journeyId: 'homeowner', stepId: 'estimate-page' })).toBe('Sam Sample · Water heater replacement · $4,380.00')
    expect(readerSampleLine({ journeyId: 'homeowner', stepId: 'demand-letter' })).toBe('Sam Sample · 100 Sample St, Kyle, TX 78640')
    expect(readerSampleLine({ journeyId: 'gc', stepId: 'bid-room' })).toBe('Pat Sample, Sample Contracting · Cedar Bend Apartments')
  })

  it('the needle is the first real sentence, without its number, cut at a word', () => {
    expect(wordingNeedle({ text: '1. Scope. Contractor agrees to perform the work described above at the property listed, in a workmanlike manner.', format: 'plain' })).toBe('Contractor agrees to perform the work described above at')
    expect(wordingNeedle({ text: '<h3>Terms</h3><p>Half is due when this agreement is signed &amp; the balance when the work is complete.</p>', format: 'html' })).toBe('Half is due when this agreement is signed & the balance')
    expect(wordingNeedle({ text: 'I agree.', format: 'plain' })).toBe('I agree.')
    expect(wordingNeedle({ text: '   ', format: 'plain' })).toBeNull()
  })

  it('offers the first three real sentences as needles, and the reader tries them in order', () => {
    expect(wordingNeedles({ text: '1. Scope. Contractor agrees to perform the work described above. 2. Changes. Additional or changed work will be priced in writing. 3. Payment. Payment is due as stated above, whatever the day.', format: 'plain' })).toEqual([
      'Contractor agrees to perform the work described above.',
      'Additional or changed work will be priced in writing.',
      'Payment is due as stated above, whatever the day.',
    ])
    document.body.innerHTML = '<p id="a">Something with the SECOND sentence: additional or changed work will be priced in writing, always.</p>'
    expect(findWordingInDocument(document, ['not on the page at all', 'additional or changed work will be priced'])?.element.id).toBe('a')
  })

  it('a labelled line loses its label, and a long sentence also offers its tail — the page may swap the noun near its start', () => {
    const consent = 'A homeowner signing an agreement: I agree to sign this agreement electronically, and I understand that my electronic signature is as binding as a handwritten one.'
    const needles = wordingNeedles({ text: consent, format: 'plain' })
    expect(needles[0]).toBe('I agree to sign this agreement electronically, and I')
    expect(needles).toContain('my electronic signature is as binding as a handwritten one.')
    document.body.innerHTML = '<label id="c">I agree to sign this estimate electronically, and I understand that my electronic signature is as binding as a handwritten one.</label>'
    expect(findWordingInDocument(document, needles)?.element.id).toBe('c')
  })

  it('paints only the phrase inside a long block when the browser can, without touching the text; lights the block when it cannot', () => {
    const long = 'A'.repeat(300) + ' The clause we want is here, in the middle of a very long box. ' + 'B'.repeat(300)
    document.body.innerHTML = `<div id="box" style="white-space: pre-wrap">${long}</div>`
    // jsdom has no CSS Highlight API: the whole block is lit.
    const plain = findWordingInDocument(document, 'The clause we want is here')
    expect(plain?.element.id).toBe('box')
    expect(plain?.range).toBeNull()
    expect((plain?.element as HTMLElement).style.backgroundColor).toBe('rgb(255, 243, 191)')
    // With the API, the block keeps its style and its text; the range is the phrase, registered under the reader's name.
    const set = new Map<string, unknown>()
    const hadCss = Object.getOwnPropertyDescriptor(window, 'CSS')
    Object.defineProperty(window, 'CSS', { value: { highlights: set }, configurable: true, writable: true })
    Object.defineProperty(window, 'Highlight', {
      value: class {
        ranges: Range[]
        constructor(...r: Range[]) {
          this.ranges = r
        }
      },
      configurable: true,
      writable: true,
    })
    const hit = findWordingInDocument(document, 'The clause we want is here')
    expect(hit?.element.id).toBe('box')
    expect(hit?.range?.toString()).toBe('The clause we want is here')
    expect((hit?.element as HTMLElement).style.backgroundColor).toBe('')
    expect(set.has('contract-reader')).toBe(true)
    expect(document.getElementById('contract-reader-highlight-style')?.textContent).toContain('::highlight(contract-reader)')
    expect(document.getElementById('box')?.childNodes).toHaveLength(1)
    // A second look clears the first.
    expect(findWordingInDocument(document, 'nowhere on this page')).toBeNull()
    expect(set.has('contract-reader')).toBe(false)
    if (hadCss) Object.defineProperty(window, 'CSS', hadCss)
    else delete (window as unknown as Record<string, unknown>).CSS
    delete (window as unknown as Record<string, unknown>).Highlight
  })

  it('lights the smallest block that carries the needle, once, and clears an earlier hit', () => {
    document.body.innerHTML = '<div id="a"><p id="p1">Something else.</p><div id="deep"><p id="p2">Half is due when this agreement is signed and the balance when the work is complete.</p></div></div>'
    const hit = findWordingInDocument(document, 'half is due when this   agreement is signed')
    expect(hit?.element.id).toBe('p2')
    expect(document.querySelectorAll(`[${READER_HIT_ATTR}]`)).toHaveLength(1)
    expect((hit?.element as HTMLElement).style.backgroundColor).toBe('rgb(255, 243, 191)')
    expect(findWordingInDocument(document, 'not on the page')).toBeNull()
    expect(document.querySelectorAll(`[${READER_HIT_ATTR}]`)).toHaveLength(0)
  })
})
