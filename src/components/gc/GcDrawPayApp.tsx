import { useState } from 'react'
import { Btn, num, td, th } from './gcUi'
import { payApplicationForDraw, timesSentBack, tradePayAppParties } from '../../lib/gc/building'
import type { DrawExtra } from '../../lib/gc/drawRows'
import { downloadPayAppExcel, downloadPayAppPdf } from '../../lib/gc/payAppFileWriters'
import type { Draw, GcProject, Partner, Sow } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U6b: a trade's pay application as the office reads it, the read-only half
 * of the prototype's `GcBuildingPayApp.tsx` (branch spike/gc-mode). Who sent it and signed it, what we did with it, the
 * file it came as, the G702's nine lines and the G703's, and the AIA form as Excel or PDF through Owner Billing's
 * writers (`payAppFileWriters.ts`). The trade's half, where it fills one out, is the Portal's P5c.
 */
export function GcDrawPayApp({
  project,
  sow,
  partner,
  draw,
  extra,
  onBack,
}: {
  project: GcProject
  sow: Sow
  partner: Partner
  /** A draw that stands, or one we sent back. */
  draw: Draw
  extra?: DrawExtra
  onBack: () => void
}) {
  const [saving, setSaving] = useState<'xlsx' | 'pdf' | null>(null)
  const [saveError, setSaveError] = useState('')
  const app = payApplicationForDraw(sow, draw)
  const returnedAs = (sow.sentBack ?? []).find((b) => b.draw.id === draw.id) ?? null
  const revised = !returnedAs && timesSentBack(sow, draw.number) > 0
  const words = draw.payApp?.signedBy ? draw.payApp : null
  // What they signed for: what they asked, before we approved less or took a charge off it.
  const charges = (draw.backCharges ?? []).reduce((s, c) => s + c.amount, 0)
  const signedFor = draw.asked?.net ?? draw.net + charges
  const parties = tradePayAppParties(project, sow, partner, app, {
    periodTo: words?.periodTo ?? '',
    address: words?.address || partner.address || '',
    license: words?.license || partner.license || '',
    signedOn: words?.signedOn || draw.requestedOn,
  })
  const download = (kind: 'xlsx' | 'pdf') => {
    setSaving(kind)
    setSaveError('')
    void (kind === 'xlsx' ? downloadPayAppExcel(app, parties) : downloadPayAppPdf(app, parties))
      .catch(() => setSaveError('The file was not made. Try again.'))
      .finally(() => setSaving(null))
  }
  const s = app.summary
  const g702: [string, string, number][] = [
    ['1', 'Original contract sum', s.originalSum],
    ['2', 'Net change by change orders', s.changeOrders],
    ['3', 'Contract sum to date', s.sumToDate],
    ['4', 'Total completed and stored to date', s.completedToDate],
    ['5', app.final ? 'Retainage, released on this final application' : `Retainage, ${s.retainagePct}% of completed and stored work`, s.retainage],
    ['6', 'Total earned less retainage', s.earnedLessRetainage],
    ['7', 'Less previous certificates for payment', s.previousCertificates],
    ['8', 'Current payment due', s.currentDue],
    ['9', 'Balance to finish, including retainage', s.balanceToFinish],
  ]
  const title = `Pay application ${draw.number}${draw.final ? ', final' : ''}${returnedAs ? ', sent back' : revised ? ', revised' : ''}`
  return (
    <div data-draw-pay-app={draw.id} style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="quiet" onClick={onBack}>
          Back to the draws
        </Btn>
        <strong style={{ fontSize: '1.02rem' }}>{title}</strong>
        <span style={{ flex: 1 }} />
        <Btn kind="quiet" onClick={() => download('xlsx')} disabled={saving !== null}>
          {saving === 'xlsx' ? 'Making it' : 'Excel'}
        </Btn>
        <Btn kind="quiet" onClick={() => download('pdf')} disabled={saving !== null}>
          {saving === 'pdf' ? 'Making it' : 'PDF'}
        </Btn>
      </div>
      {saveError && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {saveError}
        </div>
      )}
      <div data-draw-pay-app-words style={{ fontSize: '0.875rem', display: 'grid', gap: '0.25rem' }}>
        {words ? (
          <span>
            {partner.company} sent it {shortDate(words.signedOn || draw.requestedOn)}. {words.signedBy}
            {words.signedTitle ? `, ${words.signedTitle},` : ''} signed it with a {draw.final ? 'conditional final release' : 'conditional waiver'} for {money(signedFor)}.
          </span>
        ) : (
          <span>It came before we kept pay applications.</span>
        )}
        {draw.asked && (
          <span>
            <strong style={{ color: 'var(--text-amber-800)' }}>
              We approved {money(draw.net + charges)} of the {money(draw.asked.net)} asked.
            </strong>{' '}
            {draw.asked.note}
          </span>
        )}
        {returnedAs && (
          <span>
            <strong style={{ color: 'var(--text-amber-800)' }}>We sent it back {shortDate(returnedAs.on)}.</strong> {returnedAs.note}
          </span>
        )}
        {extra?.fileName && (
          <span>
            It came as {extra.fileName}.{' '}
            {extra.driveUrl && (
              <a href={extra.driveUrl} target="_blank" rel="noreferrer">
                Open it in Drive
              </a>
            )}
          </span>
        )}
        {extra && !extra.fileName && extra.driveUrl && (
          <a href={extra.driveUrl} target="_blank" rel="noreferrer">
            Open it in Drive
          </a>
        )}
        {extra && <span style={{ color: 'var(--text-muted)' }}>{extra.recordedBy ? 'We recorded it from their email or paper.' : 'They sent it from their portal.'}</span>}
      </div>
      <div>
        <strong style={{ fontSize: '0.85rem' }}>The application, G702</strong>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.3rem' }}>
          <tbody>
            {g702.map(([n, label, amount]) => (
              <tr key={n} data-g702-line={n} style={n === '8' ? { fontWeight: 700 } : undefined}>
                <td style={{ ...td, width: '2rem', color: 'var(--text-muted)' }}>{n}</td>
                <td style={td}>{label}</td>
                <td style={num}>{money(amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <strong style={{ fontSize: '0.85rem' }}>Each line, G703</strong>
        <div style={{ overflowX: 'auto', marginTop: '0.3rem' }}>
          <table style={{ width: '100%', minWidth: '46rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Item</th>
                <th style={th}>Description</th>
                <th style={{ ...th, textAlign: 'right' }}>Scheduled</th>
                <th style={{ ...th, textAlign: 'right' }}>Before</th>
                <th style={{ ...th, textAlign: 'right' }}>This period</th>
                <th style={{ ...th, textAlign: 'right' }}>Stored</th>
                <th style={{ ...th, textAlign: 'right' }}>To date</th>
                <th style={{ ...th, textAlign: 'right' }}>Done</th>
                <th style={{ ...th, textAlign: 'right' }}>Left</th>
                <th style={{ ...th, textAlign: 'right' }}>Retainage</th>
              </tr>
            </thead>
            <tbody>
              {app.lines.map((l) => (
                <tr key={l.sovId} data-g703-line={l.sovId}>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{l.item}</td>
                  <td style={td}>{l.label}</td>
                  <td style={num}>{money(l.scheduled)}</td>
                  <td style={num}>{money(l.fromPrevious)}</td>
                  <td style={num}>{money(l.thisPeriod)}</td>
                  <td style={num}>{money(l.stored)}</td>
                  <td style={num}>{money(l.toDate)}</td>
                  <td style={num}>{l.pct}%</td>
                  <td style={num}>{money(l.balance)}</td>
                  <td style={num}>{money(l.retainage)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td style={td} />
                <td style={td}>Total</td>
                <td style={num}>{money(app.totals.scheduled)}</td>
                <td style={num}>{money(app.totals.fromPrevious)}</td>
                <td style={num}>{money(app.totals.thisPeriod)}</td>
                <td style={num}>{money(app.totals.stored)}</td>
                <td style={num}>{money(app.totals.toDate)}</td>
                <td style={num}>{app.totals.pct}%</td>
                <td style={num}>{money(app.totals.balance)}</td>
                <td style={num}>{money(app.totals.retainage)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
