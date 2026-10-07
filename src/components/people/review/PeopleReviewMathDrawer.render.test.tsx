// @vitest-environment jsdom
/**
 * Render smoke for People → Review's per-person math drawer and the deal chip (punch list #52 PR 5,
 * v2.4653): a vehicle deal's fuel stays on the jobs — the drawer's ⛽ line carries its share — and
 * the vehicle line charges only the fixed costs and the fuel on no job, saying so in its own words.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PeopleReviewMathDrawer } from './PeopleReviewMathDrawer'
import { VehicleArrangementChip } from '../PeopleVehiclesWheelsSection'
import { buildReviewPersonMath } from '../../../lib/people/reviewRanked'
import type { TeamSummaryBreakdown } from '../teamSummary/types'
import type { CategoryTagRow } from '../../../lib/banking/categoryTags'

const FUEL: CategoryTagRow = { id: 't-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', sort_order: 0, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false }

// Made-up figures (the guide's example), never a real person's.
function sam(): TeamSummaryBreakdown {
  const fixed = -(165.5 * 2.24)
  const vehicleCost = fixed - 48.1
  const net = 22026
  return {
    idx: 0,
    name: 'Sam',
    hb: { source: 'hourly', onlyPaidJobs: false, dailyRows: [], subLaborRows: [], totals: { daily: 0, crew: 0, subLabor: 0, totalHours: 165.5 } },
    gb: { jobs: [], total: 49063 },
    nb: { jobs: [], total: net },
    pb: { jobs: [], totalNet: net, totalHours: 165.5, fieldHours: 165.5, overheadHours: 0, unaccountedHours: 0 },
    totalHours: 165.5,
    overheadHours: 0,
    officeHours: 0,
    bidHours: 0,
    fieldHours: 165.5,
    hourlyWage: 30,
    overheadWage: 30,
    allocatedParts: 11718,
    allocatedByTag: { [FUEL.id]: 2306 },
    vehicleArrangement: 'company',
    vehicleRate: 2.24,
    vehicleTruckName: '2019 Ford F-150',
    vehicleFixedCost: fixed,
    vehicleFuelOffJobs: -48.1,
    vehicleCost,
    allocatedLabor: 15319,
    overheadSessions: [],
    gross: 49063,
    net,
    revPerHour: 49063 / 165.5,
    netPerHour: net / 165.5,
    profitPerHourAfterOverhead: (net + vehicleCost) / 165.5,
    payConfigSource: 'hourly',
    overheadLaborCost: 0,
    overheadBurden: 0,
    profitAfterOverhead: net + vehicleCost,
  }
}

describe('PeopleReviewMathDrawer — the vehicle deal', () => {
  afterEach(() => cleanup())

  it('draws the ⛽ share on the jobs and a vehicle line of fixed costs plus fuel on no job', () => {
    const math = buildReviewPersonMath(sam(), { partsRate: 0, costLineTags: [FUEL] })
    renderWithProviders(<PeopleReviewMathDrawer math={math} />)
    // first paint: the drawer is pure props, nothing loads
    expect(screen.getByText('− ⛽ Fuel & gas')).toBeTruthy()
    expect(screen.getByText('− 🚚 2019 Ford F-150')).toBeTruthy()
    expect(
      screen.getByText('165.5 field h × $2.24 fixed + $48.10 of their fuel on no job in the period; their fuel on jobs is in the ⛽ line above'),
    ).toBeTruthy()
  })
})

describe('VehicleArrangementChip', () => {
  afterEach(() => cleanup())

  it('shows a fixed rate only when there is one', () => {
    renderWithProviders(
      <>
        <VehicleArrangementChip arrangement="company" rate={2.24} />
        <VehicleArrangementChip arrangement="company" rate={0} />
      </>,
    )
    // first paint: the chips are pure props
    expect(screen.getByText('$2.24/h fixed')).toBeTruthy()
    expect(screen.getByText('company')).toBeTruthy()
  })
})
