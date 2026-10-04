import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AIA_FIELD_DEFS, type AiaFieldKey } from '../../lib/aiaG702G703Template'
import { type AiaPreview, formatAiaMoney, formatAiaPercent } from '../../lib/aiaG702G703Preview'

/**
 * The AIA window's left side: both pages of the workbook drawn as paper, read from
 * `buildAiaPreview`. A box is a button (pressing it puts the cursor in the form's field), the
 * sheet's own math is plain ink, and the long printed paragraphs are grey bars.
 */

const PAPER_W = 1000
const LABEL_BY_KEY = Object.fromEntries(AIA_FIELD_DEFS.map((d) => [d.key, d.label])) as Record<AiaFieldKey, string>

const ink: CSSProperties = { color: 'var(--text-strong)' }
const small: CSSProperties = { fontSize: 10, letterSpacing: '0.02em' }
const mathCell: CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }

function Greek({ lines, last = 60 }: { lines: number; last?: number }) {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '4px 0' }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          style={{ height: 4, borderRadius: 2, background: 'var(--border)', width: i === lines - 1 ? `${last}%` : '100%' }}
        />
      ))}
    </div>
  )
}

function Blank({ label, width = 150 }: { label: string; width?: number }) {
  return (
    <span style={{ ...small, display: 'inline-flex', alignItems: 'flex-end', gap: 4 }}>
      {label}
      <span style={{ display: 'inline-block', width, borderBottom: '1px solid var(--text-strong)' }} />
    </span>
  )
}

function Sheet({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section
      aria-label={name}
      style={{
        ...ink,
        width: PAPER_W,
        boxSizing: 'border-box',
        padding: '26px 30px 30px',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      {children}
    </section>
  )
}

export default function AiaG702G703Paper({
  preview,
  activeKey,
  onPick,
}: {
  preview: AiaPreview
  activeKey: AiaFieldKey | null
  onPick: (key: AiaFieldKey) => void
}) {
  const paneRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const el = paneRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => setZoom(Math.max(0.3, Math.min(1.2, el.clientWidth / PAPER_W)))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!activeKey) return
    const cell = paneRef.current?.querySelector(`[data-aia-cell="${activeKey}"]`)
    if (cell && typeof cell.scrollIntoView === 'function') cell.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeKey])

  const { cells, math } = preview

  const box = (key: AiaFieldKey, style?: CSSProperties) => {
    const cell = cells[key]
    const active = activeKey === key
    const from = cell.source === 'typed' ? 'From the form.' : 'Empty.'
    return (
      <button
        type="button"
        data-aia-cell={key}
        data-aia-source={cell.source}
        onClick={() => onPick(key)}
        title={`${LABEL_BY_KEY[key]} ${from}`}
        style={{
          font: 'inherit',
          color: 'var(--text-strong)',
          display: 'block',
          width: '100%',
          minHeight: 18,
          boxSizing: 'border-box',
          padding: '1px 4px',
          margin: 0,
          textAlign: 'left',
          cursor: 'pointer',
          borderRadius: 2,
          border: 'none',
          borderBottom: cell.source === 'typed' ? '1px solid var(--border-blue)' : '1px dotted var(--border-strong)',
          background: active ? 'var(--bg-yellow-200)' : cell.source === 'typed' ? 'var(--bg-blue-tint)' : 'transparent',
          outline: active ? '2px solid #2563eb' : 'none',
          outlineOffset: 1,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...style,
        }}
      >
        {cell.text || ' '}
      </button>
    )
  }

  const moneyBox = (key: AiaFieldKey) => box(key, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' })

  const line = (no: string, label: ReactNode, value: ReactNode, opts?: { strong?: boolean; note?: string }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 130px', alignItems: 'end', columnGap: 4, marginTop: 7 }}>
      <span>{no}</span>
      <span style={{ fontWeight: opts?.strong ? 700 : 400 }}>
        {label}
        {opts?.note ? <span style={{ ...small, display: 'block', color: 'var(--text-muted)' }}>{opts.note}</span> : null}
      </span>
      <span style={{ fontWeight: opts?.strong ? 700 : 400 }}>{value}</span>
    </div>
  )

  const money = (n: number) => <span style={{ ...mathCell, display: 'block' }}>{formatAiaMoney(n)}</span>

  const th: CSSProperties = {
    ...small,
    border: '1px solid var(--text-strong)',
    padding: '3px 4px',
    textAlign: 'center',
    verticalAlign: 'bottom',
    fontWeight: 700,
  }
  const td: CSSProperties = { border: '1px solid var(--text-strong)', padding: '2px 3px', verticalAlign: 'top' }
  const tdMath: CSSProperties = { ...td, ...mathCell, padding: '3px 5px' }
  const tdFaint: CSSProperties = { ...tdMath, color: 'var(--text-muted)' }

  return (
    <div ref={paneRef} data-theme="light" data-testid="aia-paper" style={{ width: '100%' }}>
      <div style={{ zoom, display: 'flex', flexDirection: 'column', gap: 18, width: PAPER_W }}>
        <Sheet name="G702 page">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <strong style={{ fontSize: 15 }}>APPLICATION AND CERTIFICATE FOR PAYMENT</strong>
            <span style={small}>AIA DOCUMENT G702</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.95fr 1.05fr 0.5fr', columnGap: 18, marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '82px 1fr', columnGap: 6, rowGap: 2, alignContent: 'start' }}>
              <span style={small}>TO OWNER:</span>
              {box('g702_d6_owner_name')}
              <span />
              {box('g702_d7_owner_address')}
              <span />
              {box('g702_d8_owner_city_state_zip')}
              <span style={{ ...small, marginTop: 8 }}>
                FROM
                <br />
                CONTRACTOR:
              </span>
              <div style={{ marginTop: 8 }}>{box('g702_d10_contractor_name')}</div>
              <span />
              {box('g702_d11_contractor_address')}
              <span />
              {box('g702_d12_contractor_license')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={small}>PROJECT:</span>
              {box('g702_h6_project_name')}
              {box('g702_h7_project_address')}
              {box('g702_h8_project_city_state_zip')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '124px 1fr', columnGap: 6, rowGap: 2, alignContent: 'start' }}>
              <span style={small}>APPLICATION NUMBER:</span>
              {box('g702_n5_project')}
              <span style={small}>PERIOD TO:</span>
              {box('g702_n6_period_to')}
              <span style={small}>PROJECT NO:</span>
              {box('g702_n7_project_no')}
              <span style={{ ...small, marginTop: 8 }}>CONTRACT DATE:</span>
              <div style={{ marginTop: 8 }}>{box('g702_n9_contract_date')}</div>
            </div>
            <div style={small}>
              Distribution to:
              {['OWNER', 'CONSTRUCTION MANAGER', 'ARCHITECT', 'CONTRACTOR'].map((who) => (
                <div key={who} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      border: '1px solid var(--text-strong)',
                      fontSize: 9,
                      lineHeight: '10px',
                      textAlign: 'center',
                    }}
                  >
                    {who === 'CONTRACTOR' ? 'X' : ''}
                  </span>
                  {who}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '2px solid var(--text-strong)', marginTop: 14 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 1fr', columnGap: 28, marginTop: 10 }}>
            <div>
              <strong>CONTRACTOR&apos;S APPLICATION FOR PAYMENT</strong>
              <Greek lines={2} last={45} />
              {line('1.', 'ORIGINAL CONTRACT SUM', moneyBox('g702_h18_original_contract_sum'))}
              {line('2.', 'Net change by Change Orders', money(math.netChangeByChangeOrders))}
              {line('3.', 'CONTRACT SUM TO DATE (Line 1 + 2)', money(math.contractSumToDate))}
              {line('4.', 'TOTAL COMPLETED & STORED TO DATE', money(math.totalCompletedAndStored), {
                note: '(Column G on G703)',
              })}
              {line('5.', 'RETAINAGE:', null)}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '22px 16px 52px 1fr 110px 130px',
                  alignItems: 'end',
                  columnGap: 4,
                  rowGap: 5,
                  marginTop: 4,
                }}
              >
                <span />
                <span>a.</span>
                {box('g702_c28_retainage_percent', { textAlign: 'right' })}
                <span>of Completed Work</span>
                {money(math.retainageOfCompletedWork)}
                <span />
                <span />
                <span>b.</span>
                {box('g702_c31_retainage_material_percent', { textAlign: 'right' })}
                <span>of Stored Material</span>
                {money(math.retainageOfStoredMaterial)}
                <span />
              </div>
              {line('', 'Total Retainage (Line 5a + 5b)', money(math.totalRetainage))}
              {line('6.', 'TOTAL EARNED LESS RETAINAGE', money(math.totalEarnedLessRetainage), {
                note: '(Line 4 less Line 5 Total)',
              })}
              {line('7.', 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', moneyBox('g702_h40_less_previous_certificates'), {
                note: '(Line 6 from prior Certificate)',
              })}
              <div style={{ border: '2px solid var(--text-strong)', padding: '0 6px 5px', margin: '8px -6px 0' }}>
                {line('8.', 'CURRENT PAYMENT DUE', money(math.currentPaymentDue), { strong: true })}
              </div>
              {line('9.', 'BALANCE TO FINISH, INCLUDING RETAINAGE', money(math.balanceToFinish), {
                note: '(Line 3 less Line 6)',
              })}

              <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 14 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>CHANGE ORDER SUMMARY</th>
                    <th style={{ ...th, width: 120 }}>ADDITIONS</th>
                    <th style={{ ...th, width: 120 }}>DEDUCTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={td}>Total changes approved in previous months by Owner</td>
                    <td style={td}>{moneyBox('g702_f49_previous_month_change_order_additions')}</td>
                    <td style={td}>{moneyBox('g702_h49_previous_month_change_order_deductions')}</td>
                  </tr>
                  <tr>
                    <td style={td}>Total approved this Month</td>
                    <td style={td}>{moneyBox('g702_f50_this_month_change_order_additions')}</td>
                    <td style={td}>{moneyBox('g702_h50_this_month_change_order_deductions')}</td>
                  </tr>
                  <tr>
                    <td style={{ ...td, textAlign: 'right' }}>TOTALS</td>
                    <td style={tdMath}>{formatAiaMoney(math.changeOrders.additions)}</td>
                    <td style={tdMath}>{formatAiaMoney(math.changeOrders.deductions)}</td>
                  </tr>
                  <tr>
                    <td style={td} colSpan={2}>
                      NET CHANGES by Change Order
                    </td>
                    <td style={tdMath}>{formatAiaMoney(math.changeOrders.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <Greek lines={5} />
              <div style={{ ...small, marginTop: 10 }}>CONTRACTOR:</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
                <Blank label="BY:" width={210} />
                <Blank label="DATE" width={90} />
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
                <Blank label="State of:" width={130} />
                <Blank label="County of:" width={110} />
              </div>
              <Greek lines={1} last={80} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                <Blank label="Notary Public:" width={230} />
                <Blank label="My Commission Expires:" width={180} />
              </div>
              <div style={{ borderTop: '2px solid var(--text-strong)', margin: '14px 0 8px' }} />
              <strong>CERTIFICATE FOR PAYMENT</strong>
              <Greek lines={5} last={35} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', alignItems: 'end', marginTop: 8 }}>
                <span>AMOUNT CERTIFIED</span>
                <strong>{money(math.currentPaymentDue)}</strong>
              </div>
              <Greek lines={2} last={70} />
              <div style={{ ...small, marginTop: 10 }}>CONSTRUCTION MGR:</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
                <Blank label="By:" width={200} />
                <Blank label="Date:" width={90} />
              </div>
              <Greek lines={3} last={55} />
            </div>
          </div>
        </Sheet>

        <Sheet name="G703 continuation sheet">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', columnGap: 24 }}>
            <div>
              <strong style={{ fontSize: 15 }}>CONTINUATION SHEET</strong>
              <div style={small}>AIA DOCUMENT G703</div>
              <Greek lines={2} last={50} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '152px 1fr', columnGap: 6, rowGap: 2 }}>
              <span style={small}>APPLICATION NO:</span>
              {box('g703_k2_project')}
              <span style={small}>APPLICATION DATE:</span>
              {box('g703_k3_application_date')}
              <span style={small}>PERIOD TO:</span>
              {box('g703_k4_period_to')}
              <span style={small}>ARCHITECT&apos;S PROJECT NO:</span>
              {box('g703_k5_architect_project_no')}
            </div>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col />
              <col style={{ width: 96 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 54 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 86 }} />
            </colgroup>
            <thead>
              <tr>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', '', 'H', 'I'].map((c, i) => (
                  <th key={i} style={th}>
                    {c}
                  </th>
                ))}
              </tr>
              <tr>
                <th style={th}>ITEM NO.</th>
                <th style={th}>DESCRIPTION OF WORK</th>
                <th style={th}>SCHEDULED VALUE</th>
                <th style={th}>FROM PREVIOUS APPLICATION (D + E)</th>
                <th style={th}>THIS PERIOD</th>
                <th style={th}>MATERIALS PRESENTLY STORED</th>
                <th style={th}>TOTAL COMPLETED AND STORED TO DATE</th>
                <th style={th}>% (G / C)</th>
                <th style={th}>BALANCE TO FINISH (C − G)</th>
                <th style={th}>RETAINAGE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...td, textAlign: 'center', padding: '3px 3px' }}>001</td>
                <td style={td}>{box('g703_c13_description')}</td>
                <td style={td}>{moneyBox('g703_d13_scheduled_value')}</td>
                <td style={td}>{moneyBox('g703_e13_from_previous')}</td>
                <td style={td}>{moneyBox('g703_f13_this_period')}</td>
                <td style={td}>{moneyBox('g703_g13_materials_stored')}</td>
                <td style={tdMath}>{formatAiaMoney(math.line.totalToDate)}</td>
                <td style={tdMath}>
                  {math.line.pctComplete == null ? '#DIV/0!' : formatAiaPercent(math.line.pctComplete)}
                </td>
                <td style={tdMath}>{formatAiaMoney(math.line.balanceToFinish)}</td>
                <td style={tdMath}>{formatAiaMoney(math.line.retainage)}</td>
              </tr>
              {['002', '003'].map((no) => (
                <tr key={no}>
                  <td style={{ ...tdFaint, textAlign: 'center' }}>{no}</td>
                  <td style={td} />
                  <td style={tdFaint}>$0.00</td>
                  <td style={tdFaint}>$0.00</td>
                  <td style={tdFaint}>$0.00</td>
                  <td style={tdFaint}>$0.00</td>
                  <td style={tdFaint}>$0.00</td>
                  <td style={tdFaint}>#DIV/0!</td>
                  <td style={tdFaint}>$0.00</td>
                  <td style={tdFaint}>$0.00</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, ...small, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={10}>
                  Lines 004 to 036 read the same in the workbook.
                </td>
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={td} colSpan={2}>
                  TOTALS
                </td>
                <td style={tdMath}>{formatAiaMoney(math.line.scheduledValue)}</td>
                <td style={tdMath}>{formatAiaMoney(math.line.fromPrevious)}</td>
                <td style={tdMath}>{formatAiaMoney(math.line.thisPeriod)}</td>
                <td style={tdMath}>{formatAiaMoney(math.line.materialsStored)}</td>
                <td style={tdMath}>{formatAiaMoney(math.line.totalToDate)}</td>
                <td style={tdMath}>
                  {math.line.pctComplete == null ? '#DIV/0!' : formatAiaPercent(math.line.pctComplete)}
                </td>
                <td style={tdMath}>{formatAiaMoney(math.line.balanceToFinish)}</td>
                <td style={tdMath}>{formatAiaMoney(math.line.retainage)}</td>
              </tr>
            </tbody>
          </table>
        </Sheet>
      </div>
    </div>
  )
}
