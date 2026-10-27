import { describe, expect, it } from 'vitest'
import { OFFERED_OPTIONS_WORDS, estimateOfferedOptionsView, offeredOptionsCountWords } from './estimateOfferedOptionsView'
import type { EstimateOption } from './estimateOptions'

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const line = (line_item: string, amount_cents: number) => ({ line_item, description: '', quantity: 1, unit_price_cents: amount_cents, amount_cents })
const opt = (key: string, name: string, cents: number, kind: EstimateOption['kind'], over: Partial<EstimateOption> = {}): EstimateOption => ({
  key,
  name,
  description: '',
  recommended: false,
  kind,
  line_items: [line(name, cents)],
  ...over,
})

const pvc = opt('pvc', 'PVC water line', 1_097_200, 'choice', { recommended: true, description: ' Supply, trench and cover up to 1,500 ft. ' })
const hdpe = opt('hdpe', 'HDPE water line', 1_341_000, 'choice', { line_items: [line('Fused HDPE', 1_286_000), line('Fire connection', 55_000)] })
const soft = opt('soft', 'Water softener', 195_000, 'add_on')
const bibs = opt('bibs', 'Hose bibs (2)', 39_000, 'add_on', { preticked: true })

describe('estimateOfferedOptionsView', () => {
  it('a single-option estimate draws nothing new', () => {
    const v = estimateOfferedOptionsView([pvc], money)
    expect(v.active).toBe(false)
    expect(v.blocks).toEqual([])
  })

  it('every option in offered order, numbered, with its own lines and total', () => {
    const v = estimateOfferedOptionsView([pvc, hdpe], money)
    expect(v.active).toBe(true)
    expect(v.heading).toBe('What was offered')
    expect(v.countWords).toBe('2 options · choose one')
    expect(v.blocks.map((b) => b.heading)).toEqual(['Option 1 · PVC water line', 'Option 2 · HDPE water line'])
    expect(v.blocks.map((b) => b.money)).toEqual(['$10972.00', '$13410.00'])
    expect(v.blocks[1]!.lines.map((l) => l.line_item)).toEqual(['Fused HDPE', 'Fire connection'])
  })

  it('the recommended option wears the star and the Pipeline note; the pitch is trimmed', () => {
    const v = estimateOfferedOptionsView([pvc, hdpe], money)
    expect(v.blocks[0]!.chips).toEqual([OFFERED_OPTIONS_WORDS.recommended])
    expect(v.blocks[0]!.note).toBe("The Pipeline's number until they decide.")
    expect(v.blocks[0]!.pitch).toBe('Supply, trench and cover up to 1,500 ft.')
    expect(v.blocks[1]!.chips).toEqual([])
    expect(v.blocks[1]!.note).toBeNull()
    expect(v.blocks[1]!.pitch).toBe('')
  })

  it('an accepted row keeps the star and drops the note', () => {
    const v = estimateOfferedOptionsView([pvc, hdpe], money, { accepted: true })
    expect(v.blocks[0]!.chips).toEqual([OFFERED_OPTIONS_WORDS.recommended])
    expect(v.blocks.every((b) => b.note === null)).toBe(true)
  })

  it('add-ons price with a + and say when they start ticked', () => {
    const v = estimateOfferedOptionsView([pvc, hdpe, soft, bibs], money)
    expect(v.countWords).toBe('4 options · 2 add-ons')
    expect(v.blocks[2]!.money).toBe('+ $1950.00')
    expect(v.blocks[2]!.chips).toEqual([OFFERED_OPTIONS_WORDS.addOn])
    expect(v.blocks[3]!.chips).toEqual([OFFERED_OPTIONS_WORDS.addOn, OFFERED_OPTIONS_WORDS.startsTicked])
  })

  it('an all-add-on estimate says tick any and stars the one the office forecasts', () => {
    const kitchen = opt('kitchen', 'Kitchen rough-in', 420_000, 'add_on', { recommended: true })
    const v = estimateOfferedOptionsView([kitchen, soft], money)
    expect(v.countWords).toBe('2 options · tick any')
    expect(v.blocks[0]!.chips).toEqual([OFFERED_OPTIONS_WORDS.recommended, OFFERED_OPTIONS_WORDS.addOn])
    expect(v.blocks[0]!.note).toBe(OFFERED_OPTIONS_WORDS.recommendedNote)
  })

  it('an unnamed option reads as Option', () => {
    const v = estimateOfferedOptionsView([opt('a', '  ', 100, 'choice', { recommended: true }), opt('b', 'B', 200, 'choice')], money)
    expect(v.blocks[0]!.heading).toBe('Option 1 · Option')
  })

  it('count words: one add-on is singular', () => {
    expect(offeredOptionsCountWords([pvc, hdpe, soft])).toBe('3 options · 1 add-on')
  })
})
