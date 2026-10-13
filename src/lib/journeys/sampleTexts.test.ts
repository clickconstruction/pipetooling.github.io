/**
 * What customers see, Messages cut 5: the texts the tab shows are the kernels' own words, over the Messages prototype's
 * made-up people.
 */
import { describe, expect, it } from 'vitest'
import { SAMPLE_TEXT_IDS } from '../customerJourneys'
import { optoutLine } from '../messages/textOut'
import { plainWordsFailures } from '../plainWords'
import { helpAnswer } from '../quo/events'
import { SAMPLE_TEXT_COMPANY, sampleText } from './sampleTexts'

describe('the sample texts', () => {
  it('builds every text the journeys name', () => {
    for (const id of SAMPLE_TEXT_IDS) expect(sampleText(id).bubbles.length).toBeGreaterThan(0)
  })

  it('shows a customer the first text with its opt-out line, then the app’s answer to HELP', () => {
    const t = sampleText('text-customer')
    expect(t.from).toBe('Click Construction · (210) 555-0100')
    expect(t.bubbles.map((b) => b.side)).toEqual(['ours', 'theirs', 'ours'])
    expect(t.bubbles[0]?.text).toBe(`Elena, pay application 3 for Fair Oaks Shops is in your portal.\nYour portal: click.co/p/7Hq2\n\n${optoutLine(SAMPLE_TEXT_COMPANY)}`)
    expect(t.bubbles[2]?.text).toBe(helpAnswer(SAMPLE_TEXT_COMPANY))
  })

  it('shows a trade partner the first text and his reply', () => {
    const t = sampleText('text-trade')
    expect(t.bubbles[0]?.text).toBe(`Greg, checking on the Boerne sitework number. Still good for today?\n\n${optoutLine(SAMPLE_TEXT_COMPANY)}`)
    expect(t.bubbles[1]).toEqual({ side: 'theirs', text: 'Yes, end of day.', note: null })
  })

  it('takes another company’s name and number', () => {
    const t = sampleText('text-trade', { name: 'Pipe Co', phone: '(210) 555-0142', mailbox: 'office@pipe.example' })
    expect(t.from).toBe('Pipe Co · (210) 555-0142')
    expect(t.bubbles[0]?.text.endsWith('Pipe Co. Reply STOP to opt out.')).toBe(true)
  })

  it('keeps the office’s notes in plain words', () => {
    const notes = SAMPLE_TEXT_IDS.flatMap((id) => sampleText(id).bubbles.flatMap((b) => (b.note ? [b.note] : [])))
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.flatMap((n) => plainWordsFailures(n))).toEqual([])
  })
})
