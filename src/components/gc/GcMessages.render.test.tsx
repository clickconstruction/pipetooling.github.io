// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { GcMessages } from './GcMessages'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { listRows } from '../../lib/messages/listRows'
import { DEMO_NOW } from '../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../lib/messages/spineRows'

const rowIds = () => [...document.querySelectorAll('[data-messages-row]')].map((el) => el.getAttribute('data-messages-row'))
const row = (id: string) => document.querySelector(`[data-messages-row="${id}"]`) as HTMLElement

describe('GcMessages: the people list (Messages, cut 1)', () => {
  afterEach(() => window.localStorage.clear())

  it('says it is loading, then what went wrong', () => {
    const { rerender } = renderWithProviders(<GcMessages view={null} problem={null} nowIso={DEMO_NOW} onOpenThread={vi.fn()} />)
    expect(screen.getByText('Loading the messages…')).toBeTruthy()
    rerender(<GcMessages view={null} problem="The messages did not load." nowIso={DEMO_NOW} onOpenThread={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toBe('The messages did not load.')
  })

  it('lists everyone, newest conversation first, then the people with no line by name, in three lines a row', () => {
    const view = spineMessagesView()
    renderWithProviders(<GcMessages view={view} problem={null} nowIso={DEMO_NOW} onOpenThread={vi.fn()} />)
    expect(rowIds()).toEqual(['c-greg', 'c-elena', 'c-unknown', 'c-sam', 'c-bell', 'c-dana', 'c-dee', 'c-jonah', 'c-pat'])
    const [greg] = listRows(view.contacts, view.messages, { filter: 'all', search: '', nowIso: DEMO_NOW })
    expect(row('c-greg').textContent).toContain('Greg Paulk')
    expect(row('c-greg').textContent).toContain(greg!.when)
    expect(row('c-greg').textContent).toContain('Hillside Excavation · Sitework')
    expect(row('c-greg').textContent).toContain(`Email ${greg!.lastLine!.words}`)
    expect(row('c-dana').textContent).toContain('No messages yet.')
  })

  it('narrows to Customers, Trades with the architects, and Who is this?, and searches every line and number', () => {
    renderWithProviders(<GcMessages view={spineMessagesView()} problem={null} nowIso={DEMO_NOW} onOpenThread={vi.fn()} />)
    const filters = screen.getByRole('group', { name: 'Who to show' })
    fireEvent.click(within(filters).getByRole('button', { name: 'Customers' }))
    expect(rowIds()).toEqual(['c-elena', 'c-bell'])
    expect(within(filters).getByRole('button', { name: 'Customers' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(filters).getByRole('button', { name: 'Trades' }))
    expect(rowIds()).toEqual(['c-greg', 'c-sam', 'c-dana', 'c-dee', 'c-jonah'])
    fireEvent.click(within(filters).getByRole('button', { name: 'Who is this?' }))
    expect(rowIds()).toEqual(['c-unknown', 'c-pat'])
    fireEvent.click(within(filters).getByRole('button', { name: 'All' }))

    const search = screen.getByRole('textbox', { name: 'Search the messages' })
    fireEvent.change(search, { target: { value: 'Detention pond' } })
    expect(rowIds()).toEqual(['c-greg'])
    fireEvent.change(search, { target: { value: '0172' } })
    expect(rowIds()).toEqual(['c-dee'])
    fireEvent.change(search, { target: { value: 'nobody says this' } })
    expect(rowIds()).toEqual([])
    expect(screen.getByText('Nothing matches.')).toBeTruthy()
  })

  it('a row opens the thread; the list folds to a rail of faces, kept in this browser, whose faces open it too', () => {
    const onOpenThread = vi.fn()
    const { unmount } = renderWithProviders(<GcMessages view={spineMessagesView()} problem={null} nowIso={DEMO_NOW} onOpenThread={onOpenThread} />)
    fireEvent.click(row('c-elena'))
    expect(onOpenThread).toHaveBeenLastCalledWith('c-elena')

    fireEvent.click(screen.getByRole('button', { name: 'Hide the list' }))
    expect(document.querySelector('[data-messages-rail]')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    expect(window.localStorage.getItem('gcMessagesListFolded')).toBe('1')
    unmount()

    renderWithProviders(<GcMessages view={spineMessagesView()} problem={null} nowIso={DEMO_NOW} onOpenThread={onOpenThread} />)
    expect(document.querySelector('[data-messages-rail]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Greg Paulk, Hillside Excavation · Sitework, / }))
    expect(onOpenThread).toHaveBeenLastCalledWith('c-greg')
    fireEvent.click(screen.getByRole('button', { name: 'Show the list' }))
    expect(screen.getByRole('list')).toBeTruthy()
    expect(window.localStorage.getItem('gcMessagesListFolded')).toBe('0')
  })
})
