import { describe, expect, it } from 'vitest'
import {
  EMPTY_QUOTE_DRAFT,
  countAnswered,
  priceBasisHint,
  quoteFooterLines,
  quoteFooterVisible,
  quotePageView,
  shouldPersistDraft,
  strToCents,
  typedQuoteWork,
  type QuoteDraft,
} from './quotePageState'

const draft = (p: Partial<QuoteDraft> = {}): QuoteDraft => ({ ...EMPTY_QUOTE_DRAFT, lines: {}, ...p })

describe('quotePageView — a failed submit never takes the form away (J23-3, J23-N1)', () => {
  const loaded = { loading: false, loadError: null, pageStatus: 'sent', done: null }

  it('loading wins over everything', () => {
    expect(quotePageView({ ...loaded, loading: true })).toBe('loading')
  })

  it('a load-time failure (404, incomplete link, fetch failed) is a dead page', () => {
    expect(quotePageView({ ...loaded, loadError: 'This quote link doesn’t exist', pageStatus: null })).toBe('dead')
    expect(quotePageView({ ...loaded, pageStatus: null })).toBe('dead')
  })

  it('closed is closed whether it came from the first load or a 410 on submit', () => {
    expect(quotePageView({ ...loaded, pageStatus: 'closed' })).toBe('closed')
  })

  it('a sent quote shows the done screen; otherwise the form renders', () => {
    expect(quotePageView({ ...loaded, done: 3 })).toBe('done')
    expect(quotePageView(loaded)).toBe('form')
    expect(quotePageView({ ...loaded, pageStatus: 'quoted' })).toBe('form') // revision flow
  })

  it('there is no submit-error state: the view stays form (the notice rides the footer)', () => {
    // The kernel has no field for a submit error at all — the page keeps the
    // form mounted and puts the notice next to the Send button.
    expect(Object.keys(loaded)).not.toContain('submitError')
    expect(quotePageView(loaded)).toBe('form')
  })

  it('the sticky footer exists exactly on the form', () => {
    expect(quoteFooterVisible(loaded)).toBe(true)
    expect(quoteFooterVisible({ ...loaded, loading: true })).toBe(false)
    expect(quoteFooterVisible({ ...loaded, pageStatus: 'closed' })).toBe(false)
    expect(quoteFooterVisible({ ...loaded, done: 1 })).toBe(false)
    expect(quoteFooterVisible({ ...loaded, loadError: 'x', pageStatus: null })).toBe(false)
  })
})

describe('shouldPersistDraft — no draft key on a dead or closed link (J23-4)', () => {
  it('writes only for a loaded, open page with nothing sent yet', () => {
    expect(shouldPersistDraft({ token: 'abc', pageStatus: 'sent', done: null })).toBe(true)
    expect(shouldPersistDraft({ token: 'abc', pageStatus: 'quoted', done: null })).toBe(true)
  })

  it('404 / still loading / failed load: page never arrived → no write', () => {
    expect(shouldPersistDraft({ token: 'deadbeef', pageStatus: null, done: null })).toBe(false)
  })

  it('a draft loaded for another token is never written under this one', () => {
    expect(shouldPersistDraft({ token: 'new', pageStatus: 'sent', done: null, draftToken: 'old' })).toBe(false)
    expect(shouldPersistDraft({ token: 'new', pageStatus: 'sent', done: null, draftToken: 'new' })).toBe(true)
  })

  it('closed link → no write; sent quote → no write; blank token → no write', () => {
    expect(shouldPersistDraft({ token: 'abc', pageStatus: 'closed', done: null })).toBe(false)
    expect(shouldPersistDraft({ token: 'abc', pageStatus: 'sent', done: 2 })).toBe(false)
    expect(shouldPersistDraft({ token: '  ', pageStatus: 'sent', done: null })).toBe(false)
  })
})

describe('typedQuoteWork — what the closed screen shows back', () => {
  it('an untouched draft is null (the closed screen stays as it was)', () => {
    expect(typedQuoteWork(draft())).toBeNull()
    expect(typedQuoteWork(draft({ lines: { Toilets: { price: '', cantSupply: false, note: '' } } }))).toBeNull()
  })

  it('prices, can’t-supply and notes all count as work, in page order', () => {
    const d = draft({
      lines: {
        'Kitchen sinks': { price: '', cantSupply: true, note: 'alt brand: Elkay only' },
        Toilets: { price: '412.50', cantSupply: false, note: '' },
        Lavs: { price: '', cantSupply: false, note: 'call for brand' },
      },
    })
    expect(typedQuoteWork(d, ['Toilets', 'Kitchen sinks', 'Lavs', 'Carriers'])).toEqual({
      lines: [
        { fixture: 'Toilets', answer: '$412.50', note: null },
        { fixture: 'Kitchen sinks', answer: 'can’t supply', note: 'alt brand: Elkay only' },
        { fixture: 'Lavs', answer: '', note: 'call for brand' },
      ],
      extras: [],
    })
  })

  it('draft lines the page no longer lists still show (order after the page’s own)', () => {
    const d = draft({ lines: { Old: { price: '9', cantSupply: false, note: '' }, New: { price: '1', cantSupply: false, note: '' } } })
    expect(typedQuoteWork(d, ['New'])!.lines.map((l) => l.fixture)).toEqual(['New', 'Old'])
  })

  it('an unreadable price is echoed verbatim in quotes so the vendor sees what they typed', () => {
    const d = draft({ lines: { Toilets: { price: '412..50', cantSupply: false, note: '' } } })
    expect(typedQuoteWork(d)!.lines[0]?.answer).toBe('“412..50”')
  })

  it('quote-level extras: freight, validity, who', () => {
    const d = draft({ freight: '45', validUntil: '2026-10-03', quotedBy: 'Danny · Moore Supply' })
    expect(typedQuoteWork(d)).toEqual({ lines: [], extras: ['Freight $45.00', 'good until 2026-10-03', 'from Danny · Moore Supply'] })
  })
})

describe('quoteFooterLines — freight and valid-until are counted or their silence is marked (J23-6, J23-2)', () => {
  const lines = { Toilets: { price: '412.50', cantSupply: false, note: '' }, Sinks: { price: '', cantSupply: true, note: '' } }

  it('count line matches the old footer verbatim', () => {
    expect(quoteFooterLines({ answered: 0, total: 3, draft: draft() }).count).toBe('0 of 3 lines answered')
    expect(quoteFooterLines({ answered: 2, total: 3, draft: draft({ lines }) }).count).toBe('2 of 3 lines answered — partial is fine')
    expect(quoteFooterLines({ answered: 1, total: 1, draft: draft({ lines }) }).count).toBe('1 of 1 line answered — partial is fine')
  })

  it('silence is named, not implied', () => {
    expect(quoteFooterLines({ answered: 0, total: 3, draft: draft() }).extras).toBe('No freight quoted · no expiry date')
  })

  it('a typed freight and date are counted', () => {
    expect(quoteFooterLines({ answered: 0, total: 3, draft: draft({ freight: '1,250', validUntil: '2026-10-03' }) }).extras).toBe(
      'Freight $1,250.00 · good until 2026-10-03',
    )
  })

  it('a freight that isn’t a number is flagged rather than silently dropped (the submit would drop it)', () => {
    expect(quoteFooterLines({ answered: 0, total: 3, draft: draft({ freight: 'call' }) }).extras).toBe('Freight needs a number · no expiry date')
  })

  it('the save promise is always present, and turns into a receipt once something is typed', () => {
    expect(quoteFooterLines({ answered: 0, total: 3, draft: draft() }).save).toBe('Saves on this phone as you go')
    expect(quoteFooterLines({ answered: 2, total: 3, draft: draft({ lines }) }).save).toBe('Saved on this phone · nothing is sent until you tap Send quote')
    // Freight alone is typed work too — it is stored with the draft.
    expect(quoteFooterLines({ answered: 0, total: 3, draft: draft({ freight: '45' }) }).save).toMatch(/^Saved on this phone/)
  })
})

describe('answers and money parsing', () => {
  it('strToCents accepts $ and commas, rejects zero/negative/garbage', () => {
    expect(strToCents('$1,234.50')).toBe(123450)
    expect(strToCents(' 412.5 ')).toBe(41250)
    expect(strToCents('0')).toBeNull()
    expect(strToCents('-4')).toBeNull()
    expect(strToCents('abc')).toBeNull()
    expect(strToCents('')).toBeNull()
  })

  it('countAnswered counts priced or can’t-supply lines only, over the page’s fixtures', () => {
    const d = draft({
      lines: {
        A: { price: '10', cantSupply: false, note: '' },
        B: { price: '', cantSupply: true, note: '' },
        C: { price: '', cantSupply: false, note: 'note only' },
        Z: { price: '5', cantSupply: false, note: '' }, // not on the page
      },
    })
    expect(countAnswered(['A', 'B', 'C', 'D'], d)).toBe(2)
  })
})

describe('priceBasisHint — the $ box says what it is asking for (J23-5)', () => {
  it('footage units ask per ft', () => {
    for (const u of ['ft', 'FT', 'lf', 'LF', 'feet', 'foot', 'lin ft', 'linear feet', "'"]) expect(priceBasisHint(u)).toBe('per ft')
  })
  it('everything else — and no unit — asks each', () => {
    for (const u of ['ea', 'each', 'box', 'pc', '', null, undefined, 'ft2', '100 ft']) expect(priceBasisHint(u)).toBe('each')
  })
})
