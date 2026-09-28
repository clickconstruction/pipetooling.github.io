// @vitest-environment jsdom
/**
 * Bid Board → Reply book, the window. Pins what each person is given: everyone copies, and the
 * copy is signed with their own name; Edit and Delete are drawn for the person who posted a
 * reply and for devs; training mode copies and nothing else. And the form: a post goes to the
 * book as typed, a refusal stays on the form, and Escape peels the form before the window.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { BidReplyBookModal } from './BidReplyBookModal'
import type { BidReplyBook } from '../../hooks/useBidReplyBook'
import type { BidReplyEntry } from '../../lib/bids/bidReplyBook'

installDomShims()

const auth: { user: { id: string } | null; role: string; profileName: string | null; readOnly: boolean } = { user: { id: 'wendi' }, role: 'estimator', profileName: 'Wendi Example', readOnly: false }
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }))

const DECLINE = 'We are going to decline to bid on this project. As it is over 4 hours from the office, travel time would price us out of the running.'

function entry(id: string, over: Partial<BidReplyEntry> = {}): BidReplyEntry {
  return {
    id,
    title: 'Declining: too far from the office',
    kind: 'declining',
    body: DECLINE,
    sign_with_sender: true,
    created_by: 'wendi',
    created_by_name: 'Wendi Example',
    created_at: '2026-09-28T15:00:00Z',
    updated_at: '2026-09-28T15:00:00Z',
    ...over,
  }
}

const WENDIS = entry('r1')
const ALEXS = entry('r2', { title: 'Following up: a week after we sent', kind: 'following_up', body: 'Has the project been awarded yet?', created_by: 'alex', created_by_name: 'Alex Example' })

function makeBook(over: Partial<BidReplyBook> = {}): BidReplyBook {
  return {
    entries: [WENDIS, ALEXS],
    loading: false,
    loadError: null,
    atReadLimit: false,
    saving: false,
    reload: vi.fn(async () => {}),
    addReply: vi.fn(async () => null),
    updateReply: vi.fn(async () => null),
    deleteReply: vi.fn(async () => null),
    ...over,
  }
}

const writeText = vi.fn(async (_text: string) => {})
const onClose = vi.fn()

function as(who: { id: string | null; role: string; name: string | null; readOnly?: boolean }) {
  auth.user = who.id ? { id: who.id } : null
  auth.role = who.role
  auth.profileName = who.name
  auth.readOnly = who.readOnly ?? false
}

const card = (title: string) => screen.getByRole('article', { name: title })

beforeEach(() => {
  as({ id: 'wendi', role: 'estimator', name: 'Wendi Example' })
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  cleanup()
  writeText.mockClear()
  onClose.mockClear()
})

describe('BidReplyBookModal — who is given what', () => {
  it('the person who posted a reply may change and delete it, and only it', () => {
    renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
    const mine = within(card(WENDIS.title))
    expect(mine.getByRole('button', { name: `Edit "${WENDIS.title}"` })).toBeTruthy()
    expect(mine.getByRole('button', { name: `Delete "${WENDIS.title}"` })).toBeTruthy()
    expect(mine.getByText('You · Sep 28')).toBeTruthy()
    const theirs = within(card(ALEXS.title))
    expect(theirs.queryByRole('button', { name: /^Edit/ })).toBeNull()
    expect(theirs.queryByRole('button', { name: /^Delete/ })).toBeNull()
    expect(theirs.getByRole('button', { name: `Copy "${ALEXS.title}"` })).toBeTruthy()
    expect(theirs.getByText('Alex Example · Sep 28')).toBeTruthy()
  })

  it('a dev may change and delete anybody’s', async () => {
    as({ id: 'dev-1', role: 'dev', name: 'Sam Example' })
    renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
    await settle()
    expect(screen.getAllByRole('button', { name: /^Edit/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Delete/ })).toHaveLength(2)
  })

  it('a master, an assistant, a primary and a superintendent copy and post, and change nobody else’s', async () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'primary', 'superintendent']) {
      as({ id: `u-${role}`, role, name: 'Pat Example' })
      renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
      await settle()
      expect(screen.getAllByRole('button', { name: /^Copy/ }), role).toHaveLength(2)
      expect(screen.getByRole('button', { name: '+ Add a reply' }), role).toBeTruthy()
      expect(screen.queryByRole('button', { name: /^(Edit|Delete)/ }), role).toBeNull()
      cleanup()
    }
  })

  it('training mode copies and nothing else', async () => {
    as({ id: 'wendi', role: 'estimator', name: 'Wendi Example', readOnly: true })
    renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
    await settle()
    expect(screen.getAllByRole('button', { name: /^Copy/ })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: '+ Add a reply' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^(Edit|Delete)/ })).toBeNull()
  })
})

describe('BidReplyBookModal — Copy', () => {
  it('signs the copy with the name of whoever pressed it, not the author’s', async () => {
    as({ id: 'alex', role: 'estimator', name: 'Alex Example' })
    renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: `Copy "${WENDIS.title}"` }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${DECLINE}\n\nThank you,\nAlex`))
    expect(await screen.findByText('Copied, signed Alex. Paste it where you are writing.')).toBeTruthy()
  })

  it('a reply that is not signed is copied as written', async () => {
    const plain = entry('r3', { title: 'Where the plans are', kind: 'other', body: 'Plans are in the project folder.', sign_with_sender: false })
    renderWithProviders(<BidReplyBookModal book={makeBook({ entries: [plain] })} onClose={onClose} />)
    await settle()
    expect(within(card(plain.title)).queryByText(/Thank you,/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: `Copy "${plain.title}"` }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Plans are in the project folder.'))
  })

  it('says so when the browser will not copy', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: `Copy "${WENDIS.title}"` }))
    expect(await screen.findByText('This browser would not copy it. Select the wording and copy it by hand.')).toBeTruthy()
  })
})

describe('BidReplyBookModal — finding a reply', () => {
  it('the chips carry the book’s counts and narrow the list', async () => {
    renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
    await settle()
    expect(screen.getByRole('button', { name: 'All 2' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Following up 1' }))
    expect(screen.queryByRole('article', { name: WENDIS.title })).toBeNull()
    expect(card(ALEXS.title)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Asking for something 0' }))
    expect(screen.getByText(/Nothing in the book matches/)).toBeTruthy()
  })

  it('search reads the wording', async () => {
    renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
    await settle()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search the replies' }), { target: { value: 'awarded' } })
    expect(screen.queryByRole('article', { name: WENDIS.title })).toBeNull()
    expect(card(ALEXS.title)).toBeTruthy()
  })

  it('an empty book, a book still loading and a book that could not be read each say so', async () => {
    renderWithProviders(<BidReplyBookModal book={makeBook({ entries: [] })} onClose={onClose} />)
    await settle()
    expect(screen.getByText(/The book is empty/)).toBeTruthy()
    cleanup()
    renderWithProviders(<BidReplyBookModal book={makeBook({ entries: [], loading: true })} onClose={onClose} />)
    await settle()
    expect(screen.getByRole('status').textContent).toBe('Loading the replies…')
    cleanup()
    const reload = vi.fn(async () => {})
    renderWithProviders(<BidReplyBookModal book={makeBook({ entries: [], loadError: 'The reply book could not be read.', reload })} onClose={onClose} />)
    await settle()
    expect(screen.getByRole('alert').textContent).toContain('The reply book could not be read.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('BidReplyBookModal — the form', () => {
  it('posts what was typed, says what the sign-off rule will leave off, and returns to the list', async () => {
    const book = makeBook()
    renderWithProviders(<BidReplyBookModal book={book} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a reply' }))
    const form = within(screen.getByRole('form', { name: 'Add a reply' }))
    fireEvent.change(form.getByLabelText('What is it for?'), { target: { value: 'Declining: schedule is full' } })
    fireEvent.change(form.getByLabelText('The wording'), { target: { value: 'We will pass on this one.\n\nThank you,\nWendi' } })
    expect(form.getByText(/Left off when it is saved: "Thank you, Wendi"/)).toBeTruthy()
    fireEvent.click(form.getByRole('button', { name: 'Post to the book' }))
    await waitFor(() =>
      expect(book.addReply).toHaveBeenCalledWith({ title: 'Declining: schedule is full', kind: 'declining', body: 'We will pass on this one.\n\nThank you,\nWendi', signWithSender: true }),
    )
    expect(await screen.findByRole('heading', { name: 'Reply book' })).toBeTruthy()
  })

  it('a form with nothing in it is not sent, and says what is missing', async () => {
    const book = makeBook()
    renderWithProviders(<BidReplyBookModal book={book} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a reply' }))
    fireEvent.click(screen.getByRole('button', { name: 'Post to the book' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Say what the reply is for.')
    expect(book.addReply).not.toHaveBeenCalled()
  })

  it('Edit opens the reply as saved and sends the change under its id', async () => {
    const book = makeBook()
    renderWithProviders(<BidReplyBookModal book={book} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: `Edit "${WENDIS.title}"` }))
    const form = within(screen.getByRole('form', { name: 'Change a reply' }))
    expect((form.getByLabelText('The wording') as HTMLTextAreaElement).value).toBe(DECLINE)
    expect(form.getByRole('button', { name: 'Declining' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(form.getByRole('button', { name: 'Other' }))
    fireEvent.click(form.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(book.updateReply).toHaveBeenCalledWith('r1', { title: WENDIS.title, kind: 'other', body: DECLINE, signWithSender: true }))
  })

  it('a refusal stays on the form with its words', async () => {
    const book = makeBook({ updateReply: vi.fn(async () => 'Only the person who posted a reply, or a dev, can change or delete it.') })
    renderWithProviders(<BidReplyBookModal book={book} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: `Edit "${WENDIS.title}"` }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Only the person who posted a reply, or a dev, can change or delete it.')
    expect(screen.getByRole('form', { name: 'Change a reply' })).toBeTruthy()
  })

  it('Escape peels the form, then the window; typed wording is asked about first', async () => {
    renderWithProviders(<BidReplyBookModal book={makeBook()} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a reply' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await screen.findByRole('heading', { name: 'Reply book' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '+ Add a reply' }))
    fireEvent.change(screen.getByLabelText('The wording'), { target: { value: 'Half a thought' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await screen.findByText('What you typed has not been saved.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(await screen.findByRole('heading', { name: 'Reply book' })).toBeTruthy()

    await settle()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('BidReplyBookModal — Delete', () => {
  it('asks first; No deletes nothing, Delete deletes that reply', async () => {
    const book = makeBook()
    renderWithProviders(<BidReplyBookModal book={book} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: `Delete "${WENDIS.title}"` }))
    expect(await screen.findByText(`"${WENDIS.title}" leaves the book for everyone. It cannot be brought back.`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(book.deleteReply).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: `Delete "${WENDIS.title}"` }))
    await screen.findByText(/leaves the book for everyone/)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(book.deleteReply).toHaveBeenCalledWith('r1'))
    expect(await screen.findByText('Deleted.')).toBeTruthy()
  })

  it('a refused delete says why', async () => {
    const book = makeBook({ deleteReply: vi.fn(async () => 'Only the person who posted a reply, or a dev, can change or delete it.') })
    renderWithProviders(<BidReplyBookModal book={book} onClose={onClose} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: `Delete "${WENDIS.title}"` }))
    await screen.findByText(/leaves the book for everyone/)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Only the person who posted a reply, or a dev, can change or delete it.')).toBeTruthy()
  })
})
