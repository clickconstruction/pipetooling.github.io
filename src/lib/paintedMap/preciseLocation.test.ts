import { describe, expect, it } from 'vitest'
import { METERS_PER_MILE } from '../map/mapCanvasTypes'
import { plainWordsFailures } from '../plainWords'
import { taskPlaceAccuracyWords } from '../tasks/taskPlace'
import { PAINT_POOR_FIX_METERS, PAINT_ROUGH_FIX_METERS } from './paintedTrack'
import {
  PHONE_KINDS,
  PRECISE_ALREADY_ON_WORDS,
  PRECISE_PROVEN_METERS,
  PRECISE_ROUGH_HOLD_MS,
  USUAL_MARGIN_WORDS,
  areaAcrossWords,
  marginWords,
  phoneKindOf,
  preciseStateOf,
  preciseSteps,
  preciseSwitchName,
  preciseWords,
  provesPrecise,
  roughCircleWords,
  roughCompareWords,
  wayRoughWords,
  wayWeakWords,
  type PhoneKind,
} from './preciseLocation'

const HALF_MILE = METERS_PER_MILE / 2
const PHONES = PHONE_KINDS.filter((k) => k !== 'other')
const IPHONES = PHONES.filter((k) => k !== 'android')

/** Margins across every band, with each edge and a hair either side of it. */
const MARGINS = [0, 0.5, 4.5, 19.99, 20, 20.01, 35, 99.99, 100, 100.01, 300, 804, HALF_MILE, 999.99, 1000, 1000.01, 1414, 1609.344, 1609.35, 3200, 5000, 20_000]

/** The distance a margin's words claim, in metres: what `within 2,640 ft` or `within 2 miles` reaches to. */
function metersOf(words: string): number {
  const m = /^within ([\d,]+) (ft|miles?)$/.exec(words)
  if (!m) throw new Error(`not a margin: ${words}`)
  const n = Number(m[1]!.replace(/,/g, ''))
  return m[2] === 'ft' ? n / 3.28084 : n * METERS_PER_MILE
}

describe('what one reading says about the switch', () => {
  it('is still finding with no reading, or with a margin that is not one', () => {
    for (const none of [null, undefined, Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(preciseStateOf(none, true)).toBe('finding')
      expect(preciseStateOf(none, false)).toBe('finding')
    }
  })

  it('is sure up to 20 m, and weak one hair past it', () => {
    expect(PAINT_POOR_FIX_METERS).toBe(20)
    for (const m of [0, 4.5, 19.99, 20]) expect(preciseStateOf(m, false)).toBe('on')
    for (const m of [20.01, 35, 100, 100.01, 300]) expect(preciseStateOf(m, false)).toBe('weak')
  })

  it('is weak up to 1,000 m, and rough one hair past it', () => {
    expect(PAINT_ROUGH_FIX_METERS).toBe(1000)
    for (const m of [999.99, 1000]) expect(preciseStateOf(m, true)).toBe('weak')
    for (const m of [1000.01, 1414, 3200, 20_000]) expect(preciseStateOf(m, true)).toBe('rough')
  })

  it('reads a rough reading as still finding until the readings have stayed rough for the wait', () => {
    for (const m of [1000.01, 3200, 20_000]) expect(preciseStateOf(m, false)).toBe('finding')
    // The wait changes nothing about a reading that is not rough.
    for (const m of [4.5, 35, 300, 1000]) expect(preciseStateOf(m, false)).toBe(preciseStateOf(m, true))
  })

  it('waits 4 seconds', () => {
    expect(PRECISE_ROUGH_HOLD_MS).toBe(4000)
  })

  it('takes a margin of 100 m or under as proof the switch is on, and nothing wider', () => {
    expect(PRECISE_PROVEN_METERS).toBe(100)
    for (const m of [0, 4.5, 35, 99.99, 100]) expect(provesPrecise(m)).toBe(true)
    for (const m of [100.01, 300, 1000, 3200]) expect(provesPrecise(m)).toBe(false)
    for (const none of [null, undefined, Number.NaN, -1]) expect(provesPrecise(none)).toBe(false)
  })
})

describe('a margin in words', () => {
  it('is in feet up to half a mile, worded the way a task’s place words it', () => {
    expect(marginWords(4.5)).toBe('within 15 ft')
    expect(marginWords(35)).toBe('within 120 ft')
    expect(marginWords(300)).toBe('within 990 ft')
    expect(marginWords(804)).toBe('within 2,640 ft')
    for (const m of MARGINS.filter((x) => x < HALF_MILE)) expect(marginWords(m)).toBe(taskPlaceAccuracyWords(m))
  })

  it('is in whole miles from half a mile', () => {
    expect(marginWords(HALF_MILE)).toBe('within 1 mile')
    expect(marginWords(1000)).toBe('within 1 mile')
    expect(marginWords(1609.344)).toBe('within 1 mile')
    expect(marginWords(1609.35)).toBe('within 2 miles')
    expect(marginWords(3200)).toBe('within 2 miles')
    expect(marginWords(20_000)).toBe('within 13 miles')
  })

  it('is always rounded up, so the words never claim more than the phone did', () => {
    for (let m = 0; m <= 30_000; m += 7.3) {
      const words = marginWords(m)!
      expect(metersOf(words), `${m} m → ${words}`).toBeGreaterThanOrEqual(m - 0.01)
    }
  })

  it('says nothing when the phone gave no margin', () => {
    for (const none of [null, undefined, Number.NaN, -1, Number.POSITIVE_INFINITY]) expect(marginWords(none)).toBeNull()
  })

  it('has the other number ready: what a phone is usually sure of with the switch on', () => {
    expect(USUAL_MARGIN_WORDS).toBe('within 20 ft')
  })

  it('says how wide a rough area is across, rounded up, and only for a rough one', () => {
    expect(areaAcrossWords(3200)).toBe('4 miles across')
    expect(areaAcrossWords(1000.01)).toBe('2 miles across')
    expect(areaAcrossWords(1609.344)).toBe('2 miles across')
    expect(areaAcrossWords(1609.35)).toBe('3 miles across')
    expect(areaAcrossWords(20_000)).toBe('25 miles across')
    for (const m of [null, undefined, 4.5, 35, 300, 1000]) expect(areaAcrossWords(m)).toBeNull()
    expect(roughCircleWords(3200)).toBe('You are somewhere in this circle, 4 miles across.')
    expect(roughCircleWords(300)).toBeNull()
    expect(roughCircleWords(null)).toBeNull()
  })
})

describe('which phone this is, from what the browser says of itself', () => {
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
  const SAFARI = `${IOS} Version/18.1 Mobile/15E148 Safari/604.1`
  const NO_NAME = `${IOS} Mobile/15E148`
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'

  it('tells Safari on an iPhone', () => {
    expect(phoneKindOf({ userAgent: SAFARI })).toBe('iphone-safari')
    expect(phoneKindOf({ userAgent: SAFARI, standalone: false, touchPoints: 5 })).toBe('iphone-safari')
    expect(phoneKindOf({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1' })).toBe('iphone-safari')
  })

  it('tells an app saved to the Home Screen, which does not call itself Safari', () => {
    expect(phoneKindOf({ userAgent: NO_NAME, standalone: true })).toBe('iphone-home')
    expect(phoneKindOf({ userAgent: SAFARI, standalone: true })).toBe('iphone-home')
  })

  it('tells Chrome on an iPhone by CriOS', () => {
    expect(phoneKindOf({ userAgent: `${IOS} CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1` })).toBe('iphone-chrome')
  })

  it('tells the other iPhone browsers by their own names', () => {
    for (const named of ['FxiOS/132.0 Mobile/15E148 Safari/605.1.15', 'EdgiOS/131.0.2903.68 Version/18.0 Mobile/15E148 Safari/604.1', 'OPiOS/16.0.14 Mobile/15E148 Safari/9537.53', 'Version/18.1 Mobile/15E148 Safari/604.1 OPT/5.2.1', 'Version/18.1 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15', 'GSA/343.0.695551749 Mobile/15E148 Safari/604.1']) {
      expect(phoneKindOf({ userAgent: `${IOS} ${named}` }), named).toBe('iphone-other')
    }
  })

  it('takes a page inside another app’s own window as another browser, since it does not call itself Safari', () => {
    expect(phoneKindOf({ userAgent: `${NO_NAME} [FBAN/FBIOS;FBAV/488.0.0.69.103]` })).toBe('iphone-other')
    expect(phoneKindOf({ userAgent: NO_NAME })).toBe('iphone-other')
  })

  it('tells an iPad that calls itself a Mac by its touch screen', () => {
    expect(phoneKindOf({ userAgent: MAC, touchPoints: 5 })).toBe('iphone-safari')
    expect(phoneKindOf({ userAgent: MAC, touchPoints: 5, standalone: true })).toBe('iphone-home')
    // A real Mac has no touch screen, and one touch point is a trackpad's.
    expect(phoneKindOf({ userAgent: MAC, touchPoints: 0 })).toBe('other')
    expect(phoneKindOf({ userAgent: MAC, touchPoints: 1 })).toBe('other')
    expect(phoneKindOf({ userAgent: MAC })).toBe('other')
  })

  it('tells Android, whatever the browser', () => {
    expect(phoneKindOf({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' })).toBe('android')
    expect(phoneKindOf({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36' })).toBe('android')
    expect(phoneKindOf({ userAgent: 'Mozilla/5.0 (Android 15; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0', standalone: true })).toBe('android')
  })

  it('takes a desk, or anything it cannot tell, as neither', () => {
    expect(phoneKindOf({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', touchPoints: 10 })).toBe('other')
    expect(phoneKindOf({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' })).toBe('other')
    expect(phoneKindOf({ userAgent: '' })).toBe('other')
  })
})

describe('the steps to the switch', () => {
  it('names the switch as the phone’s own settings do', () => {
    for (const kind of IPHONES) expect(preciseSwitchName(kind)).toBe('Precise Location')
    expect(preciseSwitchName('android')).toBe('Use precise location')
    expect(preciseSwitchName('other')).toBeNull()
  })

  it('gives Safari and an app saved to the Home Screen one set', () => {
    const steps = ['Open the Settings app.', 'Tap Privacy & Security, then Location Services.', 'Tap Safari Websites.', 'Turn on Precise Location.', 'Come back to this screen.']
    expect(preciseSteps('iphone-safari')).toEqual(steps)
    expect(preciseSteps('iphone-home')).toEqual(steps)
  })

  it('sends Chrome on an iPhone to its own row, and another browser to the one in use', () => {
    expect(preciseSteps('iphone-chrome')[2]).toBe('Tap Chrome.')
    expect(preciseSteps('iphone-other')[2]).toBe('Tap the browser you are using.')
    for (const kind of ['iphone-chrome', 'iphone-other'] as const) {
      expect(preciseSteps(kind)).toHaveLength(5)
      expect(preciseSteps(kind).filter((_, i) => i !== 2)).toEqual(preciseSteps('iphone-safari').filter((_, i) => i !== 2))
    }
  })

  it('goes through App info on Android, the switch for the browser itself', () => {
    expect(preciseSteps('android')).toEqual(['Press and hold the browser’s icon, then tap App info.', 'Tap Permissions, then Location.', 'Turn on Use precise location.', 'Come back to this screen.'])
  })

  it('gives each phone only its own steps: a command a step, the switch by name, and the way back last', () => {
    for (const kind of PHONES) {
      const steps = preciseSteps(kind)
      for (const s of steps) expect(s, `${kind}: ${s}`).toMatch(/^(Open|Tap|Turn on|Press and hold|Come back) /)
      expect(steps.filter((s) => s === `Turn on ${preciseSwitchName(kind)}.`)).toHaveLength(1)
      expect(steps[steps.length - 1]).toBe('Come back to this screen.')
      expect(steps.join(' ')).not.toMatch(kind === 'android' ? /iPhone|Settings app|Precise Location/ : /Android|App info|Use precise location/)
    }
  })

  it('gives a desk, or a phone it cannot tell, one line for each kind of phone', () => {
    expect(preciseSteps('other')).toEqual([
      'iPhone: Settings, Privacy & Security, Location Services, Safari Websites. Turn on Precise Location.',
      'Android: hold the browser’s icon, App info, Permissions, Location. Turn on Use precise location.',
    ])
  })

  it('has a line for a phone whose switch was on all along', () => {
    expect(PRECISE_ALREADY_ON_WORDS).toBe('Already on? Step into the open and wait a moment. The phone may only be hearing a cell tower.')
  })
})

describe('the line, in every state', () => {
  it('says it is finding you before the first reading', () => {
    for (const kind of PHONE_KINDS) expect(preciseWords(null, kind, false)).toEqual({ state: 'finding', lead: 'Finding you…', tail: 'This takes a few seconds in the open.' })
  })

  it('says the same while a rough reading is still being waited on', () => {
    for (const kind of PHONE_KINDS) expect(preciseWords(3200, kind, false)).toEqual(preciseWords(null, kind, false))
  })

  it('says the switch is on, by name, on a sure reading', () => {
    for (const kind of IPHONES) expect(preciseWords(4.5, kind, false)).toEqual({ state: 'on', lead: 'Precise Location is on.', tail: 'Sure within 15 ft.' })
    expect(preciseWords(4.5, 'android', false)).toEqual({ state: 'on', lead: 'Precise location is on.', tail: 'Sure within 15 ft.' })
    expect(preciseWords(20, 'iphone-safari', false)).toEqual({ state: 'on', lead: 'Precise Location is on.', tail: 'Sure within 70 ft.' })
  })

  it('clears the switch and blames the signal from 20 m to 100 m', () => {
    for (const kind of IPHONES) expect(preciseWords(35, kind, false)).toEqual({ state: 'weak', lead: 'Precise Location is on, but the signal is weak here.', tail: 'Your phone is only sure within 120 ft.' })
    expect(preciseWords(35, 'android', false).lead).toBe('Precise location is on, but the signal is weak here.')
    expect(preciseWords(20.01, 'iphone-safari', false).lead).toBe('Precise Location is on, but the signal is weak here.')
    expect(preciseWords(100, 'iphone-safari', false).lead).toBe('Precise Location is on, but the signal is weak here.')
  })

  it('says only that the signal is weak from 100 m to 1,000 m', () => {
    for (const kind of PHONES) {
      expect(preciseWords(300, kind, false)).toEqual({ state: 'weak', lead: 'The signal is weak here.', tail: 'Your phone is only sure within 990 ft.' })
      expect(preciseWords(100.01, kind, false).lead).toBe('The signal is weak here.')
      expect(preciseWords(1000, kind, true)).toEqual({ state: 'weak', lead: 'The signal is weak here.', tail: 'Your phone is only sure within 1 mile.' })
    }
  })

  it('says the switch looks off once the readings have stayed rough, and leaves the numbers to the two rows', () => {
    for (const kind of IPHONES) expect(preciseWords(3200, kind, true)).toEqual({ state: 'rough', lead: 'Precise Location looks off.', tail: null })
    expect(preciseWords(3200, 'android', true)).toEqual({ state: 'rough', lead: 'Precise location looks off.', tail: null })
    expect(preciseWords(1000.01, 'iphone-safari', true).state).toBe('rough')
  })

  it('never says the switch is off: a page is not told, and a cell tower reads the same', () => {
    for (const kind of PHONE_KINDS) {
      for (const m of MARGINS) {
        for (const held of [true, false]) {
          const w = preciseWords(m, kind, held)
          expect(`${w.lead} ${w.tail ?? ''}`, `${kind} ${m}`).not.toMatch(/\bis off\b|\bturned off\b/i)
        }
      }
    }
  })

  it('calls the switch on only on a margin that proves it', () => {
    for (const kind of PHONES) {
      for (const m of MARGINS) {
        const said = /\bis on\b/.test(preciseWords(m, kind, true).lead)
        expect(said, `${kind} ${m}`).toBe(m <= PRECISE_PROVEN_METERS)
      }
    }
  })

  it('names no switch on a desk, or on a phone it cannot tell', () => {
    expect(preciseWords(4.5, 'other', false)).toEqual({ state: 'on', lead: 'Found you.', tail: 'Sure within 15 ft.' })
    expect(preciseWords(35, 'other', false)).toEqual({ state: 'weak', lead: 'The signal is weak here.', tail: 'This device is only sure within 120 ft.' })
    expect(preciseWords(3200, 'other', true)).toEqual({ state: 'rough', lead: 'This device only knows the area it is in.', tail: 'It is only sure within 2 miles.' })
    for (const m of MARGINS) {
      const w = preciseWords(m, 'other', true)
      expect(`${w.lead} ${w.tail ?? ''}`).not.toMatch(/precise|your phone/i)
    }
  })

  it('sets the phone’s two numbers side by side on a rough reading', () => {
    for (const kind of IPHONES) expect(roughCompareWords(3200, kind)).toEqual({ nowLabel: 'Your phone now', now: 'within 2 miles', onLabel: 'With Precise Location on', on: 'within 20 ft' })
    expect(roughCompareWords(3200, 'android')).toEqual({ nowLabel: 'Your phone now', now: 'within 2 miles', onLabel: 'With Use precise location on', on: 'within 20 ft' })
  })

  it('sets nothing beside a reading that is not rough, or where no switch is named', () => {
    for (const m of [null, undefined, 4.5, 35, 300, 1000]) expect(roughCompareWords(m, 'iphone-safari')).toBeNull()
    expect(roughCompareWords(3200, 'other')).toBeNull()
  })
})

describe('the shared map, which a stranger reads', () => {
  it('says the phone is only giving an area, and names the switch as the thing to press', () => {
    for (const kind of IPHONES) {
      expect(wayRoughWords(3200, kind)).toEqual({
        lead: 'Your phone is only giving the area you are in.',
        tail: 'It is only sure within 2 miles, so the map cannot show where you stand.',
        ask: 'To see where you stand, turn on Precise Location:',
      })
    }
    expect(wayRoughWords(3200, 'android').ask).toBe('To see where you stand, turn on Use precise location:')
  })

  it('speaks of the device where it cannot tell the phone', () => {
    expect(wayRoughWords(3200, 'other')).toEqual({
      lead: 'This device only knows the area it is in.',
      tail: 'It is only sure within 2 miles, so the map cannot show where you stand.',
      ask: 'To see where you stand, turn on precise location on your phone:',
    })
  })

  it('never names the switch for a weak signal, even one that proves it on', () => {
    for (const kind of PHONES) {
      for (const m of [35, 100, 300, 1000]) {
        const w = wayWeakWords(m, kind)
        expect(w.lead).toBe('The signal is weak here.')
        expect(w.tail).toBe(`Your phone is only sure ${marginWords(m)}.`)
        expect(`${w.lead} ${w.tail}`).not.toMatch(/precise/i)
      }
    }
    expect(wayWeakWords(35, 'other')).toEqual({ lead: 'The signal is weak here.', tail: 'This device is only sure within 120 ft.' })
    expect(wayWeakWords(null, 'iphone-safari')).toEqual({ lead: 'The signal is weak here.', tail: null })
  })

  it('never says the switch is off there either', () => {
    for (const kind of PHONE_KINDS) {
      const w = wayRoughWords(3200, kind)
      expect(`${w.lead} ${w.tail} ${w.ask}`).not.toMatch(/\bis off\b|\bturned off\b/i)
    }
  })
})

describe('every sentence a first-timer reads is plain', () => {
  const said = (kind: PhoneKind): string[] => {
    const lines: string[] = [PRECISE_ALREADY_ON_WORDS, ...preciseSteps(kind)]
    for (const m of [null, ...MARGINS]) {
      for (const held of [true, false]) {
        const w = preciseWords(m, kind, held)
        lines.push(w.lead)
        if (w.tail) lines.push(w.tail)
      }
      const circle = roughCircleWords(m)
      if (circle) lines.push(circle)
      const compare = roughCompareWords(m, kind)
      if (compare) lines.push(compare.nowLabel, compare.now, compare.onLabel, compare.on)
      const weak = wayWeakWords(m, kind)
      lines.push(weak.lead)
      if (weak.tail) lines.push(weak.tail)
      const rough = wayRoughWords(m, kind)
      lines.push(rough.lead, rough.tail, rough.ask)
    }
    return [...new Set(lines)]
  }

  it('holds one idea a sentence, none over 20 words, with no dash, semicolon, parenthesis or dot list', () => {
    for (const kind of PHONE_KINDS) {
      for (const line of said(kind)) expect(plainWordsFailures(line), `${kind}: ${line}`).toEqual([])
    }
  })
})
