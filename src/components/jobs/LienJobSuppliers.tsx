import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Store } from 'lucide-react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import {
  buildLienSupplierCard,
  lienSupplierEmailText,
  lienSupplierMark,
  type LienSupplierCardRow,
  type LienSupplierJob,
  type LienSupplierMark,
} from '../../lib/jobs/lienJobSuppliers'

const TEAL = 'var(--text-teal-700)'
const money: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const small: CSSProperties = { fontSize: '0.6875rem', color: 'var(--text-muted)' }
const COLS = 'minmax(0, 1.5fr) minmax(0, 1.25fr) minmax(0, 1.35fr) minmax(0, 0.8fr) minmax(0, 0.9fr)'

/**
 * The mark on a desk row (v2.4404): a storefront and the money, only while a
 * house is still owed on the job. Teal when a job account is open — the job
 * window's sign. `short` is the phone Calendar's form: the glyph and the amount.
 */
export function LienSupplierMarkLine({ mark, short }: { mark: LienSupplierMark | null | undefined; short?: boolean }) {
  if (!mark) return null
  return (
    <span data-lien-supplier-mark={mark.jobAccount ? 'job-account' : 'owed'} title={mark.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: mark.jobAccount ? TEAL : 'var(--text-600)', fontWeight: mark.jobAccount ? 600 : undefined, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      <Store size={13} aria-hidden />
      <span>{short ? mark.short : mark.words}</span>
      {short ? <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> owed to supply houses</span> : null}
    </span>
  )
}

function noticeWords(r: LienSupplierCardRow): { top: string; sub: string; tone: 'amber' | 'plain' | 'muted' } | null {
  if (r.notice.kind === 'open') return { top: `by ${formatYmdMonthDay(r.notice.ymd)}`, sub: `${r.notice.daysLeft} ${r.notice.daysLeft === 1 ? 'day' : 'days'}`, tone: r.notice.soon ? 'amber' : 'plain' }
  if (r.notice.kind === 'closed') return { top: `window closed ${formatYmdMonthDay(r.notice.ymd)}`, sub: '', tone: 'muted' }
  return null
}

const NOTICE_INK = { amber: 'var(--text-amber-800)', plain: 'var(--text-700)', muted: 'var(--text-muted)' } as const
const ESTIMATE_NOTE = 'Our estimate: the date this house’s own § 53.056 notice is due, counted from its unpaid invoice dates by the rule the desk uses for ours. The house keeps its own calendar.'

/**
 * Supply houses on this job (v2.4404): one row per house — its account, what is
 * unpaid since when, its own notice date, paid and owed — a total row, and one
 * bold line joining what the payer owes us to what the houses are owed. Folded
 * to one line when every house is paid, or where the caller has no room for it
 * open (`startFolded`: the Lien window's header); the caller draws nothing when
 * the job bought nothing (`job` undefined). No `overflow: hidden` on the card:
 * inside the pane's scrolling grid that lets its row shrink to nothing.
 */
export function LienJobSuppliersCard({
  job,
  propertyKind,
  todayYmd,
  openBalance,
  payerName,
  jobLabel,
  isMobile,
  startFolded = false,
}: {
  job: LienSupplierJob
  propertyKind: string
  todayYmd: string
  openBalance: number
  payerName: string
  jobLabel: string
  isMobile: boolean
  startFolded?: boolean
}) {
  const { showToast } = useToastContext()
  const card = buildLienSupplierCard(job, { propertyKind, todayYmd, openBalance, payerName })
  const allPaid = card.owed <= 0.005
  const [unfolded, setUnfolded] = useState(false)
  const foldable = allPaid || startFolded
  const showRows = !foldable || unfolded
  const foldedWords = allPaid ? card.paidLine : (lienSupplierMark(job)?.words ?? '')
  const heldHref = `/materials?tab=job-accounts&job=${encodeURIComponent(job.jobId)}`

  const copy = () => {
    const text = lienSupplierEmailText(card, { jobLabel, todayYmd, openBalance, firstHousePaidYmd: job.firstHousePaidYmd, firstCustomerPaidYmd: job.firstCustomerPaidYmd })
    if (!navigator.clipboard) {
      showToast('Could not copy. Select the text and copy it by hand.', 'error')
      return
    }
    navigator.clipboard.writeText(text).then(
      () => showToast('Copied. Paste it into your email and change what you like.', 'success'),
      () => showToast('Could not copy. Select the text and copy it by hand.', 'error'),
    )
  }

  const head = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 0.8rem', background: 'var(--bg-subtle)', borderBottom: showRows ? '1px solid var(--border)' : undefined, borderRadius: showRows ? '9px 9px 0 0' : 9, minWidth: 0 }}>
      <Store size={16} aria-hidden style={{ color: 'var(--text-700)', flex: 'none' }} />
      <strong style={{ fontSize: '0.875rem' }}>Supply houses on this job</strong>
      {foldable ? (
        <>
          <span style={{ color: allPaid ? 'var(--text-muted)' : 'var(--text-amber-800)', fontWeight: allPaid ? undefined : 600, fontSize: '0.8125rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unfolded && !allPaid ? '' : foldedWords}</span>
          <button type="button" onClick={() => setUnfolded((v) => !v)} aria-expanded={unfolded} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-blue-700)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', padding: isMobile ? '0.5rem 0' : 0, whiteSpace: 'nowrap' }}>
            {unfolded ? 'Fold' : 'Show'}
          </button>
        </>
      ) : (
        <span style={{ ...small, marginLeft: 'auto', whiteSpace: 'nowrap' }}>from our books · {formatYmdMonthDay(todayYmd)}</span>
      )}
    </div>
  )

  const rows = isMobile ? (
    <>
      {card.rows.map((r) => {
        const n = noticeWords(r)
        return (
          <div key={r.houseId} data-lien-supplier-house={r.name} style={{ padding: '0.55rem 0.8rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{r.name}</strong>
              <strong style={money}>${formatCurrency(r.owed)}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={r.accountOpen ? { color: TEAL, fontWeight: 600 } : undefined}>{r.accountWords}</span>
              {r.unpaidSince ? ` · unpaid since ${r.unpaidSince}` : ` · ${r.invoiceWords}`}
            </div>
            {n ? (
              <div style={{ fontSize: '0.75rem' }} title={ESTIMATE_NOTE}>
                <span style={{ color: NOTICE_INK[n.tone], fontWeight: n.tone === 'amber' ? 600 : undefined }}>{r.notice.kind === 'open' ? `its own notice ${n.top}, our estimate` : n.top}</span>
                {n.sub ? <span style={{ color: 'var(--text-muted)' }}> · {n.sub}</span> : null}
              </div>
            ) : null}
            {r.paid > 0.005 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>paid ${formatCurrency(r.paid)}</div> : null}
          </div>
        )
      })}
      <div style={{ padding: '0.55rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: 'var(--text-600)', fontSize: '0.8125rem' }}>
          {card.housesWord} · paid ${formatCurrency(card.paid)}
        </span>
        <strong style={{ ...money, color: allPaid ? undefined : 'var(--text-amber-800)' }}>${formatCurrency(card.owed)}</strong>
      </div>
    </>
  ) : (
    <div role="table" aria-label="Supply houses on this job">
      <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0 12px', padding: '0.4rem 0.8rem 0.3rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
        <span role="columnheader">HOUSE</span>
        <span role="columnheader">UNPAID SINCE</span>
        <span role="columnheader" title={ESTIMATE_NOTE} style={{ cursor: 'help' }}>
          ITS OWN NOTICE <span style={{ fontWeight: 500, letterSpacing: 0 }}>· our estimate</span>
        </span>
        <span role="columnheader" style={{ textAlign: 'right' }}>PAID</span>
        <span role="columnheader" style={{ textAlign: 'right' }}>OWED</span>
      </div>
      {card.rows.map((r) => {
        const n = noticeWords(r)
        return (
          <div key={r.houseId} role="row" data-lien-supplier-house={r.name} style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0 12px', padding: '0.45rem 0.8rem', borderTop: '1px solid var(--border)', alignItems: 'start' }}>
            <div role="cell" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={small}>
                <span style={r.accountOpen ? { color: TEAL, fontWeight: 600 } : undefined}>{r.accountWords}</span>
                {r.repWords ? ` · ${r.repWords}` : ''}
              </div>
            </div>
            <div role="cell" style={{ minWidth: 0 }}>
              <div>{r.unpaidSince || '—'}</div>
              <div style={small}>{r.invoiceWords}</div>
            </div>
            <div role="cell" style={{ minWidth: 0 }}>
              {n ? (
                <>
                  <div style={{ color: NOTICE_INK[n.tone], fontWeight: n.tone === 'amber' ? 600 : undefined }}>{n.top}</div>
                  {n.sub ? <div style={small}>{n.sub}</div> : null}
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>
            <div role="cell" style={money}>${formatCurrency(r.paid)}</div>
            <div role="cell" style={{ ...money, fontWeight: 600 }}>${formatCurrency(r.owed)}</div>
          </div>
        )
      })}
      <div role="row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0 12px', padding: '0.45rem 0.8rem', borderTop: '1px solid var(--border-strong)', alignItems: 'baseline' }}>
        <span role="cell" style={{ color: 'var(--text-600)' }}>{card.housesWord}</span>
        <span role="cell" />
        <span role="cell" />
        <span role="cell" style={money}>${formatCurrency(card.paid)}</span>
        <strong role="cell" style={{ ...money, color: allPaid ? undefined : 'var(--text-amber-800)' }}>${formatCurrency(card.owed)}</strong>
      </div>
    </div>
  )

  return (
    <section data-lien-suppliers-card={allPaid ? 'paid' : 'owed'} aria-label="Supply houses on this job" style={{ border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', fontSize: '0.8125rem', minWidth: 0 }}>
      {head}
      {showRows ? rows : null}
      {showRows && (card.verdict || card.paidFirst) ? (
        <div style={{ padding: '0.55rem 0.8rem', borderTop: '1px solid var(--border)', display: 'grid', gap: 3 }}>
          {card.verdict ? <strong data-lien-suppliers-verdict>{card.verdict}</strong> : null}
          {card.paidFirst ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.paidFirst}</span> : null}
        </div>
      ) : null}
      {showRows ? (
        <div style={{ display: isMobile ? 'grid' : 'flex', alignItems: 'center', gap: isMobile ? 4 : 14, padding: '0.55rem 0.8rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', borderRadius: '0 0 9px 9px' }}>
          {!allPaid ? (
            <button type="button" onClick={copy} data-lien-suppliers-copy style={{ minHeight: isMobile ? 44 : 32, padding: '0 14px', borderRadius: 7, border: '1px solid transparent', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
              Copy for an email
            </button>
          ) : null}
          <Link to={heldHref} style={{ color: 'var(--text-blue-700)', textDecoration: 'none', fontWeight: isMobile ? 600 : undefined, ...(isMobile ? { minHeight: 44, display: 'grid', placeItems: 'center' } : {}) }}>
            Open in Held for suppliers ›
          </Link>
        </div>
      ) : null}
    </section>
  )
}
