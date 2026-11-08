// @vitest-environment jsdom
/**
 * The whole of a History line in its window (punch list #280, v2.6735): the list reads a long line's
 * first words only, so the window reads the rest by the entry's id when it opens — the head with
 * *Reading the rest…* until it lands, the whole once it has, the head with the reason when it fails —
 * and a line read whole asks for nothing.
 */
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChangeLine } from '../../lib/developments/whatChanged'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DevelopmentLineWindow } from './DevelopmentLineWindow'

afterEach(() => cleanup())

const HEAD = 'The GC wrote about the pour. '.repeat(14).trim()
const WHOLE = `${HEAD} And then every word of the mail, the signature and the footer.`

function line(over: Partial<ChangeLine> = {}): ChangeLine {
  return { id: 'history:h1', at: '2026-10-28T14:12:00.000Z', kind: 'entry', verb: 'Email', about: { kind: 'site', id: null, label: 'Gun Dog' }, detail: HEAD, by: 'Dana', waitingDays: null, source: 'email', via: 'app', withTime: true, entryId: 'h1', detailIsHead: true, ...over }
}

describe('DevelopmentLineWindow — the rest of a long line', () => {
  it('reads the whole by the entry id, shows the head while it reads, then the whole', async () => {
    let settle: (text: string) => void = () => {}
    const readWhole = vi.fn(() => new Promise<string>((resolve) => (settle = resolve)))
    renderWithProviders(<DevelopmentLineWindow line={line()} onClose={() => {}} openAbout={() => {}} readWhole={readWhole} />)
    expect(readWhole).toHaveBeenCalledWith('h1')
    expect(screen.getByTestId('history-line-window-body').textContent).toContain(HEAD)
    expect(screen.getByTestId('history-line-window-reading')).toBeTruthy()
    await act(async () => settle(WHOLE))
    await waitFor(() => expect(screen.getByTestId('history-line-window-body').textContent).toBe(WHOLE))
    expect(screen.queryByTestId('history-line-window-reading')).toBeNull()
  })
  it('a failed read keeps the head and names the reason', async () => {
    const readWhole = vi.fn(() => Promise.reject({ message: 'the signal was lost', code: '' }))
    renderWithProviders(<DevelopmentLineWindow line={line()} onClose={() => {}} openAbout={() => {}} readWhole={readWhole} />)
    await waitFor(() => expect(screen.getByTestId('history-line-window-failed')).toBeTruthy())
    expect(screen.getByTestId('history-line-window-failed').textContent).toContain('the signal was lost')
    expect(screen.getByTestId('history-line-window-body').textContent).toContain(HEAD)
  })
  it('a line read whole asks for nothing', () => {
    const readWhole = vi.fn(() => Promise.resolve(WHOLE))
    renderWithProviders(<DevelopmentLineWindow line={line({ detailIsHead: undefined, detail: WHOLE })} onClose={() => {}} openAbout={() => {}} readWhole={readWhole} />)
    expect(readWhole).not.toHaveBeenCalled()
    expect(screen.getByTestId('history-line-window-body').textContent).toBe(WHOLE)
    expect(screen.queryByTestId('history-line-window-reading')).toBeNull()
  })
})
