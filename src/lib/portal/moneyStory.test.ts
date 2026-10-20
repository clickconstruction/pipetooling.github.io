import { describe, expect, it } from 'vitest'
import { moneyStory, nextAppSize, nextAppSizeWords, type MoneyCard, type MoneyStoryIn } from './moneyStory'
import { ELENA_MONEY, PRIYA_MONEY } from './portalTestPeople'

const card = (cards: MoneyCard[], kind: MoneyCard['kind'], n?: number) => cards.find((c) => c.kind === kind && (n === undefined || ('n' in c && c.n === n)))

describe("the customer's Money tab", () => {
  it("opens Elena's with the win: built, invested, paid on time, and the sum's one rule", () => {
    const story = moneyStory('en', ELENA_MONEY)
    expect(story.header).toEqual({
      big: '34% built',
      small: ['$445,000 of $1,302,450 invested', '3 of 3 paid on time'],
      pct: 34,
      check: 'The sum is your contract plus the 2 changes you signed. Nothing else.',
      howPay: null,
    })
  })

  it("lays Elena's cards out: the open one, After that, the newest paid one, the older ones folded", () => {
    const { cards } = moneyStory('en', ELENA_MONEY)
    expect(cards.map((c) => [c.kind, 'n' in c ? c.n : null])).toEqual([
      ['payApp', 4],
      ['after', null],
      ['payApp', 3],
      ['older', null],
    ])
    expect(card(cards, 'payApp', 4)).toEqual({
      kind: 'payApp',
      n: 4,
      title: 'Pay application 4',
      month: 'September',
      open: true,
      pill: null,
      covers: 'Roof deck, rough-in started, storefront glass',
      amount: '$41,200',
      photos: 3,
      checks: [
        { mark: 'plain', words: 'With your architect, Jonah Vale, for the certificate since Tue Sep 29.' },
        { mark: 'plain', words: 'Due 30 days after it.' },
        { mark: 'plain', words: 'Nothing to do yet.' },
      ],
      buttons: [{ label: 'Read the application', primary: false, press: 'read' }],
    })
    expect(card(cards, 'after')).toEqual({
      kind: 'after',
      title: 'After that',
      rows: [{ title: 'Pay application 5', month: 'October', words: 'roughly $115,000 to $145,000, about Nov 5' }],
      note: 'Sizes follow the schedule. The real number comes with the application.',
    })
    expect(card(cards, 'payApp', 3)).toMatchObject({
      open: false,
      pill: 'paid Sep 25',
      checks: [
        { mark: 'done', words: 'Certified by Jonah Vale, Sep 22.' },
        { mark: 'done', words: '6 lien waivers, every trade on it paid Sep 28' },
        { mark: 'done', words: 'Thank you' },
      ],
      buttons: [
        { label: 'Receipt', press: 'receipt' },
        { label: 'Waivers', press: 'waivers' },
      ],
    })
    expect(card(cards, 'older')).toEqual({ kind: 'older', words: 'Pay applications 2 and 1, paid', ns: [2, 1] })
  })

  it('opens the older paid ones when asked', () => {
    const { cards } = moneyStory('en', ELENA_MONEY, { showOlder: true })
    expect(cards.map((c) => [c.kind, 'n' in c ? c.n : null])).toEqual([
      ['payApp', 4],
      ['after', null],
      ['payApp', 3],
      ['payApp', 2],
      ['payApp', 1],
    ])
  })

  it("draws Elena's History in time order and the two numbers under it", () => {
    const { history } = moneyStory('en', ELENA_MONEY)
    expect(history.events.map((e) => [e.kind, e.title, e.amount])).toEqual([
      ['done', 'Contract signed', '$1,284,000'],
      ['done', 'Pay application 1 paid', '$162,000'],
      ['done', 'Pay application 2 paid', '$164,400'],
      ['done', 'Change order 1 signed', '+$11,200'],
      ['done', 'Change order 2 signed', '+$7,250'],
      ['done', 'Pay application 3 paid', '$118,600'],
      ['open', 'Pay application 4', '$41,200'],
      ['next', 'Pay application 5', null],
    ])
    expect(history.events[0]?.sub).toEqual(['Wed Jun 3'])
    expect(history.events[5]?.sub).toEqual(['Sep 25', 'thank you', '6 trades paid Sep 28'])
    expect(history.events[3]?.sub).toEqual(['Fri Sep 18', 'storefront glass'])
    expect(history.events[6]?.sub).toEqual(['with your architect since Tue Sep 29', 'Due 30 days after it.'])
    expect(history.events[7]?.sub).toEqual(['about Nov 5', 'October'])
    expect(history.investedSoFar).toEqual({ label: 'Invested so far', amount: '$445,000' })
    expect(history.toFinish).toEqual({ label: 'To finish', amount: '$857,450' })
    expect(moneyStory('en', ELENA_MONEY).payNote).toBe('Pay by bank transfer at no fee, or by card with a 3% fee. The details are on each bill.')
  })

  it("reads Elena's in Spanish, days and months included", () => {
    const story = moneyStory('es', ELENA_MONEY)
    expect(story.header.big).toBe('34% construido')
    expect(story.header.small).toEqual(['$445,000 de $1,302,450 invertido', '3 de 3 pagadas a tiempo'])
    expect(card(story.cards, 'payApp', 4)).toMatchObject({
      title: 'Solicitud de pago 4',
      month: 'septiembre',
      covers: 'Cubierta del techo, instalación interna iniciada, vidrio de fachada',
      checks: [{ words: 'Con su arquitecto, Jonah Vale, para el certificado desde el mar 29 sep.' }, { words: 'Vence 30 días después.' }, { words: 'Nada que hacer por ahora.' }],
    })
    expect(card(story.cards, 'after')).toMatchObject({ rows: [{ words: 'aproximadamente $115,000 a $145,000, cerca del 5 nov' }] })
    expect(card(story.cards, 'older')).toMatchObject({ words: 'Solicitudes de pago 2 y 1, pagadas' })
    expect(card(story.cards, 'payApp', 3)).toMatchObject({ pill: 'pagada el 25 sep', checks: [{ words: 'Certificada por Jonah Vale, el 22 sep.' }, { words: '6 renuncias de gravamen, cada oficio pagado el 28 sep' }, { words: 'Gracias' }] })
    expect(story.statement.title).toBe('El estado de cuenta')
  })

  it("reads Priya's month zero: Getting started, how paying works, the next one sized, the change waiting on her", () => {
    const story = moneyStory('en', PRIYA_MONEY)
    expect(story.header).toEqual({
      big: 'Getting started',
      small: ['$0 of $418,300 so far', 'first pay application about Nov 5'],
      pct: 0,
      check: 'The sum is your contract plus the one change you signed. Nothing else.',
      howPay: {
        title: 'How paying works',
        words:
          "Once a month we send a pay application for that month's work, with photos. Your architect certifies it. Then it is due in 30 days. Every one comes with a lien waiver from every trade we paid.",
      },
    })
    expect(story.cards).toEqual([
      {
        kind: 'after',
        title: 'After that',
        rows: [{ title: 'Pay application 1', month: 'October', words: 'roughly $60,000 to $80,000, about Nov 5' }],
        note: 'Sizes follow the schedule. The real number comes with the application.',
      },
      {
        kind: 'changes',
        title: 'Waiting on your answer',
        rows: [{ title: 'Change order 2', detail: 'a sink in exam 3', amount: '+$2,150' }],
        note: 'Signing it adds it to the sum. Declining it changes nothing.',
      },
    ])
    expect(story.history.events.map((e) => [e.title, e.sub])).toEqual([
      ['Contract signed', ['Sat Sep 19']],
      ['Change order 1 signed', ['Mon Sep 28', 'exam 2 cabinets']],
      ['Pay application 1', ['about Nov 5', 'October']],
    ])
    expect(story.statement.rows.slice(0, 2)).toEqual([
      { label: 'Contract', amount: '$412,000' },
      { label: 'Changes signed', amount: '+$6,300', count: 1 },
    ])
  })

  it('praises paid on time only when every payment was', () => {
    const late: MoneyStoryIn = { ...ELENA_MONEY, apps: ELENA_MONEY.apps.map((a) => (a.n === 2 && a.state === 'paid' ? { ...a, paidOn: '2026-09-30' } : a)) }
    expect(moneyStory('en', late).header.small).toEqual(['$445,000 of $1,302,450 invested'])
    const noDue: MoneyStoryIn = { ...ELENA_MONEY, apps: ELENA_MONEY.apps.map((a) => (a.n === 1 && a.state === 'paid' ? { ...a, dueOn: null } : a)) }
    expect(moneyStory('en', noDue).header.small).toHaveLength(1)
  })

  it('says the days to pay only when the job has them, and offers the card only when the job does', () => {
    const plain = moneyStory('en', { ...PRIYA_MONEY, payDays: null, cardFeePct: null })
    expect(plain.header.howPay?.words).toBe("Once a month we send a pay application for that month's work, with photos. Your architect certifies it. Every one comes with a lien waiver from every trade we paid.")
    expect(plain.payNote).toBe('Pay by bank transfer at no fee. The details are on each bill.')
    const noDays = moneyStory('en', { ...ELENA_MONEY, payDays: null })
    expect(card(noDays.cards, 'payApp', 4)).toMatchObject({ checks: [{ words: 'With your architect, Jonah Vale, for the certificate since Tue Sep 29.' }, { words: 'Nothing to do yet.' }] })
  })

  it('shows a certified one as due, with Pay it', () => {
    const due: MoneyStoryIn = {
      ...ELENA_MONEY,
      apps: ELENA_MONEY.apps.map((a) => (a.n === 4 ? { ...a, state: 'due' as const, certifiedBy: 'Jonah Vale', certifiedOn: '2026-10-06', dueOn: '2026-11-05' } : a)),
    }
    expect(card(moneyStory('en', due).cards, 'payApp', 4)).toMatchObject({
      open: true,
      checks: [
        { mark: 'done', words: 'Certified by Jonah Vale, Oct 6.' },
        { mark: 'strong', words: 'Due Nov 5.' },
      ],
      buttons: [
        { label: 'Pay it', primary: true, press: 'pay' },
        { label: 'Read the application', primary: false, press: 'read' },
      ],
    })
  })

  it('says the sum is the contract alone when nothing is signed, and a credit as a credit', () => {
    expect(moneyStory('en', { ...PRIYA_MONEY, changes: [] }).header.check).toBe('The sum is your contract. Nothing else.')
    const credit: MoneyStoryIn = { ...PRIYA_MONEY, changes: [{ id: 'c', number: 3, description: { en: 'drop the canopy', es: 'quitar el toldo' }, price: -500, days: 0, state: 'open' }] }
    expect(card(moneyStory('en', credit).cards, 'changes')).toMatchObject({ rows: [{ amount: 'a credit of $500' }] })
  })
})

describe("the next application's size", () => {
  it('reads the forecast ten percent either side, rounded out to $5,000', () => {
    expect(nextAppSize(130000)).toEqual({ low: 115000, high: 145000 })
    expect(nextAppSize(70000)).toEqual({ low: 60000, high: 80000 })
    expect(nextAppSize(100000)).toEqual({ low: 90000, high: 110000 })
    expect(nextAppSize(20000)).toEqual({ low: 15000, high: 25000 })
    expect(nextAppSizeWords(130000)).toBe('$115,000 to $145,000')
  })

  it('reads one rounded amount under $20,000', () => {
    expect(nextAppSize(19999)).toEqual({ about: 20000 })
    expect(nextAppSize(12340)).toEqual({ about: 12000 })
    expect(nextAppSizeWords(12340)).toBe('about $12,000')
    const small = moneyStory('en', { ...PRIYA_MONEY, next: { n: 1, month: '2026-10-01', bill: 12340, aboutOn: '2026-11-05' } })
    expect(card(small.cards, 'after')).toMatchObject({ rows: [{ words: 'about $12,000, around Nov 5' }] })
    expect(card(moneyStory('es', { ...PRIYA_MONEY, next: { n: 1, month: '2026-10-01', bill: 12340, aboutOn: '2026-11-05' } }).cards, 'after')).toMatchObject({
      rows: [{ words: 'cerca de $12,000, alrededor del 5 nov' }],
    })
  })
})
