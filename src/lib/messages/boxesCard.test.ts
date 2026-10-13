import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { boxOfInbound, parseBoxSettings, phoneWords, type BoxSettings } from './boxes'
import {
  BOX_EMPTY_WORDS,
  BOXES_INTRO,
  BOXES_NOT_SAVED,
  BOXES_SAVED_TOAST,
  BOXES_WHEN,
  EMPTY_BOXES,
  boxForWords,
  boxesFromRow,
  boxesProblem,
  boxesText,
  cleanBoxes,
  phoneAsKept,
  phoneDigits,
  sameBoxes,
} from './boxesCard'

const boxes = (team: Partial<BoxSettings['team']> = {}, bids: Partial<BoxSettings['bids']> = {}): BoxSettings => ({
  team: { address: '', phone: '', numberId: '', ...team },
  bids: { address: '', phone: '', numberId: '', ...bids },
})

describe('the Inboxes card', () => {
  it('reads a row not there, or not JSON, as every field empty', () => {
    expect(boxesFromRow(null)).toEqual(EMPTY_BOXES)
    expect(boxesFromRow('nope')).toEqual(EMPTY_BOXES)
    expect(boxesFromRow('{"team":{"address":"team@plumbing.example"}}').team.address).toBe('team@plumbing.example')
  })

  it('keeps a phone typed any way with ten digits as the company number reads, and reads it back in plain words', () => {
    for (const typed of ['5125550144', '512-555-0144', '+1 (512) 555 0144', ' 512.555.0144 ']) expect(phoneAsKept(typed)).toBe('(512) 555-0144')
    expect(phoneWords(phoneAsKept('5125550144'))).toBe('512-555-0144')
    expect(phoneAsKept(' 555-0144 ')).toBe('555-0144')
    expect(phoneDigits('555-0144')).toBe('')
  })

  it('trims the address and the Quo id and keeps the address’s case', () => {
    const c = cleanBoxes(boxes({ address: ' Team@Plumbing.example ', phone: '5125550144', numberId: ' PNteam01 ' }))
    expect(c.team).toEqual({ address: 'Team@Plumbing.example', phone: '(512) 555-0144', numberId: 'PNteam01' })
  })

  it('writes the row the reader reads back, the same boxes giving the same words', () => {
    const typed = boxes({ address: 'team@plumbing.example', phone: '512 555 0144', numberId: 'PNteam01' }, { address: 'bids@construction.example' })
    const text = boxesText(typed)
    expect(parseBoxSettings(text)).toEqual(cleanBoxes(typed))
    expect(sameBoxes(typed, cleanBoxes(typed))).toBe(true)
    expect(sameBoxes(typed, boxes())).toBe(false)
    // The reader routes a line by the saved id and address, whatever case the address was typed in.
    const saved = parseBoxSettings(text)!
    expect(boxOfInbound({ toNumberId: 'PNteam01' }, saved)).toBe('team')
    expect(boxOfInbound({ toAddress: 'Click Bids <BIDS@construction.example>' }, saved)).toBe('bids')
  })

  it('says who each box is for, from the box rules', () => {
    expect(boxForWords('team')).toBe('For customers, leads, subs and candidates.')
    expect(boxForWords('bids')).toBe('For trade partners, architects and supply houses.')
  })

  it('lets every field empty be saved, and a full pair', () => {
    expect(boxesProblem(EMPTY_BOXES)).toBeNull()
    expect(
      boxesProblem(boxes({ address: 'team@plumbing.example', phone: '5125550144', numberId: 'PNteam01' }, { address: 'bids@construction.example', phone: '2105550100', numberId: 'PNbids01' })),
    ).toBeNull()
  })

  it('stops a save in words: the address, the phone, the Quo id, and the phone and id together', () => {
    expect(boxesProblem(boxes({ address: 'team at plumbing' }))).toBe('The Team inbox’s address does not look like an email address.')
    expect(boxesProblem(boxes({ phone: '555-0144', numberId: 'PNteam01' }))).toBe('Give the Team inbox a phone number with ten digits.')
    expect(boxesProblem(boxes({}, { phone: '2105550100', numberId: 'US0bids' }))).toBe('The Bids inbox’s Quo number id starts with PN.')
    expect(boxesProblem(boxes({ phone: '5125550144' }))).toBe('Give the Team inbox its phone and its Quo number id together, or neither.')
    expect(boxesProblem(boxes({}, { numberId: 'PNbids01' }))).toBe('Give the Bids inbox its phone and its Quo number id together, or neither.')
  })

  it('stops two inboxes sharing an address, a phone or a Quo id', () => {
    expect(boxesProblem(boxes({ address: 'office@plumbing.example' }, { address: ' OFFICE@plumbing.example' }))).toBe('The two inboxes cannot share an address.')
    expect(boxesProblem(boxes({ phone: '5125550144', numberId: 'PNa' }, { phone: '(512) 555-0144', numberId: 'PNb' }))).toBe('The two inboxes cannot share a phone number.')
    expect(boxesProblem(boxes({ phone: '5125550144', numberId: 'PNsame' }, { phone: '2105550100', numberId: 'PNsame' }))).toBe('The two inboxes cannot share a Quo number id.')
  })

  it('holds every sentence it shows to the plain-words rules', () => {
    const words = [
      BOXES_INTRO,
      BOXES_WHEN,
      BOXES_SAVED_TOAST,
      BOXES_NOT_SAVED,
      boxForWords('team'),
      boxForWords('bids'),
      ...Object.values(BOX_EMPTY_WORDS),
      boxesProblem(boxes({ address: 'x' }))!,
      boxesProblem(boxes({ phone: '1', numberId: 'PNa' }))!,
      boxesProblem(boxes({ phone: '5125550144', numberId: 'x' }))!,
      boxesProblem(boxes({ phone: '5125550144' }))!,
      boxesProblem(boxes({ address: 'a@b.co' }, { address: 'a@b.co' }))!,
    ]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
