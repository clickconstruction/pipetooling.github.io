/**
 * A place's words (punch list #413, Taunya's ask of 2026-11-21 for an open-ended description): what
 * whoever comes next should know, at any length. One line for a gate, a whole description for a
 * buried line: what it is, how deep, which way it runs.
 *
 * Pure: text in, text out. No map, no network, no React.
 *
 * The rules the screens lean on:
 * - The words keep their lines. A person who writes three short lines reads three short lines.
 * - The whole description shows where a person reads one place: its own row once opened, the
 *   printed page, the shared page and a file for another map.
 * - A short form shows where many places share the room: a row in a list, the key under a
 *   picture and a text message. It is the start of the words, cut at a sentence when one ends in
 *   time and at a word when none does, with a mark that says it was cut.
 */

/** The table's own cap (`painted_map_places_words_room`). */
export const PAINTED_PLACE_WORDS_MAX = 4000
/** How much of a description a row, a picture's key or a text carries. It was the whole cap before #413. */
export const PAINTED_PLACE_WORDS_SHORT = 160
/** A short form never ends on a sentence shorter than this: it would say too little to be worth the cut. */
const SHORT_SENTENCE_MIN = 60

/** Under the box. */
export const PLACE_WORDS_LABEL = 'Describe it'
export const PLACE_WORDS_HINT = 'As much as you need. What it is, how deep, which way it runs.'
export const PLACE_WORDS_PLACEHOLDER = 'Close it behind you.'
/** The press that opens a cut description, and the one that folds it again. */
export const PLACE_WORDS_MORE = 'Read it all'
export const PLACE_WORDS_LESS = 'Show less'

/**
 * The words as they are kept: line ends made one kind, spaces inside a line collapsed, each line's
 * ends trimmed, three or more line breaks made two, the whole trimmed and cut at the cap.
 */
export function cleanPlaceWords(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, PAINTED_PLACE_WORDS_MAX)
    .trim()
}

/** The words on one line: every run of space and every line break is one space. */
export function placeWordsOnOneLine(words: string | null | undefined): string {
  return (words ?? '').replace(/\s+/g, ' ').trim()
}

/** The words are longer than a short form carries, so a row offers the rest. */
export function placeWordsAreLong(words: string | null | undefined, max: number = PAINTED_PLACE_WORDS_SHORT): boolean {
  return placeWordsOnOneLine(words).length > max
}

/**
 * The short form: the words on one line, whole when they fit. Otherwise the sentences that fit,
 * when they say enough, and failing that the words that fit, ending in `…`.
 */
export function shortPlaceWords(words: string | null | undefined, max: number = PAINTED_PLACE_WORDS_SHORT): string {
  const line = placeWordsOnOneLine(words)
  if (line.length <= max) return line
  const head = line.slice(0, max)
  // The last sentence end inside the room, followed by a space or the cut itself.
  let sentence = -1
  for (const m of head.matchAll(/[.!?](?=\s|$)/g)) sentence = m.index + 1
  if (sentence >= SHORT_SENTENCE_MIN) return `${head.slice(0, sentence)} …`
  // No sentence ends in time: cut at the last whole word, leaving room for the mark.
  const room = head.slice(0, max - 1)
  // The room may end exactly on a word, with the space right after it.
  const endsOnWord = line.charAt(max - 1) === ' '
  const space = room.lastIndexOf(' ')
  const cut = !endsOnWord && space >= SHORT_SENTENCE_MIN / 2 ? room.slice(0, space) : room
  return `${cut.replace(/[\s,;:]+$/, '')}…`
}
