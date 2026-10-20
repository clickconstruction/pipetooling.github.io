/**
 * The schedule's PR 13b (./tellTradesIo.ts): one email per company through `gc-trade-email`, kind `dates`, with its key
 * and `datesMessage`'s words; the tells recorded with the send's log row after a send that went, or went before; a
 * company refused named with the office's words and nothing recorded for it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TOLD_NOT_RECORDED, tellTheTrades } from './tellTradesIo'
import { recordScheduleTells } from './scheduleIo'
import { sendGcTradeEmail } from './tradeEmailIo'
import { GC_TRADE_EMAIL_REFUSALS } from './tradeEmail'
import { addDays } from './building'
import { moveRecord, planMove } from './schedule/moves'
import { datesMessage } from './schedule/tellTrades'
import { companiesNotTold, datesEmailKey, tellShown } from './schedule/tellWindow'
import { initialGcState } from './schedule/testState'
import type { GcProject, GcState } from './types'

vi.mock('./tradeEmailIo', () => ({ sendGcTradeEmail: vi.fn() }))
vi.mock('./scheduleIo', () => ({ recordScheduleTells: vi.fn(() => Promise.resolve(1)) }))

const s: GcState = initialGcState()
/** Fair Oaks D with TPO membrane 30 days later: Summit Roofing and Cool Breeze Mechanical to tell. */
function moved(): GcProject {
  const p = s.projects.find((x) => x.id === 'fairoaksd')!
  const a = p.schedule!.activities.find((x) => x.lineId === 'froof-1')!
  const plan = planMove(p, 'froof-1', addDays(a.start, 30), addDays(a.finish, 30))!
  const move = moveRecord(p.schedule!, 'froof-1', plan, { reason: 'weather', note: 'Rain stopped the roof for a week.', by: 'Robert' }, s.today)
  return { ...p, schedule: { ...p.schedule!, activities: plan.activities, moves: [move] } }
}

beforeEach(() => {
  vi.mocked(sendGcTradeEmail).mockReset()
  vi.mocked(recordScheduleTells).mockReset().mockResolvedValue(1)
})

describe('tellTheTrades (the schedule’s PR 13b)', () => {
  it('emails each company once with kind dates, its key and its words, and records the tells of the one that went', async () => {
    const p = moved()
    const companies = companiesNotTold(s, p)
    vi.mocked(sendGcTradeEmail)
      .mockResolvedValueOnce({ ok: true, companyId: 'summit', messageId: 'msg-1', emailSendLogId: 'log-1', to: ['Carla'], already: false })
      .mockResolvedValueOnce({ ok: false, key: 'noEmail', detail: null })
    const out = await tellTheTrades(s, p, companies)
    const summit = companies[0]!
    const key = await datesEmailKey(['move-1'])
    expect(vi.mocked(sendGcTradeEmail).mock.calls[0]![0]).toEqual({ companyId: 'summit', kind: 'dates', key, projectId: 'fairoaksd', lang: 'en', ...datesMessage(p, summit.partner, summit, 'en') })
    expect(sendGcTradeEmail).toHaveBeenCalledTimes(2)
    expect(recordScheduleTells).toHaveBeenCalledTimes(1)
    expect(recordScheduleTells).toHaveBeenCalledWith('fairoaksd', 'summit', 'log-1', [{ moveId: 'move-1', shown: tellShown(s, p, p.schedule!.moves![0]!, 'summit') }])
    expect(out).toEqual({
      told: [{ companyId: 'summit', company: 'Summit Roofing' }],
      refused: [{ companyId: 'coolbreeze', company: 'Cool Breeze Mechanical', words: GC_TRADE_EMAIL_REFUSALS.noEmail }],
    })
  })

  it('records a send that went before under the same key, so a press again saves who was told and sends nothing new', async () => {
    const p = moved()
    vi.mocked(sendGcTradeEmail).mockResolvedValue({ ok: true, companyId: 'summit', messageId: 'msg-1', emailSendLogId: 'log-first', to: ['Carla'], already: true })
    const out = await tellTheTrades(s, p, companiesNotTold(s, p).slice(0, 1))
    expect(recordScheduleTells).toHaveBeenCalledWith('fairoaksd', 'summit', 'log-first', expect.any(Array))
    expect(out.told).toEqual([{ companyId: 'summit', company: 'Summit Roofing' }])
  })

  it('names a company whose email went but whose record did not save, and says to press again', async () => {
    const p = moved()
    vi.mocked(sendGcTradeEmail).mockResolvedValue({ ok: true, companyId: 'summit', messageId: 'msg-1', emailSendLogId: null, to: ['Carla'], already: false })
    vi.mocked(recordScheduleTells).mockRejectedValue(new Error('down'))
    const out = await tellTheTrades(s, p, companiesNotTold(s, p).slice(0, 1))
    expect(recordScheduleTells).toHaveBeenCalledWith('fairoaksd', 'summit', null, expect.any(Array))
    expect(out).toEqual({ told: [], refused: [{ companyId: 'summit', company: 'Summit Roofing', words: TOLD_NOT_RECORDED }] })
  })
})
