/**
 * Empty words (punch list #184, sweep C): what an empty list says. The rule, in `CLAUDE.md` and
 * the Glossary's *Empty state*: an empty list says what fills it and offers the press, or, where
 * empty is the good state, says so and names where to look next. A bare "No bills" or "Nothing
 * here" fails, because the person is left to guess what to do. Four kinds cover the app's lists:
 *
 * - make: the viewer makes the thing. *No bids yet. New Bid ▸ adds the first.*
 * - filter: a search or the filters hide the rows. *No bids match ‘Ridgeway’. Clear the search ▸*
 * - waiting: empty is the good state. *Nothing waiting on dispatch.*
 * - data: what fills the list is another page. *No sessions yet. Clock in ▸ starts the first.*
 *
 * `EmptyState` (components/EmptyState.tsx) draws the three parts in order: `main`, the press,
 * then `tail`. The caller passes the plural noun; the words never pluralize. Every sentence
 * follows plain words (`plainWords.ts`): under 20 words, no dash, semicolon or parenthesis.
 */

export type EmptyWordsInput =
  /** The viewer makes the thing: `control` is the exact name of the button that adds the first. */
  | { kind: 'make'; noun: string; control: string }
  /** A search or the filters hide the rows: `query` is the search text, empty when only filters hide them. */
  | { kind: 'filter'; noun: string; query: string }
  /** Empty is the good state: `who` is who the list would be waiting on ("you", "dispatch", "an estimator"). */
  | { kind: 'waiting'; who: string }
  /** What fills the list is another page: `page.label` is its name, `page.tail` what it does there. */
  | { kind: 'data'; noun: string; page: { label: string; tail?: string } }

/** The three parts: `next` is the press's label, empty when there is no press. */
export type EmptyWords = { main: string; next: string; tail: string }

/** The press an `EmptyState` draws: a handler, or a page. */
export type EmptyNext = { label: string; onPress: () => void } | { label: string; to: string }

/** What `EmptyState` takes: the sentence, the press and the words after it, and a second press drawn after *or*. */
export type EmptyStateWords = { main: string; next?: EmptyNext; tail?: string; orNext?: EmptyNext }

export function emptyWords(input: EmptyWordsInput): EmptyWords {
  switch (input.kind) {
    case 'make':
      return { main: `No ${input.noun} yet.`, next: input.control, tail: 'adds the first.' }
    case 'filter': {
      const query = input.query.trim()
      return query
        ? { main: `No ${input.noun} match ‘${query}’.`, next: 'Clear the search', tail: '' }
        : { main: `No ${input.noun} match the filters.`, next: 'Clear the filters', tail: '' }
    }
    case 'waiting':
      return { main: `Nothing waiting on ${input.who}.`, next: '', tail: '' }
    case 'data':
      return { main: `No ${input.noun} yet.`, next: input.page.label, tail: input.page.tail ?? '' }
  }
}

/** The words with their press attached, in the shape `EmptyState` takes; no press when the kind has none. */
export function emptyWordsWithPress(words: EmptyWords, press: { onPress: () => void } | { to: string }): EmptyStateWords {
  return {
    main: words.main,
    next: words.next ? { label: words.next, ...press } : undefined,
    tail: words.tail || undefined,
  }
}
