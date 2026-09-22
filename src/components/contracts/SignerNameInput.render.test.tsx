// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRef, useState, type RefObject } from 'react'
import { SignerNameInput } from './SignerNameInput'
import { resolveSignerName } from '../../lib/signerNameField'

function Harness({ inputRef, onSubmit }: { inputRef: RefObject<HTMLInputElement>; onSubmit: (name: string) => void }) {
  const [name, setName] = useState('')
  const [ticked, setTicked] = useState(false)
  return (
    <div>
      <SignerNameInput ref={inputRef} value={name} onValueChange={setName} aria-label="Full name" />
      <label>
        <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} /> I agree
      </label>
      <output data-testid="state">{name}</output>
      <button type="button" onClick={() => onSubmit(resolveSignerName(name, inputRef.current?.value).name)}>
        Submit
      </button>
      <button type="button" onClick={() => setName('')}>
        Reset
      </button>
    </div>
  )
}

describe('SignerNameInput', () => {
  it('keeps a name the browser wrote without an input event across a re-render, and the submit reads it', () => {
    const ref = createRef<HTMLInputElement>()
    const submitted: string[] = []
    render(<Harness inputRef={ref} onSubmit={(n) => submitted.push(n)} />)
    const box = screen.getByLabelText('Full name') as HTMLInputElement
    // AutoFill: the value lands, no event fires.
    act(() => {
      box.value = 'Kimberly Coe'
    })
    fireEvent.click(screen.getByLabelText('I agree'))
    expect(box.value).toBe('Kimberly Coe')
    expect(screen.getByTestId('state').textContent).toBe('')
    fireEvent.click(screen.getByText('Submit'))
    expect(submitted).toEqual(['Kimberly Coe'])
  })

  it('blur syncs a silently filled value into state', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Harness inputRef={ref} onSubmit={() => undefined} />)
    const box = screen.getByLabelText('Full name') as HTMLInputElement
    act(() => {
      box.value = 'Dana Ruiz'
    })
    fireEvent.blur(box)
    expect(screen.getByTestId('state').textContent).toBe('Dana Ruiz')
  })

  it('typing still flows to state, and a parent reset clears the box', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Harness inputRef={ref} onSubmit={() => undefined} />)
    const box = screen.getByLabelText('Full name') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'Behar Krasniqi' } })
    expect(screen.getByTestId('state').textContent).toBe('Behar Krasniqi')
    fireEvent.click(screen.getByText('Reset'))
    expect(box.value).toBe('')
  })
})
