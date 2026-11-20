// @vitest-environment jsdom
/**
 * What the reader hands the mail door (punch list #239, PR 5): the mail's line as it reads now, not the list's snapshot
 * of it, so a mail put on the job moments ago still brings its files, and how many files the mail shows. Made up.
 */
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderSettled } from '../../../test/renderSmokeMocks'
import { CEDAR, ELM, fakeMyMailIo, MARISOL, mailRow, openedMail } from '../../../test/myMailRows'
import { MyMailReader } from './MyMailReader'

const door = vi.hoisted(() => ({ props: [] as Array<{ messageId?: string | null; mailFileCount?: number; mailLinks?: ReadonlyArray<string>; jobId?: string }> }))

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('../../papers/MailPaperDoor', () => ({
  MailPaperDoor: (p: { messageId?: string | null; mailFileCount?: number; mailLinks?: ReadonlyArray<string>; jobId?: string }) => {
    door.props.push(p)
    return <div data-testid="paper-door" />
  },
}))

afterEach(() => {
  cleanup()
  door.props.length = 0
})

const latest = () => door.props[door.props.length - 1]!

async function read(row: ReturnType<typeof mailRow>, opened: ReturnType<typeof openedMail>) {
  const props = { onYes: vi.fn(), onPick: vi.fn(), onMove: vi.fn(), onPutOn: vi.fn(), onUntag: vi.fn(), onOpenThread: vi.fn(), onClose: vi.fn(), lineContact: vi.fn(() => null) }
  await renderSettled(<MyMailReader io={fakeMyMailIo({ open: async () => opened })} row={row} address={MARISOL} phone={false} readKey={0} done={null} busy={false} problem={null} {...props} />, { loaded: () => screen.findByRole('dialog') })
}

describe('MyMailReader → the mail door', () => {
  it('hands the door the line the mail reads with now, when the list’s row still has none', async () => {
    const row = mailRow('dale-late', { files: 1, tagged: { ...ELM, messageId: null } })
    await read(row, openedMail(row, { tagged: { ...ELM, messageId: 'm-elm-9' } }))
    await waitFor(() => expect(latest().messageId).toBe('m-elm-9'))
    expect(latest().mailFileCount).toBe(1)
    expect(latest().jobId).toBe('job-elm')
  })

  it('keeps the list’s line when the mail reads without one', async () => {
    const row = mailRow('dale-old', { files: 1, tagged: { ...ELM, messageId: 'm-elm-1' } })
    await read(row, openedMail(row, { tagged: null }))
    await waitFor(() => expect(screen.getByTestId('paper-door')).toBeTruthy())
    expect(latest().messageId).toBe('m-elm-1')
  })

  it('a mail no line holds hands no line, and says how many files it shows', async () => {
    const row = mailRow('dale-late', { files: 1, tagged: { ...ELM, messageId: null } })
    await read(row, openedMail(row))
    await waitFor(() => expect(latest().mailFileCount).toBe(1))
    expect(latest().messageId).toBeNull()
  })

  it('counts the mail’s real files for the door, a signature’s logo and a Drive link’s preview not among them (v2.7969)', async () => {
    const row = mailRow('dale-late', { files: 3, tagged: { ...ELM, messageId: null } })
    const fileList = [
      { name: 'image001.png', mime: 'image/png', size: 4_200 },
      { name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 212_000 },
      { name: 'Zx9MadeUpKeyForATest_0123456789-abcdefghijKLMNOP=w1200-h630-p.png', mime: 'image/png', size: 61_000 },
    ]
    await read(row, openedMail(row, { fileList }))
    await waitFor(() => expect(latest().mailFileCount).toBe(1))
  })

  it('a job’s mail with no real file and no file link draws no door (v2.7973)', async () => {
    const plain = mailRow('dale-old', { tagged: { ...ELM, messageId: 'm-elm-1' } })
    await read(plain, openedMail(plain))
    expect(screen.queryByTestId('paper-door')).toBeNull()
    cleanup()
    // A signature's logo alone is no file of a paper's.
    const logo = mailRow('dale-old', { files: 1, tagged: { ...ELM, messageId: 'm-elm-1' } })
    await read(logo, openedMail(logo, { fileList: [{ name: 'image001.png', mime: 'image/png', size: 4_200 }] }))
    expect(screen.queryByTestId('paper-door')).toBeNull()
  })

  it('a job’s mail with only a file link draws the door and hands it the link, once (v2.7973)', async () => {
    const link = 'https://docs.google.com/document/d/1MadeUpDocKeyForATest_0123456789abcdefghij/edit?usp=sharing'
    const row = mailRow('dale-old', { tagged: { ...ELM, messageId: 'm-elm-1' } })
    await read(row, openedMail(row, { bodyText: `The spec book is here: ${link}${String.fromCharCode(0xfffc)}\n\nDale`, bodyHtml: `<p>The spec book is <a href="${link}">here</a>.</p>` }))
    await waitFor(() => expect(screen.getByTestId('paper-door')).toBeTruthy())
    expect(latest().mailLinks).toEqual([link])
    expect(latest().mailFileCount).toBe(0)
  })

  it('draws no door on a mail tagged to a bid', async () => {
    const row = mailRow('dale-bid', { tagged: { ...CEDAR, messageId: 'm-bid-1' } })
    await read(row, openedMail(row))
    expect(screen.queryByTestId('paper-door')).toBeNull()
  })
})
