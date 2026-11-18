// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'

const sendDevNote = vi.hoisted(() => vi.fn(async (_args: Record<string, unknown>) => ({ id: 'note-1' })))

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'helpers', profileName: 'Marco Ruiz' }) }
})
vi.mock('../../hooks/useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))
vi.mock('../../lib/tellTheDev/sendNote', () => ({ sendDevNote }))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
vi.mock('../../content/releaseNotes', () => ({ RELEASE_NOTES: [{ version: 'v2.0001' }] }))

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { useToastContext } from '../../contexts/ToastContext'
import { OFFLINE_ERROR_MESSAGE } from '../../lib/networkErrorMessage'
import { troubleMemory } from '../../lib/tellTheDev/trouble'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { TellTheDevRoot } from './TellTheDevRoot'

function ShowError({ words }: { words: string }) {
  const { showToast } = useToastContext()
  return (
    <button type="button" onClick={() => showToast(words, 'error')}>
      fail
    </button>
  )
}

function phoneWidth(on: boolean) {
  window.matchMedia = ((query: string) => ({ matches: on, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
}

beforeEach(() => {
  sendDevNote.mockClear()
  window.localStorage.clear()
  troubleMemory.clear()
  phoneWidth(false)
})

afterEach(() => {
  phoneWidth(false)
})

describe('the error line’s press', () => {
  it('carries Tell the dev, and opens the box on Went wrong with the error listed', async () => {
    renderWithProviders(
      <>
        <ShowError words="The file is too big to send." />
        <TellTheDevRoot isMobile modes={['Job Mode']} fixMode />
      </>,
      { route: '/dashboard' },
    )
    await settle()
    fireEvent.click(screen.getByText('fail'))
    fireEvent.click(await screen.findByRole('button', { name: 'Tell the dev' }))
    await settle()

    expect(screen.getByRole('radio', { name: 'Something went wrong when I…' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('The file is too big to send. (just now)')).toBeTruthy()

    // One press sends it, with no words.
    fireEvent.click(screen.getByRole('button', { name: 'Send to the dev' }))
    await settle()
    const args = sendDevNote.mock.calls[0]![0] as { kind: string; typed: string; context: { door: string; errors: { words: string }[] } }
    expect(args.kind).toBe('broken')
    expect(args.typed).toBe('')
    expect(args.context.door).toBe('error_line')
    expect(args.context.errors[0]!.words).toBe('The file is too big to send.')
  })

  it('carries no press for a lost signal', async () => {
    renderWithProviders(
      <>
        <ShowError words={OFFLINE_ERROR_MESSAGE} />
        <TellTheDevRoot isMobile modes={[]} fixMode />
      </>,
      { route: '/dashboard' },
    )
    await settle()
    fireEvent.click(screen.getByText('fail'))
    expect(await screen.findByText(OFFLINE_ERROR_MESSAGE)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tell the dev' })).toBeNull()
  })

  it('carries no press with Fix Mode off, or with no box mounted', async () => {
    const r = renderWithProviders(
      <>
        <ShowError words="The file is too big to send." />
        <TellTheDevRoot isMobile modes={[]} fixMode={false} />
      </>,
      { route: '/dashboard' },
    )
    await settle()
    fireEvent.click(screen.getByText('fail'))
    expect(await screen.findByText('The file is too big to send.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tell the dev' })).toBeNull()
    r.unmount()

    renderWithProviders(<ShowError words="The file is too big to send." />, { route: '/dashboard' })
    fireEvent.click(screen.getByText('fail'))
    expect(await screen.findByText('The file is too big to send.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tell the dev' })).toBeNull()
  })
})

function WindowOnAPress({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  return open ? (
    <ResponsiveModalShell title={title} onRequestClose={() => setOpen(false)}>
      <p>Body</p>
    </ResponsiveModalShell>
  ) : (
    <button type="button" onClick={() => setOpen(true)}>
      open the window
    </button>
  )
}

describe('a window’s title row', () => {
  it('carries the wrench on a phone, and it opens the box', async () => {
    phoneWidth(true)
    renderWithProviders(
      <>
        <TellTheDevRoot isMobile modes={[]} fixMode />
        <WindowOnAPress title="Sign the tailgate sheet" />
      </>,
      { route: '/checklist?tab=today' },
    )
    await settle()
    // A window opens after the shell is up, which is when a box is there to answer.
    fireEvent.click(screen.getByText('open the window'))
    fireEvent.click(screen.getByRole('button', { name: 'Tell the dev' }))
    await settle()
    // jsdom lays nothing out, so the window's title is proven in `readPage.test.ts`; here the door opening the box is.
    expect(screen.getByRole('dialog', { name: 'Tell the dev' })).toBeTruthy()
    // The box's own sheet carries no wrench: still exactly one.
    expect(screen.getAllByRole('button', { name: 'Tell the dev' })).toHaveLength(1)
  })

  it('carries none at a desk, where the floating wrench is always in reach', async () => {
    phoneWidth(false)
    renderWithProviders(
      <>
        <TellTheDevRoot isMobile={false} modes={[]} fixMode />
        <WindowOnAPress title="Edit Job" />
      </>,
      { route: '/jobs' },
    )
    await settle()
    fireEvent.click(screen.getByText('open the window'))
    // The floating wrench alone.
    expect(screen.getAllByRole('button', { name: 'Tell the dev' })).toHaveLength(1)
  })

  it('carries none with Fix Mode off', async () => {
    phoneWidth(true)
    renderWithProviders(
      <>
        <TellTheDevRoot isMobile modes={[]} fixMode={false} />
        <WindowOnAPress title="Edit Job" />
      </>,
      { route: '/jobs' },
    )
    await settle()
    fireEvent.click(screen.getByText('open the window'))
    expect(screen.queryByRole('button', { name: 'Tell the dev' })).toBeNull()
  })
})
