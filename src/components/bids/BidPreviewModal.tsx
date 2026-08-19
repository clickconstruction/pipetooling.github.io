import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import { buildBidCopyForText } from '../../lib/bidCopyForText'
import { formatRelativeDayPhrase } from '../../lib/relativeDayPhrase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { CustomerSnapshotModal } from '../customers/CustomerSnapshotModal'
import { BidBoardNotesPanel, type BidBoardNotesTab } from './BidBoardNotesPanel'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'

export type BidPreviewTabUrl =
  | 'bid-board'
  | 'builder-review'
  | 'working'
  | 'bid-costs'
  | 'counts'
  | 'takeoffs'
  | 'labor'
  | 'pricing'
  | 'cover-letter'
  | 'submission-followup'
  | 'rfi'
  | 'change-order'
  | 'lien-release'

export type BidPreviewModalProps = {
  bid: BidWithBuilder | null
  loading: boolean
  error: string | null
  onClose: () => void
  onNavigateToBidsTab: (tab: BidPreviewTabUrl, bidId: string) => void
  onRequestEditBid: (bidId: string) => void
  /** After bid notes change (optional refresh of preview header fields). */
  onNotesMutated?: () => void
  /** After customer notes change; defaults to onNotesMutated when omitted. */
  onNotesMutatedCustomer?: () => void
  /** Light red panel when Submission & Followup "no update" highlight applies to this bid. */
  staleNoUpdateHighlight?: boolean
  /** Render as a pane inside BidWindowModal: no overlay/dialog chrome, no Edit/Close buttons. */
  paneMode?: boolean
}

function displayUser(u: EstimatorUser | null | undefined): string {
  if (!u) return '—'
  return (u.name?.trim() || u.email || '—').slice(0, 200)
}

function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return 'Open'
  if (outcome === 'won') return 'Won'
  if (outcome === 'lost') return 'Lost'
  if (outcome === 'started_or_complete') return 'Started or Complete'
  return outcome
}

function formatYmd(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  return value.slice(0, 10)
}

function money(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v))
}

const SECTION_LABEL_STYLE: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  marginBottom: '0.45rem',
}

function ExternalLink({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href?.trim()) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
        openInExternalBrowser(href)
      }}
      style={{ color: 'var(--text-link)', textDecoration: 'none' }}
    >
      {children}
    </a>
  )
}

const LINK_CHIP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.82rem',
  padding: '0.4rem 0.65rem',
  borderRadius: 999,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  textDecoration: 'none',
  cursor: 'pointer',
}

function LinkChip({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href?.trim()) {
    return (
      <span style={{ ...LINK_CHIP_STYLE, color: 'var(--text-muted)', borderStyle: 'dashed', cursor: 'default', opacity: 0.75 }}>
        {label} — none
      </span>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
        openInExternalBrowser(href)
      }}
      style={LINK_CHIP_STYLE}
    >
      {label}
    </a>
  )
}

function Fact({
  label,
  value,
  sub,
  amber = false,
  last = false,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  amber?: boolean
  last?: boolean
}) {
  return (
    <div
      style={{
        padding: '0.7rem 1rem 0.75rem',
        borderRight: last ? 'none' : '1px solid var(--border)',
        minWidth: 0,
        background: amber ? 'var(--bg-amber-tint)' : undefined,
      }}
    >
      <div
        style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: amber ? 'var(--text-amber-700)' : 'var(--text-muted)',
          marginBottom: '0.2rem',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          overflowWrap: 'break-word',
          color: amber ? 'var(--text-amber-700)' : 'var(--text-strong)',
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: '0.72rem', fontWeight: 500, color: amber ? 'var(--text-amber-700)' : 'var(--text-muted)', marginTop: '0.1rem' }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

type DetailEntry = {
  label: string
  value: ReactNode
  /** Empty entries fold into the "Empty: …" line until "Show all fields". */
  empty: boolean
}

function DetailLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        fontSize: '0.875rem',
        borderBottom: '1px dotted var(--border)',
        paddingBottom: '0.35rem',
        minWidth: 0,
      }}
    >
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', overflowWrap: 'break-word', minWidth: 0, color: 'var(--text-strong)' }}>{value}</span>
    </div>
  )
}

type TabActionGroup = { label: string; items: { tab: BidPreviewTabUrl; label: string }[] }

function buildTabActionGroups(role: UserRole | null): TabActionGroup[] {
  const scope: TabActionGroup['items'] = [
    { tab: 'bid-board', label: 'Bid Board' },
    { tab: 'builder-review', label: 'Builder Review' },
    { tab: 'working', label: 'Working' },
  ]
  if (role === 'dev') scope.push({ tab: 'bid-costs', label: 'Bid Costs' })
  scope.push({ tab: 'counts', label: 'Counts' })

  const price: TabActionGroup['items'] = []
  if (role !== 'superintendent') {
    price.push({ tab: 'pricing', label: 'Pricing' }, { tab: 'cover-letter', label: 'Cover Letter' })
  }

  const send: TabActionGroup['items'] = []
  if (role !== 'superintendent') send.push({ tab: 'submission-followup', label: 'Submission' })
  send.push(
    { tab: 'rfi', label: 'RFI' },
    { tab: 'change-order', label: 'Change Order' },
    { tab: 'lien-release', label: 'Lien Release' }
  )

  return [
    { label: 'Scope', items: scope },
    { label: 'Price', items: price },
    { label: 'Send', items: send },
  ].filter((g) => g.items.length > 0)
}

export function BidPreviewModal({
  bid,
  loading,
  error,
  onClose,
  onNavigateToBidsTab,
  onRequestEditBid,
  onNotesMutated,
  onNotesMutatedCustomer,
  staleNoUpdateHighlight = false,
  paneMode = false,
}: BidPreviewModalProps) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()
  const [notesTab, setNotesTab] = useState<BidBoardNotesTab>('all')
  const [gcBuilderSnapshotOpen, setGcBuilderSnapshotOpen] = useState(false)
  const [showAllFields, setShowAllFields] = useState(false)
  const tabGroups = buildTabActionGroups(role)

  useEffect(() => {
    setNotesTab('all')
    setGcBuilderSnapshotOpen(false)
    setShowAllFields(false)
  }, [bid?.id])

  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
    boxSizing: 'border-box',
  }

  const modalStyle: CSSProperties = {
    background: staleNoUpdateHighlight ? 'var(--bg-red-tint)' : 'var(--surface)',
    padding: 0,
    borderRadius: 10,
    maxWidth: 720,
    width: '100%',
    maxHeight: 'min(90vh, 100%)',
    overflow: 'auto',
    boxSizing: 'border-box',
  }

  const bidNumberLabel =
    bid && bid.bid_number != null && String(bid.bid_number).trim()
      ? formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, ledgerPrefixMap), bid.bid_number)
      : '—'

  const dueYmd = bid?.bid_due_date?.trim() ? bid.bid_due_date.slice(0, 10) : ''
  const duePhrase = dueYmd ? formatRelativeDayPhrase(dueYmd, todayYmd) : null
  const dueIsHot = Boolean(dueYmd) && !bid?.outcome

  const gcName = bid?.customers?.name ?? bid?.bids_gc_builders?.name ?? null
  const gcContact = bid ? [bid.gc_contact_name, bid.gc_contact_phone, bid.gc_contact_email].filter(Boolean).join(' · ') : ''

  const lossReason = (bid as { loss_reason?: string | null } | null)?.loss_reason ?? null
  const submittedTo = (bid as { submitted_to?: string | null } | null)?.submitted_to ?? null

  const detailEntries: DetailEntry[] = bid
    ? [
        { label: 'Outcome', value: outcomeLabel(bid.outcome), empty: false },
        ...(lossReason ? [{ label: 'Loss reason', value: lossReason, empty: false }] : []),
        { label: 'Bid due date', value: formatYmd(bid.bid_due_date), empty: !bid.bid_due_date?.trim() },
        { label: 'Bid date sent', value: formatYmd(bid.bid_date_sent), empty: !bid.bid_date_sent?.trim() },
        { label: 'Design plan date', value: formatYmd(bid.design_drawing_plan_date), empty: !bid.design_drawing_plan_date?.trim() },
        ...(bid.outcome === 'won' || bid.estimated_job_start_date
          ? [{ label: 'Start date', value: formatYmd(bid.estimated_job_start_date), empty: !bid.estimated_job_start_date?.trim() }]
          : []),
        { label: 'Plan pages', value: bid.plan_pages != null ? String(bid.plan_pages) : '—', empty: bid.plan_pages == null },
        {
          label: 'Distance to office (mi)',
          value: bid.distance_from_office != null ? String(bid.distance_from_office) : '—',
          empty: bid.distance_from_office == null,
        },
        { label: 'GC contact', value: gcContact || '—', empty: !gcContact },
        { label: 'Agreed value', value: money(bid.agreed_value), empty: bid.agreed_value == null },
        { label: 'Profit', value: money(bid.profit), empty: bid.profit == null },
        { label: 'Last contact', value: formatYmd(bid.last_contact), empty: !bid.last_contact?.trim() },
        ...(submittedTo ? [{ label: 'Submitted to', value: submittedTo, empty: false }] : []),
      ]
    : []
  const shownEntries = showAllFields ? detailEntries : detailEntries.filter((e) => !e.empty)
  const foldedLabels = detailEntries.filter((e) => e.empty).map((e) => e.label)

  return (
    <div
      className={paneMode ? undefined : 'bid-preview-overlay'}
      style={paneMode ? undefined : overlayStyle}
      role={paneMode ? undefined : 'presentation'}
      onMouseDown={
        paneMode
          ? undefined
          : (e) => {
              if (e.target === e.currentTarget) onClose()
            }
      }
    >
      <div
        role={paneMode ? undefined : 'dialog'}
        aria-modal={paneMode ? undefined : true}
        aria-labelledby={paneMode ? undefined : 'bid-preview-title'}
        style={paneMode ? { background: staleNoUpdateHighlight ? 'var(--bg-red-tint)' : undefined } : modalStyle}
        onMouseDown={paneMode ? undefined : (e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '1.1rem 1.4rem 1rem',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 id={paneMode ? undefined : 'bid-preview-title'} style={{ margin: '0 0 0.15rem', fontSize: '1.3rem', letterSpacing: '-0.01em', overflowWrap: 'break-word' }}>
              {bid ? bid.project_name?.trim() || '—' : 'Preview Bid'}
            </h2>
            {bid ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflowWrap: 'break-word' }}>
                <span style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>{bidNumberLabel}</span>
                {bid.service_type?.name ? <> · {bid.service_type.name}</> : null}
                {bid.address?.trim() ? (
                  <>
                    {' · '}
                    {bid.address}
                    {' · '}
                    <ExternalLink href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bid.address)}`}>Map</ExternalLink>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {bid ? (
              <button
                type="button"
                title="Copies project name, address, and bid due date"
                onClick={() => {
                  void (async () => {
                    const text = buildBidCopyForText(bid)
                    if (!text) {
                      showToast('Nothing to copy', 'error')
                      return
                    }
                    try {
                      if (!navigator.clipboard?.writeText) {
                        showToast('Could not copy', 'error')
                        return
                      }
                      await navigator.clipboard.writeText(text)
                      showToast('Copied for text', 'success')
                    } catch {
                      showToast('Could not copy', 'error')
                    }
                  })()
                }}
                style={{ padding: '0.45rem 0.7rem', fontSize: '0.85rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-strong)' }}
              >
                Copy for text
              </button>
            ) : null}
            {bid && !paneMode ? (
              <button
                type="button"
                onClick={() => onRequestEditBid(bid.id)}
                style={{ padding: '0.45rem 0.7rem', fontSize: '0.85rem', background: '#3b82f6', color: 'white', border: '1px solid #3b82f6', borderRadius: 5, cursor: 'pointer' }}
              >
                Edit bid
              </button>
            ) : null}
            {!paneMode ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                title="Close"
                style={{ padding: '0.45rem 0.55rem', fontSize: '0.85rem', lineHeight: 1, background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-strong)' }}
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>

        {loading ? <div style={{ color: 'var(--text-muted)', padding: '0 1.4rem 1.3rem' }}>Loading…</div> : null}
        {!loading && error ? (
          <div style={{ margin: '0 1.4rem 1.3rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4 }}>
            {error}
          </div>
        ) : null}
        {!loading && !error && !bid ? (
          <div style={{ color: 'var(--text-muted)', padding: '0 1.4rem 1.3rem' }}>Bid not found or you do not have access.</div>
        ) : null}

        {bid ? (
          <>
            <div
              className="bid-preview-facts"
              style={{
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
              }}
            >
              <Fact
                label="Bid due"
                value={dueYmd || '—'}
                sub={duePhrase ?? (dueYmd ? undefined : 'no due date')}
                amber={dueIsHot}
              />
              <Fact
                label="Bid value"
                value={money(bid.bid_value)}
                sub={bid.agreed_value != null ? `agreed ${money(bid.agreed_value)}` : bid.bid_value == null ? 'not priced yet' : undefined}
              />
              <Fact
                label="GC / Builder"
                value={
                  bid.customer_id || bid.bids_gc_builders ? (
                    <button
                      type="button"
                      onClick={() => setGcBuilderSnapshotOpen(true)}
                      style={{
                        margin: 0,
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        font: 'inherit',
                        color: 'var(--text-link)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        overflowWrap: 'break-word',
                      }}
                    >
                      {gcName ?? '—'}
                    </button>
                  ) : (
                    '—'
                  )
                }
                sub={gcContact || 'no contact on file'}
              />
              <div style={{ padding: '0.7rem 1rem 0.75rem', minWidth: 0 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'break-word' }}>
                  {displayUser(bid.estimator as EstimatorUser | null | undefined)}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>(Estimator)</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'break-word' }}>
                  {displayUser(bid.account_manager as EstimatorUser | null | undefined)}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>(Account Man)</div>
              </div>
            </div>

            <div style={{ padding: '1.1rem 1.4rem 1.3rem', display: 'grid', gap: '1.15rem' }}>
              <div>
                <div style={SECTION_LABEL_STYLE}>Files &amp; links</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  <LinkChip href={bid.drive_link} label="Drive folder" />
                  <LinkChip href={bid.plans_link} label="Plans" />
                  <LinkChip href={bid.count_tooling_plans_link} label="Takeoff" />
                  <LinkChip href={bid.bid_submission_link} label="Submission" />
                </div>
              </div>

              <div>
                <div style={SECTION_LABEL_STYLE}>Details</div>
                <div
                  className="bid-preview-detail-grid"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem 1.5rem' }}
                >
                  {shownEntries.map((e) => (
                    <DetailLine key={e.label} label={e.label} value={e.value} />
                  ))}
                </div>
                {foldedLabels.length > 0 ? (
                  <p style={{ margin: '0.55rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {showAllFields ? 'Showing all fields · ' : <>Empty: {foldedLabels.join(', ')} · </>}
                    <button
                      type="button"
                      onClick={() => setShowAllFields((p) => !p)}
                      style={{ font: 'inherit', color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      {showAllFields ? 'Hide empty fields' : 'Show all fields'}
                    </button>
                  </p>
                ) : null}
                {bid.notes?.trim() ? (
                  <div style={{ marginTop: '0.8rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Notes</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-strong)', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{bid.notes}</div>
                  </div>
                ) : null}
              </div>

              <div>
                <div style={SECTION_LABEL_STYLE}>Open in Bids</div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {tabGroups.map((group) => (
                    <div key={group.label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--text-muted)',
                          width: '3.6rem',
                          flexShrink: 0,
                        }}
                      >
                        {group.label}
                      </span>
                      {group.items.map(({ tab, label }) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => onNavigateToBidsTab(tab, bid.id)}
                          style={{
                            padding: '0.28rem 0.55rem',
                            fontSize: '0.78rem',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            background: 'var(--bg-subtle)',
                            cursor: 'pointer',
                            color: 'var(--text-700)',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <BidBoardNotesPanel
                  bid={bid}
                  notesTab={notesTab}
                  onNotesTabChange={setNotesTab}
                  onLoadError={(msg) => showToast(msg, 'error')}
                  onMutated={onNotesMutated ?? (() => {})}
                  onMutatedCustomer={onNotesMutatedCustomer ?? onNotesMutated ?? (() => {})}
                  idPrefix="bid-preview"
                />
              </div>
            </div>
          </>
        ) : null}

        {bid ? (
          <CustomerSnapshotModal
            open={gcBuilderSnapshotOpen}
            onClose={() => setGcBuilderSnapshotOpen(false)}
            customerId={bid.customer_id}
            gcBuilder={bid.customer_id ? null : bid.bids_gc_builders ?? null}
          />
        ) : null}
      </div>
    </div>
  )
}
