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
  parseSupplierWordBalance,
  type LienSupplierCardRow,
  type LienSupplierJob,
  type LienSupplierMark,
} from '../../lib/jobs/lienJobSuppliers'
import { clearSupplierWord, saveSupplierWord } from '../../lib/jobs/lienSupplierWordIo'
import { formatErrorMessage } from '../../utils/errorHandling'

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
  // The house's own day (v2.4411) is said as the house's, with who said it and who wrote it down.
  if (r.notice.kind === 'said') {
    const past = r.notice.daysLeft < 0
    return { top: `notice ${past ? 'went' : 'goes'} out ${formatYmdMonthDay(r.notice.ymd)}`, sub: r.saidWords, tone: past ? 'muted' : r.notice.soon ? 'amber' : 'plain' }
  }
  if (r.notice.kind === 'open') return { top: `by ${formatYmdMonthDay(r.notice.ymd)}`, sub: `${r.notice.daysLeft} ${r.notice.daysLeft === 1 ? 'day' : 'days'}`, tone: r.notice.soon ? 'amber' : 'plain' }
  if (r.notice.kind === 'closed') return { top: `window closed ${formatYmdMonthDay(r.notice.ymd)}`, sub: '', tone: 'muted' }
  return null
}

const NOTICE_INK = { amber: 'var(--text-amber-800)', plain: 'var(--text-700)', muted: 'var(--text-muted)' } as const
const linkBtn: CSSProperties = { border: 'none', background: 'none', padding: 0, color: 'var(--text-blue-700)', cursor: 'pointer', font: 'inherit', fontSize: '0.6875rem', textAlign: 'left' }
const field: CSSProperties = { display: 'grid', gap: 3, fontSize: '0.75rem', color: 'var(--text-600)', minWidth: 0 }
const input: CSSProperties = { minHeight: 34, padding: '0 9px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-strong)', background: 'var(--surface)', minWidth: 0, width: '100%', boxSizing: 'border-box' }

/**
 * What the house told us (v2.4411): the house's own balance on the job and the day its
 * notice goes out, with who said it. Saved, it shows over our estimate on the card and in
 * the copied paragraph. Clear takes the word off and the estimate comes back.
 */
export function LienSupplierWordForm({ row, jobId, authName, isMobile, onDone, onCancel }: { row: LienSupplierCardRow; jobId: string; authName: string; isMobile: boolean; onDone: () => void; onCancel: () => void }) {
  const { showToast } = useToastContext()
  const [balance, setBalance] = useState(row.word?.balance != null ? formatCurrency(row.word.balance) : '')
  const [noticeYmd, setNoticeYmd] = useState(row.word?.noticeYmd ?? '')
  const [saidBy, setSaidBy] = useState(row.word?.saidBy ?? row.repWords.replace(/^rep /, ''))
  const [note, setNote] = useState(row.word?.note ?? '')
  const [busy, setBusy] = useState(false)
  const parsed = parseSupplierWordBalance(balance)
  const nothing = parsed.ok && parsed.value == null && !noticeYmd && !note.trim()
  const save = async () => {
    if (busy || !parsed.ok || nothing) return
    setBusy(true)
    try {
      await saveSupplierWord({ jobId, houseId: row.houseId, balance: parsed.value, noticeYmd: noticeYmd || null, saidBy, note, notedByName: authName })
      showToast(`Saved what ${row.name} told us.`, 'success')
      onDone()
    } catch (e) {
      showToast(formatErrorMessage(e, `Could not save what ${row.name} told us`), 'error')
    } finally {
      setBusy(false)
    }
  }
  const clear = async () => {
    if (busy) return
    setBusy(true)
    try {
      await clearSupplierWord(jobId, row.houseId)
      showToast(`Cleared. The card shows our estimate for ${row.name} again.`, 'success')
      onDone()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not clear it'), 'error')
    } finally {
      setBusy(false)
    }
  }
  const tall = isMobile ? { minHeight: 44 } : null
  return (
    <div data-lien-supplier-word-form={row.name} style={{ margin: '0 0.8rem 0.6rem', padding: '0.6rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: 8 }}>
      <strong>{row.name} told us…</strong>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: '8px 12px' }}>
        <label style={field}>
          Their balance on this job
          <input type="text" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder={`ours is $${formatCurrency(row.owed)}`} aria-invalid={!parsed.ok} style={{ ...input, ...tall, ...(parsed.ok ? null : { borderColor: 'var(--text-red-700)' }) }} />
        </label>
        <label style={field}>
          Their notice goes out
          <input type="date" value={noticeYmd} onChange={(e) => setNoticeYmd(e.target.value)} style={{ ...input, ...tall }} />
        </label>
        <label style={field}>
          Who said it
          <input type="text" value={saidBy} onChange={(e) => setSaidBy(e.target.value)} style={{ ...input, ...tall }} />
        </label>
        <label style={field}>
          Note
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, ...tall }} />
        </label>
      </div>
      {!parsed.ok ? <span style={{ fontSize: '0.75rem', color: 'var(--text-red-700)' }}>Type the balance as a number, like 8,950.00.</span> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        {row.word ? (
          <button type="button" disabled={busy} onClick={() => void clear()} style={{ ...tall, marginRight: 'auto', padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>
            Clear
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={onCancel} style={{ ...tall, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>
          Cancel
        </button>
        <button type="button" disabled={busy || !parsed.ok || nothing} onClick={() => void save()} style={{ ...tall, padding: '5px 14px', borderRadius: 7, border: '1px solid transparent', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy || !parsed.ok || nothing ? 0.55 : 1 }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

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
  word,
  headless = false,
}: {
  job: LienSupplierJob
  propertyKind: string
  todayYmd: string
  openBalance: number
  payerName: string
  jobLabel: string
  isMobile: boolean
  startFolded?: boolean
  /** Given to the office (v2.4411): each owed house gets *They told us…*, and a save re-reads the card. */
  word?: { authName: string; onChanged: () => void }
  /** The title row is drawn by the pane's stacked head instead (v2.4733); a folded card keeps its row, since the fold lives there. */
  headless?: boolean
}) {
  const { showToast } = useToastContext()
  const [editingHouse, setEditingHouse] = useState<string | null>(null)
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

  const wordDoor = (r: LienSupplierCardRow) =>
    word && r.owed > 0.005 ? (
      <button type="button" onClick={() => setEditingHouse(editingHouse === r.houseId ? null : r.houseId)} aria-expanded={editingHouse === r.houseId} data-lien-supplier-word-door={r.name} style={{ ...linkBtn, ...(isMobile ? { fontSize: '0.75rem', minHeight: 32 } : null) }}>
        {r.word ? 'Change what they told us…' : 'They told us…'}
      </button>
    ) : null
  const wordForm = (r: LienSupplierCardRow) =>
    word && editingHouse === r.houseId ? (
      <LienSupplierWordForm
        key={r.houseId}
        row={r}
        jobId={job.jobId}
        authName={word.authName}
        isMobile={isMobile}
        onCancel={() => setEditingHouse(null)}
        onDone={() => {
          setEditingHouse(null)
          word.onChanged()
        }}
      />
    ) : null

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
          <div key={r.houseId} data-lien-supplier-house={r.name} style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '0.55rem 0.8rem', display: 'grid', gap: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{r.name}</strong>
              <strong style={money}>${formatCurrency(r.owed)}</strong>
            </div>
            {r.theirBalanceWords ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{r.theirBalanceWords}</div> : null}
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
            {r.word?.note ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>“{r.word.note}”</div> : null}
            {r.paid > 0.005 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>paid ${formatCurrency(r.paid)}</div> : null}
            {wordDoor(r)}
          </div>
          {wordForm(r)}
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
          <div key={r.houseId} role="rowgroup" style={{ borderTop: '1px solid var(--border)' }}>
          <div role="row" data-lien-supplier-house={r.name} style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0 12px', padding: '0.45rem 0.8rem', alignItems: 'start' }}>
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
              {r.word?.note ? <div style={small}>“{r.word.note}”</div> : null}
              {wordDoor(r)}
            </div>
            <div role="cell" style={money}>${formatCurrency(r.paid)}</div>
            <div role="cell" style={{ minWidth: 0 }}>
              <div style={{ ...money, fontWeight: 600 }}>${formatCurrency(r.owed)}</div>
              {r.theirBalanceWords ? <div style={{ ...small, textAlign: 'right' }}>{r.theirBalanceWords}</div> : null}
            </div>
          </div>
          {wordForm(r)}
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
      {headless && !foldable ? null : head}
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
