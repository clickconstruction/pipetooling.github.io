// @vitest-environment jsdom
/**
 * The Board's window flags and the windows they raise, on their own (v2.7588). Each window's own behaviour has
 * its own test; the desk raising them is held by `LienDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { LienDeskWindows } from './LienDeskWindows'
import { useLienDeskWindows } from './useLienDeskWindows'

vi.mock('./LienPublicPropertyWindow', () => ({
  default: ({ addressId, onClose }: { addressId: string; onClose: (answered: boolean) => void }) => (
    <div data-test-public-review={addressId}>
      <button type="button" data-answer onClick={() => onClose(true)} />
      <button type="button" data-skip onClick={() => onClose(false)} />
    </div>
  ),
}))
vi.mock('./LienJobPathWindow', () => ({
  default: ({ jobId, onClose }: { jobId: string; onClose: (changed: boolean) => void }) => <button type="button" data-test-job-path={jobId} onClick={() => onClose(true)} />,
}))
vi.mock('./LienPublicPutBackWindow', () => ({ default: ({ addressId }: { addressId: string }) => <div data-test-put-back={addressId} /> }))
vi.mock('./LienServeWindow', () => ({
  default: ({ onAddScans, onOpenJob }: { onAddScans: () => void; onOpenJob: (jobId: string) => void }) => (
    <div data-test-serve>
      <button type="button" data-add-scans onClick={onAddScans} />
      <button type="button" data-open-job onClick={() => onOpenJob('job-1')} />
    </div>
  ),
}))
vi.mock('./LienScanBatchWindow', () => ({ default: () => <div data-test-scans /> }))
vi.mock('./LienPropertyCard', () => ({ default: () => <div data-test-property-card /> }))
vi.mock('./LienPaperPropertyWindow', () => ({ default: () => <div data-test-pane-fix /> }))

afterEach(() => cleanup())

function Desk({ onChanged = () => {}, onOpenAffidavit = () => {}, start }: { onChanged?: () => void; onOpenAffidavit?: (jobId: string) => void; start?: (w: ReturnType<typeof useLienDeskWindows>) => void }) {
  const windows = useLienDeskWindows(null)
  return (
    <>
      <button type="button" data-start onClick={() => start?.(windows)} />
      <LienDeskWindows
        data={{ jobsById: {}, addressesById: {}, ownerByJob: {} } as never}
        isMobile={false}
        todayYmd="2026-11-17"
        issuer={null}
        windows={windows}
        serveJobs={[]}
        scanTargets={[]}
        paneFix={null}
        onClosePaneFix={() => {}}
        propertyCard={null}
        setPropertyCard={() => {}}
        bookProperties={[]}
        bookLoading={false}
        bookError=""
        onChanged={onChanged}
        onOpenAffidavit={onOpenAffidavit}
        onOpenJobPaper={() => {}}
      />
    </>
  )
}
const press = (sel: string) => act(() => (document.querySelector(sel) as HTMLButtonElement).click())

describe('useLienDeskWindows', () => {
  it('starts with every window down', () => {
    const { result } = renderHook(() => useLienDeskWindows(null))
    expect(result.current).toMatchObject({ jobPath: null, publicReview: null, serveOpen: false, scansOpen: false, publicPutBack: null })
  })

  it('the host’s door opens Add the stamped scans, and a new door opens it again', () => {
    const { result, rerender } = renderHook(({ door }) => useLienDeskWindows(door), { initialProps: { door: null as { key: number } | null } })
    expect(result.current.scansOpen).toBe(false)
    rerender({ door: { key: 1 } })
    expect(result.current.scansOpen).toBe(true)
    act(() => result.current.setScansOpen(false))
    rerender({ door: { key: 2 } })
    expect(result.current.scansOpen).toBe(true)
  })
})

describe('LienDeskWindows', () => {
  it('draws nothing while no flag is up', () => {
    render(<Desk />)
    expect(document.querySelector('[data-test-serve], [data-test-scans], [data-test-public-review], [data-test-put-back], [data-test-job-path], [data-test-property-card], [data-test-pane-fix]')).toBeNull()
  })

  it('reviews the public properties one window at a time, re-reading after an answer', () => {
    const onChanged = vi.fn()
    render(<Desk onChanged={onChanged} start={(w) => w.setPublicReview(['addr-1', 'addr-2'])} />)
    press('[data-start]')
    expect(document.querySelector('[data-test-public-review="addr-1"]')).not.toBeNull()
    press('[data-skip]')
    expect(onChanged).not.toHaveBeenCalled()
    expect(document.querySelector('[data-test-public-review="addr-2"]')).not.toBeNull()
    press('[data-answer]')
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-test-public-review]')).toBeNull()
  })

  it('Serve hands over to Add the stamped scans, and a filed lien’s press closes Serve and opens its window', () => {
    const onOpenAffidavit = vi.fn()
    render(<Desk onOpenAffidavit={onOpenAffidavit} start={(w) => w.setServeOpen(true)} />)
    press('[data-start]')
    press('[data-add-scans]')
    expect(document.querySelector('[data-test-serve]')).toBeNull()
    expect(document.querySelector('[data-test-scans]')).not.toBeNull()
    cleanup()

    render(<Desk onOpenAffidavit={onOpenAffidavit} start={(w) => w.setServeOpen(true)} />)
    press('[data-start]')
    press('[data-open-job]')
    expect(document.querySelector('[data-test-serve]')).toBeNull()
    expect(onOpenAffidavit).toHaveBeenCalledWith('job-1')
  })

  it('a job’s lien path window closes and re-reads when it changed something', () => {
    const onChanged = vi.fn()
    render(<Desk onChanged={onChanged} start={(w) => w.setJobPath('job-9')} />)
    press('[data-start]')
    press('[data-test-job-path="job-9"]')
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-test-job-path]')).toBeNull()
  })
})
