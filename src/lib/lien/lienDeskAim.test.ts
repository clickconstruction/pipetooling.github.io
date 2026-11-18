import { describe, expect, it, vi } from 'vitest'
import { lienDeskAimAddressJob, lienDeskAimFrom, lienDeskAimSpent, lienDeskOffListWords, readLienDeskAim, type LienDeskAimRead } from './lienDeskAim'
import { lienDeskFromSearch, lienDeskRedirect } from './lienDeskRoute'

const lists = { notice: ['n1', 'both'], affidavit: ['a1', 'both'], retainage: ['r1'] }

describe('lienDeskAimFrom', () => {
  it('is a job on one of the three paper lists', () => {
    expect(lienDeskAimFrom('notice', 'j1')).toEqual({ kind: 'notice', jobId: 'j1' })
    expect(lienDeskAimFrom('affidavit', ' j1 ')).toEqual({ kind: 'affidavit', jobId: 'j1' })
    expect(lienDeskAimFrom('retainage', 'j1')).toEqual({ kind: 'retainage', jobId: 'j1' })
  })

  it('is nothing with no job, and on a view with no pane a job opens in', () => {
    expect(lienDeskAimFrom('affidavit', null)).toBeNull()
    expect(lienDeskAimFrom('affidavit', '  ')).toBeNull()
    for (const kind of ['next', 'calendar', 'timeline', null, undefined] as const) expect(lienDeskAimFrom(kind, 'j1')).toBeNull()
  })

  it('reads every address the desk is reached by, the old links among them', () => {
    const from = (search: string) => {
      const a = lienDeskFromSearch(new URLSearchParams(search))
      return lienDeskAimFrom(a.kind, a.job)
    }
    expect(from('tab=affidavits&job=j1')).toEqual({ kind: 'affidavit', jobId: 'j1' })
    expect(from('tab=retainage&job=j1')).toEqual({ kind: 'retainage', jobId: 'j1' })
    expect(from('tab=notices&job=j1&pile=sent')).toEqual({ kind: 'notice', jobId: 'j1' })
    // A job with no tab lands on Monthly notices.
    expect(from('job=j1')).toEqual({ kind: 'notice', jobId: 'j1' })
    // By job, To do and a word the desk does not know have no pane: the job is no aim.
    expect(from('tab=timeline&job=j1')).toBeNull()
    expect(from('tab=deadlines&job=j1')).toBeNull()
    expect(from('tab=nonsense&job=j1')).toBeNull()
    const old = (search: string) => from((lienDeskRedirect(new URLSearchParams(search)) ?? '').split('?')[1] ?? '')
    expect(old('liendesk=1&liendeskJob=j1')).toEqual({ kind: 'notice', jobId: 'j1' })
    expect(old('liendesk=1&kind=notice&liendeskJob=j1&liendeskPile=sent')).toEqual({ kind: 'notice', jobId: 'j1' })
    expect(old('liendesk=1&kind=affidavit&liendeskJob=j1')).toEqual({ kind: 'affidavit', jobId: 'j1' })
    expect(old('liendesk=1&kind=retainage&liendeskJob=j1')).toEqual({ kind: 'retainage', jobId: 'j1' })
    expect(old('liendesk=1&kind=timeline&liendeskJob=j1')).toBeNull()
    expect(old('liendesk=1')).toBeNull()
  })
})

describe('readLienDeskAim', () => {
  const read = (over: Partial<Parameters<typeof readLienDeskAim>[0]>) => readLienDeskAim({ aim: { kind: 'affidavit', jobId: 'gone' }, kind: 'affidavit', picked: null, loaded: true, lists, ...over })

  it('a job the list holds opens, on each list', () => {
    expect(read({ aim: { kind: 'notice', jobId: 'n1' }, kind: 'notice' })).toEqual({ state: 'on_list' })
    expect(read({ aim: { kind: 'affidavit', jobId: 'a1' } })).toEqual({ state: 'on_list' })
    expect(read({ aim: { kind: 'retainage', jobId: 'r1' }, kind: 'retainage' })).toEqual({ state: 'on_list' })
  })

  it('a job the list does not hold opens no job, on each list, and names the lists that do hold it', () => {
    expect(read({})).toEqual({ state: 'off_list', kind: 'affidavit', jobId: 'gone', elsewhere: [] })
    expect(read({ aim: { kind: 'notice', jobId: 'a1' }, kind: 'notice' })).toEqual({ state: 'off_list', kind: 'notice', jobId: 'a1', elsewhere: ['affidavit'] })
    expect(read({ aim: { kind: 'retainage', jobId: 'both' }, kind: 'retainage' })).toEqual({ state: 'off_list', kind: 'retainage', jobId: 'both', elsewhere: ['notice', 'affidavit'] })
    expect(read({ aim: { kind: 'affidavit', jobId: 'r1' } })).toEqual({ state: 'off_list', kind: 'affidavit', jobId: 'r1', elsewhere: ['retainage'] })
  })

  it('the aimed job picked on its list is still the aim', () => {
    expect(read({ picked: 'gone' }).state).toBe('off_list')
    expect(read({ aim: { kind: 'affidavit', jobId: 'a1' }, picked: 'a1' })).toEqual({ state: 'on_list' })
  })

  it('decides nothing before the rows are in', () => {
    expect(read({ loaded: false, lists: { notice: [], affidavit: [], retainage: [] } })).toEqual({ state: 'waiting' })
  })

  it('is nothing with no aim, on another view, and once the reader picked another row', () => {
    expect(read({ aim: null })).toEqual({ state: 'none' })
    expect(read({ kind: 'notice' })).toEqual({ state: 'none' })
    expect(read({ kind: 'next' })).toEqual({ state: 'none' })
    expect(read({ picked: 'a1' })).toEqual({ state: 'none' })
    // Even before the rows are in: a pick is the reader's.
    expect(read({ picked: 'a1', loaded: false })).toEqual({ state: 'none' })
  })
})

describe('lienDeskAimSpent · lienDeskAimAddressJob', () => {
  const off: LienDeskAimRead = { state: 'off_list', kind: 'affidavit', jobId: 'gone', elsewhere: [] }

  it('the aim is kept while the rows are awaited and while the note stands', () => {
    expect(lienDeskAimSpent({ state: 'waiting' })).toBe(false)
    expect(lienDeskAimSpent(off)).toBe(false)
    expect(lienDeskAimSpent({ state: 'on_list' })).toBe(true)
    expect(lienDeskAimSpent({ state: 'none' })).toBe(true)
  })

  it('the address keeps the job only while the note stands', () => {
    expect(lienDeskAimAddressJob(off)).toBe('gone')
    for (const state of ['none', 'waiting', 'on_list'] as const) expect(lienDeskAimAddressJob({ state })).toBeNull()
  })
})

describe('lienDeskOffListWords', () => {
  const doors = () => ({ onOpenList: vi.fn(), onOpenLienWindow: vi.fn() })

  it('a job on no list: the list by its tab’s name, and the Lien window as the press', () => {
    const d = doors()
    const words = lienDeskOffListWords({ state: 'off_list', kind: 'affidavit', jobId: 'gone', elsewhere: [] }, '650 · AXO Schertz', d)
    expect(words.main).toBe('650 · AXO Schertz is not on the Lien affidavits list.')
    expect(words.next?.label).toBe('Open its Lien window ›')
    expect(words.tail).toBe('shows where it stands.')
    expect(words.orNext).toBeUndefined()
    if (words.next && 'onPress' in words.next) words.next.onPress()
    expect(d.onOpenLienWindow).toHaveBeenCalledTimes(1)
    expect(d.onOpenList).not.toHaveBeenCalled()
  })

  it('a job on another list: that list first, then the Lien window', () => {
    const d = doors()
    const words = lienDeskOffListWords({ state: 'off_list', kind: 'retainage', jobId: 'both', elsewhere: ['notice', 'affidavit'] }, '650 · AXO Schertz', d)
    expect(words.main).toBe('650 · AXO Schertz is not on the Retainage notices list.')
    expect(words.next?.label).toBe('Open it on Monthly notices ›')
    expect(words.tail).toBeUndefined()
    expect(words.orNext?.label).toBe('Open its Lien window ›')
    if (words.next && 'onPress' in words.next) words.next.onPress()
    expect(d.onOpenList).toHaveBeenCalledWith('notice')
    if (words.orNext && 'onPress' in words.orNext) words.orNext.onPress()
    expect(d.onOpenLienWindow).toHaveBeenCalledTimes(1)
  })

  it('a job the desk holds no row for is named by what it is', () => {
    const words = lienDeskOffListWords({ state: 'off_list', kind: 'notice', jobId: 'gone', elsewhere: [] }, '  ', doors())
    expect(words.main).toBe('The job this link names is not on the Monthly notices list.')
  })
})
