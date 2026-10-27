/**
 * Empty words for Partnerships (punch list #184, sweep C): what the partnership list and a
 * partnership's Agreements, Job review, Statements, Timeline and Ledger tabs say when they have
 * no rows, in `EmptyState`'s shape (`main`, the press, `tail`). The rule is `emptyWords.ts`'s: a
 * list says what fills it and offers the press. A statement is a money write that needs the week
 * and the offsets above it, so the archive names Generate statement instead of pressing it.
 * `partnershipsEmptyWords.test.ts` fires every press and holds every sentence to plain words.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'

type Press = () => void

/** People → Contracts, where a partnership agreement is made. */
export const PEOPLE_CONTRACTS_PATH = '/people?tab=contracts'

/** People → Hours, where clocked hours are approved. */
export const PEOPLE_HOURS_PATH = '/people?tab=hours'

/** The page's make button. */
export const NEW_PARTNERSHIP_CONTROL = '+ New'

/** No partnership yet: + New opens the add form. */
export function partnershipsListEmptyWords(addNew: Press): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'partnerships', control: NEW_PARTNERSHIP_CONTROL }), { onPress: addNew })
}

/** Agreements with no document linked: People → Contracts makes the agreement, then it is linked here. */
export function partnershipAgreementsEmptyWords(personName: string): EmptyStateWords {
  return {
    main: 'No document is linked to this partnership yet.',
    next: { label: 'People → Contracts', to: PEOPLE_CONTRACTS_PATH },
    tail: `is where you make ${personName}’s partnership agreement. Pick the doc type agreement, then link it here. Only linked documents count toward the deal.`,
  }
}

/** Job review with no job: the partner's hours are approved on People → Hours. */
export const PARTNERSHIP_JOB_REVIEW_EMPTY: EmptyStateWords = { main: 'No jobs with approved clocked hours yet.', next: { label: 'People → Hours', to: PEOPLE_HOURS_PATH }, tail: 'is where the hours get approved.' }

/** The statement archive with none: Generate statement, above, makes the first when a week is open to close. */
export function partnershipStatementsEmptyWords(canGenerate: boolean): EmptyStateWords {
  return canGenerate ? { main: 'No statements yet.', tail: 'Generate statement above makes the first.' } : { main: 'No statements yet.' }
}

/** The Timeline: a filter chip hiding every row (All shows them), or nothing on it yet. */
export function partnershipTimelineEmptyWords(filtered: boolean, showAll: Press): EmptyStateWords {
  if (filtered) return { main: 'Nothing for this filter.', next: { label: 'All', onPress: showAll }, tail: 'shows every row.' }
  return { main: 'Nothing on the timeline yet.', tail: 'Charges, jobs and statements land here as they happen.' }
}

/** The Ledger with nothing posted: the Statements tab makes the first statement. */
export function partnershipLedgerEmptyWords(openStatements: Press | null): EmptyStateWords {
  if (!openStatements) return { main: 'Nothing posted yet.', tail: 'The first statement posts the first line.' }
  return { main: 'Nothing posted yet.', next: { label: 'Statements', onPress: openStatements }, tail: 'is where you make the first statement.' }
}
