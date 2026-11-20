import { describe, expect, it } from 'vitest'
import { keptBoardFlags } from './keptBoardFlags'

const base = { showingKept: true, loading: false, refreshing: false, enriching: false, keptFailed: false }

describe('keptBoardFlags', () => {
  it('hands the cache’s own flags through when no remembered rows are on screen', () => {
    expect(keptBoardFlags({ ...base, showingKept: false, loading: true })).toEqual({ jobsListLoading: true, jobsListRefreshing: false })
    expect(keptBoardFlags({ ...base, showingKept: false, refreshing: true })).toEqual({ jobsListLoading: false, jobsListRefreshing: true })
    // The enrichment of a live board is not a refresh: nothing waits on it.
    expect(keptBoardFlags({ ...base, showingKept: false, enriching: true })).toEqual({ jobsListLoading: false, jobsListRefreshing: false })
  })

  it('reads the main read behind a remembered board as a refresh, never as loading', () => {
    expect(keptBoardFlags({ ...base, loading: true })).toEqual({ jobsListLoading: false, jobsListRefreshing: true })
  })

  it('stays refreshing through the enrichment while the remembered board shows (the false failure line of v2.7953)', () => {
    expect(keptBoardFlags({ ...base, enriching: true })).toEqual({ jobsListLoading: false, jobsListRefreshing: true })
  })

  it('stays refreshing for the render between the last read landing and the live rows', () => {
    expect(keptBoardFlags(base)).toEqual({ jobsListLoading: false, jobsListRefreshing: true })
  })

  it('goes quiet only when the live read failed and nothing is out, so the line can say so', () => {
    expect(keptBoardFlags({ ...base, keptFailed: true })).toEqual({ jobsListLoading: false, jobsListRefreshing: false })
  })

  it('reads a new try after a failure as a refresh again', () => {
    expect(keptBoardFlags({ ...base, keptFailed: true, loading: true })).toEqual({ jobsListLoading: false, jobsListRefreshing: true })
    expect(keptBoardFlags({ ...base, keptFailed: true, refreshing: true })).toEqual({ jobsListLoading: false, jobsListRefreshing: true })
  })
})
