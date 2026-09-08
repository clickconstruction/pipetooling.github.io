// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ContractAcceptSignatureForm } from './ContractAcceptSignatureForm'
import { esignConsentText } from '../../lib/esignConsent'

vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return '' } } }))

function Harness({ lang, onSubmit }: { lang: 'en' | 'es'; onSubmit: (p: unknown) => void }) {
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
      onSubmit={onSubmit}
      consent={esignConsentText({ audience: 'sub', lang, documentNoun: lang === 'es' ? 'esta orden de trabajo' : 'this work order' })}
    />
  )
}

describe('ContractAcceptSignatureForm with the e-sign consent (v2.3118)', () => {
  it('renders the line with the toggle at its end, opens the two paragraphs, and orders the consent box before the agree box', () => {
    render(<Harness lang="en" onSubmit={() => undefined} />)
    expect(screen.getByText(/Your typed or drawn signature has the same legal effect as one in ink/)).toBeTruthy()
    const how = screen.getByRole('button', { name: /How electronic signing works/ })
    expect(how.getAttribute('aria-expanded')).toBe('false')
    const p1 = screen.getByText(/You're signing this work order electronically\. Under the federal ESIGN Act \(15 U\.S\.C\. § 7001\)/)
    expect(p1.closest('[hidden]')).not.toBeNull()
    fireEvent.click(how)
    expect(how.getAttribute('aria-expanded')).toBe('true')
    expect(p1.closest('[hidden]')).toBeNull()
    expect(screen.getByText(/You don't have to sign this way/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Full disclosure/ }).getAttribute('href')).toBe('/estimate/terms#electronic-signatures')
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]?.closest('label')?.textContent).toBe('I agree to sign electronically.')
    expect(boxes[1]?.closest('label')?.textContent).toBe('I have read and agree to this contract.')
  })

  it('refuses to submit until the consent box is ticked, then sends the consent payload', () => {
    const onSubmit = vi.fn()
    render(<Harness lang="en" onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText('Your full legal name'), { target: { value: 'Behar Krasniqi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit signature' }))
    expect(screen.getByText('Please tick "I agree to sign electronically" to continue.')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
    const boxes = screen.getAllByRole('checkbox')
    fireEvent.click(boxes[0]!)
    fireEvent.click(boxes[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Submit signature' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0]?.[0] as { mode: string; printedName: string; consent: { version: number; lang: string; audience: string; clauseText: string } }
    expect(payload.mode).toBe('type')
    expect(payload.printedName).toBe('Behar Krasniqi')
    expect(payload.consent.version).toBe(1)
    expect(payload.consent.lang).toBe('en')
    expect(payload.consent.audience).toBe('sub')
    expect(payload.consent.clauseText).toContain('I agree to sign electronically.')
  })

  it('renders the Spanish surface end to end', () => {
    render(<Harness lang="es" onSubmit={() => undefined} />)
    expect(screen.getByText(/Su firma escrita o dibujada tiene la misma validez legal que una en tinta/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Cómo funciona la firma electrónica/ }))
    expect(screen.getByText(/Está firmando esta orden de trabajo electrónicamente/)).toBeTruthy()
    expect(screen.getAllByRole('checkbox')[0]?.closest('label')?.textContent).toBe('Acepto firmar electrónicamente.')
    fireEvent.change(screen.getByPlaceholderText('Your full legal name'), { target: { value: 'Behar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit signature' }))
    expect(screen.getByText('Marque "Acepto firmar electrónicamente" para continuar.')).toBeTruthy()
  })
})
