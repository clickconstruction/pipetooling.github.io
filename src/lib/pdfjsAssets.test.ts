import { describe, expect, it } from 'vitest'

import { pdfjsAssetPath, pdfjsDocumentOptions } from './pdfjsAssets'

describe('pdfjsAssetPath', () => {
  it('names a file in one of the three served directories', () => {
    expect(pdfjsAssetPath('/pdfjs/wasm/jbig2.wasm')).toEqual({ dir: 'wasm', file: 'jbig2.wasm' })
    expect(pdfjsAssetPath('/pdfjs/wasm/jbig2_nowasm_fallback.js?x=1')).toEqual({ dir: 'wasm', file: 'jbig2_nowasm_fallback.js' })
    expect(pdfjsAssetPath('/pdfjs/cmaps/Adobe-Japan1-UCS2.bcmap')).toEqual({ dir: 'cmaps', file: 'Adobe-Japan1-UCS2.bcmap' })
    expect(pdfjsAssetPath('/pdfjs/standard_fonts/FoxitFixed.pfb')).toEqual({ dir: 'standard_fonts', file: 'FoxitFixed.pfb' })
  })

  it('refuses anything outside them, nested paths and dot files', () => {
    expect(pdfjsAssetPath('/pdfjs/build/pdf.worker.min.mjs')).toBeNull()
    expect(pdfjsAssetPath('/pdfjs/wasm/../package.json')).toBeNull()
    expect(pdfjsAssetPath('/pdfjs/wasm/%2e%2e/package.json')).toBeNull()
    expect(pdfjsAssetPath('/pdfjs/wasm/')).toBeNull()
    expect(pdfjsAssetPath('/pdfjs/wasm')).toBeNull()
    expect(pdfjsAssetPath('/assets/pdfjs/wasm/jbig2.wasm')).toBeNull()
    expect(pdfjsAssetPath('/pdfjs/wasm/.hidden')).toBeNull()
  })
})

describe('pdfjsDocumentOptions', () => {
  it('names the three directories under the base URL, with or without its trailing slash', () => {
    expect(pdfjsDocumentOptions('/')).toEqual({ wasmUrl: '/pdfjs/wasm/', cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/' })
    expect(pdfjsDocumentOptions('/app').wasmUrl).toBe('/app/pdfjs/wasm/')
  })
})
