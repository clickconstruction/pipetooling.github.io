// @vitest-environment jsdom
/**
 * Render smokes for the run's first step on the Lien desk's To do (punch list #362, step 5): the door over the list,
 * the checklist in its three states (questions open, every paper right, after the print), Leave out with its reason,
 * Put it back, a paper asked about again, and a failed read of the left-out rows. The rules are
 * `lienGetItRight.test.ts` and `lienLeftOut.test.ts`; this is the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { buildLienBoard } from '../../lib/jobs/lienBoard'
import type { LienDeskEntry, LienDeskPile } from '../../lib/jobs/lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'
import { buildLienGetItRight, type LienRunLine } from '../../lib/jobs/lienGetItRight'
import type { LienLeftOutRow } from '../../lib/jobs/lienLeftOut'
import { buildLienNextUp } from '../../lib/jobs/lienNextUp'
import { lienFieldsHash } from '../../lib/jobs/lienNoticeSignature'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { lienRunPrintedWords, lienRunPrintPress } from '../../lib/jobs/lienRunPrint'
import { lienStackOrderWords } from '../../lib/jobs/lienRunStack'
import LienGetItRightHost from './LienGetItRightHost'
import type { LienRunPrintState } from './useLienRunPrint'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

afterEach(cleanup)

const TODAY = '2026-11-15'
const RUN_DAY = '2026-11-16'

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: `gc-${jobId}`, openBalance: 1000, hasOwner: pile !== 'needs_owner', propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-09'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: RUN_DAY, daysLeft: 1, severity: 'red', item: null, policy: 'ask', pile, ...over }
}
const gates = (failing: LienAffidavitGate['key'][] = []): LienAffidavitGate[] => (['owner', 'legal', 'contractor', 'notice', 'homestead'] as const).map((key) => ({ key, ok: !failing.includes(key), label: key }))
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: RUN_DAY, daysLeft: 1, severity: 'red', openBalance: 1000, customerId: 'c1', gcCustomerId: `gc-${jobId}`, propertyKind: '', gates: gates(), ready: true, item: null, pile, ...over }
}
const item = (id: string, status: string, over: Record<string, unknown> = {}) => ({ id, status, fields: {}, months: [], voided_at: null, ...over }) as unknown as LienDeskEntry['item']
const signed = (id: string, over: Record<string, unknown> = {}) => item(id, 'approved', { signed_at: '2026-11-13T19:14:00Z', signer_printed_name: 'Sam', signer_signature_mode: 'type', signed_fields_hash: lienFieldsHash({}), ...over })
function left(over: Partial<LienLeftOutRow> = {}): LienLeftOutRow {
  return { id: 'r1', jobId: 'locks', paper: 'affidavit', runDay: RUN_DAY, reason: 'other', note: 'The owner is away until the 20th.', leftOutBy: 'u-rosa', leftOutAt: '2026-11-15T16:00:00Z', putBackBy: null, putBackAt: null, ...over }
}
const NAMES: Record<string, string> = { 'u-rosa': 'Rosa' }

const BEFORE = {
  notices: [notice('cedar', 'needs_owner', { openBalance: 1900 }), notice('wait', 'awaiting', { openBalance: 1500, item: item('i-wait', 'pending_approval', { submitted_at: '2026-11-12T15:00:00Z' }) }), notice('ready', 'ready', { openBalance: 2200, item: signed('i-ready') })],
  affidavits: [affidavit('locks', 'needs_property', { openBalance: 240, gates: gates(['owner']), ready: false }), affidavit('filed', 'ready', { openBalance: 9400, item: item('ia', 'approved') })],
}
const READY = {
  notices: [notice('ready', 'ready', { openBalance: 2200, item: signed('i-ready') })],
  affidavits: [affidavit('locks', 'needs_property', { openBalance: 240, gates: gates(['owner']), ready: false }), affidavit('filed', 'ready', { openBalance: 9400, item: item('ia', 'approved') })],
}
const AFTER = {
  notices: [notice('p1', 'printed', { openBalance: 800, item: signed('i1', { printed_at: '2026-11-14T15:00:00Z' }) }), notice('p2', 'printed', { openBalance: 700, item: signed('i2', { printed_at: '2026-11-14T15:00:00Z' }) })],
  affidavits: [] as LienAffidavitEntry[],
}

function mount(desk: { notices: LienDeskEntry[]; affidavits: LienAffidavitEntry[] }, over: { leftOut?: LienLeftOutRow[]; open?: boolean; office?: boolean; isMobile?: boolean; failure?: boolean; noRun?: boolean; print?: LienRunPrintState; onLeaveOut?: (line: LienRunLine, reason: string, note: string) => Promise<void>; onPutBack?: (line: LienRunLine) => Promise<void> } = {}) {
  const board = buildLienBoard({ ...desk, retainage: [], todayYmd: TODAY, jobNumber: (id) => `ZZ-${id}`, jobName: (id) => `ZZ ${id}`, gcName: () => 'ZZ Builders', leaderName: 'Sam' })
  const rows = buildLienNextUp({ ...desk, retainage: [], letterTwoByJob: {}, role: 'assistant', todayYmd: TODAY, jobTitle: (id) => `ZZ ${id}`, gcName: () => 'ZZ Builders', leaderName: () => 'Sam' })
  const run = over.noRun || over.failure ? null : buildLienGetItRight({ board, rows, leftOut: over.leftOut ?? [], todayYmd: TODAY, jobTitle: (id) => `ZZ ${id}`, leaderName: () => 'Sam' })
  const spies = { onOpen: vi.fn(), onBack: vi.fn(), onRetry: vi.fn(), onAct: vi.fn(), onOpenLine: vi.fn(), onPrint: vi.fn(), onLeaveOut: vi.fn(over.onLeaveOut ?? (async () => {})), onPutBack: vi.fn(over.onPutBack ?? (async () => {})) }
  renderWithProviders(
    <LienGetItRightHost
      run={run}
      open={over.open ?? true}
      failure={over.failure ? { kind: 'server', message: 'The papers left out of the run could not be read.' } : null}
      onOpen={spies.onOpen}
      onRetry={spies.onRetry}
      scrolls
      isMobile={over.isMobile ?? false}
      canLeaveOut={over.office ?? true}
      userName={(id) => NAMES[id] ?? null}
      onBack={spies.onBack}
      onAct={spies.onAct}
      onOpenLine={spies.onOpenLine}
      onLeaveOut={spies.onLeaveOut}
      onPutBack={spies.onPutBack}
      print={over.print}
      prints={[{ key: 'notice', label: 'Print and mail 1 notice', left: null, dead: false, onPress: spies.onPrint }, { key: 'affidavit', label: 'Print 1 for notarization', left: '1 held', dead: false, onPress: spies.onPrint }]}
    >
      <div data-the-list>the list</div>
    </LienGetItRightHost>,
  )
  return { run, ...spies }
}
const q = (sel: string) => document.querySelector<HTMLElement>(sel)
const all = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)]
const text = (sel: string) => q(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null
const stepStates = () => all('[data-lien-run-step]').map((el) => el.getAttribute('data-state'))
/** Let a press's promise settle and the state that follows it land. */
const settle = () => act(async () => {})

describe('the door over the list', () => {
  it('says the run and what waits, opens the checklist, and leaves the list under it', () => {
    const { onOpen } = mount(BEFORE, { open: false })
    expect(text('[data-lien-run-door-line]')).toBe('This run · 5 papers due by tomorrow · 3 to settle')
    expect(q('[data-the-list]')).not.toBeNull()
    expect(q('[data-lien-run="view"]')).toBeNull()
    // The values stand apart from the words.
    expect(all('[data-lien-run-door-line] [data-value="worked-out"]').map((el) => el.textContent)).toEqual(['5', 'tomorrow', '3'])
    fireEvent.click(q('[data-lien-run-door-open]')!)
    expect(q('[data-lien-run-door-open]')!.textContent).toBe('Get it right ›')
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('with every paper right the door says so and opens the run', () => {
    mount(READY, { open: false, leftOut: [left()] })
    expect(text('[data-lien-run-door-line]')).toBe('This run · 2 papers due by tomorrow · Every paper in the run is right · 1 left out')
    expect(q('[data-lien-run-door-open]')!.textContent).toBe('Open the run ›')
  })

  it('with no run it is the list alone', () => {
    mount(BEFORE, { noRun: true, open: false })
    expect(q('[data-lien-run]')).toBeNull()
    expect(q('[data-the-list]')).not.toBeNull()
  })

  it('a failed read of the left-out papers says so in the door’s place, with no count, over the list', () => {
    const { onRetry } = mount(BEFORE, { failure: true })
    expect(q('[data-lien-run="read-failure"]')!.textContent).toContain('The papers left out of the run could not be read.')
    expect(q('[data-lien-run="door"]')).toBeNull()
    expect(q('[data-lien-run="view"]')).toBeNull()
    expect(q('[data-the-list]')).not.toBeNull()
    expect(onRetry).not.toHaveBeenCalled()
  })
})

describe('before: questions are open', () => {
  it('draws the checklist in the list’s place, step 1 now, one line a paper to settle', () => {
    const { onBack } = mount(BEFORE)
    expect(q('[data-the-list]')).toBeNull()
    expect(q('[data-lien-run="view"]')!.getAttribute('data-step')).toBe('1')
    expect(stepStates()).toEqual(['now', 'wait', 'wait'])
    expect(text('[data-lien-run-step="1"]')).toBe('1 · Get it right3 to settle · 2 of 5 papers are right')
    expect(text('[data-lien-run-total]')).toBe('5 papers · $15,240.00')
    expect(all('[data-lien-run-card="settle"] [data-lien-run-line]').map((el) => el.getAttribute('data-lien-run-line')).sort()).toEqual(['affidavit:locks', 'notice:cedar', 'notice:wait'])
    expect(q('[data-lien-run-card="ready"]')).toBeNull()
    // The cents are drawn small.
    expect(q('[data-lien-run-total] [data-cents]')!.textContent).toBe('.00')
    fireEvent.click(q('[data-lien-run-back]')!)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('a line says its bin and its one thing to know, and its press is the To do row’s own', () => {
    const { onAct, onOpenLine } = mount(BEFORE)
    const line = q('[data-lien-run-line="notice:cedar"]')!
    expect(line.querySelector('[data-lien-run-stage]')!.textContent).toBe('Needs the owner')
    expect(line.textContent).toContain('September 2026')
    expect(line.textContent).toContain('ZZ-cedar')
    fireEvent.click(q('[data-lien-run-act="notice:cedar"]')!)
    expect(q('[data-lien-run-act="notice:cedar"]')!.textContent).toBe('Find the owner')
    expect(onAct).toHaveBeenCalledWith('notice:cedar')
    fireEvent.click(q('[data-lien-run-open="notice:cedar"]')!)
    expect(onOpenLine.mock.calls[0]![0].key).toBe('notice:cedar')
    // A paper that waits on the leader has no press of the office's, and can still be left out.
    expect(q('[data-lien-run-act="notice:wait"]')).toBeNull()
    expect(q('[data-lien-run-leave-out="notice:wait"]')).not.toBeNull()
  })

  it('Leave out asks for a reason, and another reason for its words, before anything is written', async () => {
    const { onLeaveOut } = mount(BEFORE)
    fireEvent.click(q('[data-lien-run-leave-out="affidavit:locks"]')!)
    const form = q('[data-lien-leave-out-form="affidavit:locks"]')!
    expect(form.querySelectorAll('input[type="radio"]')).toHaveLength(5)
    expect(q('[data-lien-leave-out-confirm]')!.textContent).toBe('Leave it out')
    fireEvent.click(q('[data-lien-leave-out-confirm]')!)
    expect(q('[data-lien-leave-out-why]')!.textContent).toBe('Pick a reason first.')
    fireEvent.click(form.querySelector('input[value="other"]')!)
    fireEvent.click(q('[data-lien-leave-out-confirm]')!)
    expect(q('[data-lien-leave-out-why]')!.textContent).toBe('Say why in a few words.')
    expect(onLeaveOut).not.toHaveBeenCalled()
    fireEvent.change(q('[data-lien-leave-out-note]')!, { target: { value: 'The owner is away until the 20th.' } })
    fireEvent.click(q('[data-lien-leave-out-confirm]')!)
    await settle()
    expect(onLeaveOut).toHaveBeenCalledTimes(1)
    expect(onLeaveOut.mock.calls[0]![0].key).toBe('affidavit:locks')
    expect(onLeaveOut.mock.calls[0]!.slice(1)).toEqual(['other', 'The owner is away until the 20th.'])
    expect(q('[data-lien-leave-out-form]')).toBeNull()
  })

  it('a picked reason goes with no words, and Cancel writes nothing', async () => {
    const { onLeaveOut } = mount(BEFORE)
    fireEvent.click(q('[data-lien-run-leave-out="notice:wait"]')!)
    fireEvent.click(q('[data-lien-leave-out-cancel]')!)
    expect(q('[data-lien-leave-out-form]')).toBeNull()
    expect(onLeaveOut).not.toHaveBeenCalled()
    fireEvent.click(q('[data-lien-run-leave-out="notice:wait"]')!)
    fireEvent.click(q('[data-lien-leave-out-form] input[value="leader_not_in_time"]')!)
    fireEvent.click(q('[data-lien-leave-out-confirm]')!)
    await settle()
    expect(onLeaveOut.mock.calls[0]!.slice(1)).toEqual(['leader_not_in_time', ''])
  })

  it('a refused leave-out says its reason and keeps the form', async () => {
    mount(BEFORE, { onLeaveOut: async () => { throw new Error('Not authorized to leave a lien paper out of the run') } })
    fireEvent.click(q('[data-lien-run-leave-out="affidavit:locks"]')!)
    fireEvent.click(q('[data-lien-leave-out-form] input[value="customer_paying"]')!)
    fireEvent.click(q('[data-lien-leave-out-confirm]')!)
    await settle()
    expect(q('[data-lien-leave-out-why]')!.textContent).toBe('Not authorized to leave a lien paper out of the run')
    expect(q('[data-lien-leave-out-form]')).not.toBeNull()
  })

  it('a viewer who is not the lien office reads the checklist with no Leave out', () => {
    mount(BEFORE, { office: false })
    expect(all('[data-lien-run-line]').length).toBeGreaterThan(0)
    expect(q('[data-lien-run-leave-out]')).toBeNull()
  })

  it('a paper left out of an earlier run is asked about first, with the old reason and both answers', async () => {
    const { onPutBack, onLeaveOut } = mount(BEFORE, { leftOut: [left({ runDay: '2026-10-15' })] })
    const asked = q('[data-lien-run-card="asked"]')!
    expect(asked.querySelector('[data-lien-run-line]')!.getAttribute('data-lien-run-line')).toBe('affidavit:locks')
    expect(text('[data-lien-run-asked-why]')).toBe('Left out of the run for Oct 15 by Rosa on Nov 15. The owner is away until the 20th.')
    expect(q('[data-lien-run-card="settle"] [data-lien-run-line="affidavit:locks"]')).toBeNull()
    expect(text('[data-lien-run-step="1"]')).toBe('1 · Get it right3 to settle · 2 of 5 papers are right')
    fireEvent.click(q('[data-lien-run-put-back="affidavit:locks"]')!)
    await settle()
    expect(onPutBack.mock.calls[0]![0].key).toBe('affidavit:locks')
    // Leave out again opens the form on the old reason.
    fireEvent.click(q('[data-lien-run-leave-out="affidavit:locks"]')!)
    expect(q('[data-lien-run-leave-out="affidavit:locks"]')!.textContent).toBe('Leave out again')
    expect((q('[data-lien-leave-out-form] input[value="other"]') as HTMLInputElement).checked).toBe(true)
    expect((q('[data-lien-leave-out-note]') as HTMLInputElement).value).toBe('The owner is away until the 20th.')
    fireEvent.click(q('[data-lien-leave-out-confirm]')!)
    await settle()
    expect(onLeaveOut.mock.calls[0]!.slice(1)).toEqual(['other', 'The owner is away until the 20th.'])
  })
})

describe('ready: every question is settled or its paper left out', () => {
  it('says every paper is right, offers the prints that exist, and lists what was left out with who, when and why', async () => {
    const { onPrint, onPutBack } = mount(READY, { leftOut: [left()] })
    expect(q('[data-lien-run="view"]')!.getAttribute('data-step')).toBe('2')
    expect(stepStates()).toEqual(['done', 'now', 'wait'])
    expect(q('[data-lien-run-card="settle"]')).toBeNull()
    expect(text('[data-lien-run-card="ready"] h3')).toBe('Every paper in the run is right. 1 left out.')
    expect(all('[data-lien-run-print]').map((el) => el.textContent)).toEqual(['Print and mail 1 notice', 'Print 1 for notarization · 1 held'])
    fireEvent.click(q('[data-lien-run-print="notice"]')!)
    expect(onPrint).toHaveBeenCalledTimes(1)
    expect(text('[data-lien-run-card="left-out"] h3')).toBe('1 left out of this run')
    expect(text('[data-lien-run-left-out-why]')).toBe('Left out by Rosa on Nov 15. The owner is away until the 20th.')
    expect(all('[data-lien-run-left-out-why] [data-value="worked-out"]').map((el) => el.textContent)).toEqual(['Rosa', 'Nov 15'])
    expect(q('[data-lien-run-right-now]')).toBeNull()
    fireEvent.click(q('[data-lien-run-put-back="affidavit:locks"]')!)
    await settle()
    expect(onPutBack.mock.calls[0]![0].key).toBe('affidavit:locks')
  })

  it('a left-out paper whose question is answered since says the Board’s prints take it', () => {
    mount(READY, { leftOut: [left({ jobId: 'filed' })] })
    expect(q('[data-lien-run-line="affidavit:filed"] [data-lien-run-right-now]')!.textContent).toBe('Its question is answered. The Board’s prints take it as it stands.')
  })

  it('a refused put back says its reason on the line', async () => {
    mount(READY, { leftOut: [left()], onPutBack: async () => { throw new Error('Not authorized to leave a lien paper out of the run') } })
    fireEvent.click(q('[data-lien-run-put-back="affidavit:locks"]')!)
    await settle()
    expect(q('[data-lien-run-card="left-out"] [role="alert"]')!.textContent).toBe('Not authorized to leave a lien paper out of the run')
  })
})

describe('after the print', () => {
  it('step 3 is now, nothing is left to settle, and the printed notices read as right', () => {
    mount(AFTER)
    expect(q('[data-lien-run="view"]')!.getAttribute('data-step')).toBe('3')
    expect(stepStates()).toEqual(['done', 'done', 'now'])
    expect(text('[data-lien-run-step="2"]')).toBe('2 · Print ✓Nothing waits to print')
    expect(text('[data-lien-run-step="3"]')).toBe('3 · Out the door2 to mail')
    expect(q('[data-lien-run-card="settle"]')).toBeNull()
    expect(text('[data-lien-run-card="right"] summary')).toBe('2 papers are right2 notices printedshow them ▸$1,500.00')
    expect(all('[data-lien-run-card="right"] [data-lien-run-line]')).toHaveLength(2)
    expect(q('[data-lien-run-leave-out]')).toBeNull()
  })
})

describe('on a phone', () => {
  it('every press is 44 px tall', () => {
    mount(BEFORE, { isMobile: true, leftOut: [left({ jobId: 'cedar', paper: 'notice' })] })
    fireEvent.click(q('[data-lien-run-leave-out="affidavit:locks"]')!)
    const short = all('[data-lien-run="view"] button').filter((b) => !b.hasAttribute('data-lien-run-open') && b.style.minHeight !== '44px')
    expect(short.map((b) => b.textContent)).toEqual([])
  })
})

/** The one print as `useLienRunPrint` hands it over, with its press watched. */
function printState(over: { notices: number; affidavits: number; held: number; reading?: boolean; mode?: 'one' | 'two'; printed?: boolean; stopped?: LienRunPrintState['stopped'] }): LienRunPrintState & { print: ReturnType<typeof vi.fn> } {
  return {
    press: lienRunPrintPress({ notices: over.notices, affidavits: over.affidavits, held: over.held, reading: over.reading ?? false, stopped: over.stopped?.length ?? 0 }),
    stopped: over.stopped ?? [],
    order: lienStackOrderWords(over.notices, over.affidavits),
    mode: over.mode ?? 'one',
    twoWhy: over.mode === 'two' ? 'This browser cannot print both kinds as one stack. Print each with its own press.' : null,
    parts: { notices: `Print ${over.notices} notices`, affidavits: `Print ${over.affidavits} affidavits` },
    notices: over.notices,
    affidavits: over.affidavits,
    printed: over.printed ? { words: lienRunPrintedWords({ notices: over.notices, affidavits: over.affidavits, atWords: '10:02 AM' }), next: 'The notices are marked printed. The affidavits go to the notary.' } : null,
    print: vi.fn(),
  }
}

describe('step 2: the one print (punch list #362, step 6)', () => {
  it('with questions open the press is live for what is right, says its count and names what it held', () => {
    const print = printState({ notices: 0, affidavits: 1, held: 3 })
    mount(BEFORE, { print })
    expect(all('[data-lien-run-card="print"] h3 > span').map((el) => el.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['2 · Print the run', '1 paper'])
    const press = q('[data-lien-run-print="run"]') as HTMLButtonElement
    expect(press.textContent).toBe('Print 1 paper · 3 wait on step 1 ▸')
    expect(press.disabled).toBe(false)
    expect(text('[data-lien-run-print-foot]')).toBe('3 papers are not right yet. Settle each above, or leave it out. The 1 that is right prints now.')
    fireEvent.click(press)
    expect(print.print).toHaveBeenCalledTimes(1)
    expect(print.print.mock.calls[0]).toEqual([])
    // The card stands under the questions, so the lines it points at are above it.
    const cards = all('[data-lien-run-card]').map((el) => el.getAttribute('data-lien-run-card'))
    expect(cards.indexOf('settle')).toBeLessThan(cards.indexOf('print'))
  })

  it('with every question settled it is the run, with the stack’s order, and the Board’s prints give way to it', () => {
    const print = printState({ notices: 1, affidavits: 1, held: 0 })
    mount(READY, { leftOut: [left()], print })
    expect(q('[data-lien-run-print="run"]')!.textContent).toBe('Print the run · 2 papers')
    expect(text('[data-lien-run-card="print"] p')).toBe('One stack, in this order: 1 notice by envelope, a divider page, then 1 affidavit by county clerk.')
    expect(q('[data-lien-run-print-foot]')).toBeNull()
    expect(all('[data-lien-run-print]').map((el) => el.getAttribute('data-lien-run-print'))).toEqual(['run'])
    // What a person left out does not print, and the card says so.
    expect(q('[data-lien-run-card="print"]')!.textContent).toContain('1 left out of this run does not print. It is listed below.')
  })

  it('is dead while the notices’ bills are read, and dead with nothing right', () => {
    mount(READY, { print: printState({ notices: 1, affidavits: 1, held: 0, reading: true }) })
    const press = q('[data-lien-run-print="run"]') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.textContent).toBe('Print the run · reading the bills…')
    cleanup()
    mount(BEFORE, { print: printState({ notices: 0, affidavits: 0, held: 4 }) })
    const none = q('[data-lien-run-print="run"]') as HTMLButtonElement
    expect(none.disabled).toBe(true)
    expect(text('[data-lien-run-card="print"] p')).toBe('Nothing waits to print.')
    expect(text('[data-lien-run-print-foot]')).toBe('No paper is right yet. Settle the 4 above, or leave each out.')
  })

  it('where one print job cannot hold both papers, each kind has its own press and the card says why', () => {
    const print = printState({ notices: 6, affidavits: 10, held: 0, mode: 'two' })
    mount(READY, { print })
    expect(q('[data-lien-run-print="run"]')).toBeNull()
    expect(q('[data-lien-run-card="print"]')!.textContent).toContain('This browser cannot print both kinds as one stack. Print each with its own press.')
    fireEvent.click(q('[data-lien-run-print="notices"]')!)
    fireEvent.click(q('[data-lien-run-print="affidavits"]')!)
    expect(print.print.mock.calls).toEqual([['notices'], ['affidavits']])
  })

  it('after the press it says when it printed and what comes next', () => {
    mount(READY, { print: printState({ notices: 1, affidavits: 1, held: 0, printed: true }) })
    const said = q('[data-lien-run-printed]')!
    expect(said.getAttribute('role')).toBe('status')
    expect(said.textContent!.replace(/\s+/g, ' ').trim()).toBe('Printed at 10:02 AM: 1 notice and 1 affidavit. The notices are marked printed. The affidavits go to the notary.')
  })

  it('a viewer with no one print still gets the Board’s two, and no print card', () => {
    mount(READY, { leftOut: [left()] })
    expect(q('[data-lien-run-card="print"]')).toBeNull()
    expect(all('[data-lien-run-print]').map((el) => el.getAttribute('data-lien-run-print'))).toEqual(['notice', 'affidavit'])
  })

  it('names a right notice that does not print, with its reason, and never says no paper is right beside it', () => {
    const held = { itemId: 'it1', jobId: 'j1', label: '1001 · ZZ Sample Shop', why: 'It waits on the leader’s signature.', kind: 'held' as const }
    const paperless = { itemId: 'it2', jobId: 'j2', label: '1002 · ZZ Other Shop', why: 'Its copies went by Docsmit, so no paper prints.', kind: 'paperless' as const }
    mount(BEFORE, { print: printState({ notices: 0, affidavits: 0, held: 4, stopped: [held, paperless] }) })
    expect((q('[data-lien-run-print="run"]') as HTMLButtonElement).disabled).toBe(true)
    expect(text('[data-lien-run-print-foot]')).toBe('No paper prints now. 2 right notices do not print here. Each is named below with its reason. 4 more wait on step 1 above.')
    expect(all('[data-lien-run-print-stopped] li').map((li) => [li.getAttribute('data-lien-run-print-stopped-row'), li.textContent])).toEqual([
      ['held', '1001 · ZZ Sample Shop It waits on the leader’s signature.'],
      ['paperless', '1002 · ZZ Other Shop Its copies went by Docsmit, so no paper prints.'],
    ])
    // A held one has a door: the run window, by the Board's own press.
    expect(q('[data-lien-run-card="print"]')!.textContent).toContain('The Board’s Print and mail press opens the run window')
    cleanup()
    // One that goes with no paper is not held: no door is named, and a live press stays live.
    mount(READY, { print: printState({ notices: 1, affidavits: 1, held: 0, stopped: [paperless] }) })
    expect((q('[data-lien-run-print="run"]') as HTMLButtonElement).disabled).toBe(false)
    expect(text('[data-lien-run-print-foot]')).toBe('1 right notice does not print here. It is named below with its reason.')
    expect(q('[data-lien-run-card="print"]')!.textContent).not.toContain('opens the run window')
    cleanup()
    mount(READY, { print: printState({ notices: 1, affidavits: 1, held: 0 }) })
    expect(q('[data-lien-run-print-stopped]')).toBeNull()
  })

  it('on a phone every press of the card is 44 px tall', () => {
    mount(READY, { isMobile: true, print: printState({ notices: 6, affidavits: 10, held: 0, mode: 'two' }) })
    expect(all('[data-lien-run-card="print"] button').map((b) => b.style.minHeight)).toEqual(['44px', '44px'])
    cleanup()
    mount(READY, { isMobile: true, print: printState({ notices: 1, affidavits: 1, held: 0 }) })
    expect(all('[data-lien-run-card="print"] button').map((b) => b.style.minHeight)).toEqual(['44px'])
    cleanup()
    // A dead press is as tall as a live one.
    mount(BEFORE, { isMobile: true, print: printState({ notices: 0, affidavits: 0, held: 4 }) })
    expect(all('[data-lien-run-card="print"] button').map((b) => [(b as HTMLButtonElement).disabled, b.style.minHeight])).toEqual([[true, '44px']])
  })
})
