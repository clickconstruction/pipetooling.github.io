import {
  GC_COMPANY,
  money,
  PAY_WITHIN_DAYS,
  pDate,
  portalPay,
  pWeekday,
  type GcState,
  type Partner,
  type PortalPayRow,
} from '../../lib/gcMode/gcModel'
import { PortalBlock, PortalNote } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: Your pay, in the trade's portal. Every pay application on the company's
 * jobs, newest first: when it was asked, approved and paid, or the day it should be paid by (we
 * pay an approved one within PAY_WITHIN_DAYS, owner 2026-10-03). Then what we hold on each job
 * and when it comes back. The sub portal's work and pay statement is the model.
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

export function GcPortalPay({ state, partner, onHome }: { state: GcState; partner: Partner; onHome: () => void }) {
  const { lang, t } = usePortalLang()
  const pay = portalPay(state, partner.id)

  return (
    <div style={{ padding: '0.9rem', display: 'grid', gap: '0.9rem' }}>
      <div>
        <button
          type="button"
          onClick={onHome}
          style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.35rem' }}
        >
          {t('backHome', { gc: GC })}
        </button>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('payTitle')}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('payIntro', { gc: GC, days: PAY_WITHIN_DAYS })}</div>
      </div>

      <PortalBlock title={t('yourMoney')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
          <Stat label={t('paidToYou')} value={money(pay.totals.paid)} />
          <Stat label={t('payOnTheWay')} value={money(pay.totals.coming)} />
          <Stat label={t('payChecking', { gc: GC })} value={money(pay.totals.checking)} />
          <Stat label={t('heldEnd')} value={money(pay.totals.held)} />
        </div>
        {pay.totals.late > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <PortalNote tone="amber">
              <strong style={{ color: 'var(--text-red-700)' }}>
                {pay.totals.late === 1 ? t('payLate1', { gc: GC }) : t('payLateN', { n: pay.totals.late, gc: GC })}
              </strong>
            </PortalNote>
          </div>
        )}
      </PortalBlock>

      <PortalBlock title={t('payTitle')}>
        {pay.rows.length === 0 ? (
          <div style={{ fontSize: '0.9rem' }}>{t('noPayYet')}</div>
        ) : (
          <div style={{ display: 'grid' }}>
            {pay.rows.map((row, i) => (
              <Row key={row.draw.id} row={row} first={i === 0} />
            ))}
          </div>
        )}
      </PortalBlock>

      <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>
        {t('payQuestions', { name: GC_COMPANY.pay.name, phone: GC_COMPANY.pay.phone })}
      </div>

      {pay.jobs.length > 0 && (
        <PortalBlock title={t('heldEnd')}>
          <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
            {pay.jobs.map((j) => (
              <div key={j.pkg.id} style={{ display: 'grid', gap: '0.15rem' }}>
                <div>
                  <strong>{j.project.name}</strong> <span style={{ opacity: 0.75 }}>· {j.pkg.trade}</span>
                </div>
                <div>
                  <strong>{money(j.held)}</strong>{' '}
                  <span style={{ opacity: 0.8 }}>
                    {j.heldBack.state === 'returned'
                      ? t('heldReturned', { date: pDate(lang, j.heldBack.on) })
                      : j.heldBack.state === 'on'
                        ? t('heldOn', { date: pDate(lang, j.heldBack.on) })
                        : t('heldAfter', { gc: GC })}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                  {t('jobPayLine', { contract: money(j.contract), paid: money(j.paid), left: money(j.leftToBill) })}
                </div>
              </div>
            ))}
          </div>
        </PortalBlock>
      )}
    </div>
  )
}

function Row({ row, first }: { row: PortalPayRow; first: boolean }) {
  const { lang, t } = usePortalLang()
  const d = row.draw
  const steps = [
    t('payAsked', { date: pDate(lang, d.requestedOn) }),
    ...(d.approvedOn ? [t('payApprovedOn', { date: pDate(lang, d.approvedOn) })] : []),
    ...(row.state === 'paid' && d.paidOn ? [t('payPaidOn', { date: pDate(lang, d.paidOn) })] : []),
  ]
  return (
    <div style={{ display: 'grid', gap: '0.15rem', padding: '0.55rem 0.1rem', borderTop: first ? 'none' : `1px solid ${RULE}`, fontSize: '0.9rem' }}>
      <strong>{row.project.name}</strong>
      <span style={{ opacity: 0.8 }}>
        {row.pkg.trade} · {d.final ? t('payAppFinal') : t('payAppN', { n: d.number })}
      </span>
      <span>
        <strong>{money(d.net)}</strong>
        {d.asked && <span style={{ opacity: 0.75 }}> {t('drawOfAsked', { asked: money(d.asked.net) })}</span>}
        {(d.backCharges ?? []).length > 0 && <span style={{ opacity: 0.75 }}> {t('bcOffDraw', { amount: money((d.backCharges ?? []).reduce((sum, c) => sum + c.amount, 0)) })}</span>}
        {!d.final && d.retainage > 0 && <span style={{ opacity: 0.75 }}> · {t('payHeld', { held: money(d.retainage) })}</span>}
      </span>
      <span style={{ fontSize: '0.82rem', opacity: 0.8 }}>
        {steps.join(' · ')}
        {row.state === 'checking' && <> · {t('drawReviewing', { gc: GC })}</>}
        {row.state === 'approved' && row.payBy && <> · {t('payBy', { date: pWeekday(lang, row.payBy) })}</>}
      </span>
      {row.state === 'late' && row.payBy && (
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-red-700)' }}>{t('payWasDue', { date: pWeekday(lang, row.payBy) })}</span>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}
