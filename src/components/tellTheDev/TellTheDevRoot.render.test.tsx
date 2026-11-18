// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const sendDevNote = vi.hoisted(() => vi.fn(async (_args: Record<string, unknown>) => ({ id: 'note-1' })))
const recordNavClick = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'assistant', profileName: 'Dana Whitfield' }) }
})
vi.mock('../../hooks/useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))
vi.mock('../../lib/tellTheDev/sendNote', () => ({ sendDevNote }))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick }))
vi.mock('../../content/releaseNotes', () => ({ RELEASE_NOTES: [{ version: 'v2.0001' }] }))

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { troubleMemory } from '../../lib/tellTheDev/trouble'
import { TellTheDevHeaderButton, TellTheDevRoot } from './TellTheDevRoot'

beforeEach(() => {
  sendDevNote.mockClear()
  recordNavClick.mockClear()
  window.localStorage.clear()
  troubleMemory.clear()
})

const ROUTE = '/jobs?tab=stages&t=secret'

describe('TellTheDevRoot', () => {
  it('draws nothing with Fix Mode off, and hears no door', async () => {
    renderWithProviders(
      <>
        <TellTheDevHeaderButton />
        <TellTheDevRoot isMobile={false} modes={[]} fixMode={false} />
      </>,
      { route: ROUTE },
    )
    // first paint
    expect(screen.queryByText('Tell the dev')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tell the dev' }))
    await settle()
    expect(screen.queryByText('Goes with your note')).toBeNull()
  })

  it('at a desk: the wrench says its words, opens the box, and sends a note with its page', async () => {
    renderWithProviders(<TellTheDevRoot isMobile={false} modes={[]} fixMode />, { route: ROUTE })
    // first paint
    const wrench = screen.getByRole('button', { name: 'Tell the dev' })
    expect(wrench.textContent).toContain('Tell the dev')
    fireEvent.click(wrench)
    await settle()

    expect(screen.getByText('Goes with your note')).toBeTruthy()
    expect(screen.getByText('Jobs · Stages')).toBeTruthy()
    expect(screen.getByText('Dana Whitfield, Assistant')).toBeTruthy()
    expect(screen.getByText('A picture of your screen is never sent.')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('v2.0001')).toBeTruthy())
    expect(recordNavClick).toHaveBeenCalledWith(expect.any(String), 'assistant', 'tell_the_dev_open', '/wrench')

    // I want needs words, and says so.
    const send = screen.getByRole('button', { name: 'Send to the dev' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(screen.getByText('Say what you want first.')).toBeTruthy()

    // This page is confusing sends with none.
    fireEvent.click(screen.getByRole('radio', { name: 'This page is confusing because…' }))
    expect(send.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('This page is confusing because'), { target: { value: 'two totals sit side by side' } })
    fireEvent.click(send)
    await waitFor(() => expect(screen.getByText('Sent to the dev. Thank you.')).toBeTruthy())

    expect(sendDevNote).toHaveBeenCalledTimes(1)
    const args = sendDevNote.mock.calls[0]![0] as { kind: string; typed: string; pageKey: string; pagePath: string; context: { page_label: string; door: string; screen: { kind: string }; app_version: string | null } }
    expect(args.kind).toBe('confusing')
    expect(args.typed).toBe('two totals sit side by side')
    expect(args.pageKey).toBe('jobs:stages')
    // The pass in the address never rides on a note.
    expect(args.pagePath).toBe('/jobs?tab=stages')
    expect(args.context).toMatchObject({ page_label: 'Jobs · Stages', door: 'wrench', screen: { kind: 'desk' }, app_version: 'v2.0001' })
    expect(recordNavClick).toHaveBeenCalledWith(expect.any(String), 'assistant', 'tell_the_dev_sent', '/confusing')
  })

  it('drops its words once the person has opened it', async () => {
    const r = renderWithProviders(<TellTheDevRoot isMobile={false} modes={[]} fixMode />, { route: ROUTE })
    fireEvent.click(screen.getByRole('button', { name: 'Tell the dev' }))
    await settle()
    r.unmount()
    renderWithProviders(<TellTheDevRoot isMobile={false} modes={[]} fixMode />, { route: ROUTE })
    // first paint
    expect(screen.getByRole('button', { name: 'Tell the dev' }).textContent).toBe('')
  })

  it('on a phone: nothing floats, the header’s wrench opens a sheet, and the modes ride on the note', async () => {
    renderWithProviders(
      <>
        <TellTheDevHeaderButton />
        <TellTheDevRoot isMobile modes={['Job Mode']} fixMode />
      </>,
      { route: '/dashboard' },
    )
    // first paint: the header's button is the only wrench
    expect(screen.getAllByRole('button', { name: 'Tell the dev' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Tell the dev' }))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Tell the dev' })).toBeTruthy()
    expect(screen.getByText('Phone, Job Mode on')).toBeTruthy()
    expect(recordNavClick).toHaveBeenCalledWith(expect.any(String), 'assistant', 'tell_the_dev_open', '/header')
  })

  it('lists the last error line, and keeps the words when a send fails', async () => {
    troubleMemory.noteErrorLine('The file is too big to send.')
    sendDevNote.mockRejectedValueOnce(new Error('The server refused the note.'))
    renderWithProviders(<TellTheDevRoot isMobile={false} modes={[]} fixMode />, { route: '/dashboard' })
    fireEvent.click(screen.getByRole('button', { name: 'Tell the dev' }))
    await settle()
    expect(screen.getByText('The file is too big to send. (just now)')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('I want'), { target: { value: 'a bigger upload' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to the dev' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The server refused the note.'))
    expect((screen.getByLabelText('I want') as HTMLTextAreaElement).value).toBe('a bigger upload')
  })
})
