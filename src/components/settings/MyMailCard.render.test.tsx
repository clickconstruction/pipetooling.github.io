// @vitest-environment jsdom
/**
 * My email in Messages (punch list #230 PR 3) over a fake io: an office person sees the switch on with their own
 * address and every line of what is read and kept; the switch saves off at once; a label left out shows as a chip, ×
 * shows it again, + a label adds one and refuses Inbox in words; a refused save says why; before the switch's column
 * is pushed the switch waits; a helper sees no card. Everything is made up.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MyMailSetting, MyMailSettingIo } from '../../lib/myMail/myMailIo'
import { renderSettled, renderWithProviders } from '../../test/renderSmokeMocks'
import { MyMailCard } from './MyMailCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

afterEach(cleanup)

const MARISOL: MyMailSetting = { on: true, hiddenLabels: ['Personal'], address: 'marisol@clickplumbing.example', ready: true }

function fakeIo(setting: MyMailSetting = MARISOL) {
  return {
    load: vi.fn<MyMailSettingIo['load']>(async () => setting),
    save: vi.fn<MyMailSettingIo['save']>(async (on, labels) => ({ on, hiddenLabels: labels ? [...labels] : setting.hiddenLabels })),
  }
}

async function draw(io = fakeIo(), role: Parameters<typeof MyMailCard>[0]['role'] = 'estimator') {
  return renderSettled(<MyMailCard role={role} userId="u-marisol" io={io} />, { loaded: () => screen.findByRole('switch', { name: 'Show my mail on the My email tab' }) })
}

describe('MyMailCard', () => {
  it('draws the switch on with the person’s own address and every line of what is read and kept', async () => {
    const io = fakeIo()
    const { loaded: toggle } = await draw(io)
    expect(io.load).toHaveBeenCalledWith('u-marisol')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    const card = document.querySelector('[data-my-mail-card]') as HTMLElement
    expect(card.id).toBe('settings-my-mail')
    expect(within(card).getByRole('heading', { name: 'My email in Messages' })).toBeTruthy()
    expect(card.querySelector('[data-my-mail-reads]')?.textContent).toBe('Reads marisol@clickplumbing.example, your Inbox and Sent, live. Nothing is kept until you tag a conversation.')
    for (const words of [
      'A tag copies that conversation onto the job, where the office team reads it. Untag takes it back, unless the office already put it on a legal matter.',
      'Nothing writes to your Gmail except the label Tagged in ClickTooling on a tagged mail.',
      'Only you see this tab. Nobody on the team reads your mail through the app.',
    ]) {
      expect(within(card).getByText(words)).toBeTruthy()
    }
    expect(within(card).getByText(/Never read: Drafts, Spam, Trash, and any label you name here\./)).toBeTruthy()
  })

  it('saves the switch off at once, the labels left as they are', async () => {
    const io = fakeIo()
    const { loaded: toggle } = await draw(io)
    fireEvent.click(toggle)
    await waitFor(() => expect(io.save).toHaveBeenCalledWith(false, null))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Show my mail on the My email tab' }).getAttribute('aria-checked')).toBe('false'))
    expect(await screen.findByText('Saved.')).toBeTruthy()
  })

  it('shows a left-out label as a chip, × shows it again, and + a label adds one, refusing Inbox in words', async () => {
    const io = fakeIo()
    await draw(io)
    const hidden = within(screen.getByRole('group', { name: 'Labels left out' }))
    expect(hidden.getByText('Personal')).toBeTruthy()
    fireEvent.click(hidden.getByRole('button', { name: 'Show Personal again' }))
    await waitFor(() => expect(io.save).toHaveBeenLastCalledWith(true, []))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show Personal again' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '+ a label' }))
    const box = screen.getByRole('textbox', { name: 'A Gmail label to leave out' })
    fireEvent.change(box, { target: { value: 'Inbox' } })
    expect(screen.getByRole('alert').textContent).toBe('Inbox and Sent are what this tab reads.')
    expect((screen.getByRole('button', { name: 'Leave it out' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: ' Receipts ' } })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Leave it out' }))
    await waitFor(() => expect(io.save).toHaveBeenLastCalledWith(true, ['Receipts']))
    expect(await screen.findByRole('button', { name: 'Show Receipts again' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'A Gmail label to leave out' })).toBeNull()
  })

  it('says why a save was refused', async () => {
    const io = fakeIo()
    io.save.mockImplementation(async () => Promise.reject(Object.assign(new Error('Leave out twenty labels at most.'), { code: 'P0001' })))
    const { loaded: toggle } = await draw(io)
    fireEvent.click(toggle)
    expect((await screen.findByRole('alert')).textContent).toContain('twenty labels')
  })

  it('holds the switch until its column is pushed, and says so', async () => {
    const io = fakeIo({ ...MARISOL, hiddenLabels: [], ready: false })
    const { loaded: toggle } = await draw(io)
    expect((toggle as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-my-mail-wait]')?.textContent).toBe('The switch arrives with the next database update. Until then your mail shows on the tab.')
  })

  it('draws nothing for a helper, who has no My email tab', () => {
    const io = fakeIo()
    const { container } = renderWithProviders(<MyMailCard role="helpers" userId="u-luis" io={io} />)
    expect(container.querySelector('[data-my-mail-card]')).toBeNull()
    expect(io.load).not.toHaveBeenCalled()
  })
})
