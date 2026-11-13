import { describe, expect, it } from 'vitest'
import { leftOutWords, type LeftOutRule } from './leftOut'
import { weekMailHtml, weekMailLeftOutLine, weekMailText, type WeekMail } from './weekMail'
import { sampleWeekMail } from './weekMailSample'

/** The Monday email says what the Bridge leaves out, in the page's own sentence under its name. */
const URL = 'https://example.test/bridge'
// Made-up names.
const rules: LeftOutRule[] = [
  { kind: 'development', key: 'dev-oak', label: 'Oak Hollow' },
  { kind: 'customer', key: 'cust-ridge', label: 'Ridgeway <Builders>' },
]
const base = sampleWeekMail('2026-11-13')
const withList: WeekMail = { ...base, leftOut: leftOutWords(rules) }

describe('what the Bridge leaves out, on the Monday email', () => {
  it('says it under the mail’s name, in the page’s sentence', () => {
    expect(weekMailLeftOutLine(withList)).toBe('Leaves out Oak Hollow and Ridgeway <Builders>.')
    const text = weekMailText(withList, URL).split('\n')
    expect(text[1]).toBe('Leaves out Oak Hollow and Ridgeway <Builders>.')
    expect(text[2]).toBe('')
    const html = weekMailHtml(withList, URL)
    expect(html).toContain('<br>Leaves out Oak Hollow and Ridgeway &lt;Builders&gt;.</div></div>')
    // Under the name and over the tiles.
    expect(html.indexOf('Leaves out Oak Hollow')).toBeLessThan(html.indexOf(base.model.tiles[0]?.label ?? ''))
  })

  it('says nothing of it when nothing is left out, and the mail is the mail there was', () => {
    for (const leftOut of [undefined, '', '  ']) {
      const mail: WeekMail = { ...base, leftOut }
      expect(weekMailLeftOutLine(mail)).toBe('')
      expect(weekMailText(mail, URL)).toBe(weekMailText(base, URL))
      expect(weekMailHtml(mail, URL)).toBe(weekMailHtml(base, URL))
    }
    // The line under the name is the blank one, as before. The cash tile's own note about bank accounts is another sentence.
    expect(weekMailText(base, URL).split('\n')[1]).toBe('')
    expect(weekMailHtml(base, URL)).not.toContain('<br>')
  })
})
