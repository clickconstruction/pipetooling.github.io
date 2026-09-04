import { describe, expect, it } from 'vitest'
import { emptyFormSchema, type FormSchema } from './formSchema'
import { acceptDigitsInput, boxHelp, boxLabel, displayValue, errorsByBox, fillProgress, fillString, fitScale, lensSequence, maskSensitive, setOneOfValue, toggleCheckbox } from './formFillState'

function schema(): FormSchema {
  const s = emptyFormSchema([{ width: 612, height: 792 }])
  s.boxes.push(
    { key: 'name', type: 'text', page: 1, rect: { x: 1, y: 1, w: 10, h: 5 }, order: 10, label: 'Name', labelEs: 'Nombre', required: true },
    { key: 'cls_a', type: 'checkbox', page: 1, rect: { x: 1, y: 1, w: 5, h: 5 }, order: 20, label: 'A', group: 'cls' },
    { key: 'cls_b', type: 'checkbox', page: 1, rect: { x: 1, y: 1, w: 5, h: 5 }, order: 21, label: 'B', group: 'cls' },
    { key: 'ssn', type: 'digits', page: 1, rect: { x: 1, y: 1, w: 10, h: 5 }, order: 30, label: 'SSN', mask: '###-##-####', sensitive: true, oneOf: 'tin', help: 'Nine digits' },
    { key: 'ein', type: 'digits', page: 1, rect: { x: 1, y: 1, w: 10, h: 5 }, order: 31, label: 'EIN', mask: '##-#######', sensitive: true, oneOf: 'tin' },
    { key: 'exempt', type: 'text', page: 1, rect: { x: 1, y: 1, w: 10, h: 5 }, order: 40, label: 'Exempt code', advanced: true },
    { key: 'requester', type: 'constant', page: 1, rect: { x: 1, y: 1, w: 10, h: 5 }, order: 50, label: '', text: 'Click' },
    { key: 'signature', type: 'signature', page: 1, rect: { x: 1, y: 1, w: 10, h: 5 }, order: 60, label: 'Signature' },
    { key: 'date', type: 'date', page: 1, rect: { x: 1, y: 1, w: 10, h: 5 }, order: 61, label: 'Date', dateMode: 'today' },
  )
  s.groups.push({ key: 'cls', label: 'Classification', exactlyOne: true, required: true })
  s.oneOfs.push({ key: 'tin', label: 'Taxpayer number', required: true })
  return s
}

describe('lens sequence + labels', () => {
  it('asks fillable boxes in order, hides rarely-needed until expanded, and speaks Español', () => {
    const s = schema()
    expect(lensSequence(s, false).map((b) => b.key)).toEqual(['name', 'cls_a', 'cls_b', 'ssn', 'ein'])
    expect(lensSequence(s, true).map((b) => b.key)).toEqual(['name', 'cls_a', 'cls_b', 'ssn', 'ein', 'exempt'])
    expect(boxLabel(s.boxes[0]!, 'es')).toBe('Nombre')
    expect(boxLabel(s.boxes[1]!, 'es')).toBe('A')
    expect(boxHelp(s.boxes[3]!, 'en')).toBe('Nine digits')
    expect(boxHelp(s.boxes[0]!, 'en')).toBeNull()
    expect(fillString('es', 'progress', { done: 2, total: 5 })).toBe('2 de 5 completadas')
    expect(fillString('en', 'nope')).toBe('nope')
  })
})

describe('display + input', () => {
  it('formats digits, masks sensitive values off-focus, and caps digit input at the mask', () => {
    const s = schema()
    const ssn = s.boxes.find((b) => b.key === 'ssn')!
    expect(displayValue(ssn, '123456789', true)).toBe('123-45-6789')
    expect(displayValue(ssn, '123456789', false)).toBe('•••-••-••89')
    expect(maskSensitive('AB-1234')).toBe('••-••34')
    expect(acceptDigitsInput(ssn, '12a3-45-67890')).toBe('123456789')
    expect(displayValue(s.boxes[0]!, 'Taunya', false)).toBe('Taunya')
  })
})

describe('checkbox groups + one-of sets', () => {
  it('exactly-one groups swap, plain checkboxes toggle, one-of clears the sibling', () => {
    const s = schema()
    let v = toggleCheckbox(s, {}, 'cls_a')
    expect(v).toEqual({ cls_a: true })
    v = toggleCheckbox(s, v, 'cls_b')
    expect(v).toEqual({ cls_b: true })
    v = toggleCheckbox(s, v, 'cls_b')
    expect(v).toEqual({ cls_b: true })
    v = setOneOfValue(s, v, 'ssn', '123456789')
    v = setOneOfValue(s, v, 'ein', '12')
    expect(v).toEqual({ cls_b: true, ein: '12' })
    expect(setOneOfValue(s, v, 'ein', '')).toEqual({ cls_b: true })
  })
})

describe('progress + errors', () => {
  it('counts required things once per set and maps set errors onto their members', () => {
    const s = schema()
    expect(fillProgress(s, {})).toEqual({ required: 3, requiredDone: 0, total: 6, done: 0 })
    expect(fillProgress(s, { name: 'T', cls_a: true, ssn: '123456789' })).toEqual({ required: 3, requiredDone: 3, total: 6, done: 3 })
    const errs = errorsByBox(s, { ssn: '12' })
    expect(errs.name).toBe('Name is required')
    expect(errs.cls_a).toBe('Pick one: Classification')
    expect(errs.cls_b).toBe('Pick one: Classification')
    expect(errs.ssn).toBe('SSN needs 9 digits')
    expect(fitScale(380, 612)).toBeCloseTo(0.6176, 3)
    expect(fitScale(2000, 612)).toBe(1.6)
  })
})
