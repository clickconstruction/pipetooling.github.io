import { describe, expect, it } from 'vitest'
import { emptyAnswersForSchema, parseWriteupTemplateSchema, schemaToJson, validateWriteupAnswers, type WriteupTemplateBlock } from './writeupTemplateSchema'

/**
 * Write-up templates (People → write-ups): the stored block schema, the blank
 * answer set a new write-up starts from, answer validation against the
 * schema, and the JSON shape written back. Pure kernel.
 */
const schema: WriteupTemplateBlock[] = [
  { type: 'prompt', id: 'intro', content: 'Describe the incident.' },
  { type: 'text', id: 'date', label: 'Date', required: true },
  { type: 'textarea', id: 'details', label: 'Details', required: false },
  { type: 'checklist', id: 'kinds', label: 'Kind', options: ['Late', 'No-show'], required: true },
  { type: 'checklist', id: 'extras', options: ['Photo'], required: false },
]

describe('parseWriteupTemplateSchema', () => {
  it('accepts the four block types, trimming ids and text and coercing required to a boolean', () => {
    const r = parseWriteupTemplateSchema([
      { type: 'prompt', id: ' intro ', content: '  Describe.  ' },
      { type: 'text', id: 'date', label: ' Date ', required: 1 },
      { type: 'textarea', id: 'details', label: 'Details' },
      { type: 'checklist', id: 'kinds', label: '  ', options: [' Late ', '', 7, 'No-show'], required: 'yes' },
    ])
    expect(r).toEqual({
      ok: true,
      schema: [
        { type: 'prompt', id: 'intro', content: 'Describe.' },
        { type: 'text', id: 'date', label: 'Date', required: true },
        { type: 'textarea', id: 'details', label: 'Details', required: false },
        { type: 'checklist', id: 'kinds', label: undefined, options: ['Late', 'No-show'], required: true },
      ],
    })
    expect(parseWriteupTemplateSchema([])).toEqual({ ok: true, schema: [] })
  })
  it('names the bad block: not an array, a missing id, an unknown type, a blank label or content, a checklist with no options, a duplicate id', () => {
    expect(parseWriteupTemplateSchema({ type: 'prompt' })).toEqual({ ok: false, error: 'Template schema must be a JSON array.' })
    expect(parseWriteupTemplateSchema([{ type: 'prompt', content: 'x' }])).toEqual({ ok: false, error: 'Invalid block at index 0.' })
    expect(parseWriteupTemplateSchema([{ type: 'prompt', id: 'a', content: 'x' }, { type: 'select', id: 'b' }])).toEqual({ ok: false, error: 'Invalid block at index 1.' })
    expect(parseWriteupTemplateSchema([{ type: 'text', id: 'a', label: '   ' }])).toEqual({ ok: false, error: 'Invalid block at index 0.' })
    expect(parseWriteupTemplateSchema([{ type: 'prompt', id: 'a', content: '' }])).toEqual({ ok: false, error: 'Invalid block at index 0.' })
    expect(parseWriteupTemplateSchema([{ type: 'checklist', id: 'a', options: ['', '  '] }])).toEqual({ ok: false, error: 'Invalid block at index 0.' })
    expect(parseWriteupTemplateSchema([{ type: 'checklist', id: 'a' }])).toEqual({ ok: false, error: 'Invalid block at index 0.' })
    expect(parseWriteupTemplateSchema([null])).toEqual({ ok: false, error: 'Invalid block at index 0.' })
    expect(parseWriteupTemplateSchema([{ type: 'text', id: 'a', label: 'A' }, { type: 'text', id: ' a', label: 'B' }])).toEqual({ ok: false, error: 'Duplicate block id "a".' })
  })
})

describe('emptyAnswersForSchema', () => {
  it('starts every answerable block blank and gives prompts nothing', () => {
    expect(emptyAnswersForSchema(schema)).toEqual({ date: '', details: '', kinds: [], extras: [] })
  })
})

describe('validateWriteupAnswers', () => {
  it('normalises answers (trimmed strings, checklist values restricted to the options) and keeps unknown keys', () => {
    const r = validateWriteupAnswers(schema, { date: ' 9/7 ', details: 42, kinds: ['Late', ' No-show ', 'Bogus', 3], extras: 'Photo', stray: 'kept' })
    expect(r).toEqual({ ok: true, answers: { date: '9/7', details: '', kinds: ['Late', 'No-show'], extras: [], stray: 'kept' } })
  })
  it('reports every unmet requirement by label, with a generic line for an unlabeled checklist', () => {
    const strict: WriteupTemplateBlock[] = [...schema, { type: 'checklist', id: 'unlabeled', options: ['A'], required: true }]
    expect(validateWriteupAnswers(strict, { kinds: ['Bogus'] })).toEqual({
      ok: false,
      errors: ['Date is required.', 'Kind: select at least one option.', 'Select at least one checklist option.'],
    })
  })
  it('with requirements off, still normalises and passes; a non-object answer set reads as empty', () => {
    expect(validateWriteupAnswers(schema, null, { enforceRequired: false })).toEqual({ ok: true, answers: { date: '', details: '', kinds: [], extras: [] } })
    expect(validateWriteupAnswers(schema, ['not', 'an', 'object'], { enforceRequired: false })).toEqual({ ok: true, answers: { date: '', details: '', kinds: [], extras: [] } })
    expect(validateWriteupAnswers(schema, {}).ok).toBe(false)
  })
})

describe('schemaToJson', () => {
  it('writes each block with its type-specific fields and required as an explicit boolean; parsing it back is the identity', () => {
    const json = schemaToJson(schema)
    expect(json).toEqual([
      { type: 'prompt', id: 'intro', content: 'Describe the incident.' },
      { type: 'text', id: 'date', label: 'Date', required: true },
      { type: 'textarea', id: 'details', label: 'Details', required: false },
      { type: 'checklist', id: 'kinds', label: 'Kind', options: ['Late', 'No-show'], required: true },
      { type: 'checklist', id: 'extras', label: undefined, options: ['Photo'], required: false },
    ])
    const back = parseWriteupTemplateSchema(JSON.parse(JSON.stringify(json)))
    expect(back).toEqual({ ok: true, schema })
  })
})
