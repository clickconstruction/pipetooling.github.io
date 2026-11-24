import { describe, expect, it } from 'vitest'
import type { PickMap, PickRecord } from './punchListView'
import {
  answerOf,
  answerPatch,
  answeredLine,
  defaultWho,
  drawnLabel,
  isAsked,
  mineFor,
  otherPills,
  picturesLine,
  waitingCounts,
  waitingHeadline,
  waitingRows,
  waitingViewLabel,
  type AskedCard,
} from './punchListWaiting'
import type { BoardItem } from './todoBoard'

function card(number: number, ask: BoardItem['ask'], over: Partial<BoardItem> = {}): BoardItem {
  return {
    slug: `card-${number}`,
    number,
    group: 'close',
    name: `Card ${number}`,
    file: `to-dos/card-${number}.md`,
    pointer: false,
    flagged: false,
    summary: '',
    next: '',
    size: 'S',
    blocker: '',
    ver: '',
    opinion: '',
    mockups: [],
    artifacts: [],
    mockup: 'has',
    mockupNote: '',
    ask,
    ...over,
  }
}

const rec = (pick: PickRecord['pick'], answersAsk: string, note = ''): PickRecord => ({ pick, note, answersAsk, at: '2026-11-24T15:00:00Z', by: 'u1', byName: 'Max Sample' })

const WALK = card(396, { who: 'owner', kind: 'walk', question: 'Walk the pace card with one superintendent.' })
const LOOK = card(426, { who: 'owner', kind: 'look', question: 'Try the swipe on My Bids.' })
const HAND = card(421, { who: 'anyone', kind: 'walk', question: 'Be at hand for the walk.' })
const COUNSEL = card(350, { who: 'counsel', kind: 'decide', question: 'Give the words for sentence 2.' })
const PLAIN = card(100, null)
const CARDS = [WALK, LOOK, HAND, COUNSEL, PLAIN]

describe('who a card waits on', () => {
  it('counts a card with a question and leaves out a card with none, and a standing list', () => {
    expect(isAsked(WALK)).toBe(true)
    expect(isAsked(PLAIN)).toBe(false)
    expect(isAsked(card(5, WALK.ask, { pointer: true }))).toBe(false)
  })

  it("gives the owner the owner's questions and anyone's, and a dev the dev's and anyone's", () => {
    expect(mineFor('master_technician')).toEqual(['owner', 'anyone'])
    expect(mineFor('dev')).toEqual(['dev', 'anyone'])
    expect(mineFor('assistant')).toEqual([])
    expect(mineFor(null)).toEqual([])
  })
})

describe('an answer', () => {
  it('is the pick made on the question the card asks today', () => {
    expect(answerOf(WALK as AskedCard, rec('do', WALK.ask!.question))).toBe('do')
    expect(answerOf(WALK as AskedCard, rec('change', WALK.ask!.question))).toBe('change')
    expect(answerOf(WALK as AskedCard, rec('later', WALK.ask!.question))).toBe('later')
  })

  it('stops counting when the card asks something else', () => {
    expect(answerOf(WALK as AskedCard, rec('do', 'An older question.'))).toBe('')
  })

  it('is not a Drop from the sorting control, nor a pick with no question kept', () => {
    expect(answerOf(WALK as AskedCard, rec('drop', WALK.ask!.question))).toBe('')
    expect(answerOf(WALK as AskedCard, rec('do', ''))).toBe('')
    expect(answerOf(WALK as AskedCard, undefined)).toBe('')
  })

  it('saves the question with the pick, and clears both when the pressed answer is pressed again', () => {
    expect(answerPatch(WALK as AskedCard, '', 'change')).toEqual({ pick: 'change', answersAsk: WALK.ask!.question })
    expect(answerPatch(WALK as AskedCard, 'do', 'later')).toEqual({ pick: 'later', answersAsk: WALK.ask!.question })
    expect(answerPatch(WALK as AskedCard, 'do', 'do')).toEqual({ pick: '', answersAsk: '' })
  })
})

describe('the rows', () => {
  const picks: PickMap = { [LOOK.slug]: rec('do', LOOK.ask!.question) }

  it('lists the unanswered cards the newest first and folds the answered ones', () => {
    const rows = waitingRows(CARDS, picks, 'everyone', ['owner', 'anyone'])
    expect(rows.waiting.map((c) => c.number)).toEqual([421, 396, 350])
    expect(rows.answered.map((c) => c.number)).toEqual([426])
  })

  it("narrows to the reader's own and to one person", () => {
    expect(waitingRows(CARDS, {}, 'mine', ['owner', 'anyone']).waiting.map((c) => c.number)).toEqual([426, 421, 396])
    expect(waitingRows(CARDS, {}, 'counsel', ['owner', 'anyone']).waiting.map((c) => c.number)).toEqual([350])
    expect(waitingRows(CARDS, {}, 'mine', []).waiting).toEqual([])
  })

  it('puts a card back in the list when its question changes after the answer', () => {
    const asksAgain = { ...LOOK, ask: { ...LOOK.ask!, question: 'Try it again after the fix.' } }
    const rows = waitingRows([asksAgain], picks, 'everyone', [])
    expect(rows.waiting.map((c) => c.number)).toEqual([426])
    expect(rows.answered).toEqual([])
  })

  it('counts what still waits, by who', () => {
    const counts = waitingCounts(CARDS, picks, ['owner', 'anyone'])
    expect(counts.mine).toBe(2)
    expect(counts.everyone).toBe(3)
    expect(counts.by.owner).toBe(1)
    expect(counts.by.anyone).toBe(1)
    expect(counts.by.counsel).toBe(1)
    expect(counts.asked).toBe(4)
    expect(counts.mineAsked).toBe(3)
  })
})

describe('the words', () => {
  it('names the View pill from the counts', () => {
    expect(waitingViewLabel({ mine: 7, everyone: 15, mineAsked: 8 })).toBe('Waiting on me 7')
    expect(waitingViewLabel({ mine: 0, everyone: 15, mineAsked: 0 })).toBe('Waiting on a person 15')
    // Every question of the reader answered: the pill still counts theirs.
    expect(waitingViewLabel({ mine: 0, everyone: 6, mineAsked: 8 })).toBe('Waiting on me 0')
  })

  it("opens on the reader's own questions when a card asks them, answered or not", () => {
    expect(defaultWho({ mineAsked: 2 })).toBe('mine')
    expect(defaultWho({ mineAsked: 0 })).toBe('everyone')
  })

  it("draws a pill for each person who has a question, without the reader's own seat, then everyone", () => {
    const counts = waitingCounts(CARDS, {}, ['owner', 'anyone'])
    expect(otherPills(counts, ['owner', 'anyone'])).toEqual([
      { who: 'anyone', label: 'Anyone at hand', count: 1 },
      { who: 'counsel', label: 'Counsel', count: 1 },
      { who: 'everyone', label: 'Everyone', count: 4 },
    ])
  })

  it('says how many wait and on whom', () => {
    expect(waitingHeadline('mine', 7, 'Max')).toBe('7 cards wait on you, Max.')
    expect(waitingHeadline('mine', 1, '')).toBe('1 card waits on you.')
    expect(waitingHeadline('counsel', 1, 'Max')).toBe('1 card waits on counsel.')
    expect(waitingHeadline('anyone', 2, 'Max')).toBe('2 cards wait on anyone at hand.')
    expect(waitingHeadline('everyone', 15, 'Max')).toBe('15 cards wait on a person.')
  })

  it('writes the folded line from the answers', () => {
    const picks: PickMap = { [WALK.slug]: rec('do', WALK.ask!.question), [LOOK.slug]: rec('change', LOOK.ask!.question, 'Fix the bar first.') }
    expect(answeredLine([LOOK as AskedCard, WALK as AskedCard], picks)).toBe('#426 Change · #396 Go ahead')
  })

  it('says how many pictures and the day they were drawn', () => {
    expect(drawnLabel('2026-11-24', 'en-US')).toBe('Nov 24')
    expect(drawnLabel('')).toBe('')
    expect(picturesLine({ page: 'to-dos/x/pictures.html', count: 5, drawn: '2026-11-24', drawnAt: '', stale: false, lead: null }, 'en-US')).toBe('5 pictures, drawn Nov 24')
    expect(picturesLine({ page: 'to-dos/x/pictures.html', count: 1, drawn: '', drawnAt: '', stale: false, lead: null })).toBe('1 picture')
    expect(picturesLine({ page: null, count: 0, drawn: '', drawnAt: '', stale: false, lead: { kind: 'built', path: 'to-dos/x/pictures-lead.webp' } })).toBe('')
    expect(picturesLine(null)).toBe('')
  })
})
