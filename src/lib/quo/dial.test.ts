/**
 * To-do #152 (v2.5803): the Call buttons through Quo. Quo's link as its deep-linking page gives it; the device; the
 * seat, own or shared; the kept pick, read and written like Show Mine · Everyone; and the plan behind every button: no
 * seat is `tel:`, a seat on a desk is `tel:` with the desk's words a ▾ away, a seat on a phone asks once and then
 * dials the kept way, and an extension stays `tel:`. The words a first-timer reads pass the plain-words rules.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { CALL_THROUGH_KEY, callWords, DIAL_WORDS, hasQuoSeat, isPhoneDevice, keepCallThrough, numberWords, planCall, quoDialHref, readCallThrough } from './dial'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const DANA = '(512) 555-0187'
const COMPANY = '512-555-0144'

function store(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  }
}

describe('quoDialHref', () => {
  it('is Quo’s link: the number in E.164 with + as %2B, from the company number, action=call', () => {
    expect(quoDialHref(DANA, COMPANY)).toBe('openphone://dial?number=%2B15125550187&from=%2B15125550144&action=call')
  })

  it('leaves from out while the boxes are not read, so Quo picks the person’s number', () => {
    expect(quoDialHref(DANA)).toBe('openphone://dial?number=%2B15125550187&action=call')
    expect(quoDialHref(DANA, '')).toBe('openphone://dial?number=%2B15125550187&action=call')
  })

  it('is null for a number the link cannot carry: an extension, or one outside the US and Canada', () => {
    expect(quoDialHref('(512) 555-0187 x12', COMPANY)).toBeNull()
    expect(quoDialHref('+44 20 7946 0958', COMPANY)).toBeNull()
    expect(quoDialHref('', COMPANY)).toBeNull()
  })
})

describe('isPhoneDevice', () => {
  it('is an iPhone or an Android phone, and an iPad that reads as a Mac with a touch screen', () => {
    expect(isPhoneDevice(IPHONE)).toBe(true)
    expect(isPhoneDevice(ANDROID)).toBe(true)
    expect(isPhoneDevice(MAC, 5)).toBe(true)
  })

  it('is not a Mac or a PC', () => {
    expect(isPhoneDevice(MAC)).toBe(false)
    expect(isPhoneDevice(MAC, 0)).toBe(false)
    expect(isPhoneDevice(WINDOWS)).toBe(false)
  })
})

describe('hasQuoSeat', () => {
  const seats = [
    { quoUserId: 'USrosa', userId: 'u-rosa' },
    { quoUserId: 'USdesk', userId: 'office' },
  ]
  it('is the person’s own seat, or the one shared by the office', () => {
    expect(hasQuoSeat('u-rosa', seats)).toBe(true)
    expect(hasQuoSeat('u-dale', seats)).toBe(true)
    expect(hasQuoSeat('u-dale', seats.slice(0, 1))).toBe(false)
  })

  it('is nobody’s with no sign-in or no seats', () => {
    expect(hasQuoSeat(null, seats)).toBe(false)
    expect(hasQuoSeat('u-rosa', [])).toBe(false)
  })
})

describe('the kept pick', () => {
  it('reads quo or phone and nothing else', () => {
    expect(readCallThrough(store({ [CALL_THROUGH_KEY]: 'quo' }))).toBe('quo')
    expect(readCallThrough(store({ [CALL_THROUGH_KEY]: 'phone' }))).toBe('phone')
    expect(readCallThrough(store({ [CALL_THROUGH_KEY]: 'fax' }))).toBeNull()
    expect(readCallThrough(store())).toBeNull()
    expect(readCallThrough(null)).toBeNull()
  })

  it('keeps the pick, forgets it on null, and a browser that keeps nothing reads as no pick', () => {
    const s = store()
    keepCallThrough('quo', s)
    expect(s.m.get(CALL_THROUGH_KEY)).toBe('quo')
    keepCallThrough(null, s)
    expect(s.m.has(CALL_THROUGH_KEY)).toBe(false)
    const broken = {
      getItem: () => {
        throw new Error('no storage')
      },
      setItem: () => {
        throw new Error('no storage')
      },
      removeItem: () => {
        throw new Error('no storage')
      },
    }
    expect(() => keepCallThrough('phone', broken)).not.toThrow()
    expect(readCallThrough(broken)).toBeNull()
  })
})

describe('planCall', () => {
  const base = { number: DANA, from: COMPANY }

  it('no seat: the tel: link as it always was, no sheet, on a phone and on a desk', () => {
    for (const phone of [true, false]) {
      const plan = planCall({ ...base, seat: false, phone, kept: 'quo' })
      expect(plan).toEqual({ href: 'tel:+15125550187', words: 'Call', through: 'phone', sheet: null, ways: [] })
    }
  })

  it('a seat on a desk: tel: with the desk’s words a ▾ away, whatever the kept pick', () => {
    const plan = planCall({ ...base, seat: true, phone: false, kept: 'quo' })
    expect(plan.href).toBe('tel:+15125550187')
    expect(plan.words).toBe('Call')
    expect(plan.sheet).toBe('desk')
    expect(plan.ways).toEqual([])
  })

  it('a seat on a phone, no pick yet: the press opens the sheet, Quo first, nothing marked', () => {
    const plan = planCall({ ...base, seat: true, phone: true, kept: null })
    expect(plan.href).toBeNull()
    expect(plan.words).toBe('Call')
    expect(plan.sheet).toBe('ways')
    expect(plan.ways.map((w) => [w.through, w.words, w.kept])).toEqual([
      ['quo', 'Call in Quo', false],
      ['phone', 'Call from my phone', false],
    ])
    expect(plan.ways[0]?.href).toBe('openphone://dial?number=%2B15125550187&from=%2B15125550144&action=call')
    expect(plan.ways[0]?.note).toBe('Dials from 512-555-0144. Quo writes the call in the thread.')
    expect(plan.ways[1]?.href).toBe('tel:+15125550187')
  })

  it('a seat on a phone, Quo kept: the button is Quo’s link and says so; the ▾ still asks', () => {
    const plan = planCall({ ...base, seat: true, phone: true, kept: 'quo', verb: 'Call back' })
    expect(plan.href).toBe('openphone://dial?number=%2B15125550187&from=%2B15125550144&action=call')
    expect(plan.words).toBe('Call back in Quo')
    expect(plan.through).toBe('quo')
    expect(plan.sheet).toBe('ways')
    expect(plan.ways.find((w) => w.kept)?.through).toBe('quo')
  })

  it('a seat on a phone, the phone kept: tel: and plain words, the Quo way a ▾ away', () => {
    const plan = planCall({ ...base, seat: true, phone: true, kept: 'phone' })
    expect(plan.href).toBe('tel:+15125550187')
    expect(plan.words).toBe('Call')
    expect(plan.through).toBe('phone')
    expect(plan.sheet).toBe('ways')
    expect(plan.ways.find((w) => w.kept)?.through).toBe('phone')
  })

  it('the boxes not read yet: Quo’s link leaves from out and the note names the company number', () => {
    const plan = planCall({ number: DANA, seat: true, phone: true, kept: null })
    expect(plan.ways[0]?.href).toBe('openphone://dial?number=%2B15125550187&action=call')
    expect(plan.ways[0]?.note).toBe('Dials from the company number. Quo writes the call in the thread.')
  })

  it('an extension stays tel: for a seat holder on a phone, with no sheet, whatever was kept', () => {
    const plan = planCall({ number: '(512) 555-0187 ext 12', from: COMPANY, seat: true, phone: true, kept: 'quo' })
    expect(plan.href).toBe('tel:512555018712')
    expect(plan.words).toBe('Call')
    expect(plan.sheet).toBeNull()
  })
})

describe('the words', () => {
  it('append in Quo to the verb only for Quo', () => {
    expect(callWords('Call', 'quo')).toBe('Call in Quo')
    expect(callWords('Call them', 'phone')).toBe('Call them')
  })

  it('read a number with no parentheses, so a sentence stays plain', () => {
    expect(numberWords('5125550144')).toBe('512-555-0144')
    expect(numberWords('+44 20 7946 0958')).toBe('+44 20 7946 0958')
  })

  it('title the sheet by the name, or the number when there is none', () => {
    expect(DIAL_WORDS.title('Dana Whitfield', DANA)).toBe('Call Dana Whitfield')
    expect(DIAL_WORDS.title('  ', DANA)).toBe('Call 512-555-0187')
    expect(DIAL_WORDS.title(null, '+44 20 7946 0958')).toBe('Call +44 20 7946 0958')
  })

  it('are plain where a first-timer reads them', () => {
    const read = [
      DIAL_WORDS.quoNote(COMPANY),
      DIAL_WORDS.quoNote(null),
      DIAL_WORDS.phoneNote,
      DIAL_WORDS.keptLine,
      DIAL_WORDS.storeLine,
      DIAL_WORDS.deskLine,
      DIAL_WORDS.deskQuo,
      DIAL_WORDS.deskMac,
      DIAL_WORDS.deskWindows,
    ]
    expect(plainWordsFailures(read.join('\n'))).toEqual([])
  })
})
