import { describe, expect, it } from 'vitest'
import { GOOGLE_MAP_STYLES } from './googleMapLook'

const rule = (featureType: string) => GOOGLE_MAP_STYLES.filter((r) => r.featureType === featureType)

describe('GOOGLE_MAP_STYLES', () => {
  it('takes Google’s own place labels off: shops, landmarks, parks and the rest are all `poi`', () => {
    expect(rule('poi')).toEqual([{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }])
  })

  it('takes the bus stops and stations off with them', () => {
    expect(rule('transit')).toEqual([{ featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] }])
  })

  it('hides labels only, so a park keeps its green and a rail line its line on the road map', () => {
    for (const r of GOOGLE_MAP_STYLES) expect(r.elementType).toBe('labels')
  })

  it('names nothing else, so street names, road numbers and the names of towns and neighbourhoods stay', () => {
    expect(GOOGLE_MAP_STYLES.map((r) => r.featureType).sort()).toEqual(['poi', 'transit'])
    for (const kept of ['road', 'administrative', 'landscape', 'water', 'all']) {
      expect(GOOGLE_MAP_STYLES.some((r) => r.featureType === kept || r.featureType.startsWith(`${kept}.`))).toBe(false)
    }
  })

  it('only ever hides: no colour and no weight of Google’s map is changed', () => {
    for (const r of GOOGLE_MAP_STYLES) expect(r.stylers).toEqual([{ visibility: 'off' }])
  })
})
