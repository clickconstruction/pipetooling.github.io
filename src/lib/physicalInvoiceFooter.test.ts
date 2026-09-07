import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import {
  PHYSICAL_INVOICE_FOOTER_CUSTOM_PRESET_MAX,
  PHYSICAL_INVOICE_FOOTER_LABEL_MAX_CHARS,
  PHYSICAL_INVOICE_FOOTER_MAX_CHARS,
  PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE,
  PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD,
  getPhysicalInvoiceFooterDefaultOnOpen,
  getPhysicalInvoiceFooterSettingsDraft,
  listPhysicalInvoiceFooterPresets,
  parsePhysicalInvoiceFooterStoredJson,
  physicalInvoiceFooterActivePresetId,
  physicalInvoiceFooterSummaryLine,
} from './physicalInvoiceFooter'

// The node test environment has no `window`, so every getter below resolves
// from the shipped defaults — exactly the state a fresh browser is in before
// the first fetch.

describe('parsePhysicalInvoiceFooterStoredJson', () => {
  it('rejects anything that is not a v2 object', () => {
    const empty = { builtinOverrides: {}, builtinLabelOverrides: {}, customPresets: [], defaultPresetId: null }
    expect(parsePhysicalInvoiceFooterStoredJson(null)).toEqual(empty)
    expect(parsePhysicalInvoiceFooterStoredJson('x')).toEqual(empty)
    expect(parsePhysicalInvoiceFooterStoredJson([])).toEqual(empty)
    expect(parsePhysicalInvoiceFooterStoredJson({ standard: 'legacy shape' })).toEqual(empty)
    expect(parsePhysicalInvoiceFooterStoredJson({ v: 1, builtinOverrides: { standard: 'x' } })).toEqual(empty)
  })

  it('reads overrides, labels, custom presets and the default; caps lengths and count; "standard" default becomes null', () => {
    const long = 'x'.repeat(PHYSICAL_INVOICE_FOOTER_MAX_CHARS + 50)
    const out = parsePhysicalInvoiceFooterStoredJson({
      v: 2,
      builtinOverrides: { standard: long, alternate: 'alt body', bogus: 'ignored' },
      builtinLabelOverrides: { standard: '  Main  ', alternate: '', extra: 'no' },
      customPresets: [
        { id: 'c1', label: ' Lien ', body: 'lien text' },
        { id: 'bad' }, // missing fields → dropped
        ...Array.from({ length: PHYSICAL_INVOICE_FOOTER_CUSTOM_PRESET_MAX + 5 }, (_, i) => ({ id: `x${i}`, label: `L${i}`, body: 'b' })),
      ],
      defaultPresetId: ' standard ',
    })
    expect(out.builtinOverrides.standard).toHaveLength(PHYSICAL_INVOICE_FOOTER_MAX_CHARS)
    expect(out.builtinOverrides.alternate).toBe('alt body')
    expect(out.builtinLabelOverrides).toEqual({ standard: 'Main' }) // blank alternate label dropped
    expect(out.customPresets[0]).toEqual({ id: 'c1', label: 'Lien', body: 'lien text' })
    expect(out.customPresets).toHaveLength(PHYSICAL_INVOICE_FOOTER_CUSTOM_PRESET_MAX)
    expect(out.defaultPresetId).toBeNull()
  })

  it('keeps a non-standard default id and caps label length', () => {
    const out = parsePhysicalInvoiceFooterStoredJson({ v: 2, defaultPresetId: 'c1', builtinLabelOverrides: { standard: 'y'.repeat(PHYSICAL_INVOICE_FOOTER_LABEL_MAX_CHARS + 10) } })
    expect(out.defaultPresetId).toBe('c1')
    expect(out.builtinLabelOverrides.standard).toHaveLength(PHYSICAL_INVOICE_FOOTER_LABEL_MAX_CHARS)
  })
})

describe('shipped defaults (no window, no session)', () => {
  it('lists the two builtins with their shipped bodies and labels', () => {
    expect(listPhysicalInvoiceFooterPresets()).toEqual([
      { id: 'standard', label: 'Standard', body: PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD },
      { id: 'alternate', label: 'Alternate', body: PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE },
    ])
  })
  it('opens on the standard body', () => {
    expect(getPhysicalInvoiceFooterDefaultOnOpen()).toBe(PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD)
  })
  it('recognises a preset body exactly, and only exactly', () => {
    expect(physicalInvoiceFooterActivePresetId(PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE)).toBe('alternate')
    expect(physicalInvoiceFooterActivePresetId(PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE + ' ')).toBeNull()
    expect(physicalInvoiceFooterActivePresetId('')).toBeNull()
  })
  it('summarises the footer as None / the preset label / Custom', () => {
    expect(physicalInvoiceFooterSummaryLine('   ')).toBe('None')
    expect(physicalInvoiceFooterSummaryLine(PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD)).toBe('Standard')
    expect(physicalInvoiceFooterSummaryLine('Anything else')).toBe('Custom')
  })
  it('the Settings draft mirrors the shipped state', () => {
    expect(getPhysicalInvoiceFooterSettingsDraft()).toEqual({
      standardBody: PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD,
      alternateBody: PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE,
      standardLabel: 'Standard',
      alternateLabel: 'Alternate',
      customPresets: [],
      defaultPresetId: 'standard',
    })
  })
  it('the shipped footer bodies fit the cap', () => {
    expect(PHYSICAL_INVOICE_FOOTER_PRESET_STANDARD.length).toBeLessThanOrEqual(PHYSICAL_INVOICE_FOOTER_MAX_CHARS)
    expect(PHYSICAL_INVOICE_FOOTER_PRESET_ALTERNATE.length).toBeLessThanOrEqual(PHYSICAL_INVOICE_FOOTER_MAX_CHARS)
  })
})
