import { describe, expect, it } from 'vitest'
import { PAINTED_PLACE_WORDS_MAX, PAINTED_PLACE_WORDS_SHORT, cleanPlaceWords, placeWordsAreLong, placeWordsOnOneLine, shortPlaceWords } from './paintedPlaceWords'

const SEWER = '4 in. PVC sewer, from the house to the tap at the street. About 4 ft deep at the walk and 6 ft at the curb. It runs straight, under the left edge of the front walk. The old clay line is still in the ground beside it, capped at both ends.'

describe('cleanPlaceWords', () => {
  it('keeps one line as it is', () => {
    expect(cleanPlaceWords('  Close it   behind you. ')).toBe('Close it behind you.')
  })
  it('keeps the lines a person wrote', () => {
    expect(cleanPlaceWords('4 in. PVC\r\nAbout 4 ft deep\n  Runs to the street  ')).toBe('4 in. PVC\nAbout 4 ft deep\nRuns to the street')
  })
  it('makes three or more line breaks two', () => {
    expect(cleanPlaceWords('One\n\n\n\nTwo')).toBe('One\n\nTwo')
  })
  it('reads nothing as nothing', () => {
    expect(cleanPlaceWords(null)).toBe('')
    expect(cleanPlaceWords(' \n \n ')).toBe('')
  })
  it('cuts at the table’s cap', () => {
    expect(cleanPlaceWords('a'.repeat(PAINTED_PLACE_WORDS_MAX + 50))).toHaveLength(PAINTED_PLACE_WORDS_MAX)
  })
  it('keeps a whole description under the cap', () => {
    expect(cleanPlaceWords(SEWER)).toBe(SEWER)
  })
})

describe('placeWordsOnOneLine', () => {
  it('makes every line break one space', () => {
    expect(placeWordsOnOneLine('4 in. PVC\nAbout 4 ft deep\n\nRuns to the street')).toBe('4 in. PVC About 4 ft deep Runs to the street')
  })
})

describe('shortPlaceWords', () => {
  it('gives short words whole', () => {
    expect(shortPlaceWords('Close it behind you.')).toBe('Close it behind you.')
    expect(placeWordsAreLong('Close it behind you.')).toBe(false)
  })
  it('gives words of exactly the room whole', () => {
    const exact = 'a'.repeat(PAINTED_PLACE_WORDS_SHORT)
    expect(shortPlaceWords(exact)).toBe(exact)
    expect(placeWordsAreLong(exact)).toBe(false)
  })
  it('cuts a long description at the last sentence that fits', () => {
    const short = shortPlaceWords(SEWER)
    expect(short).toBe('4 in. PVC sewer, from the house to the tap at the street. About 4 ft deep at the walk and 6 ft at the curb. …')
    expect(short.length).toBeLessThanOrEqual(PAINTED_PLACE_WORDS_SHORT + 2)
    expect(placeWordsAreLong(SEWER)).toBe(true)
  })
  it('does not take an abbreviation’s dot inside a word for a sentence end', () => {
    // `4 in.` is followed by a space, so it can end the cut, but only when it says enough.
    const words = `4 in. ${'pipe '.repeat(60)}`
    expect(shortPlaceWords(words).endsWith('…')).toBe(true)
    expect(shortPlaceWords(words)).not.toBe('4 in. …')
  })
  it('cuts at a word when no sentence ends in time', () => {
    const words = 'word '.repeat(80).trim()
    const short = shortPlaceWords(words)
    expect(short.endsWith('word…')).toBe(true)
    expect(short.length).toBeLessThanOrEqual(PAINTED_PLACE_WORDS_SHORT)
  })
  it('cuts one unbroken run at the room', () => {
    const short = shortPlaceWords('x'.repeat(500))
    expect(short).toBe(`${'x'.repeat(PAINTED_PLACE_WORDS_SHORT - 1)}…`)
  })
  it('puts the lines of a description on one', () => {
    expect(shortPlaceWords('Garage.\nBehind the water heater.')).toBe('Garage. Behind the water heater.')
  })
  it('takes a room of its own', () => {
    expect(shortPlaceWords('One two three four five six seven eight nine ten eleven twelve thirteen', 40)).toBe('One two three four five six seven eight…')
  })
})

describe('a long description on the surfaces that share their room', () => {
  it('is its short form in the key under a picture, after the name', async () => {
    const { pictureKeyLine } = await import('./paintedMapPicture')
    expect(pictureKeyLine({ name: 'Buried sewer line', words: SEWER })).toBe('Buried sewer line. 4 in. PVC sewer, from the house to the tap at the street. About 4 ft deep at the walk and 6 ft at the curb. …')
    expect(pictureKeyLine({ name: 'Truck gate', words: 'Close it behind you.' })).toBe('Truck gate. Close it behind you.')
  })
  it('is its short form in a text about one place, over the link', async () => {
    const { placeShareWords } = await import('./paintedPlaceShare')
    const words = placeShareWords({ lat: 29.5, lng: -98.2, name: 'Buried sewer line', kind: 'buried_sewer', words: SEWER }) ?? ''
    expect(words.split('\n')[0]).toBe('Buried sewer line. 4 in. PVC sewer, from the house to the tap at the street. About 4 ft deep at the walk and 6 ft at the curb. …')
    expect(words.split('\n')).toHaveLength(2)
  })
  it('is whole on a printed page, with its lines kept', async () => {
    const { buildPaintedMapPrintHtml } = await import('./paintedMapPrint')
    const html = buildPaintedMapPrintHtml({ name: 'Places on this job', words: '', company: { name: 'A company', phone: '' }, madeWords: '', picture: null, link: null, lines: [], places: [{ number: 1, name: 'Buried sewer line', words: `${SEWER}\nSecond line.`, kind: 'buried_sewer', photo: null }] })
    expect(html).toContain(`${SEWER}\nSecond line.`)
    expect(html).toContain('.w { white-space: pre-wrap; overflow-wrap: anywhere; }')
  })
})
