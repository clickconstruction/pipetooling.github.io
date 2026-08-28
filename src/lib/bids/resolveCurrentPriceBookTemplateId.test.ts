import { describe, expect, it } from 'vitest'
import { resolveCurrentPriceBookTemplateId, resolvePriceBookTemplateRoot } from './resolveCurrentPriceBookTemplateId'

describe('resolveCurrentPriceBookTemplateId', () => {
  const templateIds = ['tmpl-default', 'tmpl-wendi']

  it('returns the source template of an active bid-owned copy', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-1',
        bidPricings: [{ id: 'copy-1', source_version_id: 'tmpl-wendi' }],
        templateIds,
      }),
    ).toBe('tmpl-wendi')
  })

  it('returns the template id when the active pricing IS a template (Default fallback)', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'tmpl-default',
        bidPricings: [],
        templateIds,
      }),
    ).toBe('tmpl-default')
  })

  it('returns null when no pricing is selected', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: null,
        bidPricings: [{ id: 'copy-1', source_version_id: 'tmpl-wendi' }],
        templateIds,
      }),
    ).toBeNull()
  })

  it('returns null for a bid-owned copy with no recorded source (e.g. built blank)', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-blank',
        bidPricings: [{ id: 'copy-blank', source_version_id: null }],
        templateIds,
      }),
    ).toBeNull()
  })

  it('prefers the owned-copy lineage even if the id also looks like a template list member', () => {
    // A copy is matched before the template-id check, so its source wins.
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-2',
        bidPricings: [{ id: 'copy-2', source_version_id: 'tmpl-default' }],
        templateIds,
      }),
    ).toBe('tmpl-default')
  })

  it('returns null when the active id is neither an owned copy nor a known template', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'tmpl-deleted',
        bidPricings: [],
        templateIds,
      }),
    ).toBeNull()
  })

  // v2.2396 (Wendi): scenarios born from "+ Add price" duplicates or bid-version clones
  // record another SCENARIO as their source — the template sits at the root of the chain.
  it('walks a scenario→scenario lineage to the template root', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-of-copy',
        bidPricings: [
          { id: 'copy-of-copy', source_version_id: 'copy-1' },
          { id: 'copy-1', source_version_id: 'tmpl-wendi' },
        ],
        templateIds,
      }),
    ).toBe('tmpl-wendi')
  })

  it('walks across bid versions (three hops) to the template root', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'v3-price',
        bidPricings: [
          { id: 'v3-price', source_version_id: 'v2-price' },
          { id: 'v2-price', source_version_id: 'v1-price' },
          { id: 'v1-price', source_version_id: 'tmpl-default' },
        ],
        templateIds,
      }),
    ).toBe('tmpl-default')
  })

  it('returns null when the lineage dead-ends before a template', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-of-blank',
        bidPricings: [
          { id: 'copy-of-blank', source_version_id: 'copy-blank' },
          { id: 'copy-blank', source_version_id: null },
        ],
        templateIds,
      }),
    ).toBeNull()
  })

  it('survives a cyclic lineage without looping', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'a',
        bidPricings: [
          { id: 'a', source_version_id: 'b' },
          { id: 'b', source_version_id: 'a' },
        ],
        templateIds,
      }),
    ).toBeNull()
  })

  it('returns null when the chain hops to a deleted scenario', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy-2',
        bidPricings: [{ id: 'copy-2', source_version_id: 'gone-scenario' }],
        templateIds,
      }),
    ).toBeNull()
  })
})

describe('resolvePriceBookTemplateRoot', () => {
  const templateIds = ['tmpl-wendi']

  it('resolves any pricing id (not just the selected one) — the dedupe direction', () => {
    const bidPricings = [
      { id: 'p1', source_version_id: 'tmpl-wendi' },
      { id: 'p2', source_version_id: 'p1' },
    ]
    expect(resolvePriceBookTemplateRoot({ pricingId: 'p2', bidPricings, templateIds })).toBe('tmpl-wendi')
    expect(resolvePriceBookTemplateRoot({ pricingId: 'p1', bidPricings, templateIds })).toBe('tmpl-wendi')
  })

  it('a template id resolves to itself', () => {
    expect(resolvePriceBookTemplateRoot({ pricingId: 'tmpl-wendi', bidPricings: [], templateIds })).toBe('tmpl-wendi')
  })
})

// v2.2444: `source_version_id` is ON DELETE SET NULL, so deleting a scenario orphans every copy
// taken from it. The name the clone carried over is the surviving evidence of lineage.
describe('name fallback for a severed lineage', () => {
  const templates = [
    { id: 'tmpl-default', name: 'Default' },
    { id: 'tmpl-wendi', name: 'WENDI' },
  ]
  const templateIds = templates.map((t) => t.id)

  it('resolves an orphaned copy by its name (BP384: two WENDI pricings, source deleted)', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'orphan',
        bidPricings: [{ id: 'orphan', source_version_id: null, name: 'WENDI' }],
        templateIds,
        templates,
      }),
    ).toBe('tmpl-wendi')
  })

  it('matches case- and whitespace-insensitively', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'orphan',
        bidPricings: [{ id: 'orphan', source_version_id: null, name: '  wendi ' }],
        templateIds,
        templates,
      }),
    ).toBe('tmpl-wendi')
  })

  it('follows the chain to the orphan at its end, not the pricing asked about', () => {
    // A scenario duplicated off an orphaned copy: the walk dead-ends at `orphan`, and the name
    // that decides is the one we started from — duplicates keep the source name too.
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'dupe',
        bidPricings: [
          { id: 'dupe', source_version_id: 'orphan', name: 'WENDI' },
          { id: 'orphan', source_version_id: null, name: 'WENDI' },
        ],
        templateIds,
        templates,
      }),
    ).toBe('tmpl-wendi')
  })

  it('refuses an ambiguous name — two templates share it, so neither is evidence', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'orphan',
        bidPricings: [{ id: 'orphan', source_version_id: null, name: 'WENDI' }],
        templateIds: [...templateIds, 'tmpl-wendi-2'],
        templates: [...templates, { id: 'tmpl-wendi-2', name: 'wendi' }],
      }),
    ).toBeNull()
  })

  it('stays null when the name matches no template', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'orphan',
        bidPricings: [{ id: 'orphan', source_version_id: null, name: 'Scratch pricing' }],
        templateIds,
        templates,
      }),
    ).toBeNull()
  })

  it('stays null for an unnamed orphan', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'orphan',
        bidPricings: [{ id: 'orphan', source_version_id: null, name: '' }],
        templateIds,
        templates,
      }),
    ).toBeNull()
  })

  it('a live lineage still wins over the name', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'copy',
        // Named WENDI but genuinely cloned from Default — the chain is the better evidence.
        bidPricings: [{ id: 'copy', source_version_id: 'tmpl-default', name: 'WENDI' }],
        templateIds,
        templates,
      }),
    ).toBe('tmpl-default')
  })

  it('without `templates` the dead-end stays null (pre-v2.2444 callers unchanged)', () => {
    expect(
      resolveCurrentPriceBookTemplateId({
        selectedPricingVersionId: 'orphan',
        bidPricings: [{ id: 'orphan', source_version_id: null, name: 'WENDI' }],
        templateIds,
      }),
    ).toBeNull()
  })

  it('breaks a cyclic lineage by name rather than looping', () => {
    expect(
      resolvePriceBookTemplateRoot({
        pricingId: 'a',
        bidPricings: [
          { id: 'a', source_version_id: 'b', name: 'WENDI' },
          { id: 'b', source_version_id: 'a', name: 'WENDI' },
        ],
        templateIds,
        templates,
      }),
    ).toBe('tmpl-wendi')
  })
})
