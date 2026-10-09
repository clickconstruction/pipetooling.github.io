// @vitest-environment jsdom
import { createRef } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { LienNoticeSignLine, type LienNoticeSignLineHandle } from './LienNoticeSignLine'

vi.mock('signature_pad', () => ({
  default: class {
    private drawn = false
    constructor(_c: HTMLCanvasElement) {}
    off() {}
    on() {}
    isEmpty() {
      return !this.drawn
    }
    toDataURL() {
      return 'data:image/png;base64,AAAA'
    }
    toData() {
      return []
    }
    fromData() {}
    clear() {
      this.drawn = false
    }
  },
}))

describe('LienNoticeSignLine (v2.5082)', () => {
  it('his name waits on the line in the cursive face; the press reads as a typed signature; Draw instead turns the line into a pad that must hold ink', () => {
    const ref = createRef<LienNoticeSignLineHandle>()
    renderWithProviders(<LienNoticeSignLine ref={ref} printedName="Robert Douglas" under={['Robert Douglas, Owner', 'Click Plumbing']} signedLabel="Signed October 9, 2026" />)
    const line = screen.getByTestId('lien-sign-line')
    expect(line.getAttribute('data-lien-sign-mode')).toBe('type')
    expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Robert Douglas')
    expect(line.textContent).toContain('Your signature, as it will print')
    expect(line.textContent).toContain('Robert Douglas, Owner, Click Plumbing')
    expect(line.textContent).toContain('Signed October 9, 2026')
    expect(ref.current?.mode).toBe('type')
    expect(ref.current?.isEmpty()).toBe(false)
    expect(ref.current?.toDataURL()).toBeNull()
    fireEvent.click(screen.getByTestId('lien-sign-line-toggle'))
    expect(line.getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(screen.getByLabelText('Sign on the line').tagName).toBe('CANVAS')
    expect(line.textContent).toContain('Sign here, on the line')
    expect(ref.current?.mode).toBe('draw')
    expect(ref.current?.isEmpty()).toBe(true)
    expect(ref.current?.toDataURL()).toBeNull()
    expect(screen.getByRole('button', { name: 'Press instead' })).toBeTruthy()
  })

  it('at someone else’s screen there is no press: the pad alone, and no way to switch', () => {
    renderWithProviders(<LienNoticeSignLine printedName="Robert Douglas" under={['Robert Douglas, Owner']} signedLabel="Signed October 9, 2026" allowPress={false} />)
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(screen.queryByTestId('lien-sign-line-toggle')).toBeNull()
  })
})
