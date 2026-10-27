// @vitest-environment jsdom
/**
 * Render smoke for Draft Payroll's failed list (punch list #184, sweep A, PR 2): after
 * *Generate N reports*, each person whose report did not generate stays in the window with the
 * reason and a Try again door.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DraftPayrollModal, type DraftPayrollModalProps } from './DraftPayrollModal'

afterEach(cleanup)

function props(over: Partial<DraftPayrollModalProps> = {}): DraftPayrollModalProps {
  return {
    open: true,
    onClose: () => {},
    zIndex: 1000,
    periodStart: '2026-10-18',
    periodEnd: '2026-10-24',
    onChangePeriodStart: () => {},
    onChangePeriodEnd: () => {},
    onShiftWeek: () => {},
    bulkGenerating: false,
    pendingLoading: false,
    pendingError: null,
    pendingCount: 0,
    canAccessHours: true,
    onOpenHoursForPeriod: () => {},
    peopleNames: ['Marisol', 'Todd'],
    payStubs: [],
    payStubPaymentsByStubId: {},
    payStubDeductionsByStubId: {},
    payStubAdditionalByStubId: {},
    getCostForPersonDate: () => 100,
    getEffectiveHours: () => 8,
    getRunPayrollReviewDayItems: () => [],
    onBulkGenerateRemaining: () => {},
    onGenerateReport: () => {},
    onViewStub: () => {},
    onRecordPayment: () => {},
    canDeletePayReports: false,
    onRequestDeleteStub: () => {},
    deletingPayStubId: null,
    markingPayStubId: null,
    generatingPayStubPerson: null,
    showToast: () => {},
    onNavigateToHoursForReviewDate: () => {},
    onOpenHoursBreakdown: () => {},
    ...over,
  }
}

describe('Draft Payroll — the reports that did not generate', () => {
  it('lists each person with the reason and a Try again door', () => {
    const onRetry = vi.fn()
    renderWithProviders(<DraftPayrollModal {...props({ bulkFailures: [{ person: 'Todd', why: 'Failed to create pay report: no pay config' }], onRetryBulkFailure: onRetry })} />)
    const list = document.querySelector('[data-draft-payroll-failed]')
    expect(list?.textContent).toContain('1 report did not generate. It stays here with the reason.')
    expect(document.querySelector('[data-draft-payroll-failed-person="Todd"]')?.textContent).toContain('Failed to create pay report: no pay config')
    fireEvent.click(screen.getByRole('button', { name: 'Try again ▸' }))
    expect(onRetry).toHaveBeenCalledWith('Todd')
  })
  it('draws nothing when every report generated', () => {
    renderWithProviders(<DraftPayrollModal {...props()} />)
    expect(document.querySelector('[data-draft-payroll-failed]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Generate 2 reports' })).toBeTruthy()
  })
})
