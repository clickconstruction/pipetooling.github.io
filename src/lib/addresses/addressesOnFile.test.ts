import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import { plainWordsFailures } from '../plainWords'
import {
  CLOSE_ON_FILE_WORDS,
  addressesOnFile,
  closeOnFile,
  closeOnFileFoot,
  onFileCountWords,
  onFileEntry,
  onFileMatches,
  onFileSentence,
  type AddressRow,
} from './addressesOnFile'

const job = (id: string, address: string | null, developmentId: string | null = null): AddressRow => ({ kind: 'job', id, address, developmentId })
const bid = (id: string, address: string | null, developmentId: string | null = null): AddressRow => ({ kind: 'bid', id, address, developmentId })

const DEVS = new Map([['d1', 'Old Quarry Ranch'], ['d2', 'Sample Flats']])

const ROWS: AddressRow[] = [
  job('j1', '118 Old Quarry Trl, Sampleton, TX', 'd1'),
  job('j2', '118 Old Quarry Trail, Sampleton, TX 78000', 'd1'),
  job('j3', '118 Old Quarry Trl, Sampleton, TX', null),
  bid('b1', '118 old quarry trl, sampleton, tx', 'd1'),
  job('j4', '118 Old Quarry Trl Barn, Sampleton, TX'),
  job('j5', '11704 FM 1117, Placeholder, TX'),
  job('j6', '412 Sample Canyon Dr Building 20, Exampleville, TX'),
  job('j7', '8217 Placeholder Creek Blvd, Exampleville, TX'),
  job('j8', '   '),
  job('j9', null),
  bid('b2', '90 Example Ridge Rd, Placeholder, TX', 'd2'),
]

const LIST = addressesOnFile(ROWS, DEVS)
const find = (start: string) => LIST.find((a) => a.address.startsWith(start))

describe('addressesOnFile', () => {
  it('puts one address under one cleaned key, however it was written', () => {
    const quarry = find('118 Old Quarry Trl, S')
    expect(quarry).toMatchObject({ jobs: 3, bids: 1, developmentName: 'Old Quarry Ranch' })
    // Trl and Trail, a zip, and lower case are the same address. The barn is its own.
    expect(LIST.filter((a) => a.key.startsWith('118 old quarry trail')).length).toBe(2)
  })

  it('keeps the spelling most of its jobs use, and the first one read on a tie', () => {
    expect(find('118 Old Quarry')?.address).toBe('118 Old Quarry Trl, Sampleton, TX')
    const tie = addressesOnFile([job('a', '5 A St'), job('b', '5 A Street')], new Map())
    expect(tie[0]?.address).toBe('5 A St')
  })

  it('leaves a blank address out', () => {
    expect(LIST.length).toBe(6)
  })

  it('names a development only when every job and bid there that has one has the same one', () => {
    const mixed = addressesOnFile([job('a', '5 A St', 'd1'), job('b', '5 A St', 'd2')], DEVS)
    expect(mixed[0]?.developmentName).toBeNull()
    expect(find('90 Example')?.developmentName).toBe('Sample Flats')
    expect(find('11704')?.developmentName).toBeNull()
  })

  it('does not count the job being edited at its own address', () => {
    const without = addressesOnFile(ROWS, DEVS, { kind: 'job', id: 'j5' })
    expect(without.some((a) => a.address.startsWith('11704'))).toBe(false)
    const fewer = addressesOnFile(ROWS, DEVS, { kind: 'job', id: 'j1' })
    expect(fewer.find((a) => a.key === '118 old quarry trail sampleton tx')?.jobs).toBe(2)
    // A bid with the same id is another thing.
    expect(addressesOnFile(ROWS, DEVS, { kind: 'bid', id: 'j5' }).some((a) => a.address.startsWith('11704'))).toBe(true)
  })
})

describe('onFileMatches', () => {
  it('waits for three typed characters', () => {
    expect(onFileMatches(LIST, '11')).toEqual([])
    expect(onFileMatches(LIST, ' 1 1 ')).toEqual([])
    expect(onFileMatches(LIST, '117').map((m) => m.address)).toEqual(['11704 FM 1117, Placeholder, TX'])
  })

  it('finds an address by the start of what is typed, the busiest first', () => {
    const rows = onFileMatches(LIST, '118 old quar')
    expect(rows.map((m) => m.address)).toEqual(['118 Old Quarry Trl, Sampleton, TX', '118 Old Quarry Trl Barn, Sampleton, TX'])
    expect(rows[0]?.matchEnd).toBe('118 old quar'.length)
  })

  it('treats the last typed word as half a word, so a short form does not hide a match', () => {
    // `tr` would clean to `trail`. Typed as the last word it still finds `trl` and `trail`.
    expect(onFileMatches(LIST, '118 old quarry tr').length).toBe(2)
    expect(onFileMatches(LIST, '118 old quarry t').length).toBe(2)
    // `st` must not turn into `street` and miss a street named Stone.
    const stone = addressesOnFile([job('a', '40 Stone Rd, Placeholder, TX')], new Map())
    expect(onFileMatches(stone, '40 st').length).toBe(1)
  })

  it('finds a street typed with no house number, after the ones that start that way', () => {
    const rows = onFileMatches(LIST, 'sample can')
    expect(rows.map((m) => m.address)).toEqual(['412 Sample Canyon Dr Building 20, Exampleville, TX'])
    expect(rows[0]?.matchEnd).toBe(0)
  })

  it('shows three rows at most', () => {
    const many = addressesOnFile(['A', 'B', 'C', 'D', 'E'].map((x, i) => job(String(i), `77 Sample ${x} St`)), new Map())
    expect(onFileMatches(many, '77 sample').length).toBe(3)
    expect(onFileMatches(many, '77 sample', 1).length).toBe(1)
  })

  it('finds nothing for words no address has', () => {
    expect(onFileMatches(LIST, 'nowhere lane')).toEqual([])
  })
})

describe('onFileEntry and its words', () => {
  it('knows an address on file by its cleaned key', () => {
    expect(onFileEntry(LIST, '118 OLD QUARRY TRAIL, Sampleton, TX 78000')?.jobs).toBe(3)
    expect(onFileEntry(LIST, '119 Old Quarry Trl')).toBeNull()
    expect(onFileEntry(LIST, '  ')).toBeNull()
  })

  it('counts jobs and bids in words', () => {
    expect(onFileCountWords({ jobs: 25, bids: 0 })).toBe('25 jobs')
    expect(onFileCountWords({ jobs: 1, bids: 2 })).toBe('1 job and 2 bids')
    expect(onFileCountWords({ jobs: 0, bids: 1 })).toBe('1 bid')
  })

  it('says the line under the box, with its values marked', () => {
    const quarry = onFileEntry(LIST, '118 Old Quarry Trl, Sampleton, TX')
    expect(quarry).not.toBeNull()
    if (!quarry) return
    expect(plainSentence(onFileSentence(quarry))).toBe('On file. 3 jobs and 1 bid are at this address, in the development Old Quarry Ranch.')
    const one = onFileEntry(LIST, '11704 FM 1117, Placeholder, TX')
    if (!one) return
    expect(plainSentence(onFileSentence(one))).toBe('On file. 1 job is at this address.')
    expect(onFileSentence(one)).toContain('⟪count|1 job⟫')
  })
})

describe('closeOnFile', () => {
  it('asks about an address one letter off the one on file', () => {
    const close = closeOnFile(LIST, '118 Old Quary Trl, Sampleton TX')
    expect(close?.entry.address).toBe('118 Old Quarry Trl, Sampleton, TX')
    expect(close?.typed.filter((w) => w.differs).map((w) => w.text)).toEqual(['Quary'])
    expect(close?.onFile.filter((w) => w.differs).map((w) => w.text)).toEqual(['Quarry'])
  })

  it('asks about a space that is missing or added', () => {
    expect(closeOnFile(LIST, '11704 FM1117, Placeholder, TX')?.entry.address).toBe('11704 FM 1117, Placeholder, TX')
  })

  it('is quiet for an address already on file', () => {
    expect(closeOnFile(LIST, '118 old quarry trail, sampleton, tx')).toBeNull()
  })

  it('is quiet for another house number, another unit or another building', () => {
    expect(closeOnFile(LIST, '120 Old Quarry Trl, Sampleton, TX')).toBeNull()
    expect(closeOnFile(LIST, '412 Sample Canyon Dr Building 16, Exampleville, TX')).toBeNull()
    expect(closeOnFile(LIST, '8217 Placeholder Creek Blvd 201, Exampleville, TX')).toBeNull()
  })

  it('is quiet for an address with no house number, and for a blank', () => {
    expect(closeOnFile(LIST, 'Old Quary Trl, Sampleton, TX')).toBeNull()
    expect(closeOnFile(LIST, '')).toBeNull()
  })

  it('is quiet for a different street that happens to share a number', () => {
    expect(closeOnFile(LIST, '118 Elm Grove Ct, Sampleton, TX')).toBeNull()
  })

  it('picks the nearer one, then the busier one', () => {
    const list = addressesOnFile([job('a', '9 Maple Ridge Rd'), job('b', '9 Maple Ridge Rd'), job('c', '9 Maple Bridge Rd')], new Map())
    expect(closeOnFile(list, '9 Maple Ridg Rd')?.entry.jobs).toBe(2)
  })
})

describe('the words', () => {
  it('pass the plain-words rules', () => {
    const quarry = onFileEntry(LIST, '118 Old Quarry Trl, Sampleton, TX')
    if (!quarry) throw new Error('fixture')
    const lines = [CLOSE_ON_FILE_WORDS.title, closeOnFileFoot(quarry), plainSentence(onFileSentence(quarry))]
    for (const line of lines) expect(plainWordsFailures(line), line).toEqual([])
  })

  it('names the count in the foot', () => {
    const quarry = onFileEntry(LIST, '118 Old Quarry Trl, Sampleton, TX')
    if (!quarry) throw new Error('fixture')
    expect(closeOnFileFoot(quarry)).toBe('Keeping yours makes a new place. This job will not match the 3 jobs and 1 bid on file. You can still save.')
  })
})
