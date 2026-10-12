// @vitest-environment jsdom
/**
 * Follow up's Nudges from the flow, its hook over the flows' demo people: everyone read once while Follow up is on
 * screen, the rows built with Follow up's portal skip, and the presses on the steps a row's one message names. Hold
 * until Mon holds each until next Monday, and Remind now records each with the channel the flow asked for and its round.
 * Each press then reads everyone again. A refused press keeps its own words. Nothing here is a real row.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANGE_ORDERS, NOW, demoPeople } from '../lib/flows/demoPeople.fixture'
import type { NudgeBatch } from '../lib/flows/flowNudgesIo'
import { nextMonday, type NudgeRow } from '../lib/flows/nudges'
import { SEED_FLOWS } from '../lib/flows/seed'

const loadNudgeBatch = vi.fn(async (_now: Date): Promise<NudgeBatch> => ({
  people: demoPeople(),
  names: new Map(),
  flows: { customer: SEED_FLOWS.customer, trade: SEED_FLOWS.trade, arch: SEED_FLOWS.arch },
}))
vi.mock('../lib/flows/flowNudgesIo', () => ({ loadNudgeBatch: (now: Date) => loadNudgeBatch(now) }))

const holdUntil = vi.fn(async (..._args: unknown[]): Promise<string> => 'hold-1')
const remindNow = vi.fn(async (..._args: unknown[]): Promise<string> => 'sent-1')
vi.mock('../lib/flows/flowPersonIo', () => ({
  flowPresses: { holdUntil: (...args: unknown[]) => holdUntil(...args), remindNow: (...args: unknown[]) => remindNow(...args) },
}))

const { namedSteps, useFlowNudges } = await import('./useFlowNudges')

const noPortal = () => false
const rowOf = (rows: readonly NudgeRow[], contactId: string): NudgeRow => {
  const row = rows.find((r) => r.contactId === contactId)
  if (!row) throw new Error(`no row for ${contactId}`)
  return row
}

async function opened(enabled = true) {
  const hook = renderHook((props: { enabled: boolean }) => useFlowNudges({ enabled: props.enabled, now: () => NOW }), { initialProps: { enabled } })
  if (enabled) await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

beforeEach(() => {
  loadNudgeBatch.mockClear()
  holdUntil.mockReset().mockResolvedValue('hold-1')
  remindNow.mockReset().mockResolvedValue('sent-1')
})

describe('useFlowNudges', () => {
  it("reads everyone once while Follow up is on screen, and builds the rows with Follow up's portal skip", async () => {
    const { result } = await opened()
    expect(loadNudgeBatch).toHaveBeenCalledTimes(1)
    expect(loadNudgeBatch).toHaveBeenCalledWith(NOW)
    expect(result.current.build(noPortal).map((r) => r.contactId)).toEqual(['priya', 'greg', 'jonah'])
    // Priya's second change order shows on her page, so the portal row speaks for it and her nudge drops.
    const onPortal = (contactId: string, paper: string, key: string | null) => contactId === 'priya' && paper === 'co' && key === CHANGE_ORDERS.priya2
    expect(result.current.build(onPortal).map((r) => r.contactId)).toEqual(['greg', 'jonah'])
  })

  it('reads nothing while Follow up is not on screen, and reads when it opens', async () => {
    const hook = await opened(false)
    expect(loadNudgeBatch).not.toHaveBeenCalled()
    expect(hook.result.current.build(noPortal)).toEqual([])
    hook.rerender({ enabled: true })
    await waitFor(() => expect(loadNudgeBatch).toHaveBeenCalledTimes(1))
  })

  it("holds each step the row's one message names until next Monday, then reads everyone again", async () => {
    const { result } = await opened()
    const jonah = rowOf(result.current.build(noPortal), 'jonah')
    expect(namedSteps(jonah).map((s) => `${s.stepId}@${s.jobId}`)).toEqual(['certify@boerne', 'questions@boerne'])
    let said: { ok: boolean; words: string } | undefined
    await act(async () => {
      said = await result.current.holdUntilMonday(jonah)
    })
    expect(said).toEqual({ ok: true, words: 'Held until Monday. The row comes back then.' })
    expect(holdUntil.mock.calls).toEqual([
      ['jonah', 'certify', { projectId: 'boerne' }, nextMonday(NOW)],
      ['jonah', 'questions', { projectId: 'boerne' }, nextMonday(NOW)],
    ])
    expect(loadNudgeBatch).toHaveBeenCalledTimes(2)
  })

  it('records Remind now with the channel the flow asked for and its round, waiting on the row while it runs', async () => {
    const { result } = await opened()
    const greg = rowOf(result.current.build(noPortal), 'greg')
    let finish: (id: string) => void = () => undefined
    remindNow.mockImplementationOnce(() => new Promise<string>((resolve) => (finish = resolve)))
    let pending: Promise<{ ok: boolean; words: string }> | undefined
    act(() => {
      pending = result.current.remindNow(greg)
    })
    await waitFor(() => expect(result.current.pressing).toBe('greg'))
    await act(async () => {
      finish('sent-1')
      await pending
    })
    expect(await pending).toEqual({ ok: true, words: 'Marked as reminded today. The app sends no second reminder on top of it.' })
    expect(remindNow.mock.calls).toEqual([['greg', 'ask', { projectId: 'boerne' }, 'text', 'inv-greg-boerne']])
    expect(result.current.pressing).toBeNull()
    expect(loadNudgeBatch).toHaveBeenCalledTimes(2)
  })

  it('keeps a refused press in its own words, and reads nothing again', async () => {
    const { result } = await opened()
    holdUntil.mockRejectedValueOnce(new Error('Hold until: Only the office holds a reminder.'))
    let said: { ok: boolean; words: string } | undefined
    await act(async () => {
      said = await result.current.holdUntilMonday(rowOf(result.current.build(noPortal), 'greg'))
    })
    expect(said).toEqual({ ok: false, words: 'Hold until: Only the office holds a reminder.' })
    expect(result.current.pressing).toBeNull()
    expect(loadNudgeBatch).toHaveBeenCalledTimes(1)
  })
})
