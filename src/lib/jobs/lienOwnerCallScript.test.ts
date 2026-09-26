import { describe, expect, it } from 'vitest'
import { CALL_OPENINGS, EMPTY_CALL_STATE, callBack, callCard, callHasFacts, callJump, callPile, callReply, callSentence, callToOwnerCall, holdingWords, type CallLetterFacts } from './lienOwnerCallScript'
import { affidavitPileFor, parseOwnerCall } from './lienOwnerCall'

const facts: CallLetterFacts = {
  jobLabel: '273 · Dudley (Lennox)',
  property: '9703 Lenox Hl, San Antonio, TX 78230',
  ownerName: 'Priya Natarajan',
  gcName: 'RMC',
  us: 'Click',
  instrument: 'notice_53_056',
  letterKind: 'residential',
  mailedOn: '2026-09-22',
  amount: '$7,902.00',
  months: 'June, July and August 2026',
  signer: 'Robert Douglas, Master Plumber',
  phone: '(512) 360-0599',
  affidavitBy: '2026-11-16',
}
const fmt = { day: (d: string) => d, money: (n: number) => `$${n.toLocaleString('en-US')}` }

describe('the owner’s call as a conversation (v2.3852)', () => {
  it('opens with counsel’s frame and the six openings in the owner’s words', () => {
    const c = callCard(facts, EMPTY_CALL_STATE, fmt)
    expect(c.say).toContain('Thanks for calling about the notice on 9703 Lenox Hl.')
    expect(c.say).toContain('you did nothing wrong by paying RMC. You didn’t hire us, and this is not a lawsuit.')
    expect(c.replies.map((r) => r.key)).toEqual(CALL_OPENINGS.map((o) => `opening:${o.key}`))
    expect(c.replies[0]!.words).toBe('“I already paid RMC — everything.”')
    expect(callHasFacts(EMPTY_CALL_STATE)).toBe(false)
    expect(callSentence(facts, EMPTY_CALL_STATE, fmt)).toBe('')
    expect(holdingWords(facts, fmt)).toBe('the residential § 53.056 notice mailed 2026-09-22')
    expect(holdingWords({ ...facts, instrument: 'retainage_53_057', letterKind: 'retainage' }, fmt)).toBe('the § 53.057 retainage notice mailed 2026-09-22')
  })

  it('Priya’s call: paid in full → the 10% went out early → wants to pay us — four cards, the facts as by-products, the sentence and Pile C', () => {
    let s = callReply(EMPTY_CALL_STATE, 'opening:paid')
    expect(s.step).toBe('paid')
    expect(s.owesGc).toBe('no')
    let c = callCard(facts, s, fmt)
    expect(c.say).toContain('the law doesn’t ask you to pay twice for anything you paid before our notice reached you')
    expect(c.say).toContain('Did that stay with you, or has it gone to RMC?')
    expect(c.replies.find((r) => r.key === 'ten_released')?.needs).toBe('released')
    expect(callSentence(facts, s, fmt)).toBe('Priya Natarajan paid RMC in full.')

    s = callReply(s, 'ten_released', { releasedOn: '2026-09-10', completedOn: '2026-08-30' })
    expect(s.step).toBe('next')
    c = callCard(facts, s, fmt)
    expect(c.title).toBe('the 10% went out early')
    expect(c.say).toContain('for you that was until 2026-09-29. Since it went out on 2026-09-10, the property can still be reached for that amount.')
    expect(c.say).toContain('I’m not saying you owe it')
    expect(c.say).toContain('we file a lien affidavit on the property by 2026-11-16 and send you a copy within five days')
    expect(c.say).toContain('you get a release the same day and a copy goes to RMC')
    expect(c.cites).toContain('§ 53.105')
    expect(c.replies.map((r) => r.key)).toEqual(['pay_us_now', 'wait', 'callback'])
    expect(c.replies[2]!.words).toBe('“Can I talk to Robert?”')
    expect(callSentence(facts, s, fmt)).toBe('Priya Natarajan paid RMC in full. They let the 10% go to RMC on 2026-09-10, 19 days before the hold ended. RMC finished 2026-08-30.')
    expect(callPile(s)).toBe('C')

    s = callReply(s, 'pay_us_now')
    expect(s.step).toBe('wrap')
    c = callCard(facts, s, fmt)
    expect(c.final).toBe(true)
    expect(c.say).toContain('That’s your decision on your contract with RMC — not something the law makes you do.')
    expect(c.say).toContain('a check payable only to Click, a release the same day, and a copy to RMC')
    expect(c.say).toContain('Thanks for calling — you’ll hear from us before anything else happens.')
    expect(c.cites).toBe('counsel’s sign-off on this job first')
    expect(callSentence(facts, s, fmt)).toContain('They’d like to pay us directly — counsel’s sign-off first.')

    const rec = callToOwnerCall({ ...s, note: 'very calm' }, 'Taunya', '2026-09-26T16:00:00Z')
    expect(rec).toEqual({ at: '2026-09-26T16:00:00Z', name: 'Taunya', owesGc: 'no', owesAmount: null, reserved: 'released', originalContractCompletedOn: '2026-08-30', note: 'very calm', releasedOn: '2026-09-10', wantsToPayUs: true, gcSilentToThem: false, callbackWanted: false, told: ['open', 'paid', 'next', 'wrap'] })
    expect(affidavitPileFor(rec)).toBe('C')
    // and it reads back through the tolerant parse, new facts included
    expect(parseOwnerCall(rec)).toEqual(rec)
  })

  it('“still owe some” asks the amount and says the § 53.081 hold; the 10% held is Pile A; the record carries the figure', () => {
    let s = callJump(EMPTY_CALL_STATE, 'owes')
    let c = callCard(facts, s, fmt)
    expect(c.say).toContain('Please don’t send RMC that money until this is cleared. The notice lets you hold back $7,902.00 from it.')
    expect(c.say).toContain('RMC emails us that you may pay us directly')
    s = callReply(s, 'ten_held', { contractOpen: true })
    c = callCard(facts, s, fmt)
    expect(c.title).toBe('what happens next')
    expect(c.say).toContain('Please keep holding it until we send you a release.')
    expect(callPile(s)).toBe('A')
    expect(callSentence(facts, s, fmt)).toBe('Priya Natarajan still owes RMC something. The 10% is still with them. RMC is still on the job.')
    // the amount typed with the reply on a balance card
    const t = callReply(callJump(EMPTY_CALL_STATE, 'sued'), 'still_owe', { amount: 14_000 })
    expect(t.step).toBe('owes')
    expect(callSentence(facts, t, fmt)).toBe('Priya Natarajan still owes RMC about $14,000.')
    expect(callToOwnerCall(t, 'T', 'x').owesAmount).toBe(14_000)
  })

  it('“am I being sued”, “builder’s gone quiet”, “can I pay you” and “call me back” each say their line and then ask where things stand; not sure goes to the 10% alone', () => {
    const sued = callCard(facts, callJump(EMPTY_CALL_STATE, 'sued'), fmt)
    expect(sued.say).toContain('No. You didn’t hire us and this isn’t a lawsuit')
    expect(sued.replies.map((r) => r.key)).toEqual(['paid_all', 'still_owe', 'not_sure'])
    const silent = callJump(EMPTY_CALL_STATE, 'gc_silent')
    expect(silent.gcSilentToThem).toBe(true)
    expect(callCard(facts, silent, fmt).say).toContain('please don’t send RMC another payment that includes our $7,902.00')
    const pay = callJump(EMPTY_CALL_STATE, 'pay_us')
    expect(pay.wantsToPayUs).toBe(true)
    expect(callCard(facts, pay, fmt).say).toContain('Before that — where do things stand with RMC')
    const cb = callJump(EMPTY_CALL_STATE, 'callback')
    expect(cb.callbackWanted).toBe(true)
    expect(callCard(facts, cb, fmt).say).toContain('I’ll have Robert call you today.')
    const unsure = callReply(callJump(EMPTY_CALL_STATE, 'sued'), 'not_sure')
    expect(unsure.step).toBe('ten')
    expect(callCard(facts, unsure, fmt).say).toContain('ten percent')
    // the wrap does not repeat a line already said on the opening card
    const wrapped = callReply(callReply(pay, 'paid_all'), 'ten_unknown')
    const next = callCard(facts, wrapped, fmt)
    expect(next.replies.map((r) => r.key)).toEqual(['wait', 'callback']) // pay_us_now is gone — they already asked
    const w = callReply(wrapped, 'wait')
    expect(callCard(facts, w, fmt).say).toBe('Thanks for calling — you’ll hear from us before anything else happens.')
    expect(callSentence(facts, wrapped, fmt)).toBe('Priya Natarajan paid RMC in full. They’d like to pay us directly — counsel’s sign-off first.')
  })

  it('the 10% released after the hold is “that part is done”; never held is § 53.105; the retainage notice says the affidavit-copy rule', () => {
    const late = callReply(callJump(EMPTY_CALL_STATE, 'paid'), 'ten_released', { releasedOn: '2026-10-10', completedOn: '2026-08-30' })
    expect(callCard(facts, late, fmt).say).toContain('so that part is done. There’s nothing there to hold.')
    expect(callSentence(facts, late, fmt)).toContain('after the hold ended')
    const never = callReply(callJump(EMPTY_CALL_STATE, 'paid'), 'ten_never', { completedOn: '2026-08-30' })
    expect(callCard(facts, never, fmt).title).toBe('the 10% was never held')
    expect(callPile(never)).toBe('B')
    const ret: CallLetterFacts = { ...facts, instrument: 'retainage_53_057', letterKind: 'retainage', amount: '$4,250.00', months: '', affidavitBy: '' }
    const owes = callCard(ret, callJump(EMPTY_CALL_STATE, 'owes'), fmt)
    expect(owes.say).toContain('Please don’t release retainage or make a final payment to RMC until this is cleared.')
    expect(owes.say).toContain('begins the day our filed affidavit reaches you')
    expect(callCard(ret, EMPTY_CALL_STATE, fmt).say).toContain('the retainage notice on 9703 Lenox Hl')
    expect(callCard(ret, callReply(callJump(EMPTY_CALL_STATE, 'paid'), 'ten_unknown'), fmt).say).toContain('we file a lien affidavit on the property and send you a copy')
  })

  it('Back returns to the previous card and keeps the facts; a chip jumps from anywhere without losing them', () => {
    const s = callReply(callJump(EMPTY_CALL_STATE, 'paid'), 'ten_held', { completedOn: '2026-08-30' })
    const back = callBack(s)
    expect(back.step).toBe('paid')
    expect(back.reserved).toBe('held')
    expect(callBack(callBack(back)).step).toBe('open')
    expect(callBack(EMPTY_CALL_STATE).step).toBe('open')
    const jumped = callJump(s, 'pay_us')
    expect(jumped.step).toBe('pay_us')
    expect(jumped.opening).toBe('paid') // the first opening stays the opening
    expect(jumped.owesGc).toBe('no')
    expect(jumped.wantsToPayUs).toBe(true)
    expect(jumped.told).toEqual(['open', 'paid', 'next', 'pay_us'])
  })
})
