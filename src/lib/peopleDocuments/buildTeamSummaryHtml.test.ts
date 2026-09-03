import { describe, expect, it } from 'vitest'
import {
  buildTeamSummaryHtml,
  type TeamSummaryHtmlContext,
  type TeamSummaryHtmlOverheadDecomp,
} from './buildTeamSummaryHtml'
import type { TeamSummaryBreakdown } from '../../components/people/teamSummary/types'

function makeBreakdown(overrides: Partial<TeamSummaryBreakdown> = {}): TeamSummaryBreakdown {
  return {
    idx: 0,
    name: 'Alice Field',
    hb: {
      source: 'hourly',
      onlyPaidJobs: false,
      dailyRows: [
        {
          date: '2026-07-01',
          hours: 8,
          crewAllocations: [
            { hcp: 'HCP-1', jobName: 'Smith repipe', address: '12 Main St', pct: 100, hours: 8, valueCreated: 900 },
          ],
        },
      ],
      subLaborRows: [],
      totals: { daily: 8, crew: 8, subLabor: 0, totalHours: 8 },
    },
    gb: {
      jobs: [
        {
          jobId: 'j1',
          hcp: 'HCP-1',
          jobName: 'Smith repipe',
          totalBill: 1000,
          pctComplete: 100,
          pctCompleteSource: 'set',
          valueCreated: 1000,
          totalLaborOnJob: 400,
          costInPeriod: 400,
          ratio: 1,
          allocatedRevenue: 1000,
        },
      ],
      total: 1000,
    },
    nb: {
      jobs: [
        {
          jobId: 'j1',
          hcp: 'HCP-1',
          jobName: 'Smith repipe',
          valueCreated: 1000,
          partsCost: 100,
          tagCosts: {},
          totalLaborOnJob: 400,
          revenueBeforeOverhead: 500,
          costInPeriod: 400,
          ratio: 1,
          allocatedNet: 500,
        },
      ],
      total: 500,
    },
    pb: {
      jobs: [{ jobId: 'j1', hcp: 'HCP-1', jobName: 'Smith repipe', allocatedNet: 500, hoursInPeriod: 8 }],
      totalNet: 500,
      totalHours: 8,
      fieldHours: 8,
      overheadHours: 0,
      unaccountedHours: 0,
    },
    totalHours: 8,
    overheadHours: 0,
    officeHours: 0,
    bidHours: 0,
    fieldHours: 8,
    hourlyWage: 50,
    overheadWage: 50,
    allocatedParts: 0,
    allocatedByTag: {},
    vehicleArrangement: 'none' as const,
    vehicleRate: null,
    vehicleTruckName: null,
    vehicleCost: 0,
    allocatedLabor: 0,
    overheadLaborCost: 0,
    overheadSessions: [],
    gross: 1000,
    net: 500,
    profitAfterOverhead: 460,
    overheadBurden: -40,
    revPerHour: 125,
    netPerHour: 62.5,
    profitPerHourAfterOverhead: 57.5,
    payConfigSource: 'hourly',
    ...overrides,
  }
}

function makeDecomp(overrides: Partial<TeamSummaryHtmlOverheadDecomp> = {}): TeamSummaryHtmlOverheadDecomp {
  return {
    ratePerHour: 12.5,
    ratePerRevenueDecimal: 0.18,
    ratePerLaborDollar: 0.42,
    windowStart: '2026-05-04',
    windowEnd: '2026-08-01',
    officeLabor90d: 20000,
    bidLabor90d: 5000,
    officeParts90d: 3000,
    invoices90d: 150000,
    fieldHours90d: 2240,
    fieldLaborUsd90d: 90000,
    ...overrides,
  }
}

function baseCtx(overrides: Partial<TeamSummaryHtmlContext> = {}): TeamSummaryHtmlContext {
  return {
    isEmbedded: false,
    periodLabel: 'Last 30 days (2026-07-03 – 2026-08-01)',
    breakdowns: [makeBreakdown(), makeBreakdown({ idx: 1, name: 'Bob Office', payConfigSource: 'salary' })],
    overheadRate: 12.5,
    overheadRateLoading: false,
    overheadDecomp: makeDecomp(),
    selectedPersonName: null,
    ...overrides,
  }
}

describe('buildTeamSummaryHtml', () => {
  it('builds a standalone popup document with title, header, period meta, and roster count', () => {
    const html = buildTeamSummaryHtml(baseCtx())
    expect(html.startsWith('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary</title>')).toBe(true)
    expect(html.trimEnd().endsWith('</body></html>')).toBe(true)
    expect(html).toContain('<h1>Team Summary</h1>')
    expect(html).toContain(
      '<div class="meta">Last 30 days (2026-07-03 – 2026-08-01) &middot; 2 people</div>',
    )
  })

  it('uses the singular noun for a one-person roster', () => {
    const html = buildTeamSummaryHtml(baseCtx({ breakdowns: [makeBreakdown()] }))
    expect(html).toContain('&middot; 1 person</div>')
  })

  it('popup mode: 1in margin, visible h1, and no embedded resize script', () => {
    const html = buildTeamSummaryHtml(baseCtx({ isEmbedded: false }))
    expect(html).toContain('body { font-family: sans-serif; margin: 1in; }')
    expect(html).toContain('h1 { margin-bottom: 0.25rem; }')
    expect(html).not.toContain('team-summary-resize')
  })

  it('embedded mode (dead branch, kept intentionally): 0 margin, hidden h1, resize script present', () => {
    const html = buildTeamSummaryHtml(baseCtx({ isEmbedded: true, selectedPersonName: 'Alice Field' }))
    expect(html).toContain('body { font-family: sans-serif; margin: 0; }')
    expect(html).toContain('h1 { margin-bottom: 0.25rem; display: none; }')
    expect(html).toContain("parent.postMessage({ type: 'team-summary-resize', height: r }, '*')")
    expect(html).toContain('var selectedPersonName = "Alice Field";')
  })

  it('serializes the breakdowns payload and overhead JSON into the script', () => {
    const html = buildTeamSummaryHtml(baseCtx())
    expect(html).toContain('var breakdowns = [{"idx":0,"name":"Alice Field",')
    expect(html).toContain('var overheadRate = 12.5;')
    expect(html).toContain('"ratePerLaborDollar":0.42')
    expect(html).toContain('var selectedPersonName = null;')
  })

  it('serializes a null overhead rate and preserves raw nulls in the decomposition', () => {
    const html = buildTeamSummaryHtml(
      baseCtx({
        overheadRate: null,
        overheadDecomp: makeDecomp({ ratePerHour: null, officeLabor90d: null, fieldHours90d: null }),
      }),
    )
    expect(html).toContain('var overheadRate = null;')
    // The popup has always serialized the raw (possibly-null) rate fields —
    // unlike the inline memo, which coerces the pool numbers to 0.
    expect(html).toContain('"officeLabor90d":null')
    expect(html).toContain('"fieldHours90d":null')
  })

  it('renders the overhead meta as a clickable button when the rate is loaded', () => {
    const html = buildTeamSummaryHtml(baseCtx({ overheadRate: 12.5, overheadRateLoading: false }))
    expect(html).toContain(
      '<button type="button" id="overhead-meta-btn" class="meta-sub-btn" title="Click for rate decomposition">Overhead Method A: $12.50 per field hour (rolling 90-day rate) <span aria-hidden="true">&#9432;</span></button>',
    )
  })

  it('renders plain loading / unavailable meta text with no button', () => {
    // The script always looks up #overhead-meta-btn, so assert the button
    // MARKUP is absent, not the id string itself.
    const loading = buildTeamSummaryHtml(baseCtx({ overheadRateLoading: true }))
    expect(loading).toContain('<div class="meta-sub">Overhead Method A: loading…</div>')
    expect(loading).not.toContain('<button type="button" id="overhead-meta-btn"')
    const unavailable = buildTeamSummaryHtml(baseCtx({ overheadRate: null, overheadRateLoading: false }))
    expect(unavailable).toContain('<div class="meta-sub">Overhead Method A: unavailable</div>')
    expect(unavailable).not.toContain('<button type="button" id="overhead-meta-btn"')
  })

  it('HTML-escapes the period label', () => {
    const html = buildTeamSummaryHtml(baseCtx({ periodLabel: 'Custom <range> & "stuff"' }))
    expect(html).toContain('Custom &lt;range&gt; &amp; &quot;stuff&quot; &middot;')
    expect(html).not.toContain('Custom <range>')
  })

  it('escapes </ in JSON payloads so a hostile name cannot close the script tag', () => {
    const html = buildTeamSummaryHtml(
      baseCtx({
        breakdowns: [makeBreakdown({ name: 'Eve </script><script>alert(1)' })],
        selectedPersonName: 'Eve </script><script>alert(1)',
        isEmbedded: true,
      }),
    )
    expect(html).not.toContain('"Eve </script>')
    expect(html).toContain('Eve \\u003c/script>\\u003cscript>alert(1)')
  })

  it('ships the client-side sort/search/drilldown machinery in the script', () => {
    const html = buildTeamSummaryHtml(baseCtx())
    for (const fragment of [
      'function renderTable()',
      'function compareRows(',
      'function buildHoursBody(',
      'function buildOverheadRateBody(',
      'function bridgeTarget()',
      'id="search-input"',
      'id="reset-sort"',
      "classList.add('printing-modal')",
    ]) {
      expect(html).toContain(fragment)
    }
  })

  it('is deterministic: identical context produces byte-identical output', () => {
    const a = buildTeamSummaryHtml(baseCtx())
    const b = buildTeamSummaryHtml(baseCtx())
    expect(a).toBe(b)
    expect(a.length).toBeGreaterThan(50_000)
  })
})
