import { describe, expect, it } from 'vitest'
import { CONTRACT_LINK_EXPIRED_WORDS, CONTRACT_LINK_GONE_WORDS, CONTRACT_PAPER_NOT_READY_WORDS, contractLinkErrorWords } from './contractAcceptLink'
import { JOB_PAPER_NOT_READY } from '../../supabase/functions/_shared/clausePaper'
import { plainWordsFailures } from './plainWords'

describe('the signing page’s words when its link does not load', () => {
  it('says a dead link plainly, naming no portal, whichever 404 the function sent', () => {
    expect(contractLinkErrorWords(404, 'Not found')).toBe(CONTRACT_LINK_GONE_WORDS)
    expect(contractLinkErrorWords(404, 'Not available')).toBe(CONTRACT_LINK_GONE_WORDS)
    expect(CONTRACT_LINK_GONE_WORDS).not.toMatch(/portal/i)
    expect(plainWordsFailures(CONTRACT_LINK_GONE_WORDS)).toEqual([])
  })

  it('words an expired link by its code, and leaves anything else to the failure’s class, never the function’s words (v2.5965)', () => {
    expect(contractLinkErrorWords(410, 'expired')).toBe(CONTRACT_LINK_EXPIRED_WORDS)
    expect(plainWordsFailures(CONTRACT_LINK_EXPIRED_WORDS)).toEqual([])
    expect(contractLinkErrorWords(500)).toBeNull()
    expect(contractLinkErrorWords(410, null)).toBeNull()
  })

  it('sends the signer to the office when a job’s paper is not ready, in the function’s own sentence (punch list #389)', () => {
    expect(contractLinkErrorWords(409, 'paper_not_ready')).toBe(CONTRACT_PAPER_NOT_READY_WORDS)
    expect(CONTRACT_PAPER_NOT_READY_WORDS).toBe(JOB_PAPER_NOT_READY)
    expect(plainWordsFailures(CONTRACT_PAPER_NOT_READY_WORDS)).toEqual([])
  })
})
