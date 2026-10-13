import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  boxForKind,
  boxForNew,
  boxForReply,
  boxOfInbound,
  fromWords,
  phoneWords,
  stoppedOn,
  stopScope,
  type BoxSettings,
  type StopChannel,
} from './boxes'

// Made-up settings: what `messages_boxes_v1` would hold.
const SETTINGS: BoxSettings = {
  team: { address: 'team@clickplumbing.example', phone: '(512) 555-0144', numberId: 'PNteam0144' },
  bids: { address: 'Bids@ClickConstruction.example', phone: '(512) 555-0199', numberId: 'PNbids0199' },
}

// Dana Whitfield, a residential customer; Greg Hill, a trade partner; Elena Marchetti, a GC customer who wrote to bids@.
const DANA = { kind: 'customer' }
const GREG = { kind: 'trade' }
const ELENA = { kind: 'customer' }
const UNKNOWN = { kind: 'unknown' }

describe('which box', () => {
  it('holds the plumbing company’s people on team and the GC side’s on bids', () => {
    expect(['customer', 'lead', 'sub', 'candidate'].map(boxForKind)).toEqual(['team', 'team', 'team', 'team'])
    expect(['trade', 'arch', 'supply_house'].map(boxForKind)).toEqual(['bids', 'bids', 'bids'])
    expect(boxForKind('unknown')).toBeNull()
  })

  it('starts Dana’s conversations from team and Greg’s from bids', () => {
    expect(boxForNew(DANA)).toBe('team')
    expect(boxForNew(GREG)).toBe('bids')
    expect(boxForNew(UNKNOWN)).toBe('team')
  })

  it('answers a customer who wrote to bids@ from bids@, and starts the next conversation from team', () => {
    expect(boxForReply('bids', ELENA)).toBe('bids')
    expect(boxForNew(ELENA)).toBe('team')
    expect(boxForReply('team', GREG)).toBe('team')
    expect(boxForReply(null, GREG)).toBe('bids')
    expect(boxForReply(null, UNKNOWN)).toBe('team')
  })
})

describe('fromWords', () => {
  it('names the box’s address or number, and the company', () => {
    expect(fromWords('team', 'email', SETTINGS, 'Click Plumbing')).toEqual(['from team@clickplumbing.example', 'Click Plumbing'])
    expect(fromWords('team', 'text', SETTINGS, 'Click Plumbing')).toEqual(['from the company number 512-555-0144', 'Click Plumbing'])
    expect(fromWords('bids', 'text', SETTINGS, 'Click Construction')).toEqual(['from the bids number 512-555-0199', 'Click Construction'])
  })

  it('writes a number with its area code out of parentheses', () => {
    expect(['(512) 555-0144', ' (512)555-0144', '512-555-0144'].map(phoneWords)).toEqual(['512-555-0144', '512-555-0144', '512-555-0144'])
  })

  it('passes the plain words rules', () => {
    const words = (['team', 'bids'] as const).flatMap((box) => (['text', 'email'] as const).flatMap((ch) => fromWords(box, ch, SETTINGS, 'Click Plumbing')))
    expect(words.flatMap(plainWordsFailures)).toEqual([])
  })
})

describe('boxOfInbound', () => {
  it('reads the line’s own mailbox first', () => {
    expect(boxOfInbound({ mailbox: 'bids', toNumberId: 'PNteam0144' }, SETTINGS)).toBe('bids')
  })

  it('then the number it came to, then the address it was sent to', () => {
    expect(boxOfInbound({ toNumberId: 'PNbids0199', toAddress: 'team@clickplumbing.example' }, SETTINGS)).toBe('bids')
    expect(boxOfInbound({ toNumberId: 'PNsomeoneelse', toAddress: 'Click Bids <bids@clickconstruction.example>' }, SETTINGS)).toBe('bids')
    expect(boxOfInbound({ toAddress: ' TEAM@clickplumbing.example ' }, SETTINGS)).toBe('team')
  })

  it('knows nothing when none of them place it', () => {
    expect(boxOfInbound({}, SETTINGS)).toBeNull()
    expect(boxOfInbound({ mailbox: null, toNumberId: 'PNx', toAddress: 'someone@else.example' }, SETTINGS)).toBeNull()
  })
})

describe('a STOP per number', () => {
  const DANA_CELL: StopChannel = { channelId: 'dana-phone', optedOutAt: null }
  const AT = '2026-10-12T15:00:00.000Z'

  it('silences the team number and leaves the bids number open', () => {
    const write = stopScope(DANA_CELL, 'stop', 'team', AT)
    expect(write).toEqual({ channelId: 'dana-phone', boxes: ['team'], optedOutByBox: { team: AT } })
    const after = { ...DANA_CELL, optedOutByBox: write.optedOutByBox }
    expect(stoppedOn(after, 'team')).toBe(true)
    expect(stoppedOn(after, 'bids')).toBe(false)
  })

  it('and the other way', () => {
    const after = { ...DANA_CELL, optedOutByBox: stopScope(DANA_CELL, 'stop', 'bids', AT).optedOutByBox }
    expect([stoppedOn(after, 'team'), stoppedOn(after, 'bids')]).toEqual([false, true])
  })

  it('reopens only the number a START came to', () => {
    const both = { ...DANA_CELL, optedOutByBox: { team: AT, bids: AT } }
    const after = { ...both, optedOutByBox: stopScope(both, 'start', 'team', AT).optedOutByBox }
    expect([stoppedOn(after, 'team'), stoppedOn(after, 'bids')]).toEqual([false, true])
  })

  it('reaches both numbers when the STOP came to a number it cannot place', () => {
    expect(stopScope(DANA_CELL, 'stop', null, AT)).toEqual({ channelId: 'dana-phone', boxes: ['team', 'bids'], optedOutByBox: { team: AT, bids: AT } })
  })

  it('reads an older STOP from before two numbers as every number, until a box says otherwise', () => {
    const old: StopChannel = { channelId: 'dana-phone', optedOutAt: '2026-09-01T12:00:00.000Z' }
    expect([stoppedOn(old, 'team'), stoppedOn(old, 'bids')]).toEqual([true, true])
    const restarted = { ...old, optedOutByBox: stopScope(old, 'start', 'team', AT).optedOutByBox }
    expect([stoppedOn(restarted, 'team'), stoppedOn(restarted, 'bids')]).toEqual([false, true])
  })
})
