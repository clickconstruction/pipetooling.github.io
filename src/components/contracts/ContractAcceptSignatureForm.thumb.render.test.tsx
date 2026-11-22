// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ContractAcceptSignatureForm } from './ContractAcceptSignatureForm'
import { INLINE_THUMB_PAD, SIGN_PRESS_MIN_HEIGHT, SIGN_TICK_BOX, SIGN_TICK_ROW } from './signatureFormStyles'
import { esignConsentText } from '../../lib/esignConsent'

vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return '' } } }))

function Harness() {
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  return (
    <ContractAcceptSignatureForm
      printedName={name}
      agreed={agreed}
      onPrintedNameChange={setName}
      onAgreedChange={setAgreed}
      formError={null}
      submitting={false}
      onSubmit={() => undefined}
      consent={esignConsentText({ audience: 'customer', lang: 'en', documentNoun: 'this agreement' })}
    />
  )
}

describe('the signing form at a thumb’s size (v2.8294)', () => {
  it('the sizes: a press is 44 px, a box to tick is 22 px in a row a thumb tall', () => {
    expect(SIGN_PRESS_MIN_HEIGHT).toBe(44)
    expect(SIGN_TICK_ROW.minHeight).toBe(44)
    expect(SIGN_TICK_BOX.width).toBe(22)
    expect(SIGN_TICK_BOX.height).toBe(22)
    // The padding grows the press, and the margin takes the same back so the line stays where it is.
    expect(INLINE_THUMB_PAD.paddingTop).toBe(12)
    expect(INLINE_THUMB_PAD.paddingBottom).toBe(12)
    expect(INLINE_THUMB_PAD.marginTop).toBe(-12)
    expect(INLINE_THUMB_PAD.marginBottom).toBe(-12)
  })

  it('the button that signs is the form’s largest press: as wide as the name box, 48 px tall', () => {
    render(<Harness />)
    const sign = screen.getByRole('button', { name: 'Submit signature' })
    expect(sign.style.width).toBe('100%')
    expect(sign.style.maxWidth).toBe('400px')
    expect(sign.style.minHeight).toBe('48px')
    // Its box counts its padding, so 100% never runs past the form.
    expect(sign.style.boxSizing).toBe('border-box')
  })

  it('both boxes a signer must tick are 22 px, each in a row 44 px tall that is the press', () => {
    render(<Harness />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    for (const box of boxes) {
      expect(box.style.width).toBe('22px')
      expect(box.style.height).toBe('22px')
      const row = box.closest('label')
      expect(row?.style.minHeight).toBe('44px')
      expect(row?.style.cursor).toBe('pointer')
    }
    // The two rows are the same row and both start at the left edge, so one box sits over the other.
    expect(boxes[0]?.closest('label')?.getAttribute('data-sign-tick')).toBe('consent')
    expect(boxes[1]?.closest('label')?.getAttribute('data-sign-tick')).toBe('agree')
    for (const box of boxes) expect((box.closest('label')?.parentElement as HTMLElement).style.justifyContent).toBe('flex-start')
  })

  it('Type and Draw are 44 px tall, and the words that open how signing works have room for a thumb', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Type' }).style.minHeight).toBe('44px')
    expect(screen.getByRole('button', { name: 'Draw' }).style.minHeight).toBe('44px')
    const how = screen.getByRole('button', { name: /How electronic signing works/ })
    expect(how.style.paddingTop).toBe('12px')
    expect(how.style.paddingBottom).toBe('12px')
    expect(how.style.marginTop).toBe('-12px')
    expect(how.style.marginBottom).toBe('-12px')
  })
})
