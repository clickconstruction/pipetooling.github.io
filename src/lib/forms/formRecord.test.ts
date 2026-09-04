import { describe, expect, it } from 'vitest'
import { emptyFormSchema, type FormSchema } from './formSchema'
import { formFacts, formFactsOneLine } from './formRecord'

function schema(): FormSchema {
  const s = emptyFormSchema([{ width: 612, height: 792 }])
  s.boxes.push(
    { key: 'name', type: 'text', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 10, label: 'Name' },
    { key: 'cls_a', type: 'checkbox', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 20, label: 'Individual', group: 'cls' },
    { key: 'cls_b', type: 'checkbox', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 21, label: 'C corp', group: 'cls' },
    { key: 'foreign', type: 'checkbox', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 25, label: 'Has foreign partners' },
    { key: 'zip', type: 'digits', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 30, label: 'ZIP', mask: '#####' },
    { key: 'ssn', type: 'digits', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 40, label: 'SSN', mask: '###-##-####', sensitive: true },
    { key: 'ein', type: 'digits', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 41, label: 'EIN', mask: '##-#######', sensitive: true },
    { key: 'requester', type: 'constant', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 50, label: '', text: 'Click' },
    { key: 'signature', type: 'signature', page: 1, rect: { x: 1, y: 1, w: 1, h: 1 }, order: 60, label: 'Signature' },
  )
  s.groups.push({ key: 'cls', label: 'Classification', exactlyOne: true, required: true })
  return s
}

describe('formFacts', () => {
  it('labels stored answers in form order, folds a group into one fact, and shows sensitive hints as last-four only', () => {
    const facts = formFacts(schema(), { name: 'Misses Taunya', cls_a: true, zip: '78640' }, { ssn: '6789' })
    expect(facts).toEqual([
      { key: 'name', label: 'Name', value: 'Misses Taunya', sensitive: false },
      { key: 'cls', label: 'Classification', value: 'Individual', sensitive: false },
      { key: 'zip', label: 'ZIP', value: '78640', sensitive: false },
      { key: 'ssn', label: 'SSN', value: '••••6789', sensitive: true },
    ])
    expect(formFactsOneLine(facts)).toBe('Misses Taunya · Individual · 78640')
    expect(formFactsOneLine(facts, 4)).toBe('Misses Taunya · Individual · 78640 · SSN ••••6789')
    expect(formFacts(schema(), { foreign: true }, null)).toEqual([{ key: 'foreign', label: 'Has foreign partners', value: 'Yes', sensitive: false }])
    expect(formFacts(schema(), null, null)).toEqual([])
  })
})
