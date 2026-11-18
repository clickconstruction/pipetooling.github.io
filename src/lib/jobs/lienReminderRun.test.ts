import { describe, expect, it, vi } from 'vitest'
import type { LienLeaderTellResult } from './lienAffidavitApprovalTell'
import { lienReminderPlan } from './lienLeaderReminder'
import { sendLienReminder, type LienReminderTell } from './lienReminderRun'

const went = (): LienLeaderTellResult => ({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Marcus' } })

function tell(over: Partial<LienReminderTell> = {}): LienReminderTell & { approval: ReturnType<typeof vi.fn>; affidavits: ReturnType<typeof vi.fn>; signatures: ReturnType<typeof vi.fn> } {
  return { approval: vi.fn(async () => went()), affidavits: vi.fn(async () => went()), signatures: vi.fn(async () => went()), ...over } as never
}

describe('sendLienReminder', () => {
  it('sends one message for each notice, as a reminder', async () => {
    const t = tell()
    const plan = lienReminderPlan([
      { kind: 'notice', label: '650', itemId: 'i1', dueYmd: '2026-11-20' },
      { kind: 'notice', label: '702', itemId: 'i2', dueYmd: null },
    ])
    const sent = await sendLienReminder(plan, t)
    expect(t.approval).toHaveBeenCalledTimes(2)
    expect(t.approval).toHaveBeenNthCalledWith(1, 'i1', '2026-11-20', { remind: true })
    expect(t.signatures).not.toHaveBeenCalled()
    expect(sent.done).toBe(2)
    expect(sent.failed).toEqual([])
  })

  it('sends the notices to sign as one message for the lot', async () => {
    const t = tell()
    const plan = lienReminderPlan([
      { kind: 'signature', label: '650', itemId: 'i1', dueYmd: null },
      { kind: 'signature', label: '702', itemId: 'i2', dueYmd: null },
    ])
    const sent = await sendLienReminder(plan, t)
    expect(t.signatures).toHaveBeenCalledTimes(1)
    expect(t.signatures).toHaveBeenCalledWith([{ itemId: 'i1', dueYmd: null }, { itemId: 'i2', dueYmd: null }])
    expect(t.approval).not.toHaveBeenCalled()
    expect(sent.done).toBe(2)
  })

  it('keeps going past a notice that fails and names it with its reason', async () => {
    const approval = vi.fn(async (itemId: string) => (itemId === 'i1' ? ({ ok: false, reason: 'Not the office' } as LienLeaderTellResult) : went()))
    const sent = await sendLienReminder(lienReminderPlan([{ kind: 'notice', label: '650', itemId: 'i1', dueYmd: null }, { kind: 'notice', label: '702', itemId: 'i2', dueYmd: null }]), tell({ approval }))
    expect(approval).toHaveBeenCalledTimes(2)
    expect(sent.done).toBe(1)
    expect(sent.failed).toHaveLength(1)
    expect(sent.failed[0]!.label).toBe('650')
    expect(sent.failed[0]!.reason).not.toBe('')
  })

  it('a call that could not be made counts nothing', async () => {
    const sent = await sendLienReminder(lienReminderPlan([{ kind: 'signature', label: '650', itemId: 'i1', dueYmd: null }]), tell({ signatures: vi.fn(async () => null) }))
    expect(sent.done).toBe(0)
    expect(sent.failed).toEqual([{ label: '650', reason: 'the message could not be sent' }])
  })

  it('sends nothing for an empty plan', async () => {
    const t = tell()
    const sent = await sendLienReminder(lienReminderPlan([]), t)
    expect(t.approval).not.toHaveBeenCalled()
    expect(t.affidavits).not.toHaveBeenCalled()
    expect(t.signatures).not.toHaveBeenCalled()
    expect(sent).toMatchObject({ done: 0, failed: [] })
  })
})
