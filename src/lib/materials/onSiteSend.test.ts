import { describe, expect, it } from 'vitest'
import type { OutboxPress } from '../offline/outbox'
import type { LandOutcome } from '../offline/landFieldPress'
import { createOutboxState } from '../offline/outboxState'
import { createOnSiteSender, isPendingOnSitePress, pendingOnSitePresses } from './onSiteSend'
import type { OnSiteWrite } from './onSiteWrites'

const write = (id: string): OnSiteWrite => ({ table: 'job_material_movements', op: 'insert', id, row: { id, job_id: 'j1', part_name: 'ZZ test elbow', quantity: 1, reason: 'used', from_container_id: 'a1' } })
const args = (id: string, jobId = 'j1') => ({ jobId, what: `1 ${id}`, writes: [write(id)], pressedAt: 1_800_000_000_000 })

async function bench(opts: { online?: boolean; allowed?: boolean; signedIn?: boolean } = {}) {
  const store = createOutboxState({ readAll: async () => [], write: async () => {}, del: async () => {}, clear: async () => {} })
  if (opts.signedIn !== false) await store.load('u1', Date.now())
  const state = { online: opts.online ?? true }
  const kept: string[] = []
  const unkept: string[] = []
  const sent: string[] = []
  /** What the office answers next, one per send; a function holds the send open until it is called. */
  const answers: Array<LandOutcome | (() => Promise<LandOutcome>)> = []
  const sender = createOnSiteSender({
    store,
    land: async (press: OutboxPress) => {
      sent.push((press.payload as unknown as { writes: OnSiteWrite[] }).writes[0]!.id)
      const next = answers.shift() ?? { kind: 'landed', result: {} }
      return typeof next === 'function' ? next() : next
    },
    online: () => state.online,
    allowed: () => opts.allowed ?? true,
    keep: (press) => void kept.push(press.id),
    unkeep: (id) => void unkept.push(id),
  })
  return { store, sender, state, kept, unkept, sent, answers }
}

describe('an on-site press leaves the phone', () => {
  it('with a signal it goes at once, and the outbox never lists it', async () => {
    const b = await bench()
    expect(await b.sender.send(args('m1'))).toEqual({ kind: 'landed' })
    expect(b.sent).toEqual(['m1'])
    expect(b.store.presses()).toEqual([])
    // Kept on the phone before the send, taken back once the office answered.
    expect(b.kept).toHaveLength(1)
    expect(b.unkept).toEqual(b.kept)
    expect(b.sender.inHand()).toEqual([])
  })

  it('with no signal it is kept without a try, and only the first says so', async () => {
    const b = await bench({ online: false })
    expect(await b.sender.send(args('m1'))).toEqual({ kind: 'queued', first: true })
    expect(await b.sender.send(args('m2'))).toEqual({ kind: 'queued', first: false })
    expect(b.sent).toEqual([])
    const waiting = b.store.presses()
    expect(waiting.map((p) => p.state)).toEqual(['waiting', 'waiting'])
    expect(waiting.map((p) => p.kind)).toEqual(['on-site-press', 'on-site-press'])
    expect(waiting[0]!.seq).toBeLessThan(waiting[1]!.seq)
    expect(waiting[0]).toMatchObject({ userId: 'u1', pressedAt: 1_800_000_000_000, about: '1 m1', door: '/tally?tab=on-site&job=j1' })
  })

  it('a send that fails at the signal is kept, with its try counted', async () => {
    const b = await bench()
    b.answers.push({ kind: 'failed', error: new Error('Failed to fetch') })
    expect(await b.sender.send(args('m1'))).toEqual({ kind: 'queued', first: true })
    expect(b.store.presses()).toHaveLength(1)
    expect(b.store.presses()[0]).toMatchObject({ state: 'waiting', attempts: 1 })
    expect(b.unkept).toEqual([])
  })

  it('a press behind one that waits is kept behind it, never sent ahead', async () => {
    const b = await bench()
    b.answers.push({ kind: 'failed', error: new Error('Failed to fetch') })
    await b.sender.send(args('box'))
    // The signal is back for this one, but the new box it goes into has not landed yet.
    expect(await b.sender.send(args('part'))).toEqual({ kind: 'queued', first: false })
    expect(b.sent).toEqual(['box'])
    expect(b.store.presses().map((p) => (p.payload as unknown as { writes: OnSiteWrite[] }).writes[0]!.id)).toEqual(['box', 'part'])
  })

  it('presses made while one is in flight go one at a time, in the order pressed', async () => {
    const b = await bench()
    let release: (v: LandOutcome) => void = () => {}
    b.answers.push(() => new Promise<LandOutcome>((r) => (release = r)))
    const first = b.sender.send(args('m1'))
    const second = b.sender.send(args('m2'))
    const third = b.sender.send(args('m3'))
    await Promise.resolve()
    await Promise.resolve()
    expect(b.sent).toEqual(['m1'])
    // All three are kept on the phone already, and the two that wait are still in hand for a fresh read to draw.
    expect(b.kept).toHaveLength(3)
    expect(b.sender.inHand().map((p) => p.payload.writes[0]!.id)).toEqual(['m1', 'm2', 'm3'])
    release({ kind: 'landed', result: {} })
    expect(await first).toEqual({ kind: 'landed' })
    expect(await second).toEqual({ kind: 'landed' })
    expect(await third).toEqual({ kind: 'landed' })
    expect(b.sent).toEqual(['m1', 'm2', 'm3'])
    expect(b.sender.inHand()).toEqual([])
  })

  it('when the one in flight loses its signal, the ones behind it are kept behind it', async () => {
    const b = await bench()
    let release: (v: LandOutcome) => void = () => {}
    b.answers.push(() => new Promise<LandOutcome>((r) => (release = r)))
    const first = b.sender.send(args('m1'))
    const second = b.sender.send(args('m2'))
    await Promise.resolve()
    release({ kind: 'failed', error: new Error('Failed to fetch') })
    expect(await first).toEqual({ kind: 'queued', first: true })
    expect(await second).toEqual({ kind: 'queued', first: false })
    expect(b.sent).toEqual(['m1'])
    expect(b.store.presses().map((p) => (p.payload as unknown as { writes: OnSiteWrite[] }).writes[0]!.id)).toEqual(['m1', 'm2'])
  })

  it('a refusal is handed back with its reason and nothing is kept', async () => {
    const b = await bench()
    b.answers.push({ kind: 'refused', refusal: { message: 'new row violates row-level security policy', code: '42501' } })
    expect(await b.sender.send(args('m1'))).toEqual({ kind: 'refused', message: 'new row violates row-level security policy' })
    expect(b.store.presses()).toEqual([])
    expect(b.unkept).toEqual(b.kept)
  })

  it('a session whose presses never queue gets the failure back, as before', async () => {
    for (const opts of [{ allowed: false }, { signedIn: false }]) {
      const b = await bench(opts)
      const error = new Error('Failed to fetch')
      b.answers.push({ kind: 'failed', error })
      expect(await b.sender.send(args('m1'))).toEqual({ kind: 'failed', error })
      expect(b.store.presses()).toEqual([])
      expect(b.kept).toEqual([])
      // With no signal it is still tried, since nothing would send it later.
      b.state.online = false
      expect(await b.sender.send(args('m2'))).toEqual({ kind: 'landed' })
      expect(b.sent).toEqual(['m1', 'm2'])
    }
  })
})

describe('pendingOnSitePresses', () => {
  it('lists a job’s presses that wait in the outbox and the ones still in hand, oldest first, and no other job’s', async () => {
    const b = await bench({ online: false })
    await b.sender.send(args('m1'))
    await b.sender.send(args('x1', 'j2'))
    await b.sender.send(args('m2'))
    const ids = (jobId: string) => pendingOnSitePresses(jobId, b.sender, b.store).map((p) => p.payload.writes[0]!.id)
    expect(ids('j1')).toEqual(['m1', 'm2'])
    expect(ids('j2')).toEqual(['x1'])
    // A press the office refused, or one that landed, is not on its way any more.
    const [first, , third] = b.store.presses()
    b.store.put({ ...first!, state: 'refused', refusal: { message: 'no', code: null } })
    b.store.put({ ...third!, state: 'sent', sentAt: 1 })
    expect(ids('j1')).toEqual([])
    expect(b.store.presses().filter(isPendingOnSitePress)).toHaveLength(1)
  })
})
