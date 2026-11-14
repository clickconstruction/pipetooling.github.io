import { describe, expect, it } from 'vitest'
import { buildPaintedMapPrintHtml, paintedMapPrintTitle, PAINTED_MAP_PRINT_KIND, type PaintedMapPrintInput } from './paintedMapPrint'

const PIC = 'data:image/jpeg;base64,AAAA'
const base: PaintedMapPrintInput = {
  company: { name: 'Made Up Plumbing', phone: '(555) 010-0000' },
  name: 'The way in for deliveries',
  words: 'Start at the truck gate.',
  picture: PIC,
  places: [
    { number: 1, name: 'Truck gate', words: 'Close it behind you.', photo: 'data:image/jpeg;base64,BBBB' },
    { number: 2, name: 'Meter', words: '', photo: null },
  ],
  lines: ['About 870 ft, give or take 10 ft · drawn by hand'],
  link: { url: 'https://example.test/way/q7m2kd4x9p', qrSvg: '<svg data-qr="1"></svg>', endsWords: 'The link ends by itself on Feb 11.' },
  madeWords: 'Made Nov 13, 2026',
}

describe('a painted map on paper', () => {
  it('carries the company, the map, its places, its lengths, the code and the day', () => {
    const html = buildPaintedMapPrintHtml(base)
    expect(html).toContain('<b>Made Up Plumbing</b>')
    expect(html).toContain('<h1>The way in for deliveries</h1>')
    expect(html).toContain('Start at the truck gate.')
    expect(html).toContain(`<img class="map" src="${PIC}"`)
    expect(html).toContain('<b>Truck gate</b><div class="w">Close it behind you.</div>')
    expect(html).toContain('<b>Meter</b></td>')
    expect(html).toContain('About 870 ft, give or take 10 ft · drawn by hand')
    expect(html).toContain('A length here is a guide for how far. It is not a measurement.')
    expect(html).toContain('<svg data-qr="1"></svg>')
    expect(html).toContain('example.test/way/q7m2kd4x9p')
    expect(html).toContain('The link ends by itself on Feb 11.')
    expect(html).toContain('Made Nov 13, 2026. A printed map goes out of date. Scan the code for the map as it is today.')
    expect(html).toContain('size: letter')
  })

  it('reaches out for nothing: every picture is in the page', () => {
    const html = buildPaintedMapPrintHtml({ ...base, picture: 'https://tiles.test/a.jpg', places: [{ number: 1, name: 'Gate', words: '', photo: 'https://signed.test/p.jpg?token=abc' }] })
    expect(html).not.toContain('tiles.test')
    expect(html).not.toContain('signed.test')
    expect(html).toContain('The picture of the map did not load. The places below are still right.')
    expect(html).not.toMatch(/<img[^>]+src="http/)
    expect(html).not.toContain('<script')
  })

  it('has no code without a link, and says who to ask', () => {
    const html = buildPaintedMapPrintHtml({ ...base, link: null })
    expect(html).not.toContain('class="code"')
    expect(html).toContain('Made Nov 13, 2026. A printed map goes out of date. Ask whoever gave it to you for the map as it is today.')
  })

  it('writes a name as words, never as markup', () => {
    const html = buildPaintedMapPrintHtml({ ...base, name: '<img src=x onerror=alert(1)>', words: '"quoted" & <b>bold</b>', places: [{ number: 1, name: '<script>x</script>', words: '<i>', photo: null }] })
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;')
  })

  it('prints a map of places alone, with no length line', () => {
    const html = buildPaintedMapPrintHtml({ ...base, lines: [] })
    expect(html).not.toContain('class="len"')
    expect(html).not.toContain('A length here is a guide')
  })

  it('is filed as a painted map print, titled with the map', () => {
    expect(PAINTED_MAP_PRINT_KIND).toBe('painted_map_print')
    expect(paintedMapPrintTitle('The way in')).toBe('Painted map: The way in')
  })
})
