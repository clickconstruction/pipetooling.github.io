import { describe, expect, it } from 'vitest'
import type { LienBoard, LienBoardTile } from '../jobs/lienBoard'
import { needsYouDashboardDoor } from '../phoneLayout/needsYouPlace'
import type { PageMode } from '../pageMode'
import { plainWordsFailures } from '../plainWords'
import { lienDeskCard, lienDeskCardShown } from './lienDeskCard'

const tile = (key: LienBoardTile['key'], figure: string, label: string, tone: LienBoardTile['tone'], line: string | null = null): LienBoardTile => ({ key, figure, label, line, tone, destination: null })

/** A Board with fourteen papers due, three of them late, six waiting on the leader and five in the run. */
const board = (over: Partial<Record<LienBoardTile['key'], LienBoardTile>> = {}, dayWords: string | null = 'Dec 15'): Pick<LienBoard, 'tiles' | 'dayWords'> => ({
  dayWords,
  tiles: [
    over.by_day ?? tile('by_day', '14', 'by Dec 15 · 8 to file · 6 to send', 'red', '3 are past their day.'),
    over.waiting ?? tile('waiting', '6', 'waiting on the leader', 'violet', '6 to sign'),
    over.in_mail ?? tile('in_mail', '5', 'to print and mail', 'amber', '1 to print · 4 to mail'),
    over.unpaid ?? tile('unpaid', '$86,400', 'unpaid on the desk', 'quiet'),
  ],
})

describe('the Lien desk’s card on the Dashboard', () => {
  it('draws three of the Board’s four tiles, in the Board’s order, and never the unpaid amount', () => {
    const card = lienDeskCard(board(), { viewerIsLeader: false })
    expect(card.values.map((v) => v.key)).toEqual(['by_day', 'waiting', 'in_mail'])
    expect(JSON.stringify(card)).not.toContain('86,400')
    expect(JSON.stringify(card)).not.toContain('unpaid')
  })

  it('says the day in two words, and keeps the tile’s parts off the card', () => {
    const [day] = lienDeskCard(board(), { viewerIsLeader: false }).values
    expect(day).toEqual({ key: 'by_day', figure: '14', words: 'by Dec 15', tone: 'red' })
    expect(lienDeskCard(board({ by_day: tile('by_day', '0', 'nothing dated', 'quiet') }, null), { viewerIsLeader: false }).values[0]).toEqual({ key: 'by_day', figure: '0', words: 'nothing dated', tone: null })
  })

  it('says you to the person the count waits on, and the tile’s own words to everyone else', () => {
    expect(lienDeskCard(board(), { viewerIsLeader: true }).values[1]).toEqual({ key: 'waiting', figure: '6', words: 'wait on you', tone: null })
    expect(lienDeskCard(board({ waiting: tile('waiting', '1', 'waiting on the leader', 'violet') }), { viewerIsLeader: true }).values[1]!.words).toBe('waits on you')
    expect(lienDeskCard(board(), { viewerIsLeader: false }).values[1]!.words).toBe('waiting on the leader')
    expect(lienDeskCard(board({ waiting: tile('waiting', '6', 'waiting on Sam', 'violet') }), { viewerIsLeader: false }).values[1]!.words).toBe('waiting on Sam')
  })

  it('colors the day’s count alone: the leader’s violet and the run’s amber stay on the Board', () => {
    const card = lienDeskCard(board(), { viewerIsLeader: false })
    expect(card.values.map((v) => v.tone)).toEqual(['red', null, null])
    const calm = lienDeskCard(board({ by_day: tile('by_day', '14', 'by Dec 15', 'amber') }), { viewerIsLeader: false })
    expect(calm.values.map((v) => v.tone)).toEqual([null, null, null])
  })

  it('carries the day tile’s red line in the Board’s own words, and no line while nothing is late or at risk', () => {
    expect(lienDeskCard(board(), { viewerIsLeader: true }).line).toBe('3 are past their day.')
    expect(lienDeskCard(board({ by_day: tile('by_day', '2', 'by tomorrow', 'red', '2 will not make tomorrow as they stand.') }), { viewerIsLeader: true }).line).toBe('2 will not make tomorrow as they stand.')
    // Red because the day is tomorrow, with every paper on track: the count is red and there is no line.
    expect(lienDeskCard(board({ by_day: tile('by_day', '2', 'by tomorrow', 'red') }), { viewerIsLeader: true }).line).toBeNull()
    expect(lienDeskCard(board({ by_day: tile('by_day', '14', 'by Dec 15', 'amber') }), { viewerIsLeader: true }).line).toBeNull()
  })

  it('writes words a first-timer can read', () => {
    for (const viewerIsLeader of [true, false]) {
      const card = lienDeskCard(board(), { viewerIsLeader })
      for (const v of card.values) expect(plainWordsFailures(`${v.figure} ${v.words}.`), v.words).toEqual([])
      expect(plainWordsFailures(card.line ?? '')).toEqual([])
    }
  })
})

describe('where the Lien desk’s card stands', () => {
  it('stands above the Needs you card on a page with no door', () => {
    expect(lienDeskCardShown({ door: false, cardsStay: false, bannersHidden: false })).toBe(true)
  })

  it('stands under a door that keeps the cards', () => {
    expect(lienDeskCardShown({ door: true, cardsStay: true, bannersHidden: false })).toBe(true)
  })

  it('goes to the Inbox tab with the list under the office person’s older door, as it has since v2.3883', () => {
    expect(lienDeskCardShown({ door: true, cardsStay: false, bannersHidden: false })).toBe(false)
  })

  it('is not drawn on Job Mode’s own Dashboard, which draws no banners', () => {
    expect(lienDeskCardShown({ door: true, cardsStay: true, bannersHidden: true })).toBe(false)
    expect(lienDeskCardShown({ door: false, cardsStay: false, bannersHidden: true })).toBe(false)
  })

  it('every page the Dashboard plans: only the office person’s Dispatch Mode door is without it', () => {
    for (const newPhoneLayout of [false, true]) {
      for (const phoneOffice of [false, true]) {
        for (const mode of ['dispatch', 'job', 'task', 'full'] as PageMode[]) {
          const plan = needsYouDashboardDoor({ newPhoneLayout, phoneOffice, mode })
          const shown = lienDeskCardShown({ door: plan != null, cardsStay: plan?.cardsStay ?? false, bannersHidden: false })
          expect(shown, `${newPhoneLayout} ${phoneOffice} ${mode}`).toBe(!(phoneOffice && mode === 'dispatch'))
        }
      }
    }
  })
})
