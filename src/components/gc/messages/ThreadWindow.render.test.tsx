// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ThreadWindow } from './ThreadWindow'
import { WhoIsThisWindow } from './WhoIsThisWindow'
import type { MessagesWrites } from './messagesWrites'
import type { ThreadSlots } from './threadSlots'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import type { RecordHit } from '../../../lib/messages/messagesIo'
import type { JobTile } from '../../../lib/messages/jobTiles'

const ALAMO: RecordHit = { record: { table: 'gc_companies', id: 'gc-alamo' }, label: 'Alamo Concrete', sub: 'Trade partner', kind: 'trade' }

function writes(named: string | null = 'c-unknown'): MessagesWrites {
  return {
    nameContact: vi.fn(() => Promise.resolve(named)),
    tieMessage: vi.fn(() => Promise.resolve()),
    setDefaultJob: vi.fn(() => Promise.resolve()),
    addJob: vi.fn(() => Promise.resolve()),
    removeJob: vi.fn(() => Promise.resolve()),
    searchRecords: vi.fn(() => Promise.resolve([ALAMO])),
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
}

function open(contactId: string, more: { w?: MessagesWrites; slots?: ThreadSlots; onClose?: () => void; onOpenJob?: (k: string) => void; onShowContact?: (id: string) => void; at?: string } = {}) {
  const w = more.w ?? writes()
  const onClose = more.onClose ?? vi.fn()
  renderWithProviders(
    <ThreadWindow
      contactId={contactId}
      at={more.at ?? null}
      onClose={onClose}
      slots={more.slots}
      view={spineMessagesView()}
      nowIso={DEMO_NOW}
      writes={w}
      onOpenJob={more.onOpenJob}
      onShowContact={more.onShowContact}
    />,
  )
  return { w, onClose, win: screen.getByRole('dialog', { name: contactId === 'c-greg' ? 'Greg Paulk: messages' : /: messages$/ }) }
}

describe('ThreadWindow: a person\'s thread (Messages, cut 1)', () => {
  it('waits for the read, then says when the person is not in Messages', () => {
    const { rerender } = renderWithProviders(<ThreadWindow contactId="c-greg" onClose={vi.fn()} view={null} nowIso={DEMO_NOW} writes={writes()} />)
    expect(screen.getByText('Loading the thread…')).toBeTruthy()
    rerender(<ThreadWindow contactId="c-nobody" onClose={vi.fn()} view={spineMessagesView()} nowIso={DEMO_NOW} writes={writes()} />)
    expect(screen.getByText('This person is not in Messages.')).toBeTruthy()
  })

  it('draws an email’s files as chips under its words, the time below them, and a chip opens the message (cut 6)', () => {
    const { win } = open('c-greg')
    const line = win.querySelector('[data-thread-line="m-greg-email-in"]') as HTMLElement
    const chips = within(line.querySelector('[data-line-files]') as HTMLElement).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual([
      'PDFHillside-Boerne-sitework-rev1.pdf · 1.3 MB',
      'IMGsite-photo-pad.jpg · 2.8 MB',
      '↗Addendum 2 drawings · a link',
      'FHillside-Boerne-full-set.zip · 31 MB',
    ])
    expect(line.lastElementChild!.textContent).toBe('11:30 AM')
    fireEvent.click(chips[1]!)
    expect(screen.getByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' }).querySelector('[data-message-files]')).toBeTruthy()
  })

  it('draws the header in its rows: name with ☎ and ⋯, what they are, their numbers, whose move, the stamps, the jobs', () => {
    const { win } = open('c-greg')
    expect(within(win).getByRole('heading', { name: 'Greg Paulk' })).toBeTruthy()
    expect(win.textContent).toContain('Trade partner: Hillside Excavation')
    expect(within(win).getByRole('link', { name: 'Call (210) 555-0113' }).getAttribute('href')).toBe('tel:2105550113')
    // v2.5542: the call link and ⋯ wear the header's control class (no border, one height) in place of their own borders.
    expect(within(win).getByRole('link', { name: 'Call (210) 555-0113' }).className).toBe('thread-head-control')
    expect(within(win).getByRole('button', { name: 'More' }).className).toBe('thread-head-control')
    const reach = win.querySelector('[data-thread-reach]') as HTMLElement
    expect(within(reach).getByRole('link', { name: 'greg@hillside.example' }).getAttribute('href')).toBe('mailto:greg@hillside.example')
    fireEvent.click(within(win).getByRole('button', { name: 'Hide their numbers and addresses' }))
    expect(win.querySelector('[data-thread-reach]')).toBeNull()
    expect(win.querySelector('[data-thread-status]')!.textContent).not.toBe('')
    expect(win.querySelector('[data-thread-stamps]')!.textContent).not.toBe('')
    const rail = win.querySelector('[data-jobs-rail]') as HTMLElement
    expect(within(rail).getByRole('button', { name: 'New messages land on #42' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(rail).getByRole('button', { name: 'Make B482 the job new messages land on' })).toBeTruthy()

    fireEvent.click(within(win).getByRole('button', { name: 'More' }))
    const menu = within(win).getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Show all text', 'Open their record'])
  })

  it('draws every slot a later cut fills, and its ⋯ rows after the window\'s own', () => {
    const press = vi.fn()
    const slots: ThreadSlots = {
      headerRight: () => <span>portal pill</span>,
      statusRow: () => <span>on the flow</span>,
      menuRows: () => [{ key: 'stop', label: 'Mark STOP', onPress: press }],
      aboveBox: () => <div>a chip above the box</div>,
      box: () => <div>the reply box</div>,
      underLine: (m) => (m.id === 'm-greg-text-in' ? <div>an offer under his text</div> : null),
      lineBody: (m) => (m.id === 'm-greg-text-in' ? <span>a highlighted body</span> : null),
      side: () => <aside>the flow panel</aside>,
    }
    const { win } = open('c-greg', { slots })
    for (const words of ['portal pill', 'on the flow', 'a chip above the box', 'the reply box', 'an offer under his text', 'a highlighted body', 'the flow panel']) {
      expect(within(win).getByText(words)).toBeTruthy()
    }
    fireEvent.click(within(win).getByRole('button', { name: 'More' }))
    fireEvent.click(within(win).getByRole('menuitem', { name: 'Mark STOP' }))
    expect(press).toHaveBeenCalledTimes(1)
  })

  it('the rail: the star moves, ⧉ opens the job, a press filters the lines, and × asks before it takes a tie off', async () => {
    const onOpenJob = vi.fn()
    const { w, win } = open('c-greg', { onOpenJob })
    const rail = win.querySelector('[data-jobs-rail]') as HTMLElement
    fireEvent.click(within(rail).getByRole('button', { name: 'Make B482 the job new messages land on' }))
    expect(w.setDefaultJob).toHaveBeenCalledWith('c-greg', 'bid:bid-boerne')
    fireEvent.click(within(rail).getByRole('button', { name: 'Open #42' }))
    expect(onOpenJob).toHaveBeenCalledWith('project:proj-stoneoak')

    const lines = () => win.querySelectorAll('[data-thread-line]').length
    const all = lines()
    fireEvent.click(within(rail).getByRole('button', { name: /^#42 / }))
    expect(lines()).toBeLessThan(all)
    fireEvent.click(within(rail).getByRole('button', { name: 'show all' }))
    expect(lines()).toBe(all)

    fireEvent.click(within(rail).getByRole('button', { name: 'Take B482 off them' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Take B482 Boerne Retail Shell off Greg Paulk?' })
    fireEvent.click(within(ask).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(w.removeJob).toHaveBeenCalledWith('c-greg', 'bid:bid-boerne'))
  })

  it('a line opens in the message window; Escape closes that window first, then the thread', async () => {
    const onClose = vi.fn()
    const { win } = open('c-greg', { onClose })
    fireEvent.click(win.querySelector('[data-thread-line="m-greg-email-in"]')!)
    const full = await screen.findByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' })
    expect(full.querySelector('[data-message-full]')!.textContent).toContain('Numbers attached for the Boerne sitework.')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Email: Hillside sitework, Boerne, rev 1' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a line with no job asks for one in the picker, which also unties', async () => {
    const { w, win } = open('c-greg')
    const odd = win.querySelector('[data-thread-line="m-greg-odd-optout"]') as HTMLElement
    fireEvent.click(within(odd).getByRole('button', { name: 'no job' }))
    const picker = await screen.findByRole('dialog', { name: 'Tie this line to a job' })
    fireEvent.click(within(picker).getByRole('button', { name: /^#42 Stone Oak Pharmacy/ }))
    expect(w.tieMessage).toHaveBeenCalledWith('m-greg-odd-optout', 'project:proj-stoneoak')
    expect(screen.queryByRole('dialog', { name: 'Tie this line to a job' })).toBeNull()
  })

  it('Who is this?: a number nobody named finds its person and joins their thread', async () => {
    const onShowContact = vi.fn()
    const w = writes('c-dee')
    const { win } = open('c-unknown', { w, onShowContact })
    const header = win.querySelector('[data-thread-header]') as HTMLElement
    expect(within(header).getByText('A number nobody has named')).toBeTruthy()
    expect(within(header).getAllByText('Who is this?')).toHaveLength(1)
    fireEvent.click(within(win).getByRole('button', { name: 'Who is this?' }))
    const who = await screen.findByRole('dialog', { name: /^Who is this\?/ })
    fireEvent.change(within(who).getByRole('textbox', { name: 'Their name or their company' }), { target: { value: 'Alamo' } })
    const hit = await within(who).findByRole('option', { name: /Alamo Concrete/ })
    expect(w.searchRecords).toHaveBeenCalledWith('Alamo')
    fireEvent.click(hit)
    fireEvent.change(within(who).getByRole('textbox', { name: /^Their own name/ }), { target: { value: 'Dee' } })
    fireEvent.click(within(who).getByRole('button', { name: 'This is who it is' }))
    await waitFor(() => expect(onShowContact).toHaveBeenCalledWith('c-dee'))
    expect(w.nameContact).toHaveBeenCalledWith('c-unknown', { record: { table: 'gc_companies', id: 'gc-alamo' }, kind: 'trade', name: 'Dee' })
  })

  it('Who is this?: the box their line came in on puts its own kinds first (R6)', async () => {
    const dana: RecordHit = { record: { table: 'customers', id: 'cu-dana' }, label: 'Dana Whitfield', sub: 'Customer', kind: 'customer' }
    const view = spineMessagesView()
    const unknown = view.contacts.find((c) => c.id === 'c-unknown')!
    const shown = async (box: 'team' | 'bids' | null) => {
      const w = { ...writes(), searchRecords: vi.fn(() => Promise.resolve([ALAMO, dana])) }
      const { unmount } = renderWithProviders(<WhoIsThisWindow contact={unknown} box={box} writes={w} onNamed={vi.fn()} onClose={vi.fn()} />)
      const who = screen.getByRole('dialog', { name: /^Who is this\?/ })
      fireEvent.change(within(who).getByRole('textbox', { name: 'Their name or their company' }), { target: { value: 'Whit' } })
      await within(who).findByRole('option', { name: /Dana Whitfield/ })
      const order = within(who).getAllByRole('option').map((o) => o.textContent ?? '')
      unmount()
      return order.map((t) => (t.startsWith('Dana') ? 'Dana' : 'Alamo'))
    }
    expect(await shown('team')).toEqual(['Dana', 'Alamo'])
    expect(await shown('bids')).toEqual(['Alamo', 'Dana'])
    expect(await shown(null)).toEqual(['Alamo', 'Dana'])
  })
})
