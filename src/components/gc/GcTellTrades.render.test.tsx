// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 13b: the Tell the trades window on main's test state. Fair Oaks D's TPO
 * membrane moved 30 days, so Summit Roofing and Cool Breeze Mechanical are to tell. One chip per company with its lines,
 * the picked company's email as it will go, one press for every company, and then who was told and who was not, with
 * why. Every sentence a first-timer reads passes plain words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcTellTrades } from './GcTellTrades'
import { addDays } from '../../lib/gc/building'
import { moveRecord, planMove } from '../../lib/gc/schedule/moves'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { GC_TRADE_EMAIL_REFUSALS } from '../../lib/gc/tradeEmail'
import type { TellTheTrades } from '../../lib/gc/tellTradesIo'
import type { CompanyToTell } from '../../lib/gc/schedule/tellTrades'
import type { GcProject } from '../../lib/gc/types'
import { plainWordsFailures } from '../../lib/plainWords'

afterEach(cleanup)

const s = initialGcState()
function moved(): GcProject {
  const p = s.projects.find((x) => x.id === 'fairoaksd')!
  const a = p.schedule!.activities.find((x) => x.lineId === 'froof-1')!
  const plan = planMove(p, 'froof-1', addDays(a.start, 30), addDays(a.finish, 30))!
  const move = moveRecord(p.schedule!, 'froof-1', plan, { reason: 'weather', note: 'Rain stopped the roof for a week.', by: 'Robert' }, s.today)
  return { ...p, schedule: { ...p.schedule!, activities: plan.activities, moves: [move] } }
}

describe('GcTellTrades: the window the trades are told from', () => {
  it('shows each company with its lines, the picked one’s email, and tells them all on one press', async () => {
    const answer: TellTheTrades = {
      told: [{ companyId: 'summit', company: 'Summit Roofing' }],
      refused: [{ companyId: 'coolbreeze', company: 'Cool Breeze Mechanical', words: GC_TRADE_EMAIL_REFUSALS.noEmail }],
    }
    const onTell = vi.fn((_companies: CompanyToTell[]) => Promise.resolve(answer))
    const onClose = vi.fn()
    render(<GcTellTrades state={s} project={moved()} onTell={onTell} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Tell the trades' })
    expect(dialog.textContent).toContain('1 move not told yet. Each company gets one email, in its language, with its old and new days and why. It answers from its portal.')
    const chips = within(within(dialog).getByRole('group', { name: 'Companies to tell' })).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['Summit Roofing · 2 lines', 'Cool Breeze Mechanical · 3 lines'])
    const email = () => dialog.querySelector('[data-tell-email]')!.textContent!
    expect(email()).toContain('Your dates moved on')
    expect(email()).toContain('TPO membrane')
    fireEvent.click(chips[1]!)
    expect(email()).toContain('Rooftop units')
    expect(dialog.textContent).toContain("2 emails go out, each with the company's portal link.")
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell 2 companies' }))
    await waitFor(() => expect(dialog.querySelector('[data-tell-result]')).toBeTruthy())
    expect(onTell.mock.calls[0]![0].map((c) => c.partner.company)).toEqual(['Summit Roofing', 'Cool Breeze Mechanical'])
    expect(dialog.querySelector('[data-tell-result]')!.textContent).toBe(`Told Summit Roofing.Cool Breeze Mechanical was not told. ${GC_TRADE_EMAIL_REFUSALS.noEmail}`)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('names the one company on its press when there is one', () => {
    const p = moved()
    const one = { ...p, schedule: { ...p.schedule!, moves: p.schedule!.moves!.map((m) => ({ ...m, toldOn: s.today, toldTo: ['summit'] })) } }
    render(<GcTellTrades state={s} project={one} onTell={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Tell Cool Breeze Mechanical' })).toBeTruthy()
    expect(screen.getByText(/^1 email goes out/)).toBeTruthy()
  })

  it('says each thing a first-timer reads in plain words', () => {
    const said = [
      'Tell the trades their dates moved',
      '1 move not told yet.',
      'Each company gets one email, in its language, with its old and new days and why.',
      'It answers from its portal.',
      '2 emails go out, each with the company\'s portal link.',
      'The schedule reads again with who was told.',
      'Told Summit Roofing and Cool Breeze Mechanical.',
      'Cool Breeze Mechanical was not told.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
