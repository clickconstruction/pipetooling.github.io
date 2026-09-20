// @vitest-environment jsdom
/** v2.3636: the signature form's own words follow `lang` — the sub portal in Español no longer meets an English form. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ContractAcceptSignatureForm } from './ContractAcceptSignatureForm'

// jsdom has no canvas: the pad is stubbed, as in the form's own render test.
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return '' } } }))

afterEach(cleanup)

function mount(lang?: 'en' | 'es') {
  const onSubmit = vi.fn()
  render(
    <ContractAcceptSignatureForm
      printedName=""
      agreed={false}
      onPrintedNameChange={() => undefined}
      onAgreedChange={() => undefined}
      formError={null}
      submitting={false}
      onSubmit={onSubmit}
      heading="Firmar para aceptar"
      agreeLabel="He leído y acepto."
      submitLabel="Enviar firma"
      lang={lang}
    />,
  )
  return onSubmit
}

describe('ContractAcceptSignatureForm — language', () => {
  it('Spanish: the name label, Type / Draw, the draw hint, Clear, and the field hint', () => {
    const onSubmit = mount('es')
    expect(screen.getByText('Su nombre')).toBeTruthy()
    expect(screen.getByPlaceholderText('Su nombre legal completo')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Firme escribiendo o dibujando' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dibujar' }))
    expect(screen.getByText('Firme abajo (con el dedo o el ratón)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Borrar firma' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar firma' }))
    expect(screen.getByText('Escriba su nombre completo.')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('English stays the default for every other signing surface', () => {
    mount()
    expect(screen.getByText('Your name')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Type' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Draw' })).toBeTruthy()
  })
})
