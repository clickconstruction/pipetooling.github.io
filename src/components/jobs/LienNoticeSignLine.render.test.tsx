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

describe('LienNoticeSignLine · the master’s code on someone else’s screen (v2.5791)', () => {
  it('his name in cursive, a code field, and the handle reads the digits; Draw instead keeps his name on the tag', () => {
    const ref = createRef<LienNoticeSignLineHandle>()
    renderWithProviders(<LienNoticeSignLine ref={ref} printedName="Malachi Whites" under={['Malachi Whites, Master Plumber', 'Click Plumbing']} signedLabel="Signed October 23, 2026" codeSigner={{ firstName: 'Malachi', status: 'ready' }} />)
    const line = screen.getByTestId('lien-sign-line')
    expect(line.getAttribute('data-lien-sign-mode')).toBe('code')
    expect(line.textContent).toContain('Malachi signs here with his code')
    expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Malachi Whites')
    expect(ref.current?.isEmpty()).toBe(true)
    fireEvent.change(screen.getByLabelText('Malachi’s signing code'), { target: { value: '24x68' } })
    expect(ref.current?.code()).toBe('2468')
    expect(ref.current?.isEmpty()).toBe(false)
    expect(ref.current?.toDataURL()).toBeNull()
    fireEvent.click(screen.getByTestId('lien-sign-line-toggle'))
    expect(line.getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(line.textContent).toContain('Malachi signs here, in his own hand')
    expect(ref.current?.code()).toBe('')
    expect(screen.getByRole('button', { name: 'Code instead' })).toBeTruthy()
  })

  it('a locked or unset code leads with the pad and says why; a wrong code shows under the field', () => {
    const { unmount } = renderWithProviders(<LienNoticeSignLine printedName="Malachi Whites" under={['Malachi Whites']} signedLabel="Signed October 23, 2026" codeSigner={{ firstName: 'Malachi', status: 'locked', lockedUntilClock: '2:29 PM' }} />)
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(document.querySelector('[data-lien-sign-code-words]')!.textContent).toBe('His code is locked until 2:29 PM after five wrong tries. He can draw here instead.')
    expect(screen.queryByTestId('lien-sign-line-toggle')).toBeNull()
    unmount()
    renderWithProviders(<LienNoticeSignLine printedName="Malachi Whites" under={['Malachi Whites']} signedLabel="Signed October 23, 2026" codeSigner={{ firstName: 'Malachi', status: 'ready' }} codeProblem="That is not Malachi’s code. 3 tries left." />)
    expect(document.querySelector('[data-lien-sign-code-words]')!.textContent).toBe('That is not Malachi’s code. 3 tries left.')
  })
})
