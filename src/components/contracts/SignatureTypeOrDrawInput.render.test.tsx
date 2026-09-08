// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createRef, useState, type RefObject } from 'react'
import { SignatureTypeOrDrawInput, type SignatureMode, type SignatureTypeOrDrawHandle } from './SignatureTypeOrDrawInput'

const padState = { empty: true }
vi.mock('signature_pad', () => ({
  default: class {
    off() {}
    clear() {
      padState.empty = true
    }
    isEmpty() {
      return padState.empty
    }
    toDataURL() {
      return 'data:image/png;base64,MOCK'
    }
  },
}))

function Harness({ handle, name = 'Dana Ruiz' }: { handle: RefObject<SignatureTypeOrDrawHandle>; name?: string }) {
  const [mode, setMode] = useState<SignatureMode>('type')
  return <SignatureTypeOrDrawInput ref={handle} mode={mode} onModeChange={setMode} printedName={name} align="left" />
}

describe('SignatureTypeOrDrawInput (v2.3159)', () => {
  it('starts in Type with the cursive preview and no canvas; Draw swaps in the pad and a Clear button', () => {
    const handle = createRef<SignatureTypeOrDrawHandle>()
    render(<Harness handle={handle} />)
    expect(screen.getByRole('group', { name: 'Sign by typing or drawing' })).toBeTruthy()
    expect(screen.queryByLabelText('Signature drawing area')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear signature' })).toBeNull()
    expect(handle.current?.toDataURL()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
    expect(screen.getByLabelText('Signature drawing area')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear signature' })).toBeTruthy()
    expect(screen.getByText('Sign below (use your finger or mouse)')).toBeTruthy()
  })

  it('reports an empty pad as empty, hands back the PNG once something is drawn, and Clear empties it again', () => {
    const handle = createRef<SignatureTypeOrDrawHandle>()
    render(<Harness handle={handle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
    padState.empty = true
    expect(handle.current?.isEmpty()).toBe(true)
    expect(handle.current?.toDataURL()).toBeNull()

    padState.empty = false
    expect(handle.current?.isEmpty()).toBe(false)
    expect(handle.current?.toDataURL()).toBe('data:image/png;base64,MOCK')

    fireEvent.click(screen.getByRole('button', { name: 'Clear signature' }))
    expect(handle.current?.isEmpty()).toBe(true)
  })

  it('switching back to Type never yields a PNG, even with ink on the pad', () => {
    const handle = createRef<SignatureTypeOrDrawHandle>()
    render(<Harness handle={handle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
    padState.empty = false
    expect(handle.current?.toDataURL()).toBe('data:image/png;base64,MOCK')
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    expect(handle.current?.toDataURL()).toBeNull()
    expect(screen.queryByLabelText('Signature drawing area')).toBeNull()
  })
})
