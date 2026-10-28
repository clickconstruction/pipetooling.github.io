import { describe, expect, it } from 'vitest'
import type { Tile } from '../messages/weekStrip'
import type { WalkKit } from './kit'
import {
  MAIL_WAIT_MS,
  POLL_MS,
  STEPS,
  deliveredText,
  emptyReport,
  errorWords,
  estimateTextWords,
  finishReport,
  inboundLine,
  isSeedLine,
  openedLine,
  outboundCount,
  outboundLine,
  ownKeys,
  parseWalkFlags,
  pressWindowStart,
  reportKit,
  reportLines,
  secretsOut,
  seedLine,
  stepHeld,
  stepSkipped,
  stepWent,
  stoppedForTeam,
  strayRows,
  stripDifference,
  waitSaw,
  waitUntil,
  waitedWords,
  type ThreadLine,
} from './walkRun'

const KIT: WalkKit = {
  customerId: 'cu-walk',
  contactId: 'c-walk',
  emailChannelId: 'ch-walk-email',
  phoneChannelId: 'ch-walk-phone',
  estimateId: 'e-walk',
  email: 'bids@clickplumbing.example',
  phone: '(737) 300-9478',
  testerId: 'u-tester',
  sharedPhone: false,
  madeAt: '2026-10-22T14:00:00.000Z',
}

const line = (patch: Partial<ThreadLine> & Pick<ThreadLine, 'id' | 'channel' | 'direction' | 'at'>): ThreadLine => ({
  quo_id: null,
  channel_id: 'ch-walk-phone',
  who_text: '',
  body: '',
  delivery: null,
  mailbox: null,
  ...patch,
})

describe('parseWalkFlags', () => {
  it('reads each flag and names the unknown ones', () => {
    expect(parseWalkFlags([])).toEqual({ flags: { keep: false, ownerPresses: false, fallbackPhone: false, answer: false, cleanupOnly: false }, unknown: [] })
    expect(parseWalkFlags(['--keep', '--answer']).flags).toMatchObject({ keep: true, answer: true })
    expect(parseWalkFlags(['--owner-presses', '--fallback-phone', '--cleanup-only']).flags).toMatchObject({ ownerPresses: true, fallbackPhone: true, cleanupOnly: true })
    expect(parseWalkFlags(['--kep', 'x']).unknown).toEqual(['--kep', 'x'])
  })
})

describe('the steps and the wait', () => {
  it('lists fourteen steps in the walk’s order, the mail legs with three minutes', () => {
    expect(STEPS.map((s) => s.key)).toEqual(['setup', 'signIn', 'seedOld', 'estimateEmail', 'estimateText', 'open', 'replyEmail', 'replyText', 'stop', 'start', 'answer', 'office', 'stray', 'cleanup'])
    expect(STEPS.find((s) => s.key === 'open')?.limitMs).toBe(MAIL_WAIT_MS)
    expect(POLL_MS).toBe(15_000)
  })

  it('ends at once on a thing already there, costs no sleep, and counts one look', async () => {
    const slept: number[] = []
    const end = await waitUntil(async () => 'there', { limitMs: 60_000, sleep: async (ms) => void slept.push(ms), now: () => 0 })
    expect(end).toEqual({ found: 'there', waitedMs: 0, polls: 1, lastError: null })
    expect(slept).toEqual([])
  })

  it('polls every 15 seconds and ends after its limit with what it saw: nothing', async () => {
    let clock = 0
    const slept: number[] = []
    const end = await waitUntil(async () => null, { limitMs: 60_000, sleep: async (ms) => void (slept.push(ms), (clock += ms)), now: () => clock })
    expect(end).toEqual({ found: null, waitedMs: 60_000, polls: 5, lastError: null })
    expect(slept).toEqual([15_000, 15_000, 15_000, 15_000])
  })

  it('finds a thing that arrives on the third look', async () => {
    let clock = 0
    let looks = 0
    const end = await waitUntil(async () => (++looks === 3 ? { id: 'm-1' } : null), { limitMs: 180_000, sleep: async (ms) => void (clock += ms), now: () => clock })
    expect(end).toEqual({ found: { id: 'm-1' }, waitedMs: 30_000, polls: 3, lastError: null })
    expect(waitedWords(30_000)).toBe('30 s')
    expect(waitedWords(150_000)).toBe('2 m 30 s')
    expect(waitedWords(120_000)).toBe('2 m')
  })

  it('tries a poll that threw again on the next poll, within the limit, and tells each failure as it happens', async () => {
    let clock = 0
    let looks = 0
    const heard: string[] = []
    const end = await waitUntil(
      async () => {
        looks += 1
        if (looks < 3) throw Object.assign(new TypeError('fetch failed'), { cause: new Error('ECONNRESET') })
        return { id: 'm-1' }
      },
      { limitMs: 180_000, sleep: async (ms) => void (clock += ms), now: () => clock, onError: (words, poll) => heard.push(`${poll}: ${words}`) },
    )
    expect(end).toEqual({ found: { id: 'm-1' }, waitedMs: 30_000, polls: 3, lastError: 'TypeError: fetch failed (ECONNRESET)' })
    expect(heard).toEqual(['1: TypeError: fetch failed (ECONNRESET)', '2: TypeError: fetch failed (ECONNRESET)'])
  })

  it('a wait whose every poll throws still ends on its limit, with the last error in words for the step', async () => {
    let clock = 0
    const end = await waitUntil(
      async () => {
        throw new Error('messages: permission denied')
      },
      { limitMs: 60_000, sleep: async (ms) => void (clock += ms), now: () => clock },
    )
    expect(end).toEqual({ found: null, waitedMs: 60_000, polls: 5, lastError: 'messages: permission denied' })
    expect(waitSaw(end, 'still a draft')).toBe('still a draft; the last poll failed: messages: permission denied')
    expect(waitSaw({ lastError: null }, 'still a draft')).toBe('still a draft')
    expect(waitSaw({ lastError: null })).toBeNull()
    expect(errorWords('plain')).toBe('plain')
    expect(errorWords(Object.assign(new TypeError('fetch failed'), { cause: 'ECONNRESET' }))).toBe('TypeError: fetch failed (ECONNRESET)')
  })
})

describe('a kept kit: the press before the restart, and the one seed', () => {
  it('opens the press window at the kit’s own stamp, else at the run’s moment', () => {
    expect(pressWindowStart(KIT, '2026-10-23T09:00:00.000Z')).toBe('2026-10-22T14:00:00.000Z')
    expect(pressWindowStart({ madeAt: null }, '2026-10-23T09:00:00.000Z')).toBe('2026-10-23T09:00:00.000Z')
    expect(pressWindowStart({ madeAt: 'yesterday' }, '2026-10-23T09:00:00.000Z')).toBe('2026-10-23T09:00:00.000Z')
    expect(pressWindowStart(null, '2026-10-23T09:00:00.000Z')).toBe('2026-10-23T09:00:00.000Z')
  })

  it('finds the seed by its who or its quo_id, and the press wait never takes it for the estimate text', () => {
    const seed = line({ id: 'm-seed', channel: 'text', direction: 'out', at: '2026-10-20T09:00:00.000Z', who_text: 'ZZ walk seed', quo_id: 'walk-seed-abc' })
    const press = line({ id: 'm-press', channel: 'text', direction: 'out', at: '2026-10-22T15:00:00.000Z', quo_id: 'quo-1' })
    expect(seedLine([press])).toBeNull()
    expect(seedLine([press, seed])?.id).toBe('m-seed')
    expect(isSeedLine({ quo_id: 'walk-seed-x', who_text: '' })).toBe(true)
    expect(isSeedLine({ quo_id: null, who_text: 'ZZ walk seed' })).toBe(true)
    expect(isSeedLine({ quo_id: 'quo-1', who_text: 'ZZ Walk tester' })).toBe(false)
    // A kit older than three days: a restart's seed is newer than its stamp, and still never the press.
    expect(outboundLine([seed], 'text', '2026-10-01T00:00:00.000Z')).toBeNull()
    expect(outboundLine([seed, press], 'text', pressWindowStart(KIT, '2026-10-23T09:00:00.000Z'))?.id).toBe('m-press')
    expect(outboundCount([seed, press], 'text', '2026-10-01T00:00:00.000Z')).toBe(1)
  })
})

describe('the estimate text’s words', () => {
  it('fills the sheet’s line with the kit’s blanks', () => {
    const w = estimateTextWords({ job: 'ZZ walk estimate (delete me)', amount: '$1.00', link: 'https://clicktooling.example/estimate/accept?t=abc' })
    expect(w.text).toBe('ZZ, this is ZZ Walk tester with Click Plumbing. Your estimate for ZZ walk estimate (delete me) is ready, $1.00. Open it to approve the option you want: https://clicktooling.example/estimate/accept?t=abc')
    expect(w.left).toEqual([])
  })
})

describe('what each wait looks for on the kit’s thread', () => {
  const lines: ThreadLine[] = [
    line({ id: 'm-text-out', channel: 'text', direction: 'out', at: '2026-10-22T14:02:00.000Z', delivery: 'delivered', mailbox: 'team', quo_id: 'quo-1' }),
    line({ id: 'm-eye', channel: 'event', direction: 'out', at: '2026-10-22T14:04:00.000Z', quo_id: 'estimate:e-walk:opened', body: '👀 ZZ opened estimate #7.' }),
    line({ id: 'm-email-in', channel: 'email', direction: 'in', at: '2026-10-22T14:06:00.000Z', mailbox: 'team', channel_id: 'ch-walk-email' }),
    line({ id: 'm-text-in', channel: 'text', direction: 'in', at: '2026-10-22T14:08:00.000Z', mailbox: 'team' }),
    line({ id: 'm-old-in', channel: 'text', direction: 'in', at: '2026-10-20T14:08:00.000Z', mailbox: 'team' }),
    line({ id: 'm-email-out', channel: 'email', direction: 'out', at: '2026-10-22T14:10:00.000Z', mailbox: 'team' }),
  ]

  it('the 👀 line by its key', () => {
    expect(openedLine(lines, 'e-walk')?.id).toBe('m-eye')
    expect(openedLine(lines, 'e-other')).toBeNull()
  })

  it('their newest line in on a channel and box since the send, never an older one', () => {
    expect(inboundLine(lines, 'email', 'team', '2026-10-22T14:05:00.000Z')?.id).toBe('m-email-in')
    expect(inboundLine(lines, 'text', null, '2026-10-22T14:07:00.000Z')?.id).toBe('m-text-in')
    expect(inboundLine(lines, 'text', 'bids', '2026-10-22T14:07:00.000Z')).toBeNull()
    expect(inboundLine(lines, 'text', null, '2026-10-22T15:00:00.000Z')).toBeNull()
  })

  it('our lines out, counted since the send', () => {
    expect(outboundLine(lines, 'text', '2026-10-22T14:00:00.000Z')?.id).toBe('m-text-out')
    expect(outboundCount(lines, 'email', '2026-10-22T14:09:00.000Z')).toBe(1)
    // A minute of slack for the clocks: a send at 14:10 still counts when asked since 14:11, not since 14:12.
    expect(outboundCount(lines, 'email', '2026-10-22T14:11:00.000Z')).toBe(1)
    expect(outboundCount(lines, 'email', '2026-10-22T14:12:00.000Z')).toBe(0)
  })

  it('a text of ours delivered, and the team box’s stop on the number', () => {
    expect(deliveredText(lines, 'm-text-out')).toBe(true)
    expect(deliveredText([{ ...lines[0]!, delivery: null }], 'm-text-out')).toBe(false)
    expect(deliveredText(lines, null)).toBe(false)
    expect(stoppedForTeam({ opted_out_at: null, opted_out_by_box: { team: '2026-10-22T14:12:00.000Z' } })).toBe(true)
    expect(stoppedForTeam({ opted_out_at: null, opted_out_by_box: { team: null } })).toBe(false)
    expect(stoppedForTeam({ opted_out_at: null, opted_out_by_box: null })).toBe(false)
    expect(stoppedForTeam({ opted_out_at: '2026-10-01T00:00:00.000Z', opted_out_by_box: {} })).toBe(true)
  })
})

describe('the strip’s difference', () => {
  const tile = (key: Tile['key'], value: string, sub: string | null = null): Tile => ({ key, label: key, value, sub, door: null, tip: '' })

  it('names each tile’s value with the kit and without, and which the kit changed', () => {
    const withKit = [tile('answered', '3 of 4', '75%'), tile('estimates', '1 sent · 1 opened')]
    const without = [tile('answered', '2 of 3', '67%'), tile('estimates', 'none')]
    expect(stripDifference(withKit, without)).toEqual([
      { key: 'answered', label: 'answered', withKit: '3 of 4 · 75%', withoutKit: '2 of 3 · 67%', differs: true },
      { key: 'estimates', label: 'estimates', withKit: '1 sent · 1 opened', withoutKit: 'none', differs: true },
    ])
    expect(stripDifference([tile('longest', '12 m')], [tile('longest', '12 m')])[0]?.differs).toBe(false)
    expect(stripDifference([tile('longest', '12 m')], [])[0]?.withoutKit).toBe('none')
  })
})

describe('the stray check', () => {
  const boxes = {
    team: { address: 'team@clickplumbing.example', phone: '(512) 994-2774', numberId: 'PN-team' },
    bids: { address: 'bids@clickplumbing.example', phone: '(737) 300-9478', numberId: 'PN-bids' },
  }

  it('keys every own address and number as the database keys them', () => {
    const own = ownKeys(boxes, KIT, 'team@noreply.clicktooling.example')
    expect([...own].sort()).toEqual(['email:bids@clickplumbing.example', 'email:team@clickplumbing.example', 'email:team@noreply.clicktooling.example', 'phone:5129942774', 'phone:7373009478'])
    expect(ownKeys(null, null).size).toBe(1)
  })

  it('names a contact made during the run that carries one, never the kit’s and never an older contact', () => {
    const own = ownKeys(boxes, KIT)
    const contacts = [
      { id: 'c-walk', kind: 'customer', created_at: '2026-10-22T14:00:30.000Z', channels: [{ kind: 'email', key: 'bids@clickplumbing.example' }] },
      { id: 'c-stray', kind: 'unknown', created_at: '2026-10-22T14:03:00.000Z', channels: [{ kind: 'phone', key: '5129942774' }] },
      { id: 'c-old', kind: 'trade', created_at: '2026-10-12T14:03:00.000Z', channels: [{ kind: 'email', key: 'bids@clickplumbing.example' }] },
      { id: 'c-dana', kind: 'customer', created_at: '2026-10-22T14:05:00.000Z', channels: [{ kind: 'phone', key: '5125550100' }] },
    ]
    expect(strayRows(contacts, own, 'c-walk', '2026-10-22T14:00:00.000Z')).toEqual([{ contactId: 'c-stray', kind: 'unknown', madeAt: '2026-10-22T14:03:00.000Z', carries: 'phone 5129942774' }])
  })
})

describe('the report', () => {
  const flags = parseWalkFlags([]).flags

  it('is green when every step went, no stray, and cleanup answered counts', () => {
    const r = emptyReport('2026-10-22T14:00:00.000Z', flags)
    r.kit = reportKit(KIT)
    r.steps = [stepWent('setup'), stepWent('replyText', { sentAt: '2026-10-22T14:08:00.000Z', landedAt: '2026-10-22T14:08:40.000Z', where: 'text in, box team', waitedFor: '40 s' })]
    r.strays = []
    r.cleanup = { cleaned: true, counts: { messages: 6, contacts: 1, customers: 1, estimates: 1 } }
    const done = finishReport(r, '2026-10-22T14:20:00.000Z')
    expect(done.ok).toBe(true)
    expect(done.held).toEqual([])
    expect(done.kit).toEqual({ customerId: 'cu-walk', contactId: 'c-walk', estimateId: 'e-walk', emailChannelId: 'ch-walk-email', phoneChannelId: 'ch-walk-phone', sharedPhone: false })
    const lines = reportLines(done)
    expect(lines[0]).toBe('Walk started 2026-10-22 14:00:00 UTC, finished 2026-10-22 14:20:00 UTC.')
    expect(lines[1]).toBe('Green: every step went, no stray contact, cleaned up.')
    expect(lines).toContain('  ✓ Reply by text from the bids number · sent 2026-10-22 14:08:00 · landed 2026-10-22 14:08:40 · text in, box team · waited 40 s')
    expect(lines).toContain('Stray check: no contact made during the run carries an own address or number.')
    expect(lines).toContain('Cleaned up: messages 6, contacts 1, customers 1, estimates 1.')
  })

  it('is not green when a step held, a stray was made, or cleanup refused; a kept kit says how to clean it', () => {
    const r = emptyReport('2026-10-22T14:00:00.000Z', flags)
    r.steps = [stepWent('setup'), stepHeld('open', 'the estimate email never arrived', { waitedFor: '3 m', saw: 'bids@ had no email from the app’s sender' }), stepSkipped('replyEmail', 'the estimate email never arrived')]
    r.strays = [{ contactId: 'c-stray', kind: 'unknown', madeAt: '2026-10-22T14:03:00.000Z', carries: 'phone 5129942774' }]
    r.cleanup = { cleaned: false, words: 'The walk kit cannot be cleaned up: a job is on the kit’s customer.' }
    const done = finishReport(r, '2026-10-22T14:20:00.000Z')
    expect(done.ok).toBe(false)
    expect(done.held).toEqual(['Open the estimate from the bids inbox: the estimate email never arrived'])
    const lines = reportLines(done)
    expect(lines).toContain('  ✗ Open the estimate from the bids inbox · waited 3 m · saw: bids@ had no email from the app’s sender · held: the estimate email never arrived')
    expect(lines).toContain('  – Reply by email from bids@ · not run: the estimate email never arrived')
    expect(lines.some((l) => l.startsWith('Stray check: 1 stray contact(s): unknown c-stray carries phone 5129942774'))).toBe(true)
    expect(lines).toContain('Cleanup: The walk kit cannot be cleaned up: a job is on the kit’s customer.')

    const kept = finishReport({ ...emptyReport('2026-10-22T14:00:00.000Z', { ...flags, keep: true }), steps: [stepWent('setup')], strays: [] }, '2026-10-22T14:01:00.000Z')
    expect(kept.ok).toBe(true)
    expect(reportLines(kept)).toContain('Kept: the kit’s rows stay (--keep). Run `npm run walk -- --cleanup-only` to remove them.')
  })
})

describe('secretsOut', () => {
  it('replaces every secret and every accept link by its last four characters, and leaves short values alone', () => {
    const text = 'anon eyJhbGciOiJIUzI1NiJ9.anon-key-value signed with dev-login-secret-9 at https://clicktooling.example/estimate/accept?t=abcdef0123 (port 9)'
    expect(secretsOut(text, ['eyJhbGciOiJIUzI1NiJ9.anon-key-value', 'dev-login-secret-9', '9', null, undefined])).toBe('anon …alue signed with …et-9 at …0123 (port 9)')
    expect(secretsOut('nothing here', ['tester-jwt-value'])).toBe('nothing here')
  })
})
