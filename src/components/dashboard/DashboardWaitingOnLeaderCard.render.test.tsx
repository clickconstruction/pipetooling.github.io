// @vitest-environment jsdom
/**
 * The office's Waiting on card: a lien row's Remind press, dead once this visit reminded him and while another
 * reminder goes; a row with no message says so and opens its job; the press for his signing code; and a read
 * that failed said in words under the rows.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { buildWaitingOnLeader, type WaitingOnLeaderCard } from '../../lib/dashboard/waitingOnLeader'
import { WaitingOnLeaderBody, type WaitingOnLeaderBodyProps } from './DashboardWaitingOnLeaderCard'

afterEach(cleanup)

const card: WaitingOnLeaderCard = buildWaitingOnLeader({
  leaders: [{ id: 'm1', name: 'Marcus Reed' }],
  lien: {
    approve: [{ itemId: 'i1', label: '650 · Alder Creek Lofts', dueYmd: '2026-11-20', askedYmd: '2026-11-13', runGc: null }],
    sign: [
      { itemId: 'i2', label: '702 · Pine Hollow Clinic', dueYmd: '2026-11-19', askedYmd: null, runGc: null },
      { itemId: 'i3', label: '711 · Juniper Row', dueYmd: '2026-11-24', askedYmd: null, runGc: null },
    ],
  },
  waivers: [{ jobId: 'j7', askedYmd: '2026-11-14' }],
  tags: [{ jobId: 'j8', askedYmd: '2026-11-16' }],
  lineBudgets: { lines: 2, projects: 1 },
})!

function draw(over: Partial<WaitingOnLeaderBodyProps> = {}) {
  const props: WaitingOnLeaderBodyProps = { card, notRead: [], reminding: null, reminded: {}, onRemind: vi.fn(), onOpen: vi.fn(), ...over }
  render(<WaitingOnLeaderBody {...props} />)
  return props
}

const q = (sel: string) => document.querySelector(sel) as HTMLElement | null

describe('WaitingOnLeaderBody', () => {
  it('names the leader, counts what waits and lists a row a line', () => {
    draw()
    expect(screen.getByRole('region', { name: 'Waiting on Marcus' })).toBeTruthy()
    expect(q('[data-waiting-on-leader-count]')!.textContent).toBe('7')
    expect([...document.querySelectorAll('[data-waiting-row]')].map((r) => r.getAttribute('data-waiting-row'))).toEqual(['approve', 'sign', 'waivers', 'tagged-notes', 'line-budgets'])
  })

  it('a lien row has Remind, named in full for a screen reader, and hands its row to the press', () => {
    const props = draw()
    const press = q('[data-waiting-remind="sign"]') as HTMLButtonElement
    expect(press.textContent).toBe('Remind')
    expect(press.getAttribute('aria-label')).toBe('Remind Marcus of 2 papers')
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    expect(props.onRemind).toHaveBeenCalledTimes(1)
    expect((props.onRemind as ReturnType<typeof vi.fn>).mock.calls[0]![0].key).toBe('sign')
  })

  it('a row reminded this visit says when, and its press is dead', () => {
    const props = draw({ reminded: { approve: '2:10 PM' } })
    const press = q('[data-waiting-remind="approve"]') as HTMLButtonElement
    expect(press.textContent).toBe('Reminded 2:10 PM')
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(props.onRemind).not.toHaveBeenCalled()
    expect((q('[data-waiting-remind="sign"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('while one reminder goes, every Remind is dead', () => {
    draw({ reminding: 'approve' })
    expect(q('[data-waiting-remind="approve"]')!.textContent).toBe('Reminding…')
    expect((q('[data-waiting-remind="approve"]') as HTMLButtonElement).disabled).toBe(true)
    expect((q('[data-waiting-remind="sign"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('a row with no message says so, and opens its job', () => {
    const props = draw()
    expect(q('[data-waiting-remind="waivers"]')).toBeNull()
    expect(q('[data-waiting-row="waivers"]')!.textContent).toContain('No reminder goes for this yet. Tell Marcus yourself.')
    fireEvent.click(q('[data-waiting-open="waivers"]')!)
    expect(props.onOpen).toHaveBeenCalledWith('/jobs?edit=j7', 'waivers')
    expect(q('[data-waiting-row="line-budgets"] button')).toBeNull()
    expect(q('[data-waiting-row="line-budgets"]')!.textContent).toContain('Tell Marcus yourself.')
  })

  it('a lien row keeps a door to the desk beside its words', () => {
    const props = draw()
    fireEvent.click(q('[data-waiting-open="approve"]')!)
    expect(props.onOpen).toHaveBeenCalledWith('/lien-desk?tab=notices&pile=awaiting', 'approve')
  })

  it('he is here: one press opens the pile that takes his code', () => {
    const props = draw()
    const press = q('[data-waiting-code]')!
    expect(press.textContent).toBe('Marcus is here, sign with the signing code')
    fireEvent.click(press)
    expect(props.onOpen).toHaveBeenCalledWith('/lien-desk?tab=notices&pile=ready', 'code')
  })

  it('no press for his code with nothing to sign', () => {
    draw({ card: buildWaitingOnLeader({ leaders: [{ id: 'm1', name: 'Marcus' }], lien: { approve: [], sign: [] }, waivers: [{ jobId: 'j7', askedYmd: null }], tags: [], lineBudgets: null })! })
    expect(q('[data-waiting-code]')).toBeNull()
  })

  it('says which read failed', () => {
    draw({ notRead: ['The Lien desk', 'The lien waivers'] })
    const lines = [...document.querySelectorAll('[data-waiting-not-read]')].map((p) => p.textContent)
    expect(lines).toEqual(['The Lien desk could not be read, so this list may be short.', 'The lien waivers could not be read, so this list may be short.'])
  })
})
