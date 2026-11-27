/**
 * The Punch list's **Waiting on me** view (punch list #438): the cards that carry a question
 * (`ask:` in their front matter, `punchListAsk.ts`), each with the question first and one control to
 * answer it. Diane's ask of 2026-11-24: make it easy for a person to see the questions they still
 * have to answer, and what the card looks like.
 *
 * The answer is the board's own pick, read differently on a card with a question: **Go ahead** is the
 * pick `do`, **Not now** is `later`, and **Change** is `change`, with the note saying what. A pick is
 * the answer only to the question it was given: the row keeps the question it answered
 * (`answers_ask`), and when a session writes the card's next question the old pick stops counting, so
 * the card waits again.
 *
 * Pure: the cards and the picks in, the rows out.
 */
import type { UserRole } from '../../types/userRole'
import { ASK_WHO, ASK_WHO_LABEL, type AskWho, type CardAsk } from './punchListAsk'
import { isOpenItem, type PickMap, type PickRecord } from './punchListView'
import type { BoardItem } from './todoBoard'

/** The three answers, in the order the control draws them. */
export const ANSWER_PICKS = ['do', 'change', 'later'] as const
export type AnswerPick = (typeof ANSWER_PICKS)[number]

export const ANSWER_LABEL: Record<AnswerPick, string> = { do: 'Go ahead', change: 'Change', later: 'Not now' }

/** A card that waits on a person: open, with a question. */
export type AskedCard = BoardItem & { ask: CardAsk }

export function isAsked(item: BoardItem): item is AskedCard {
  return isOpenItem(item) && !!item.ask
}

/**
 * The card's answer to the question it asks today, or '' when it has none. A pick made before the
 * question changed, or a Drop from the sorting control, is no answer.
 */
export function answerOf(item: Pick<AskedCard, 'ask'>, rec: PickRecord | undefined): AnswerPick | '' {
  if (!rec || rec.answersAsk !== item.ask.question) return ''
  return rec.pick === 'do' || rec.pick === 'change' || rec.pick === 'later' ? rec.pick : ''
}

/** Toggle: pressing the pressed answer takes it back. */
export function nextAnswer(current: AnswerPick | '', clicked: AnswerPick): AnswerPick | '' {
  return current === clicked ? '' : clicked
}

/**
 * Whose questions are the reader's own. The page opens to the owner and the devs alone
 * (`canOpenPunchList`): the owner is the Leader, and a question for anyone at hand is everybody's.
 */
export function mineFor(role: UserRole | null | undefined): AskWho[] {
  if (role === 'master_technician') return ['owner', 'anyone']
  if (role === 'dev') return ['dev', 'anyone']
  return []
}

/** The pills over the list: the reader's own questions, one person's, or everyone's. */
export type WhoPill = 'mine' | AskWho | 'everyone'

export function isWhoPill(value: string | null | undefined): value is WhoPill {
  return value === 'mine' || value === 'everyone' || (ASK_WHO as readonly string[]).includes(value ?? '')
}

function matchesWho(item: AskedCard, who: WhoPill, mine: readonly AskWho[]): boolean {
  if (who === 'everyone') return true
  if (who === 'mine') return mine.includes(item.ask.who)
  return item.ask.who === who
}

/** The newest card first, as By number runs. */
function byNumberDown(a: BoardItem, b: BoardItem): number {
  return b.number - a.number
}

export interface WaitingRows {
  /** Cards whose question has no answer yet. */
  waiting: AskedCard[]
  /** Cards whose question has been answered; they fold at the foot. */
  answered: AskedCard[]
}

/** The view's rows for one pill, each list the newest card first. */
export function waitingRows(items: readonly BoardItem[], picks: PickMap, who: WhoPill, mine: readonly AskWho[]): WaitingRows {
  const asked = items.filter(isAsked).filter((it) => matchesWho(it, who, mine)).sort(byNumberDown)
  return {
    waiting: asked.filter((it) => answerOf(it, picks[it.slug]) === ''),
    answered: asked.filter((it) => answerOf(it, picks[it.slug]) !== ''),
  }
}

export interface WaitingCounts {
  /** Unanswered questions that are the reader's own. */
  mine: number
  /** Unanswered questions, whoever they wait on. */
  everyone: number
  /** Unanswered questions by who they wait on. */
  by: Record<AskWho, number>
  /** Cards that carry a question at all, answered or not: zero hides the view. */
  asked: number
  /** Cards that ask the reader, answered or not: the view stays theirs after they answer the last one. */
  mineAsked: number
}

export function waitingCounts(items: readonly BoardItem[], picks: PickMap, mine: readonly AskWho[]): WaitingCounts {
  const by = Object.fromEntries(ASK_WHO.map((w) => [w, 0])) as Record<AskWho, number>
  const asked = items.filter(isAsked)
  let everyone = 0
  let own = 0
  for (const it of asked) {
    if (answerOf(it, picks[it.slug]) !== '') continue
    everyone++
    by[it.ask.who]++
    if (mine.includes(it.ask.who)) own++
  }
  return { mine: own, everyone, by, asked: asked.length, mineAsked: asked.filter((it) => mine.includes(it.ask.who)).length }
}

/** The View pill's words: the reader's own count when a card asks them, else everybody's. */
export function waitingViewLabel(counts: Pick<WaitingCounts, 'mine' | 'everyone' | 'mineAsked'>): string {
  return counts.mineAsked > 0 ? `Waiting on me ${counts.mine}` : `Waiting on a person ${counts.everyone}`
}

/**
 * The pill the view opens on: the reader's own questions when a card asks them, else everyone's. It
 * reads the cards that ask, not the ones still unanswered, so answering the last one leaves the reader
 * on their own list, which then says nothing is waiting.
 */
export function defaultWho(counts: Pick<WaitingCounts, 'mineAsked'>): WhoPill {
  return counts.mineAsked > 0 ? 'mine' : 'everyone'
}

/**
 * The pills to draw after the reader's own: each person with a question waiting, then everyone. The
 * reader's own seat (the owner's *The owner*) is left out, since their own pill already holds it.
 */
export function otherPills(counts: WaitingCounts, mine: readonly AskWho[]): Array<{ who: WhoPill; label: string; count: number }> {
  const people = ASK_WHO.filter((w) => counts.by[w] > 0 && w !== mine[0]).map((w) => ({
    who: w as WhoPill,
    label: ASK_WHO_LABEL[w],
    count: counts.by[w],
  }))
  return [...people, { who: 'everyone', label: 'Everyone', count: counts.everyone }]
}

/** The line over the list: "7 cards wait on you, Max." or who the pill names. */
export function waitingHeadline(who: WhoPill, count: number, firstName: string): string {
  const cards = count === 1 ? '1 card waits' : `${count} cards wait`
  if (who === 'mine') return `${cards} on you${firstName ? `, ${firstName}` : ''}.`
  if (who === 'everyone') return `${cards} on a person.`
  return `${cards} on ${whoInSentence(who)}.`
}

/** "the owner", "anyone at hand": the label as it reads inside a sentence. */
export function whoInSentence(who: AskWho): string {
  const label = ASK_WHO_LABEL[who]
  return label.charAt(0).toLowerCase() + label.slice(1)
}

/** The folded line's words: "#189 Go ahead · #284 Change". */
export function answeredLine(cards: readonly AskedCard[], picks: PickMap): string {
  return cards
    .map((it) => {
      const a = answerOf(it, picks[it.slug])
      return a ? `#${it.number} ${ANSWER_LABEL[a]}` : ''
    })
    .filter(Boolean)
    .join(' · ')
}

/** What a press on an answer saves: the pick, and the question it answers ('' when the press takes the answer back). */
export function answerPatch(item: Pick<AskedCard, 'ask'>, current: AnswerPick | '', clicked: AnswerPick): { pick: AnswerPick | ''; answersAsk: string } {
  const pick = nextAnswer(current, clicked)
  return { pick, answersAsk: pick ? item.ask.question : '' }
}

/** "Nov 24" from the page's `2026-11-24`; '' when the page does not say its day. */
export function drawnLabel(drawn: string, locale?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(drawn)
  if (!m) return ''
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

/** "5 pictures, drawn Nov 24" for the row's small line; '' when the card has no pictures page. */
export function picturesLine(pictures: BoardItem['pictures'], locale?: string): string {
  if (!pictures?.page || pictures.count < 1) return ''
  const n = pictures.count === 1 ? '1 picture' : `${pictures.count} pictures`
  const day = drawnLabel(pictures.drawn, locale)
  return day ? `${n}, drawn ${day}` : n
}
