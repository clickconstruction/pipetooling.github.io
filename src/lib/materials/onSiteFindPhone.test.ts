import { describe, expect, it } from 'vitest'
import type { Container, ContainerLine } from './onSite'
import type { OnSiteFindHit } from './onSiteFind'
import { findPhoneRow } from './onSiteFindPhone'

const box = (over: Partial<Container> = {}): Container => ({ id: 'c1', jobId: 'j1', label: 'G12', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z', ...over }) as Container
const line = (over: Partial<ContainerLine> = {}): ContainerLine => ({ containerId: 'c1', partKey: 'zz test elbow', partId: null, partName: 'ZZ test elbow', manufacturer: null, onHand: 94, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, ...over }) as ContainerLine
const hit = (over: Partial<OnSiteFindHit> = {}): OnSiteFindHit => ({ jobId: 'j1', jobLabel: '224 · ZZ Test phase 2', container: box(), place: '', line: line(), ...over })
const counted = { words: 'counted Mon by Sam', due: false }

describe('a part that matched', () => {
  it('reads the part, the box it is in, the job, and how many are on hand', () => {
    expect(findPhoneRow(hit({ place: 'North yard', container: box({ where: 'by the gate' }), line: line({ manufacturer: 'ZZ Maker' }) }), counted)).toEqual({
      key: 'c1:zz test elbow',
      title: 'ZZ test elbow',
      maker: 'ZZ Maker',
      boxLabel: 'G12',
      boxWords: 'cage · North yard · by the gate',
      jobWords: '224 · ZZ Test phase 2',
      onHand: '94',
      countWords: 'counted Mon by Sam',
      due: false,
      openLabel: 'Open G12 on 224 · ZZ Test phase 2',
    })
  })

  it('a box nobody placed says only what it is', () => {
    expect(findPhoneRow(hit(), counted).boxWords).toBe('cage')
    expect(findPhoneRow(hit({ container: box({ kind: 'loose' }) }), counted).boxWords).toBe('loose pile')
  })

  it('a big count keeps its thousands mark, and none on hand is a zero', () => {
    expect(findPhoneRow(hit({ line: line({ onHand: 1250 }) }), counted).onHand).toBe('1,250')
    expect(findPhoneRow(hit({ line: line({ onHand: 0 }) }), counted).onHand).toBe('0')
  })

  it('a box due a count says so in its words and is marked', () => {
    expect(findPhoneRow(hit(), { words: 'counted 21 days ago', due: true })).toMatchObject({ countWords: 'counted 21 days ago', due: true })
  })
})

describe('a box that matched by its own name', () => {
  it('is named by the box, with no part, no maker and no figure', () => {
    expect(findPhoneRow(hit({ line: null, place: 'North yard' }), counted)).toMatchObject({ key: 'c1:', title: 'G12', maker: '', boxLabel: '', boxWords: 'cage · North yard', onHand: null, openLabel: 'Open G12 on 224 · ZZ Test phase 2' })
  })
})

describe('the row a delivery lands in', () => {
  it('reads delivered, and says nothing about a count it never has', () => {
    const row = findPhoneRow(hit({ container: box({ label: 'Unsorted', kind: 'unsorted' }) }), { words: 'never counted', due: true })
    expect(row).toMatchObject({ boxLabel: 'Unsorted', boxWords: 'delivered', countWords: '', due: false })
  })
})

describe('keys', () => {
  it('two parts in one box and one part in two boxes are four rows', () => {
    const keys = [
      findPhoneRow(hit(), counted),
      findPhoneRow(hit({ line: line({ partKey: 'zz test tee', partName: 'ZZ test tee' }) }), counted),
      findPhoneRow(hit({ container: box({ id: 'c2', label: 'G13' }), line: line({ containerId: 'c2' }) }), counted),
      findPhoneRow(hit({ line: null }), counted),
    ].map((r) => r.key)
    expect(new Set(keys).size).toBe(4)
  })
})
