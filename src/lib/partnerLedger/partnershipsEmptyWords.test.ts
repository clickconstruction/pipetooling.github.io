import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'
import {
  PARTNERSHIP_JOB_REVIEW_EMPTY,
  PEOPLE_CONTRACTS_PATH,
  PEOPLE_HOURS_PATH,
  partnershipAgreementsEmptyWords,
  partnershipLedgerEmptyWords,
  partnershipStatementsEmptyWords,
  partnershipTimelineEmptyWords,
  partnershipsListEmptyWords,
} from './partnershipsEmptyWords'

const noop = () => {}
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
function press(w: EmptyStateWords) {
  if (!w.next || !('onPress' in w.next)) throw new Error(`no handler press on: ${w.main}`)
  w.next.onPress()
}

describe('partnershipsEmptyWords', () => {
  it('the list: + New opens the add form', () => {
    const add = vi.fn()
    const words = partnershipsListEmptyWords(add)
    expect(read(words)).toBe('No partnerships yet. + New adds the first.')
    press(words)
    expect(add).toHaveBeenCalledTimes(1)
  })

  it('Agreements and Job review link to the People tab that fills them', () => {
    const agreements = partnershipAgreementsEmptyWords('Pat Partner')
    expect(agreements.next).toEqual({ label: 'People → Contracts', to: PEOPLE_CONTRACTS_PATH })
    expect(agreements.tail).toContain('Pat Partner’s partnership agreement')
    expect(PARTNERSHIP_JOB_REVIEW_EMPTY.next).toEqual({ label: 'People → Hours', to: PEOPLE_HOURS_PATH })
  })

  it('Statements names Generate statement instead of pressing it; the Ledger opens the Statements tab', () => {
    expect(partnershipStatementsEmptyWords(true)).toEqual({ main: 'No statements yet.', tail: 'Generate statement above makes the first.' })
    expect(partnershipStatementsEmptyWords(false)).toEqual({ main: 'No statements yet.' })
    const open = vi.fn()
    const ledger = partnershipLedgerEmptyWords(open)
    expect(read(ledger)).toBe('Nothing posted yet. Statements is where you make the first statement.')
    press(ledger)
    expect(open).toHaveBeenCalledTimes(1)
    expect(partnershipLedgerEmptyWords(null).next).toBeUndefined()
  })

  it('the Timeline offers All under a filter', () => {
    const all = vi.fn()
    const filtered = partnershipTimelineEmptyWords(true, all)
    expect(read(filtered)).toBe('Nothing for this filter. All shows every row.')
    press(filtered)
    expect(all).toHaveBeenCalledTimes(1)
    expect(partnershipTimelineEmptyWords(false, all).next).toBeUndefined()
  })

  it('every sentence reads in plain words', () => {
    const all: EmptyStateWords[] = [
      partnershipsListEmptyWords(noop),
      partnershipAgreementsEmptyWords('Pat Partner'),
      PARTNERSHIP_JOB_REVIEW_EMPTY,
      partnershipStatementsEmptyWords(true),
      partnershipTimelineEmptyWords(true, noop),
      partnershipTimelineEmptyWords(false, noop),
      partnershipLedgerEmptyWords(noop),
      partnershipLedgerEmptyWords(null),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
