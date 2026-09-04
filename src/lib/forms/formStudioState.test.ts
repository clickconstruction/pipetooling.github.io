import { describe, expect, it } from 'vitest'
import { emptyFormSchema, validateFormSchema, type PdfFieldInfo } from './formSchema'
import {
  addBox,
  bookEntryForForm,
  clampRectToPage,
  duplicateBox,
  mergeDraftedFields,
  moveOrder,
  moveRect,
  parseSchemaJson,
  promoteToDigits,
  removeBox,
  renameBoxKey,
  schemaSummary,
  uniqueBoxKey,
} from './formStudioState'

const LETTER = { width: 612, height: 792 }

const W9_FIELDS: PdfFieldInfo[] = [
  { name: 'p.f1_01[0]', kind: 'text', page: 1, rect: { x: 58, y: 660, w: 517, h: 14 } },
  { name: 'p.c1_1[0]', kind: 'checkbox', page: 1, rect: { x: 73, y: 603, w: 8, h: 8 } },
  { name: 'p.c1_1[1]', kind: 'checkbox', page: 1, rect: { x: 180, y: 603, w: 8, h: 8 } },
  { name: 'p.f1_11[0]', kind: 'text', page: 1, rect: { x: 417.6, y: 396, w: 43.2, h: 24 }, maxLength: 3 },
  { name: 'p.f1_12[0]', kind: 'text', page: 1, rect: { x: 475.2, y: 396, w: 28.8, h: 24 }, maxLength: 2 },
  { name: 'p.f1_13[0]', kind: 'text', page: 1, rect: { x: 518.4, y: 396, w: 57.6, h: 24 }, maxLength: 4 },
]

describe('addBox / clamp / move', () => {
  it('adds a centred box with a unique key and keeps rects inside the page', () => {
    const { schema, box } = addBox(emptyFormSchema([LETTER]), 'text', 1)
    expect(box).toMatchObject({ key: 'text_1', type: 'text', page: 1, order: 10, label: 'New text box' })
    expect(box.rect).toEqual({ x: 226, y: 389, w: 160, h: 14 })
    const again = addBox(schema, 'text', 1).box
    expect(again.key).toBe('text_2')
    expect(again.order).toBe(20)
    expect(addBox(schema, 'digits', 1).box).toMatchObject({ key: 'digits_1', mask: '###-##-####' })
    expect(addBox(schema, 'signature', 1).box.key).toBe('signature')
    expect(clampRectToPage({ x: 600, y: -20, w: 100, h: 30 }, LETTER)).toEqual({ x: 512, y: 0, w: 100, h: 30 })
    const moved = moveRect(schema, 'text_1', 1000, -1000).boxes[0]!.rect
    expect(moved).toEqual({ x: 452, y: 0, w: 160, h: 14 })
  })

  it('renames, duplicates (unbound), removes, and prunes empty sets', () => {
    let s = addBox(emptyFormSchema([LETTER]), 'checkbox', 1).schema
    s = { ...s, boxes: s.boxes.map((b) => ({ ...b, bind: 'p.c1[0]', group: 'g' })), groups: [{ key: 'g', label: 'G', exactlyOne: true, required: false }] }
    expect(renameBoxKey(s, 'checkbox_1', 'Bad Key').error).toMatch(/lowercase/)
    s = renameBoxKey(s, 'checkbox_1', 'cls_a').schema
    expect(s.boxes[0]!.key).toBe('cls_a')
    expect(renameBoxKey(addBox(s, 'text', 1).schema, 'text_1', 'cls_a').error).toMatch(/already used/)
    const dup = duplicateBox(s, 'cls_a')
    expect(dup.box).toMatchObject({ key: 'cls_a_2', group: 'g' })
    expect(dup.box?.bind).toBeUndefined()
    const removed = removeBox(removeBox(dup.schema, 'cls_a'), 'cls_a_2')
    expect(removed.boxes).toEqual([])
    expect(removed.groups).toEqual([])
    expect(uniqueBoxKey(s, 'Cls A')).toBe('cls_a_2')
  })

  it('swaps tab order with a neighbour', () => {
    let s = addBox(emptyFormSchema([LETTER]), 'text', 1).schema
    s = addBox(s, 'text', 1).schema
    s = moveOrder(s, 'text_2', -1)
    expect([...s.boxes].sort((a, b) => a.order - b.order).map((b) => b.key)).toEqual(['text_2', 'text_1'])
    expect(moveOrder(s, 'text_2', -1).boxes.find((b) => b.key === 'text_2')?.order).toBe(10)
  })
})

describe('mergeDraftedFields', () => {
  it('imports a PDF field set once, skipping fields already bound', () => {
    const first = mergeDraftedFields(emptyFormSchema([LETTER]), W9_FIELDS, [LETTER])
    expect(first.added).toBe(6)
    expect(first.skipped).toBe(0)
    expect(first.schema.groups.map((g) => g.key)).toEqual(['c1_1'])
    expect(validateFormSchema(first.schema)).toEqual([])
    const second = mergeDraftedFields(first.schema, [...W9_FIELDS, { name: 'p.f1_99[0]', kind: 'text', page: 1, rect: { x: 1, y: 1, w: 10, h: 10 } }], [LETTER])
    expect(second.added).toBe(1)
    expect(second.skipped).toBe(6)
    expect(second.schema.boxes).toHaveLength(7)
  })
})

describe('promoteToDigits', () => {
  it('merges the three SSN cells into one masked box with ordered segments and a union rect', () => {
    const s = mergeDraftedFields(emptyFormSchema([LETTER]), W9_FIELDS, [LETTER]).schema
    const r = promoteToDigits(s, ['f1_13', 'f1_11', 'f1_12'], '###-##-####', 'ssn', 'Social Security number')
    expect(r.error).toBeUndefined()
    const ssn = r.schema.boxes.find((b) => b.key === 'ssn')!
    expect(ssn).toMatchObject({ type: 'digits', mask: '###-##-####', bindSegments: ['p.f1_11[0]', 'p.f1_12[0]', 'p.f1_13[0]'], rect: { x: 417.6, y: 396, w: 158.4, h: 24 } })
    expect(r.schema.boxes.some((b) => b.key === 'f1_11')).toBe(false)
    expect(promoteToDigits(s, ['f1_11', 'f1_12'], '###-##-####', 'ssn', 'SSN').error).toMatch(/3 segment/)
    expect(promoteToDigits(s, ['c1_1_0'], '###', 'x', 'X').error).toMatch(/bound text/)
  })
})

describe('parseSchemaJson + summary + publish payload', () => {
  it('parses a valid schema, reports invalid ones, and summarises', () => {
    const s = mergeDraftedFields(emptyFormSchema([LETTER]), W9_FIELDS, [LETTER]).schema
    const parsed = parseSchemaJson(JSON.stringify(s))
    expect(parsed.ok).toBe(true)
    expect(parseSchemaJson('{').ok).toBe(false)
    const bad = parseSchemaJson(JSON.stringify({ ...s, boxes: [{ key: 'X', type: 'text', page: 9, rect: { x: 0, y: 0, w: 0, h: 0 }, order: 1, label: '' }] }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.length).toBeGreaterThan(2)
    expect(schemaSummary(s)).toEqual({ boxes: 6, asked: 6, sensitive: 0, bound: 6, drawn: 0 })
    expect(bookEntryForForm({ formTemplateId: 'f', packetTemplateId: 'p', documentName: ' W-9 ', audience: 'sub', sequenceOrder: 3, versionDate: '2024-03-01' })).toEqual({
      template_id: 'p',
      document_name: 'W-9',
      sequence_order: 3,
      book_body_html: null,
      book_body_format: 'plain',
      tags: ['form'],
      canonical_document_url: null,
      audience: 'sub',
      book_version_date: '2024-03-01',
      form_template_id: 'f',
    })
  })
})
