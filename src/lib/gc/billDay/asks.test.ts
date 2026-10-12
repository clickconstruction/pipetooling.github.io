import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { owedDrawWords } from '../ownerBilling'
import { askDrawText, askNotInTexts, askWaiverText, firstNameOf, owedDrawWordsIn, remindDrawText, sendBackNote, superintendentText, type AskTo } from './asks'
import { drawAtWeSee, type DrawLineAtWeSee } from './lines'
import { billDayDates, tradeDraws, walkDraws, type TradeDraw } from './trades'
import { billDayJob, billDayState, WENDI_WALK } from '../../../test/fixtures/billDayDemo'

const LINK = 'https://example.test/t/demo#draws'

function stoneOak() {
  const state = billDayState()
  const project = billDayJob(state, 'stoneoak')
  const dates = billDayDates(state, project)
  const rows = tradeDraws(state, project, dates)
  const row = (company: string): TradeDraw => {
    const r = rows.find((x) => x.company === company)
    if (!r) throw new Error(`no ${company}`)
    return r
  }
  const to = (r: TradeDraw): AskTo => ({ firstName: firstNameOf(r.person), link: LINK, lang: 'en' })
  return { state, project, dates, rows, row, to }
}

/** Lone Star's draw 2 at what the walk saw. */
function lsLines(checks = WENDI_WALK): DrawLineAtWeSee[] {
  const state = billDayState('2026-10-22')
  const project = billDayJob(state, 'stoneoak')
  const pkg = project.packages.find((k) => k.id === 'so-mech')
  const draw = pkg?.sow?.draws.find((d) => d.id === 'ls-2')
  if (!pkg?.sow || !draw) throw new Error('no Lone Star draw 2')
  return drawAtWeSee(project, pkg, pkg.sow, draw, checks).lines
}

describe('the asks for a draw', () => {
  it('asks a trade not in for its draw by the cut-off, with the link last', () => {
    const { project, dates, row, to } = stoneOak()
    expect(askDrawText(row('Kerr Electric'), dates, project.name, to(row('Kerr Electric')))).toBe(
      `Dana, pay application 4 on Stone Oak Pharmacy closes Mon Oct 19. Your draw 3 is due by then. Send it here: ${LINK}`,
    )
    expect(askDrawText(row('Hillside Excavation'), dates, project.name, to(row('Hillside Excavation')))).toBe(
      `Greg, pay application 4 on Stone Oak Pharmacy closes Mon Oct 19. Your draw 3 is due by then. The unconditional waiver for draw 2 is still owed too. Send them here: ${LINK}`,
    )
  })

  it('asks each trade not in with its own text, leaving out one said to send nothing and one with no one to text', () => {
    const { state, project, dates, to } = stoneOak()
    const rows = tradeDraws(state, project, dates, [{ sowId: 'sow-kerr', periodTo: '2026-10-25', saidBy: 'Dana Kerr', at: '2026-10-02T15:00:00Z' }])
    const texts = askNotInTexts(rows, dates, project.name, (r) => (r.company === 'Alamo Steel' ? null : to(r)))
    expect(texts.map((t) => [t.packageId, t.partnerId])).toEqual([['so-site', 'bd-hillside']])
  })

  it('greets no one when the company has no contact', () => {
    const state = billDayState()
    const helotes = billDayJob(state, 'helotes')
    const dates = billDayDates(state, helotes)
    const [paving] = tradeDraws(state, helotes, dates)
    if (!paving) throw new Error('no Hill Country Paving')
    expect(askDrawText(paving, dates, helotes.name, { firstName: firstNameOf(paving.person), link: LINK, lang: 'en' })).toBe(
      `Pay application 1 on Helotes Dental Office closes Mon Oct 19. Your draw 1 is due by then. Send it here: ${LINK}`,
    )
  })
})

describe('the waiver ask and the reminder', () => {
  it('asks for the unconditional waiver still owed, with the day we paid that draw', () => {
    const { row, to } = stoneOak()
    expect(askWaiverText(row('Hillside Excavation'), to(row('Hillside Excavation')))).toBe(
      `Greg, the unconditional waiver for draw 2 is still owed. We paid that draw Sep 28. Upload it here: ${LINK}`,
    )
    expect(askWaiverText(row('Kerr Electric'), to(row('Kerr Electric')))).toBeNull()
  })

  it('reminds a trade of the draw we sent back, with our note', () => {
    const { row, to } = stoneOak()
    expect(remindDrawText(row('Rio Paving'), to(row('Rio Paving')))).toBe(
      `Dan, draw 2 went back Thu Oct 1. Line 3, Base, lot, reads 80%. We see 50%. Send it again. Resend it here: ${LINK}`,
    )
    expect(remindDrawText(row('Kerr Electric'), to(row('Kerr Electric')))).toBeNull()
  })
})

describe('the superintendent’s text', () => {
  it('counts the draws waiting on us, never a dollar', () => {
    const { project, dates, rows } = stoneOak()
    const text = superintendentText('Wendi', walkDraws(rows).length, project.name, dates)
    expect(text).toBe('Wendi, 1 draw to check on Stone Oak Pharmacy by Fri Oct 23. The lines are on the daily log, in walking order.')
    expect(superintendentText('Wendi', 2, project.name, dates)).toContain('2 draws to check')
    expect(text).not.toContain('$')
  })
})

describe('sendBackNote', () => {
  it('writes the note from the walk: each line under the claim, her note, the photo', () => {
    expect(sendBackNote(lsLines(), 'en')).toBe('Line 2, Rough-in, level 1, reads 90%. We see 75%. East wing branch lines not hung. We have a photo of it. Send it again.')
  })

  it('names stored material not seen on site, and says nothing when every line is as claimed', () => {
    const notThere = WENDI_WALK.map((c) => (c.sovId === 'ls-equip' ? { ...c, onSite: false, note: 'No units in the yard' } : c.sovId === 'ls-l1' ? { ...c, weSee: 90 } : c))
    expect(sendBackNote(lsLines(notThere), 'en')).toBe('Line 4, Equipment, claims $4,100 of stored material. We did not see it on site. No units in the yard. Send it again.')
    expect(sendBackNote(lsLines(WENDI_WALK.map((c) => (c.sovId === 'ls-l1' ? { ...c, weSee: 90 } : c))), 'en')).toBe('')
  })
})

describe('plain words', () => {
  it('keeps every ask in short sentences with nothing glued', () => {
    const { project, dates, rows, row, to } = stoneOak()
    const texts = [
      ...askNotInTexts(rows, dates, project.name, to).map((t) => t.text),
      askWaiverText(row('Hillside Excavation'), to(row('Hillside Excavation'))) ?? '',
      remindDrawText(row('Rio Paving'), to(row('Rio Paving'))) ?? '',
      superintendentText('Wendi', 1, project.name, dates),
      sendBackNote(lsLines(), 'en'),
    ]
    for (const t of texts) expect(plainWordsFailures(t)).toEqual([])
  })
})

describe('firstNameOf', () => {
  it('takes the first word of the contact, or nothing', () => {
    expect([firstNameOf('Luis Ortega'), firstNameOf('  Dana Kerr '), firstNameOf('')]).toEqual(['Luis', 'Dana', ''])
  })
})

describe('in the trade’s language', () => {
  const es = (r: TradeDraw): AskTo => ({ firstName: firstNameOf(r.person), link: LINK, lang: 'es' })

  it('writes the draw words word for word as owedDrawWords in English, and in Spanish after the waiver', () => {
    const cases = [
      [{ draw: 2, amount: 1, final: false }],
      [{ draw: 1, amount: 1, final: false }, { draw: 2, amount: 1, final: false }],
      [{ draw: 1, amount: 1, final: false }, { draw: 2, amount: 1, final: false }, { draw: 3, amount: 1, final: false }],
      [{ draw: 4, amount: 1, final: true }],
      [{ draw: 1, amount: 1, final: false }, { draw: 2, amount: 1, final: false }, { draw: 5, amount: 1, final: true }],
    ]
    for (const owed of cases) expect(owedDrawWordsIn('en', owed)).toBe(owedDrawWords(owed))
    expect(cases.map((owed) => owedDrawWordsIn('es', owed))).toEqual([
      'del pago 2',
      'de los pagos 1 y 2',
      'de los pagos 1, 2 y 3',
      'del pago final',
      'de los pagos 1 y 2 y del pago final',
    ])
  })

  it('asks for a draw and a waiver in Spanish, with Spanish dates', () => {
    const { project, dates, row } = stoneOak()
    expect(askDrawText(row('Hillside Excavation'), dates, project.name, es(row('Hillside Excavation')))).toBe(
      `Greg, la solicitud de pago 4 de Stone Oak Pharmacy cierra el lun 19 oct. Su pago 3 debe llegar antes de esa fecha. La renuncia incondicional del pago 2 también está pendiente. Envíelos aquí: ${LINK}`,
    )
    expect(askDrawText(row('Kerr Electric'), dates, project.name, { ...es(row('Kerr Electric')), firstName: '' })).toBe(
      `La solicitud de pago 4 de Stone Oak Pharmacy cierra el lun 19 oct. Su pago 3 debe llegar antes de esa fecha. Envíelo aquí: ${LINK}`,
    )
    expect(askWaiverText(row('Hillside Excavation'), es(row('Hillside Excavation')))).toBe(
      `Greg, la renuncia incondicional del pago 2 sigue pendiente. Ese pago se pagó el 28 sep. Súbala aquí: ${LINK}`,
    )
  })

  it('keeps the office’s own note in the words it was typed in', () => {
    const { row } = stoneOak()
    expect(remindDrawText(row('Rio Paving'), es(row('Rio Paving')))).toBe(
      `Dan, el pago 2 se le devolvió el jue 1 oct. Line 3, Base, lot, reads 80%. We see 50%. Send it again. Reenvíelo aquí: ${LINK}`,
    )
    expect(sendBackNote(lsLines(), 'es')).toBe('Línea 2, Rough-in, level 1, dice 90%. Nosotros vemos 75%. East wing branch lines not hung. Tenemos una foto. Envíelo de nuevo.')
  })
})
