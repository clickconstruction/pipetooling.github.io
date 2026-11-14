import { describe, expect, it } from 'vitest'
import { deskJobsNotLoadedWords, deskRowNotLoadedWords, siteJobsNotLoadedWords } from './onSiteReadFailed'

describe('what a screen says when part of its read failed', () => {
  it('a site names how many of its jobs are not on the screen', () => {
    expect(siteJobsNotLoadedWords(0, 2)).toBe('')
    expect(siteJobsNotLoadedWords(1, 2)).toBe('1 of this site’s 2 jobs did not load. Its boxes are not on this screen, and the figures leave them out.')
    expect(siteJobsNotLoadedWords(2, 3)).toBe('2 of this site’s 3 jobs did not load. Their boxes are not on this screen, and the figures leave them out.')
    expect(siteJobsNotLoadedWords(1, 1)).toBe('This site’s job did not load, so none of its boxes are on this screen.')
    expect(siteJobsNotLoadedWords(3, 3)).toBe('None of this site’s 3 jobs loaded, so none of its boxes are on this screen.')
  })
  it('the desk’s site row counts the jobs that did not load', () => {
    expect(deskJobsNotLoadedWords(0)).toBe('')
    expect(deskJobsNotLoadedWords(1)).toBe('1 job did not load')
    expect(deskJobsNotLoadedWords(2)).toBe('2 jobs did not load')
  })
  it('a job’s own row gives the reason in place of its figures', () => {
    expect(deskRowNotLoadedWords('No connection. Check your signal.')).toBe('Did not load. No connection. Check your signal.')
    expect(deskRowNotLoadedWords(null)).toBe('Did not load.')
  })
})
