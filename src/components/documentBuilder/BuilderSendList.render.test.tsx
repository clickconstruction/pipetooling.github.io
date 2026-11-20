// @vitest-environment jsdom
/**
 * The Document builder's send list (punch list #404, step 5): a row a party with where the send stands, the box that
 * sends to one and names the person on its press, a page that is off kept off, an unread revision held until the box
 * is ticked, and the one press that sends to everyone ready, names who it held and keeps going past one that fails.
 * Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SendParty, SendRecord } from '../../lib/documentBuilder/send'
import { BuilderSendList } from './BuilderSendList'

afterEach(cleanup)

const sent = (over: Partial<SendRecord> = {}): SendRecord => ({ id: 's1', contactName: 'Ana Pruitt', about: null, sentOn: '2026-11-12', sentRevision: 1, timesSent: 1, openedOn: '2026-11-14', openedRevision: 1, ...over })
const party = (id: string, name: string, over: Partial<SendParty> = {}): SendParty => ({ id, name, page: { state: 'on' }, contacts: [{ name: `${name} Owner`, email: `owner@${id}.test`, role: 'owner' }], send: null, ...over })

const PARTIES: SendParty[] = [
  party('cedarfork', 'Cedar Fork Drain', { contacts: [{ name: 'Ana Pruitt', email: 'ana@cedarfork.test', role: 'owner' }], send: sent() }),
  party('lonemesa', 'Lone Mesa Excavation', { contacts: [{ name: 'Ben Winters', email: 'ben@lonemesa.test' }, { name: 'Cy Doyle', email: 'cy@lonemesa.test', role: 'office' }] }),
  party('pecos', 'Pecos Insulation', { contacts: [{ name: 'Gil Marsh', email: 'gil@pecos.test' }] }),
  party('hilltop', 'Hilltop Electric', { page: { state: 'none' }, contacts: [{ name: 'Noor Abbasi', email: 'noor@hilltop.test' }] }),
  party('tollgate', 'Tollgate Mechanical', { page: { state: 'off', offOn: '2026-10-03' }, contacts: [{ name: 'Pat Lindqvist', email: 'pat@tollgate.test' }] }),
]

const ok = async () => ({ ok: true as const, value: true })

function draw(over: Partial<Parameters<typeof BuilderSendList>[0]> = {}) {
  const props = {
    title: "Send the sheet to this job's trades",
    lead: 'A trade you send it to gets an email.',
    parties: PARTIES,
    revision: 1,
    published: true,
    unpublishedWords: "Publish this job's sheet first.",
    unread: '',
    noun: 'trade' as const,
    defaultNote: 'Here is what your certificate must show on this job.',
    emptyWords: 'No trade is on this job yet.',
    onSend: vi.fn(ok),
    onTakeOff: vi.fn(ok),
    onTurnPageOn: vi.fn(ok),
    ...over,
  }
  render(<BuilderSendList {...props} />)
  return props
}

const row = (id: string) => document.querySelector(`[data-send-party="${id}"]`) as HTMLElement

describe('BuilderSendList', () => {
  it('says where each send stands, and what stands in the way of the rest', () => {
    draw()
    expect(within(row('cedarfork')).getByText('Sent Nov 12 to Ana Pruitt')).toBeTruthy()
    expect(within(row('cedarfork')).getByText('Opened Nov 14')).toBeTruthy()
    expect(within(row('hilltop')).getByText('No page yet')).toBeTruthy()
    expect(within(row('tollgate')).getByText('Their page is off')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send to 2 trades who are ready' })).toBeTruthy()
    expect(screen.getByText('Held: Hilltop Electric has no page yet. Send to them alone to make one.')).toBeTruthy()
    expect(screen.getByText('Held: Tollgate Mechanical. Their page is off.')).toBeTruthy()
    expect(screen.getByText('Each send is kept under Sent copies on Documents.')).toBeTruthy()
  })

  it('opens a box that names the person on its press, and sends the note to who was picked', async () => {
    const props = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Send it to Lone Mesa Excavation' }))
    expect(screen.getByRole('button', { name: 'Send to Ben' })).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'To' }), { target: { value: 'cy@lonemesa.test' } })
    expect(screen.getByRole('option', { name: 'Cy Doyle, office' })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'A note to them' }), { target: { value: 'A made-up note.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to Cy' }))
    await waitFor(() => expect(props.onSend).toHaveBeenCalledTimes(1))
    expect(props.onSend).toHaveBeenCalledWith(PARTIES[1], { name: 'Cy Doyle', email: 'cy@lonemesa.test', role: 'office' }, 'A made-up note.', 'first', false)
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'A note to them' })).toBeNull())
  })

  it('says a send to someone with no page makes one', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Send it to Hilltop Electric' }))
    expect(screen.getByText('Hilltop Electric has no page yet. Sending makes one.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send to Noor' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('never turns a page back on: the send is dead, and turning the page on is its own press', async () => {
    const props = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Send it to Tollgate Mechanical' }))
    expect(screen.getByText(/Their page was turned off on Oct 3\. A send never turns a page back on\./)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send to Pat' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Turn their page on' }))
    await waitFor(() => expect(props.onTurnPageOn).toHaveBeenCalledWith(PARTIES[4]))
    expect(props.onSend).not.toHaveBeenCalled()
  })

  it('holds an unread revision until Send it anyway is ticked', async () => {
    const props = draw({ unread: 'Your insurance agent has not checked your usual sheet.' })
    const all = screen.getByRole('button', { name: 'Send to 2 trades who are ready' }) as HTMLButtonElement
    expect(all.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Your insurance agent has not checked your usual sheet. Send it anyway.' }))
    expect(all.disabled).toBe(false)
    fireEvent.click(all)
    await waitFor(() => expect(props.onSend).toHaveBeenCalledTimes(2))
    expect(props.onSend.mock.calls.map((c) => [c[0].id, c[1].email, c[3], c[4]])).toEqual([
      ['lonemesa', 'ben@lonemesa.test', 'first', true],
      ['pecos', 'gil@pecos.test', 'first', true],
    ])
    expect(await screen.findByText('Sent to 2 trades. Held 2.')).toBeTruthy()
  })

  it('keeps going past a send that fails, and names it with its reason', async () => {
    const onSend = vi.fn(async (p: SendParty) => (p.id === 'lonemesa' ? { ok: false as const, error: 'The email did not go. Nothing was recorded. Try again.' } : { ok: true as const, value: true }))
    draw({ onSend })
    fireEvent.click(screen.getByRole('button', { name: 'Send to 2 trades who are ready' }))
    expect(await screen.findByText('Sent to 1 trade. Held 2. 1 did not send.')).toBeTruthy()
    expect(onSend).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Lone Mesa Excavation: The email did not go. Nothing was recorded. Try again.')).toBeTruthy()
  })

  it('sends again, tells them it changed, and takes a send off their page', async () => {
    const props = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Send it again, Cedar Fork Drain' }))
    await waitFor(() => expect(props.onSend).toHaveBeenCalledTimes(1))
    expect(props.onSend.mock.calls[0]?.slice(1, 4)).toEqual([{ name: 'Ana Pruitt', email: 'ana@cedarfork.test', role: 'owner' }, '', 'again'])
    fireEvent.click(screen.getByRole('button', { name: 'Take it off the page of Cedar Fork Drain' }))
    await waitFor(() => expect(props.onTakeOff).toHaveBeenCalledWith(PARTIES[0]))
    cleanup()
    const next = draw({ revision: 2 })
    expect(within(row('cedarfork')).getByText('Changed since they opened it')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tell them it changed, Cedar Fork Drain' }))
    await waitFor(() => expect(next.onSend).toHaveBeenCalledTimes(1))
    expect(next.onSend.mock.calls[0]?.[3]).toBe('changed')
  })

  it('names the reason when one send is refused', async () => {
    draw({ onSend: vi.fn(async () => ({ ok: false as const, error: 'That company is not on this job.' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Send it to Pecos Insulation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send to Gil' }))
    expect((await screen.findByRole('alert')).textContent).toBe('That company is not on this job.')
    expect(screen.getByRole('button', { name: 'Send to Gil' })).toBeTruthy()
  })

  it('is dead until the sheet is published, and says what to do first', () => {
    draw({ published: false })
    expect((screen.getByRole('button', { name: 'Send to 2 trades who are ready' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText("Publish this job's sheet first.")).toBeTruthy()
  })

  it('says so with nobody on the job', () => {
    draw({ parties: [] })
    expect(screen.getByText('No trade is on this job yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Send to/ })).toBeNull()
  })
})
