// @vitest-environment jsdom
/**
 * v2.6513: what a press on a contact point in a message's words does. Email on this person's own address opens the box
 * here on Email and writes *pressed Email on*; on another address it asks whose it is, makes a thread when nobody's, opens
 * it with the box on Email and writes *opened a thread for*; Call and the map write their lines; Undo writes nothing; a
 * refused write says why.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { contactById } from '../../../lib/contacts/kernel'
import { deferredLineCount, flushDeferredLines, type BodyContactsIo } from '../../../lib/messages/bodyContactsIo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { pressSourceOf, useContactPointActs } from './useContactPointActs'
import type { ContactPoint } from '../../../lib/messages/bodyContacts'

const view = spineMessagesView()
const greg = contactById(view.contacts, 'c-greg')!
const email = view.messages.find((m) => m.id === 'm-greg-email-in')!

const GREG_EMAIL: ContactPoint = { kind: 'email', address: 'greg@hillside.example', words: 'greg@hillside.example' }
const ANA_EMAIL: ContactPoint = { kind: 'email', address: 'ana@hillside.example', words: 'ana@hillside.example' }
const DANA_EMAIL: ContactPoint = { kind: 'email', address: 'Dana@Hillside.example', words: 'Dana@Hillside.example' }
const CELL: ContactPoint = { kind: 'phone', number: '(832) 871-4166', ext: '121', words: '(832) 871-4166 ext. 121' }
const OFFICE: ContactPoint = { kind: 'address', words: '4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477' }

function fakeIo(more: Partial<BodyContactsIo> = {}): BodyContactsIo {
  return {
    whoseChannel: vi.fn(async () => null),
    makeThread: vi.fn(async () => 'c-new'),
    writeLine: vi.fn(async () => {}),
    myName: vi.fn(async () => 'Grace'),
    ...more,
  }
}

function Harness({ io, onShowContact, onClose, undoMs = 40 }: { io: BodyContactsIo; onShowContact: (id: string, more?: { reply?: 'text' | 'email' | null }) => void; onClose: () => void; undoMs?: number }) {
  const acts = useContactPointActs({ contact: greg, message: email, onClose, onShowContact, io, undoMs })
  return (
    <div>
      <button onClick={() => acts.onReply(GREG_EMAIL, 'email')}>email greg</button>
      <button onClick={() => acts.onReply(ANA_EMAIL, 'email')}>email ana</button>
      <button onClick={() => acts.onReply(DANA_EMAIL, 'email')}>email dana</button>
      <button onClick={() => acts.onCall(CELL, 'phone')}>call</button>
      <button onClick={() => acts.onMap(OFFICE)}>map</button>
    </div>
  )
}

describe('useContactPointActs: a press on a number or an address in a message’s words (v2.6513)', () => {
  afterEach(() => {
    flushDeferredLines()
    cleanup()
  })

  it('names where the press was made from the line', () => {
    expect(pressSourceOf(email, greg)).toEqual({ first: 'Greg', channel: 'email', dayWords: 'Oct 2', ours: false })
    expect(pressSourceOf({ ...email, direction: 'out' }, greg)).toEqual({ first: null, channel: 'email', dayWords: 'Oct 2', ours: true })
    expect(pressSourceOf({ ...email, direction: 'team', channel: 'note' }, greg).channel).toBe('note')
  })

  it('Email on this person’s own address closes the window, opens this thread on Email, and writes the line after the time', async () => {
    const io = fakeIo()
    const onShowContact = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<Harness io={io} onShowContact={onShowContact} onClose={onClose} />)
    fireEvent.click(screen.getByText('email greg'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onShowContact).toHaveBeenCalledWith('c-greg', { reply: 'email' })
    expect(io.whoseChannel).not.toHaveBeenCalled()
    expect(screen.getByText('Email pressed on greg@hillside.example. The line lands on the thread in ten seconds.')).toBeTruthy()
    expect(io.writeLine).not.toHaveBeenCalled()
    await waitFor(() => expect(io.writeLine).toHaveBeenCalledWith('c-greg', "Grace pressed Email on greg@hillside.example from Greg's email of Oct 2."))
  })

  it('Email on another address asks whose it is, makes a thread when nobody’s, opens it on Email, and writes the thread line', async () => {
    const io = fakeIo()
    const onShowContact = vi.fn()
    renderWithProviders(<Harness io={io} onShowContact={onShowContact} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('email ana'))
    await waitFor(() => expect(onShowContact).toHaveBeenCalledWith('c-new', { reply: 'email' }))
    expect(io.whoseChannel).toHaveBeenCalledWith('email', 'ana@hillside.example')
    expect(io.makeThread).toHaveBeenCalledWith('email', 'ana@hillside.example', greg)
    expect(screen.getByText('A thread for ana@hillside.example is open. The line lands on this thread in ten seconds.')).toBeTruthy()
    await waitFor(() => expect(io.writeLine).toHaveBeenCalledWith('c-greg', "Grace opened a thread for ana@hillside.example from Greg's email of Oct 2."))
    cleanup()
    // An address someone already holds: their thread, nothing made.
    const held = fakeIo({ whoseChannel: vi.fn(async () => 'c-dana') })
    const show = vi.fn()
    renderWithProviders(<Harness io={held} onShowContact={show} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('email dana'))
    await waitFor(() => expect(show).toHaveBeenCalledWith('c-dana', { reply: 'email' }))
    expect(held.makeThread).not.toHaveBeenCalled()
  })

  it('Call and the map write their lines; Undo writes nothing; a refused write says why', async () => {
    const io = fakeIo()
    renderWithProviders(<Harness io={io} onShowContact={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('call'))
    expect(screen.getByText('Call pressed on (832) 871-4166 ext. 121. The line lands on the thread in ten seconds.')).toBeTruthy()
    expect(deferredLineCount()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Undone. Nothing was written.')).toBeTruthy()
    expect(deferredLineCount()).toBe(0)
    fireEvent.click(screen.getByText('map'))
    await waitFor(() => expect(io.writeLine).toHaveBeenCalledWith('c-greg', "Grace opened the map for 4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477 from Greg's email of Oct 2."))
    expect(io.writeLine).toHaveBeenCalledTimes(1)
    cleanup()
    const refused = fakeIo({ writeLine: vi.fn(async () => Promise.reject(new Error('Could not write the line on the thread.'))) })
    renderWithProviders(<Harness io={refused} onShowContact={vi.fn()} onClose={vi.fn()} undoMs={10} />)
    fireEvent.click(screen.getByText('call'))
    await act(() => new Promise((r) => setTimeout(r, 30)))
    expect(screen.getByText('Could not write the line on the thread.')).toBeTruthy()
  })
})
