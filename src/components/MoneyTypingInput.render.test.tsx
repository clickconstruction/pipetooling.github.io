// @vitest-environment jsdom
/**
 * The money box with commas while typing (v2.4334), driven the way a person does: type at the end
 * and in the middle, Backspace over a comma, paste, leave the box. The parent keeps the plain value.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MoneyTypingInput } from './MoneyTypingInput'

afterEach(cleanup)

function Harness({ initial = '', onPlain }: { initial?: string; onPlain?: (v: string) => void }) {
  const [v, setV] = useState(initial)
  return (
    <label>
      Amount
      <MoneyTypingInput
        value={v}
        onChange={(next) => {
          setV(next)
          onPlain?.(next)
        }}
      />
      <output data-testid="plain">{v}</output>
    </label>
  )
}

const box = () => screen.getByLabelText('Amount') as HTMLInputElement
const plain = () => screen.getByTestId('plain').textContent
/** Put `next` in the box with the cursor at `caret` (end by default), as a keystroke would. */
function edit(next: string, caret = next.length) {
  const el = box()
  el.focus()
  fireEvent.change(el, { target: { value: next, selectionStart: caret, selectionEnd: caret } })
}

describe('MoneyTypingInput', () => {
  it('shows the commas while typing and keeps the plain value for the caller', () => {
    render(<Harness />)
    for (const typed of ['1', '17', '177', '1777', '17777', '17777.', '17777.5', '17777.51']) edit(typed)
    expect(box().value).toBe('17,777.51')
    expect(plain()).toBe('17777.51')
    expect(box().selectionStart).toBe(9)
  })

  it('a digit typed in the middle keeps the cursor right after it', () => {
    render(<Harness initial="17777.51" />)
    // The person puts the cursor after "17,7" and types 2.
    edit('17,72777.51'.slice(0, 5) + '77.51', 5)
    expect(box().value).toBe('177,277.51')
    expect(box().selectionStart).toBe(5)
  })

  it('Backspace just after a comma removes the digit before it', () => {
    render(<Harness initial="17777.51" />)
    const el = box()
    el.focus()
    el.setSelectionRange(3, 3)
    fireEvent.keyDown(el, { key: 'Backspace' })
    expect(el.value).toBe('1,777.51')
    expect(plain()).toBe('1777.51')
    expect(el.selectionStart).toBe(1)
  })

  it('a pasted "$9,022.49" reads as 9022.49', () => {
    render(<Harness />)
    edit('$9,022.49')
    expect(box().value).toBe('9,022.49')
    expect(plain()).toBe('9022.49')
  })

  it('a letter is dropped and the box looks as it did', () => {
    render(<Harness initial="9022.49" />)
    edit('9,02x2.49', 5)
    expect(box().value).toBe('9,022.49')
    expect(plain()).toBe('9022.49')
  })

  it('leaving the box after typing shows cents; leaving without typing changes nothing', () => {
    const onPlain = vi.fn()
    render(<Harness initial="17777.5" onPlain={onPlain} />)
    fireEvent.focus(box())
    fireEvent.blur(box())
    expect(onPlain).not.toHaveBeenCalled()
    expect(box().value).toBe('17,777.5')
    edit('9000')
    fireEvent.blur(box())
    expect(box().value).toBe('9,000.00')
    expect(plain()).toBe('9000.00')
  })
})
