import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  boxForKind,
  boxForNew,
  boxForReply,
  boxOfInbound,
  boxSetting,
  fromNumberFor,
  fromWords,
  lastWroteTo,
  mailboxFor,
  NO_BOX_FALLBACK,
  orderHitsByBox,
  parseBoxSettings,
  numberName,
  phoneWords,
  sendBox,
  stoppedOn,
  stopScope,
  type BoxFallback,
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

  it('never places words that are not an address on a box with no address yet', () => {
    const empty: BoxSettings = { team: { address: '', phone: '', numberId: '' }, bids: SETTINGS.bids }
    expect(boxOfInbound({ toAddress: 'undisclosed-recipients:;' }, empty)).toBeNull()
    expect(boxOfInbound({ toNumberId: '' }, empty)).toBeNull()
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

  it('keeps when they first stopped on a STOP again', () => {
    const stopped = { ...DANA_CELL, optedOutByBox: { team: '2026-10-01T12:00:00.000Z' } }
    expect(stopScope(stopped, 'stop', 'team', AT).optedOutByBox).toEqual({ team: '2026-10-01T12:00:00.000Z' })
    const old: StopChannel = { channelId: 'dana-phone', optedOutAt: '2026-09-01T12:00:00.000Z' }
    expect(stopScope(old, 'stop', 'bids', AT).optedOutByBox).toEqual({ bids: '2026-09-01T12:00:00.000Z' })
    const started = { ...DANA_CELL, optedOutByBox: { team: null } }
    expect(stopScope(started, 'stop', 'team', AT).optedOutByBox).toEqual({ team: AT })
  })

  it('reads an older STOP from before two numbers as every number, until a box says otherwise', () => {
    const old: StopChannel = { channelId: 'dana-phone', optedOutAt: '2026-09-01T12:00:00.000Z' }
    expect([stoppedOn(old, 'team'), stoppedOn(old, 'bids')]).toEqual([true, true])
    const restarted = { ...old, optedOutByBox: stopScope(old, 'start', 'team', AT).optedOutByBox }
    expect([stoppedOn(restarted, 'team'), stoppedOn(restarted, 'bids')]).toEqual([false, true])
  })
})

describe('Settings’ row (parseBoxSettings)', () => {
  it('reads both boxes, each field trimmed', () => {
    expect(parseBoxSettings(JSON.stringify({ team: { address: ' team@clickplumbing.example ', phone: '(512) 555-0144', numberId: 'PNteam0144' }, bids: SETTINGS.bids }))).toEqual({
      team: SETTINGS.team,
      bids: SETTINGS.bids,
    })
  })

  it('reads the row as it ships, every field empty', () => {
    const shipped = '{"team":{"address":"","phone":"","numberId":""},"bids":{"address":"","phone":"","numberId":""}}'
    expect(parseBoxSettings(shipped)).toEqual({ team: { address: '', phone: '', numberId: '' }, bids: { address: '', phone: '', numberId: '' } })
  })

  it('reads a missing box or a field that is not text as empty', () => {
    expect(parseBoxSettings('{"team":{"address":"team@clickplumbing.example","phone":5125550144}}')).toEqual({
      team: { address: 'team@clickplumbing.example', phone: '', numberId: '' },
      bids: { address: '', phone: '', numberId: '' },
    })
  })

  it('reads no row, an empty one, or one that is not JSON as null', () => {
    expect(parseBoxSettings(null)).toBeNull()
    expect(parseBoxSettings('  ')).toBeNull()
    expect(parseBoxSettings('team@clickplumbing.example')).toBeNull()
    expect(parseBoxSettings('[1,2]')).toBeNull()
  })
})

// What an edge function would pass: today's one number and mailbox for team, the reader's grant for bids.
const SECRETS: BoxFallback = {
  team: { address: 'office@clickplumbing.example', phone: '(210) 555-0100', numberId: 'PNsecret0100' },
  bids: { address: 'bids@clickconstruction.example' },
}

describe('a box’s fields as a send uses them (boxSetting)', () => {
  it('takes Settings’ own, and each empty one from the fallback', () => {
    const half: BoxSettings = { team: { address: 'team@clickplumbing.example', phone: '', numberId: '' }, bids: SETTINGS.bids }
    expect(boxSetting('team', half, SECRETS)).toEqual({ address: 'team@clickplumbing.example', phone: '(210) 555-0100', numberId: 'PNsecret0100' })
    expect(boxSetting('bids', half, SECRETS)).toEqual(SETTINGS.bids)
  })

  it('reads the fallback alone with no row, and nothing on the client', () => {
    expect(boxSetting('team', null, SECRETS)).toEqual(SECRETS.team)
    expect(boxSetting('bids', null, SECRETS)).toEqual({ address: 'bids@clickconstruction.example', phone: '', numberId: '' })
    expect(boxSetting('team', null)).toEqual({ address: '', phone: '', numberId: '' })
    expect(boxSetting('team', null, NO_BOX_FALLBACK)).toEqual({ address: '', phone: '', numberId: '' })
  })
})

describe('the address and the number a message goes from (mailboxFor, fromNumberFor)', () => {
  it('sends Dana’s from team and Greg’s from bids', () => {
    expect(mailboxFor(DANA.kind, SETTINGS)).toBe('team@clickplumbing.example')
    expect(mailboxFor(GREG.kind, SETTINGS)).toBe('Bids@ClickConstruction.example')
    expect(fromNumberFor(DANA.kind, SETTINGS)).toEqual({ box: 'team', phone: '(512) 555-0144', numberId: 'PNteam0144' })
    expect(fromNumberFor(GREG.kind, SETTINGS)).toEqual({ box: 'bids', phone: '(512) 555-0199', numberId: 'PNbids0199' })
  })

  it('answers Elena from bids, where she wrote, though she is a customer', () => {
    expect(mailboxFor(ELENA.kind, SETTINGS, NO_BOX_FALLBACK, 'bids')).toBe('Bids@ClickConstruction.example')
    expect(fromNumberFor(ELENA.kind, SETTINGS, NO_BOX_FALLBACK, 'bids').numberId).toBe('PNbids0199')
  })

  it('starts an unknown sender’s conversation from team', () => {
    expect(fromNumberFor(UNKNOWN.kind, SETTINGS).box).toBe('team')
  })

  it('falls back to today’s secrets on the edge and to nothing on the client while Settings is empty', () => {
    expect(fromNumberFor(DANA.kind, null, SECRETS)).toEqual({ box: 'team', phone: '(210) 555-0100', numberId: 'PNsecret0100' })
    expect(mailboxFor(GREG.kind, null, SECRETS)).toBe('bids@clickconstruction.example')
    expect(mailboxFor(DANA.kind, null)).toBe('')
    expect(fromNumberFor(DANA.kind, null)).toEqual({ box: 'team', phone: '', numberId: '' })
  })
})

describe('the box they last wrote to (lastWroteTo)', () => {
  it('is their newest line in that names a box', () => {
    const lines = [
      { direction: 'in', at: '2026-10-10T14:00:00Z', mailbox: 'team' as const },
      { direction: 'in', at: '2026-10-11T09:00:00Z', mailbox: 'bids' as const },
      { direction: 'out', at: '2026-10-12T09:00:00Z', mailbox: 'team' as const },
      { direction: 'in', at: '2026-10-12T10:00:00Z', mailbox: null },
    ]
    expect(lastWroteTo(lines)).toBe('bids')
  })

  it('is null when no line in names one', () => {
    expect(lastWroteTo([{ direction: 'in', at: '2026-10-12T10:00:00Z' }])).toBeNull()
    expect(lastWroteTo([])).toBeNull()
  })
})

describe('Who is this? in the box’s order (orderHitsByBox)', () => {
  const hits = [
    { label: 'Greg Hill', kind: 'trade' },
    { label: 'Dana Whitfield', kind: 'customer' },
    { label: 'Fergus Supply', kind: 'supply_house' },
    { label: 'Elena Marchetti', kind: 'customer' },
  ]
  const order = (box: 'team' | 'bids' | null) => orderHitsByBox(hits, box).map((h) => h.label)

  it('puts the customers first on the team line, each group as it came', () => {
    expect(order('team')).toEqual(['Dana Whitfield', 'Elena Marchetti', 'Greg Hill', 'Fergus Supply'])
  })

  it('puts the trade partners and the supply houses first on bids@', () => {
    expect(order('bids')).toEqual(['Greg Hill', 'Fergus Supply', 'Dana Whitfield', 'Elena Marchetti'])
  })

  it('keeps the order they came in when the box is not known, and never changes the list it was given', () => {
    expect(order(null)).toEqual(hits.map((h) => h.label))
    expect(hits[0]!.label).toBe('Greg Hill')
  })
})

describe('the box a text goes from (sendBox, R6 PR 4)', () => {
  it('sends from the box wanted when it has a number, else from the company number', () => {
    // As quo-send reads them before the row names a bids number: today's secrets fill the team box.
    const today: BoxSettings = { team: boxSetting('team', null, SECRETS), bids: boxSetting('bids', null, SECRETS) }
    expect(sendBox('bids', today)).toBe('team')
    expect(sendBox('team', today)).toBe('team')
    expect(sendBox('bids', SETTINGS)).toBe('bids')
  })

  it('names each number', () => {
    expect([numberName('team'), numberName('bids')]).toEqual(['the company number', 'the bids number'])
  })
})
