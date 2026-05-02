import { useEffect, type CSSProperties, type ReactNode } from 'react'

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toLocaleDateString('en-CA'))
    d.setDate(d.getDate() + 1)
  }
  return days
}

/** M/D without year (e.g. 3/1–3/7), matches Pay History ledger labels. */
function ledgerPayPeriodShortLabel(periodStartYmd: string, periodEndYmd: string): string {
  const md = (iso: string) => {
    const x = new Date(iso + 'T12:00:00')
    return `${x.getMonth() + 1}/${x.getDate()}`
  }
  return `${md(periodStartYmd)}–${md(periodEndYmd)}`
}

export type CustomPayReportsPayStubPick = {
  id: string
  person_name: string
  period_start: string
  period_end: string
  created_at: string | null
}

export type CustomPayReportsModalProps = {
  open: boolean
  onClose: () => void
  zIndex: number
  peopleNames: string[]
  person: string
  onChangePerson: (v: string) => void
  periodStart: string
  onChangePeriodStart: (v: string) => void
  periodEnd: string
  onChangePeriodEnd: (v: string) => void
  onGenerate: () => void
  getCostForPersonDate: (person: string, date: string) => number
  hoursDaysCorrect: Set<string>
  payPreviewOtherStubHintByDate: Map<string, { hintText: string; stubIds: string[] }>
  payStubs: CustomPayReportsPayStubPick[]
  onViewStub: (stub: CustomPayReportsPayStubPick) => void | Promise<void>
  showToast: (message: string, variant: 'success' | 'error' | 'warning' | 'info') => void
}

export function CustomPayReportsModal({
  open,
  onClose,
  zIndex,
  peopleNames,
  person,
  onChangePerson,
  periodStart,
  onChangePeriodStart,
  periodEnd,
  onChangePeriodEnd,
  onGenerate,
  getCostForPersonDate,
  hoursDaysCorrect,
  payPreviewOtherStubHintByDate,
  payStubs,
  onViewStub,
  showToast,
}: CustomPayReportsModalProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const otherStubInstallmentsA11y =
    'Cash installments on another pay report are recorded for the whole report in the database, not allocated to individual days.'

  function openPayPreviewOtherStub(stubId: string) {
    const stub = payStubs.find((s) => s.id === stubId)
    if (!stub) {
      showToast('Pay report not found.', 'error')
      return
    }
    void Promise.resolve(onViewStub(stub)).catch((e: unknown) =>
      showToast(e instanceof Error ? e.message : 'Failed to open pay report', 'error'),
    )
  }

  const otherPayHintLinkStyle: CSSProperties = {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    color: '#2563eb',
    fontSize: 'inherit',
    cursor: 'pointer',
    textDecoration: 'underline',
    textAlign: 'left',
    maxWidth: '100%',
  }

  const personTrim = person?.trim() ?? ''
  let previewBlock: ReactNode = null
  if (personTrim && periodStart <= periodEnd) {
    const days = getDaysInRange(periodStart, periodEnd)
    const byDay = days.map((d) => ({ date: d, cost: getCostForPersonDate(personTrim, d) }))
    const total = byDay.reduce((s, x) => s + x.cost, 0)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    previewBlock = (
      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#f9fafb',
          borderRadius: 6,
          border: '1px solid #e5e7eb',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          People pay config payments for {personTrim} ({periodStart} to {periodEnd})
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Day</th>
                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Other payments</th>
              </tr>
            </thead>
            <tbody>
              {byDay.map(({ date, cost }) => {
                const isCorrect = hoursDaysCorrect.has(date)
                const otherEntry = payPreviewOtherStubHintByDate.get(date)
                const rowTitleParts = [
                  !isCorrect ? 'Day not marked Correct in Hours tab' : null,
                  otherEntry ? `${otherEntry.hintText}. ${otherStubInstallmentsA11y}` : null,
                ].filter(Boolean)
                const rowTitle = rowTitleParts.length > 0 ? rowTitleParts.join(' ') : undefined
                const firstOtherId = otherEntry?.stubIds[0]
                const firstOtherStub = firstOtherId ? payStubs.find((s) => s.id === firstOtherId) : undefined
                const firstOtherLabel = firstOtherStub
                  ? ledgerPayPeriodShortLabel(firstOtherStub.period_start, firstOtherStub.period_end)
                  : null
                return (
                  <tr
                    key={date}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: isCorrect ? undefined : 'rgba(251, 146, 60, 0.15)',
                    }}
                    title={rowTitle}
                  >
                    <td style={{ padding: '0.25rem 0.5rem' }}>{date}</td>
                    <td style={{ padding: '0.25rem 0.5rem', color: '#6b7280' }}>
                      {dayNames[new Date(date + 'T12:00:00').getDay()]}
                    </td>
                    <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>
                      ${cost > 0 ? cost.toFixed(2) : '0.00'}
                    </td>
                    <td style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#6b7280', maxWidth: 240 }}>
                      {otherEntry && firstOtherId && firstOtherLabel ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            alignItems: 'flex-start',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => openPayPreviewOtherStub(firstOtherId)}
                            style={otherPayHintLinkStyle}
                            title={otherStubInstallmentsA11y}
                            aria-label={`View pay report ${firstOtherLabel} (installments on another period). ${otherStubInstallmentsA11y}`}
                          >
                            Installments on report {firstOtherLabel}
                          </button>
                          {otherEntry.stubIds.length > 1 ? (
                            <details style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                              <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                                {otherEntry.stubIds.length - 1} more report
                                {otherEntry.stubIds.length - 1 > 1 ? 's' : ''} with payments
                              </summary>
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.15rem',
                                  marginTop: '0.25rem',
                                }}
                              >
                                {otherEntry.stubIds.slice(1).map((sid) => {
                                  const s = payStubs.find((x) => x.id === sid)
                                  const pl = s
                                    ? ledgerPayPeriodShortLabel(s.period_start, s.period_end)
                                    : sid.slice(0, 8)
                                  return (
                                    <button
                                      key={sid}
                                      type="button"
                                      onClick={() => openPayPreviewOtherStub(sid)}
                                      style={otherPayHintLinkStyle}
                                      title={otherStubInstallmentsA11y}
                                      aria-label={`View pay report ${pl} (installments on another period). ${otherStubInstallmentsA11y}`}
                                    >
                                      {pl}
                                    </button>
                                  )
                                })}
                              </div>
                            </details>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                <td colSpan={2} style={{ padding: '0.35rem 0.5rem' }}>
                  Total
                </td>
                <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${total.toFixed(2)}
                </td>
                <td style={{ padding: '0.35rem 0.5rem', color: '#9ca3af' }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          width: '100%',
          maxWidth: 900,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Generate Custom Pay Report</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              color: '#6b7280',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {peopleNames.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>
            No people with Show in Hours selected. In Hours, open People pay config and check Show in Hours for people to track.
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Person</span>
            <select
              value={person}
              onChange={(e) => onChangePerson(e.target.value)}
              style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 140 }}
            >
              <option value="">Select person</option>
              {peopleNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => onChangePeriodStart(e.target.value)}
              style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </label>
          <label>
            <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => onChangePeriodEnd(e.target.value)}
              style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </label>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onGenerate()}
              disabled={!personTrim}
              title={
                !personTrim
                  ? peopleNames.length === 0
                    ? 'In Hours, open People pay config and check Show in Hours for people to track'
                    : 'Select a person to generate a pay report'
                  : undefined
              }
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: personTrim ? '#3b82f6' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: personTrim ? 'pointer' : 'not-allowed',
                fontWeight: 500,
              }}
            >
              Generate Pay Report
            </button>
            {!personTrim && (
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                {peopleNames.length === 0
                  ? 'In Hours, open People pay config and check Show in Hours for people to track'
                  : 'Select a person to generate a pay report'}
              </span>
            )}
          </span>
        </div>
        {previewBlock}
      </div>
    </div>
  )
}
