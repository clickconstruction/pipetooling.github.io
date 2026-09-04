// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { emptyFormSchema, type FormBox, type FormSchema, type FormValues } from '../../../lib/forms/formSchema'
import { setOneOfValue, toggleCheckbox } from '../../../lib/forms/formFillState'
import { FormFillOverlay } from './FormFillOverlay'

function schema(): FormSchema {
  const s = emptyFormSchema([{ width: 612, height: 792 }])
  s.boxes.push(
    { key: 'name', type: 'text', page: 1, rect: { x: 58, y: 660, w: 517, h: 14 }, order: 10, label: 'Name', labelEs: 'Nombre', required: true },
    { key: 'cls_a', type: 'checkbox', page: 1, rect: { x: 73, y: 603, w: 8, h: 8 }, order: 20, label: 'Individual', group: 'cls' },
    { key: 'cls_b', type: 'checkbox', page: 1, rect: { x: 180, y: 603, w: 8, h: 8 }, order: 21, label: 'C corp', group: 'cls' },
    { key: 'ssn', type: 'digits', page: 1, rect: { x: 417, y: 396, w: 158, h: 24 }, order: 30, label: 'SSN', mask: '###-##-####', sensitive: true, oneOf: 'tin' },
    { key: 'requester', type: 'constant', page: 1, rect: { x: 389, y: 468, w: 186, h: 38 }, order: 40, label: '', text: 'Click Plumbing' },
    { key: 'signature', type: 'signature', page: 1, rect: { x: 131, y: 196, w: 250, h: 16 }, order: 50, label: 'Signature' },
    { key: 'date', type: 'date', page: 1, rect: { x: 400, y: 196, w: 170, h: 16 }, order: 51, label: 'Date', dateMode: 'today' },
  )
  s.groups.push({ key: 'cls', label: 'Classification', exactlyOne: true, required: true })
  s.oneOfs.push({ key: 'tin', label: 'TIN', required: true })
  return s
}

function Harness({ lang = 'en' as 'en' | 'es' }) {
  const s = schema()
  const [values, setValues] = useState<FormValues>({})
  const [focused, setFocused] = useState<string | null>(null)
  const onText = (box: FormBox, raw: string) => setValues((v) => (box.oneOf ? setOneOfValue(s, v, box.key, raw) : { ...v, [box.key]: raw }))
  return (
    <div style={{ position: 'relative', width: 612, height: 792 }}>
      <FormFillOverlay schema={s} pageNo={1} scale={1} values={values} lang={lang} focusedKey={focused} errors={{}} todayLabel="Sep 4, 2026" signature={{ mode: 'type', text: 'Taunya Rachelle' }} onFocus={setFocused} onText={onText} onToggle={(k) => setValues((v) => toggleCheckbox(s, v, k))} />
    </div>
  )
}

describe('FormFillOverlay', () => {
  it('positions inputs at the boxes, swaps exactly-one checkboxes, masks the SSN off-focus, and shows constants, date, and signature', () => {
    render(<Harness />)
    const name = screen.getByLabelText('Name') as HTMLInputElement
    // y 660, h 14 on a 792 page at scale 1 → top 118
    expect(name.style.top).toBe('118px')
    expect(name.style.left).toBe('58px')
    fireEvent.change(name, { target: { value: 'Misses Taunya' } })
    expect(name.value).toBe('Misses Taunya')

    const a = screen.getByRole('checkbox', { name: 'Individual' })
    const b = screen.getByRole('checkbox', { name: 'C corp' })
    fireEvent.click(a)
    expect(a.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(b)
    expect(a.getAttribute('aria-checked')).toBe('false')
    expect(b.getAttribute('aria-checked')).toBe('true')

    const ssn = screen.getByLabelText('SSN') as HTMLInputElement
    fireEvent.focus(ssn)
    fireEvent.change(ssn, { target: { value: '123456789' } })
    expect(ssn.value).toBe('123-45-6789')
    fireEvent.blur(ssn)
    expect(ssn.value).toBe('•••-••-••89')

    expect(screen.getByText('Click Plumbing')).toBeTruthy()
    expect(screen.getByText('Sep 4, 2026')).toBeTruthy()
    expect(screen.getByText('Taunya Rachelle')).toBeTruthy()
  })

  it('labels in Español when asked', () => {
    render(<Harness lang="es" />)
    expect(screen.getByLabelText('Nombre')).toBeTruthy()
  })
})
