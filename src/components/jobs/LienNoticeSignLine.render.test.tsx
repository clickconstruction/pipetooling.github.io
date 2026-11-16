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

describe('LienNoticeSignLine · the desk’s one-box footer (v2.7382)', () => {
  const frame = () => ({
    call: <>→ Your call on July and August 2026</>,
    note: <span> · keeps the rule “Ask me each time”</span>,
    press: <button type="button">Sign and approve &amp; next ▸</button>,
    strip: <button type="button">Hold — they promised…</button>,
  })

  it('the call, the code and the host’s press sit inside the box beside the paper; the strip runs under them', () => {
    const ref = createRef<LienNoticeSignLineHandle>()
    renderWithProviders(<LienNoticeSignLine ref={ref} printedName="Malachi Whites" under={['Malachi Whites, Master Plumber', 'Click Plumbing']} signedLabel="Signed November 15, 2026" codeSigner={{ firstName: 'Malachi', status: 'ready' }} frame={frame()} />)
    const line = screen.getByTestId('lien-sign-line')
    expect(line.hasAttribute('data-lien-sign-frame')).toBe(true)
    expect(line.getAttribute('data-lien-sign-mode')).toBe('code')
    expect(line.textContent).toContain('Malachi signs here with his code')
    // The call is the box's title, with the signed day and the rule's note under it.
    const call = line.querySelector('.lienSignFrameCall') as HTMLElement
    expect(call.textContent).toBe('→ Your call on July and August 2026Signed November 15, 2026 · keeps the rule “Ask me each time”')
    // The code field and the press share one row; the label is short and the field keeps its full name for a screen reader.
    const row = line.querySelector('[data-lien-sign-code-row]') as HTMLElement
    expect(row.textContent).toBe('Malachi’s codeSign and approve & next ▸')
    fireEvent.change(screen.getByLabelText('Malachi’s signing code'), { target: { value: '24x68' } })
    expect(ref.current?.code()).toBe('2468')
    expect(document.querySelector('[data-lien-sign-code-words]')!.textContent).toBe('Four to six digits, his alone. The record names this screen.')
    expect((line.querySelector('.lienSignFrameStrip') as HTMLElement).textContent).toBe('Hold — they promised…')
    // The way to the pad sits on the paper's corner, and the pad has Clear beside the way back.
    const corner = line.querySelector('.lienSignFramePaper .lienSignFrameCorner') as HTMLElement
    expect(corner.textContent).toBe('Draw instead')
    fireEvent.click(screen.getByTestId('lien-sign-line-toggle'))
    expect(line.getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(line.textContent).toContain('Malachi signs here, in his own hand')
    expect(corner.textContent).toBe('ClearCode instead')
    expect(line.querySelector('[data-lien-sign-code-row]')).toBeNull()
    expect(screen.getByRole('button', { name: /Sign and approve & next/ })).toBeTruthy()
  })

  it('his own sign-in: no code field, the press alone beside the paper; a wrong code or a locked one still reads in the box', () => {
    const { unmount } = renderWithProviders(<LienNoticeSignLine printedName="Robert Douglas" under={['Robert Douglas, Owner']} signedLabel="Signed November 15, 2026" frame={{ ...frame(), strip: undefined, note: undefined }} />)
    const line = screen.getByTestId('lien-sign-line')
    expect(line.getAttribute('data-lien-sign-mode')).toBe('type')
    expect(screen.getByTestId('lien-sign-line-name').textContent).toBe('Robert Douglas')
    expect(line.querySelector('.lienSignFrameCode')).toBeNull()
    expect(line.querySelector('.lienSignFrameStrip')).toBeNull()
    expect(document.querySelector('[data-lien-sign-code-words]')).toBeNull()
    unmount()
    renderWithProviders(<LienNoticeSignLine printedName="Malachi Whites" under={['Malachi Whites']} signedLabel="Signed November 15, 2026" codeSigner={{ firstName: 'Malachi', status: 'locked', lockedUntilClock: '2:29 PM' }} frame={frame()} />)
    expect(screen.getByTestId('lien-sign-line').getAttribute('data-lien-sign-mode')).toBe('draw')
    expect(document.querySelector('[data-lien-sign-code-words]')!.textContent).toBe('His code is locked until 2:29 PM after five wrong tries. He can draw here instead.')
    expect(screen.queryByTestId('lien-sign-line-toggle')).toBeNull()
  })
})
