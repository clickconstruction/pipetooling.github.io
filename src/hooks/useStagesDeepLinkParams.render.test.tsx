// @vitest-environment jsdom
/**
 * The board's deep-link doors (punch list #46 row 2, the Stages map's step 5): each modal door
 * opens once and strips its own params with `replace`; `?rtb=1` strips unguarded, arms a
 * window flag, and polls until the Ready to Bill header holds still before focusing it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import type { NavigateFunction } from 'react-router-dom'
import { useStagesDeepLinkParams, useStagesRtbFocus, type StagesDeepLinkDoors } from './useStagesDeepLinkParams'
import { parseStagesDeepLinks } from '../lib/jobs/stagesDeepLinks'
import { stagesSectionElementId } from '../lib/jobs/stagesSectionPrefs'

function makeDoors() {
  return {
    followups: vi.fn(),
    gcReview: vi.fn(),
    gcNotice: vi.fn(),
    lienDesk: vi.fn(),
    lienWindow: vi.fn(),
    round: vi.fn(),
    chase: vi.fn(),
    forecast: vi.fn(),
  } satisfies StagesDeepLinkDoors
}

const qs = (s: string) => new URLSearchParams(s)
const searches = (navigate: ReturnType<typeof vi.fn>) => navigate.mock.calls.map((c) => (c[0] as { search: string }).search)

function mount(search: string, doors = makeDoors()) {
  const navigate = vi.fn()
  const hook = renderHook(
    ({ sp }: { sp: URLSearchParams }) => useStagesDeepLinkParams(sp, navigate as unknown as NavigateFunction, doors),
    { initialProps: { sp: qs(search) } },
  )
  return { ...hook, navigate, doors }
}

afterEach(cleanup)

describe('useStagesDeepLinkParams — the modal doors', () => {
  it('no door in the URL: nothing opens, nothing navigates, the parse is returned', () => {
    const { result, navigate, doors } = mount('tab=stages')
    expect(navigate).not.toHaveBeenCalled()
    expect(Object.values(doors).every((d) => d.mock.calls.length === 0)).toBe(true)
    expect(result.current).toEqual(parseStagesDeepLinks(qs('tab=stages')))
  })

  it.each([
    ['followups=1', 'followups', []],
    ['gcReview=1', 'gcReview', []],
    ['gcnotice=cust-9', 'gcNotice', ['cust-9']],
    ['liendesk=1&liendeskJob=j-4&kind=affidavit&liendeskPile=missed', 'lienDesk', [{ jobId: 'j-4', kind: 'affidavit', pile: 'missed' }]],
    ['lienwindow=j-4&lientab=affidavit', 'lienWindow', [{ jobId: 'j-4', tab: 'affidavit' }]],
    ['round=1&gc=gc-2', 'round', ['gc-2']],
    ['round=1', 'round', [null]],
    ['chase=1', 'chase', []],
    ['forecast=1', 'forecast', []],
  ] as const)('%s opens %s and strips only its own params', (door, key, args) => {
    const { navigate, doors } = mount(`tab=stages&${door}&keep=me`)
    expect(doors[key]).toHaveBeenCalledTimes(1)
    expect(doors[key]).toHaveBeenCalledWith(...args)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith({ search: 'tab=stages&keep=me' }, { replace: true })
  })

  it('a door opens once per mount — the same link coming back later does not re-open it', () => {
    const { rerender, navigate, doors } = mount('chase=1')
    rerender({ sp: qs('') })
    rerender({ sp: qs('chase=1&x=2') })
    expect(doors.chase).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('a door that arrives later still opens once', () => {
    const { rerender, navigate, doors } = mount('tab=stages')
    rerender({ sp: qs('tab=stages&forecast=1') })
    rerender({ sp: qs('tab=stages&forecast=1') })
    expect(doors.forecast).toHaveBeenCalledTimes(1)
    expect(searches(navigate)).toEqual(['tab=stages'])
  })

  it('preserved quirk: two doors at once open in the old order, each stripping its own params from the same pre-strip URL', () => {
    const { navigate, doors } = mount('forecast=1&followups=1&round=1&gc=g')
    expect(doors.followups).toHaveBeenCalledTimes(1)
    expect(doors.round).toHaveBeenCalledWith('g')
    expect(doors.forecast).toHaveBeenCalledTimes(1)
    expect(searches(navigate)).toEqual(['forecast=1&round=1&gc=g', 'forecast=1&followups=1', 'followups=1&round=1&gc=g'])
  })
})

describe('useStagesRtbFocus', () => {
  let top = 500
  beforeEach(() => {
    vi.useFakeTimers()
    delete (window as unknown as { __rtbFocusArmedAt?: number }).__rtbFocusArmedAt
    const el = document.createElement('div')
    el.id = stagesSectionElementId('readyToBill')
    el.getBoundingClientRect = () => ({ top }) as DOMRect
    document.body.appendChild(el)
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  function mountRtb(search: string) {
    const navigate = vi.fn()
    const focus = vi.fn()
    const sp = qs(search)
    const hook = renderHook(
      ({ s }: { s: URLSearchParams }) => useStagesRtbFocus(parseStagesDeepLinks(s), s, navigate as unknown as NavigateFunction, focus),
      { initialProps: { s: sp } },
    )
    return { ...hook, navigate, focus }
  }

  it('without rtb it does nothing', () => {
    const { navigate, focus } = mountRtb('tab=stages')
    vi.advanceTimersByTime(5000)
    expect(navigate).not.toHaveBeenCalled()
    expect(focus).not.toHaveBeenCalled()
  })

  it('strips rtb, then focuses once the header holds still — and re-pins if the header is pushed down', () => {
    top = 500
    const { navigate, focus } = mountRtb('tab=stages&rtb=1')
    expect(navigate).toHaveBeenCalledWith({ search: 'tab=stages' }, { replace: true })
    vi.advanceTimersByTime(400) // first tick: records the top
    expect(focus).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300) // still → focus
    expect(focus).toHaveBeenCalledWith('readyToBill')
    top = 0
    vi.advanceTimersByTime(300) // moved to the top: record
    vi.advanceTimersByTime(300) // still at the top: stop
    expect(focus).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30_000)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('the window arm stops a second mount within 5 s from polling again, but the strip still runs', () => {
    const first = mountRtb('rtb=1')
    const second = mountRtb('rtb=1')
    expect(second.navigate).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(first.focus).toHaveBeenCalledTimes(1)
    expect(second.focus).not.toHaveBeenCalled()
  })

  it('gives up after 100 tries when the header never appears', () => {
    document.body.innerHTML = ''
    const { focus } = mountRtb('rtb=1')
    vi.advanceTimersByTime(400 + 300 * 120)
    expect(vi.getTimerCount()).toBe(0)
    expect(focus).not.toHaveBeenCalled()
  })
})
