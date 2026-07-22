import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { COMMENT_KEY_BY_RATING, RATING_DEFS, RatingSliders, type RatingKey } from './ratingDimensions'
import TeamReviewSection from './TeamReviewSection'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import {
  UNSORTED_ROLE_KEY,
  groupTeamProspects,
  moveTeamProspectAcrossRoles,
  nextTeamProspectRank,
  reorderActiveTeamProspects,
  roleKeyOf,
  type TeamProspectRankUpdate,
} from '../../lib/teamProspectRanking'
import { distinctTeamProspectSources, summarizeTeamProspectSources } from '../../lib/teamProspectSourceSummary'

export type TeamProspect = {
  id: string
  master_user_id: string
  created_by: string
  name: string
  phone_number: string | null
  email: string | null
  trade: string | null
  source: string | null
  notes: string | null
  status: string
  rank_order: number
  role_id: string | null
  last_contact: string | null
  created_at: string | null
  updated_at: string | null
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  links: unknown
}

export type TeamProspectRole = {
  id: string
  name: string
  position: number
  created_at: string | null
}

/** One reviewer's screening-call verdict (team_prospect_reviews; unique per candidate+reviewer). */
export type TeamProspectReview = {
  id: string
  team_prospect_id: string
  reviewer_user_id: string
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  comment_ability: string | null
  comment_drive: string | null
  comment_integrity: string | null
  remarks: string | null
  updated_at: string | null
}

type ReviewDraft = {
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  comment_ability: string
  comment_drive: string
  comment_integrity: string
  remarks: string
}

const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  rating_ability: null, rating_drive: null, rating_integrity: null,
  comment_ability: '', comment_drive: '', comment_integrity: '', remarks: '',
}

/** Dev-defined onboarding checklist item (Hire tab). */
export type TeamOnboardingItem = {
  id: string
  label: string
  link_url: string | null
  position: number
}

type OnboardingStatusValue = 'pending' | 'requested' | 'done'

/** Box colors: red = pending, yellow = requested (asked, waiting), green = done. */
const ONBOARDING_STATUS_META: Record<OnboardingStatusValue, { label: string; color: string; next: OnboardingStatusValue }> = {
  pending: { label: 'Not started', color: 'var(--text-red-600)', next: 'requested' },
  requested: { label: 'Requested — waiting', color: '#d97706', next: 'done' },
  done: { label: 'Done', color: '#16a34a', next: 'pending' },
}

type Props = {
  authUserId: string
  /** Devs manage the Hire tab's onboarding checklist items. */
  isDev: boolean
  resolveMasterId: () => Promise<string | null>
}

type CandidateDraft = {
  name: string
  phone_number: string
  email: string
  trade: string
  source: string
  notes: string
  role_id: string // '' = Unsorted
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  links: Array<{ type: string; url: string }>
}

const EMPTY_DRAFT: CandidateDraft = {
  name: '', phone_number: '', email: '', trade: '', source: '', notes: '', role_id: '',
  rating_ability: null, rating_drive: null, rating_integrity: null, links: [],
}

export type CandidateLink = { type: string; url: string }

const CANDIDATE_LINK_TYPE_SUGGESTIONS = ['Indeed', 'Resume', 'LinkedIn', 'Facebook', 'Website', 'References', 'Other']

/** Parse the jsonb links column defensively (old rows have none; bad shapes are dropped). */
function parseCandidateLinks(raw: unknown): CandidateLink[] {
  if (!Array.isArray(raw)) return []
  const out: CandidateLink[] = []
  for (const item of raw) {
    if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
      const url = (item as { url: string }).url.trim()
      if (!url) continue
      const t = typeof (item as { type?: unknown }).type === 'string' ? ((item as { type: string }).type).trim() : ''
      out.push({ type: t || 'Link', url })
    }
  }
  return out
}

/** Normalize for save: drop empty urls, default the type, ensure a protocol so chips open off-site. */
function serializeCandidateLinks(links: CandidateLink[]): CandidateLink[] {
  return links
    .map((l) => ({ type: l.type.trim() || 'Link', url: l.url.trim() }))
    .filter((l) => l.url)
    .map((l) => ({ ...l, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}` }))
}

/** Candidate link chips (board + interview cards): type name opens the url in a new tab. */
function CandidateLinkChips({ links }: { links: CandidateLink[] }) {
  if (links.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.35rem 0 0 1.35rem' }}>
      {links.map((l, i) => (
        <a
          key={`${l.url}-${i}`}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          title={l.url}
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '0.1rem 0.45rem',
            borderRadius: 999,
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-link)',
            textDecoration: 'none',
          }}
        >
          🔗 {l.type}
        </a>
      ))}
    </div>
  )
}

// RATING_DEFS / RatingKey / RatingValues / COMMENT_KEY_BY_RATING / RatingSliders
// moved to ./ratingDimensions (v2.948) — shared with Team → Review.

/** Card-footer read-only bars — deliberately NOT range inputs so they can't fight the drag-to-rank gesture. */
function CandidateRatingBars({ candidate }: { candidate: TeamProspect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', margin: '0.45rem 0 0 1.35rem' }}>
      {RATING_DEFS.map((def) => {
        const value = candidate[def.key as RatingKey]
        return (
          <div key={def.key} title={`${def.label}: ${value == null ? 'unrated' : `${value}/100`}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.65rem', color: value == null ? 'var(--text-faint)' : 'var(--text-muted)', width: '3.4rem', flexShrink: 0 }}>
              {def.short}
            </span>
            <span aria-hidden style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${value ?? 0}%`, background: def.color, borderRadius: 999 }} />
            </span>
            <span style={{ fontSize: '0.65rem', color: value == null ? 'var(--text-faint)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', width: '1.6rem', textAlign: 'right', flexShrink: 0 }}>
              {value == null ? '—' : value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const inputStyle = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 } as const
const labelSpanStyle = { display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' } as const
const smallButtonStyle = (busy: boolean) => ({
  padding: '0.3rem 0.65rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  background: 'var(--bg-subtle)',
  color: 'var(--text-700)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  cursor: busy ? 'not-allowed' : 'pointer',
  opacity: busy ? 0.65 : 1,
}) as const

function dropId(roleKey: string): string {
  return `drop:${roleKey}`
}

/** Kanban boards: `closestCorners` alone keeps favoring the source column; prefer pointer placement first. */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  if (pointer.length > 0) return pointer
  const rect = rectIntersection(args)
  if (rect.length > 0) return rect
  return closestCorners(args)
}

function formatLastContact(iso: string | null): string {
  if (!iso) return 'Never contacted'
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'Contacted today'
  if (diffDays === 1) return 'Contacted 1 day ago'
  return `Contacted ${diffDays} days ago`
}

function CandidateFields({
  draft,
  setDraft,
  roles,
  knownSources,
}: {
  draft: CandidateDraft
  setDraft: (d: CandidateDraft) => void
  roles: TeamProspectRole[]
  knownSources: string[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <label>
        <span style={labelSpanStyle}>Name *</span>
        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Role column</span>
        <select value={draft.role_id} onChange={(e) => setDraft({ ...draft, role_id: e.target.value })} style={inputStyle}>
          <option value="">Unsorted</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span style={labelSpanStyle}>Phone Number</span>
        <input type="text" value={draft.phone_number} onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Email</span>
        <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Trade (plumber, apprentice, office…)</span>
        <input type="text" value={draft.trade} onChange={(e) => setDraft({ ...draft, trade: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Source (referral, job board, walk-in…)</span>
        {/* Reuse existing spellings so the Source success stats don't fragment */}
        <input type="text" list="team-prospect-source-options" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} style={inputStyle} />
        <datalist id="team-prospect-source-options">
          {knownSources.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <div>
        <span style={labelSpanStyle}>Links</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {draft.links.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                type="text"
                list="team-prospect-link-type-options"
                value={l.type}
                placeholder="Type"
                aria-label={`Link ${i + 1} type`}
                onChange={(e) => setDraft({ ...draft, links: draft.links.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}
                style={{ ...inputStyle, width: '7.5rem', flexShrink: 0 }}
              />
              <input
                type="url"
                value={l.url}
                placeholder="https://…"
                aria-label={`Link ${i + 1} URL`}
                onChange={(e) => setDraft({ ...draft, links: draft.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, links: draft.links.filter((_, j) => j !== i) })}
                title="Remove link"
                aria-label={`Remove link ${i + 1}`}
                style={{ border: 'none', background: 'none', color: 'var(--text-red-600)', cursor: 'pointer', padding: '0 0.25rem', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
          <datalist id="team-prospect-link-type-options">
            {CANDIDATE_LINK_TYPE_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, links: [...draft.links, { type: '', url: '' }] })}
            style={{ alignSelf: 'flex-start', padding: '0.25rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            + Add link
          </button>
        </div>
      </div>
      <label>
        <span style={labelSpanStyle}>Notes</span>
        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
    </div>
  )
}

/** One draggable candidate card in a role column. */
function SortableCandidateCard({
  candidate,
  rank,
  busy,
  onEdit,
  onMarkContacted,
  onSetStatus,
  onPullUp,
}: {
  candidate: TeamProspect
  rank: number
  busy: boolean
  onEdit: () => void
  onMarkContacted: () => void
  onSetStatus: (status: 'hired' | 'passed') => void
  onPullUp: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: candidate.id })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        padding: '0.5rem 0.6rem',
        background: 'var(--surface)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to re-rank or move to another role"
          aria-label="Drag to re-rank or move to another role"
          style={{ cursor: 'grab', background: 'none', border: 'none', color: 'var(--text-faint)', padding: 0, fontSize: '1rem', touchAction: 'none' }}
        >
          ⠿
        </button>
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>#{rank}</span>
        <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{candidate.name}</span>
        {candidate.trade && (
          <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {candidate.trade}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          title={`Edit ${candidate.name}`}
          aria-label={`Edit ${candidate.name}`}
          style={{ background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', color: 'var(--text-faint)', padding: 0, fontSize: '0.9375rem', lineHeight: 1, alignSelf: 'flex-start' }}
        >
          ⚙
        </button>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.25rem 0 0 1.35rem' }}>
        {candidate.phone_number && <span>{candidate.phone_number}</span>}
        {candidate.email && <span style={{ overflowWrap: 'anywhere' }}>{candidate.email}</span>}
        {candidate.source && <span>via {candidate.source}</span>}
        <span>{formatLastContact(candidate.last_contact)}</span>
      </div>
      {candidate.notes && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 1.35rem', whiteSpace: 'pre-wrap' }}>{candidate.notes}</div>
      )}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.4rem 0 0 1.35rem' }}>
        <button type="button" disabled={busy} onClick={onMarkContacted} title="Stamp last contact as now" style={smallButtonStyle(busy)}>
          Talked today
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onPullUp}
          title="Advance to Interview"
          style={{ ...smallButtonStyle(busy), background: '#2563eb', color: 'white', border: 'none' }}
        >
          Advance
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetStatus('passed')}
          style={{ ...smallButtonStyle(busy), color: 'var(--text-red-600)' }}
        >
          Passed
        </button>
      </div>
      <CandidateLinkChips links={parseCandidateLinks(candidate.links)} />
      <CandidateRatingBars candidate={candidate} />
    </li>
  )
}

/** One role column: droppable header + sortable card list + per-column Add. */
function RoleColumn({
  roleKey,
  title,
  candidates,
  referencedCount,
  busy,
  confirmingDeleteRole,
  onRequestDeleteRole,
  onConfirmDeleteRole,
  onCancelDeleteRole,
  onAddCandidate,
  renderCard,
}: {
  roleKey: string
  title: string
  candidates: TeamProspect[]
  /** Rows of ANY status referencing this role — a real role is deletable only at zero. Null for the virtual Unsorted column. */
  referencedCount: number | null
  busy: boolean
  confirmingDeleteRole: boolean
  onRequestDeleteRole: () => void
  onConfirmDeleteRole: () => void
  onCancelDeleteRole: () => void
  onAddCandidate: () => void
  renderCard: (candidate: TeamProspect, rank: number) => ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(roleKey) })
  const isRealRole = referencedCount !== null
  const deletable = isRealRole && referencedCount === 0
  return (
    <section
      style={{
        flex: '0 0 300px',
        maxWidth: 300,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: isOver ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({candidates.length})</span>
        <span style={{ flex: 1 }} />
        {isRealRole && !confirmingDeleteRole && (
          <button
            type="button"
            disabled={busy || !deletable}
            onClick={onRequestDeleteRole}
            title={deletable ? 'Delete this role column' : `Delete every candidate in this role first (${referencedCount} still assigned, including Hired/Passed)`}
            aria-label={`Delete role ${title}`}
            style={{
              background: 'none',
              border: 'none',
              color: deletable ? 'var(--text-red-600)' : 'var(--text-faint)',
              cursor: busy || !deletable ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              padding: '0 0.15rem',
            }}
          >
            ✕
          </button>
        )}
        {isRealRole && confirmingDeleteRole && (
          <span style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmDeleteRole}
              style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              Delete role
            </button>
            <button type="button" disabled={busy} onClick={onCancelDeleteRole} style={{ ...smallButtonStyle(busy), fontSize: '0.7rem' }}>
              Cancel
            </button>
          </span>
        )}
      </header>
      <div ref={setNodeRef} style={{ flex: 1, padding: '0.5rem', minHeight: 60 }}>
        <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {candidates.map((c, i) => renderCard(c, i + 1))}
          </ul>
        </SortableContext>
        {candidates.length === 0 && (
          <p style={{ margin: 0, padding: '0.5rem 0.25rem', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
            {roleKey === UNSORTED_ROLE_KEY ? 'Nothing unsorted.' : 'No candidates yet — add one below or drag a card here.'}
          </p>
        )}
      </div>
      <footer style={{ padding: '0.5rem' }}>
        <button
          type="button"
          disabled={busy}
          onClick={onAddCandidate}
          style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-blue-500)', border: '1px dashed var(--border-strong)', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          + Add candidate
        </button>
      </footer>
    </section>
  )
}

/** Prospects → Team: prospective hires on a board — one drag-ranked column per role being hired for. */
export default function TeamProspectsTab({ authUserId, isDev, resolveMasterId }: Props) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<TeamProspect[]>([])
  const [roles, setRoles] = useState<TeamProspectRole[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addDraft, setAddDraft] = useState<CandidateDraft>(EMPTY_DRAFT)
  const [editTarget, setEditTarget] = useState<TeamProspect | null>(null)
  const [editDraft, setEditDraft] = useState<CandidateDraft>(EMPTY_DRAFT)
  const [modalError, setModalError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [addingRole, setAddingRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState<string | null>(null)

  /** Which stage sub-tab is showing: Screen (board) / Interview (calls+reviews) / Hire / Review (current team, v2.948). */
  const [stage, setStage] = useState<'screen' | 'interview' | 'hire' | 'review'>('screen')
  const [activeUserCount, setActiveUserCount] = useState(0)
  const [onboardingItems, setOnboardingItems] = useState<TeamOnboardingItem[]>([])
  /** `${prospectId}:${itemId}` → status; missing key = pending. */
  const [onboardingStatuses, setOnboardingStatuses] = useState<Map<string, OnboardingStatusValue>>(() => new Map())
  const [onboardingSettingsOpen, setOnboardingSettingsOpen] = useState(false)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemLink, setNewItemLink] = useState('')
  const [itemDrafts, setItemDrafts] = useState<Record<string, { label: string; link_url: string }>>({})
  const [passedOpen, setPassedOpen] = useState(false)
  const [reviews, setReviews] = useState<TeamProspectReview[]>([])
  const [reviewerNames, setReviewerNames] = useState<Map<string, string>>(() => new Map())
  const [reviewTarget, setReviewTarget] = useState<TeamProspect | null>(null)
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(EMPTY_REVIEW_DRAFT)
  const [hireTarget, setHireTarget] = useState<TeamProspect | null>(null)
  const [hireKind, setHireKind] = useState<'sub' | 'helper'>('sub')
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    const [candidatesRes, rolesRes, reviewsRes, itemsRes, statusesRes, activeUsersRes] = await Promise.all([
      supabase.from('team_prospects').select('*').order('rank_order', { ascending: true }),
      supabase.from('team_prospect_roles').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('team_prospect_reviews').select('*').order('updated_at', { ascending: false }),
      supabase.from('team_onboarding_items').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('team_prospect_onboarding_statuses').select('*'),
      supabase.from('users').select('id', { count: 'exact', head: true }).is('archived_at', null),
    ])
    setActiveUserCount(activeUsersRes.count ?? 0)
    if (candidatesRes.error || rolesRes.error) {
      showToast(`Failed to load candidates: ${(candidatesRes.error ?? rolesRes.error)!.message}`, 'error')
    } else {
      setRows((candidatesRes.data ?? []) as TeamProspect[])
      setRoles((rolesRes.data ?? []) as TeamProspectRole[])
      // Reviews are additive UI; a load error (e.g. migration not applied yet) just hides them.
      const reviewRows = (reviewsRes.error ? [] : (reviewsRes.data ?? [])) as TeamProspectReview[]
      setReviews(reviewRows)
      const reviewerIds = [...new Set(reviewRows.map((r) => r.reviewer_user_id))]
      if (reviewerIds.length > 0) {
        const { data: reviewers } = await supabase.from('users').select('id, name').in('id', reviewerIds)
        setReviewerNames(new Map(((reviewers ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, (u.name ?? '').trim() || 'Reviewer'])))
      } else {
        setReviewerNames(new Map())
      }
      // Onboarding is additive UI; load errors (e.g. migration pending) just hide it.
      setOnboardingItems((itemsRes.error ? [] : ((itemsRes.data ?? []) as TeamOnboardingItem[])))
      const statusMap = new Map<string, OnboardingStatusValue>()
      if (!statusesRes.error) {
        for (const r of (statusesRes.data ?? []) as Array<{ team_prospect_id: string; item_id: string; status: string }>) {
          statusMap.set(`${r.team_prospect_id}:${r.item_id}`, r.status as OnboardingStatusValue)
        }
      }
      setOnboardingStatuses(statusMap)
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const { activeByRole, calling, hired, passed } = groupTeamProspects(rows)
  const reviewsByProspect = new Map<string, TeamProspectReview[]>()
  for (const r of reviews) {
    ;(reviewsByProspect.get(r.team_prospect_id) ?? reviewsByProspect.set(r.team_prospect_id, []).get(r.team_prospect_id)!).push(r)
  }
  const roleNameById = new Map(roles.map((r) => [r.id, r.name]))
  const referencedCountByRole = new Map<string, number>()
  for (const r of rows) {
    if (!r.role_id) continue
    referencedCountByRole.set(r.role_id, (referencedCountByRole.get(r.role_id) ?? 0) + 1)
  }
  const unsortedActive = activeByRole[UNSORTED_ROLE_KEY] ?? []
  const sourceSummary = summarizeTeamProspectSources(rows)
  const knownSources = distinctTeamProspectSources(rows)

  async function persistRankUpdates(updates: TeamProspectRankUpdate[]) {
    const results = await Promise.all(
      updates.map((u) => {
        const payload: { rank_order: number; role_id?: string | null } = { rank_order: u.rank_order }
        if ('role_id' in u) payload.role_id = u.role_id ?? null
        return supabase.from('team_prospects').update(payload).eq('id', u.id)
      }),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      showToast(`Failed to save ranking: ${failed.error.message}`, 'error')
      await load()
    }
  }

  function applyListsToRows(lists: TeamProspect[][]) {
    const changed = new Map<string, TeamProspect>()
    for (const list of lists) for (const row of list) changed.set(row.id, row)
    setRows((prev) => prev.map((r) => changed.get(r.id) ?? r))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event
    if (!over) return
    const draggedId = String(dragged.id)
    const draggedRow = rows.find((r) => r.id === draggedId)
    if (!draggedRow || draggedRow.status === 'hired' || draggedRow.status === 'passed') return
    const sourceKey = roleKeyOf(draggedRow)

    const overStr = String(over.id)
    let destKey: string
    let overCandidateId: string | null = null
    if (overStr.startsWith('drop:')) {
      destKey = overStr.slice('drop:'.length)
    } else {
      overCandidateId = overStr
      const overRow = rows.find((r) => r.id === overStr)
      if (!overRow) return
      destKey = roleKeyOf(overRow)
    }

    const sourceList = activeByRole[sourceKey] ?? []
    if (sourceKey === destKey) {
      if (!overCandidateId || overCandidateId === draggedId) return
      const fromIndex = sourceList.findIndex((r) => r.id === draggedId)
      const toIndex = sourceList.findIndex((r) => r.id === overCandidateId)
      const { next, updates } = reorderActiveTeamProspects(sourceList, fromIndex, toIndex)
      if (updates.length === 0) return
      applyListsToRows([next])
      await persistRankUpdates(updates)
    } else {
      const destList = activeByRole[destKey] ?? []
      const destIndex = overCandidateId ? destList.findIndex((r) => r.id === overCandidateId) : destList.length
      const destRoleId = destKey === UNSORTED_ROLE_KEY ? null : destKey
      const { source, dest, updates } = moveTeamProspectAcrossRoles(
        sourceList,
        destList,
        draggedId,
        destIndex < 0 ? destList.length : destIndex,
        destRoleId,
      )
      if (updates.length === 0) return
      applyListsToRows([source, dest])
      await persistRankUpdates(updates)
    }
  }

  async function saveNewCandidate() {
    if (busy) return
    if (!addDraft.name.trim()) {
      setModalError('Name is required.')
      return
    }
    setBusy(true)
    setModalError(null)
    const masterId = await resolveMasterId()
    if (!masterId) {
      setModalError('Unable to determine owner.')
      setBusy(false)
      return
    }
    const roleId = addDraft.role_id || null
    const { error } = await supabase.from('team_prospects').insert({
      master_user_id: masterId,
      created_by: authUserId,
      name: addDraft.name.trim(),
      phone_number: addDraft.phone_number.trim() || null,
      email: addDraft.email.trim() || null,
      trade: addDraft.trade.trim() || null,
      source: addDraft.source.trim() || null,
      notes: addDraft.notes.trim() || null,
      links: serializeCandidateLinks(addDraft.links) as unknown as string,
      status: 'active',
      role_id: roleId,
      rank_order: nextTeamProspectRank(rows, roleId),
    })
    setBusy(false)
    if (error) {
      setModalError(error.message)
      return
    }
    setAddOpen(false)
    setAddDraft(EMPTY_DRAFT)
    await load()
  }

  async function saveEdit() {
    if (!editTarget || busy) return
    if (!editDraft.name.trim()) {
      setModalError('Name is required.')
      return
    }
    setBusy(true)
    setModalError(null)
    const newRoleId = editDraft.role_id || null
    const roleChanged = newRoleId !== (editTarget.role_id ?? null)
    const payload: Record<string, string | number | null> = {
      name: editDraft.name.trim(),
      phone_number: editDraft.phone_number.trim() || null,
      email: editDraft.email.trim() || null,
      trade: editDraft.trade.trim() || null,
      source: editDraft.source.trim() || null,
      notes: editDraft.notes.trim() || null,
      rating_ability: editDraft.rating_ability,
      rating_drive: editDraft.rating_drive,
      rating_integrity: editDraft.rating_integrity,
      links: serializeCandidateLinks(editDraft.links) as unknown as string,
    }
    if (roleChanged) {
      // Moving via the modal appends to the bottom of the target column
      payload.role_id = newRoleId
      payload.rank_order = nextTeamProspectRank(rows, newRoleId)
    }
    const { error } = await supabase.from('team_prospects').update(payload).eq('id', editTarget.id)
    setBusy(false)
    if (error) {
      setModalError(error.message)
      return
    }
    setEditTarget(null)
    await load()
  }

  async function deleteCandidate() {
    if (!editTarget || busy) return
    setBusy(true)
    const { error } = await supabase.from('team_prospects').delete().eq('id', editTarget.id)
    setBusy(false)
    if (error) {
      setModalError(error.message)
      return
    }
    setEditTarget(null)
    await load()
  }

  async function setStatus(candidate: TeamProspect, status: 'active' | 'calling' | 'hired' | 'passed') {
    if (busy) return
    setBusy(true)
    const payload: { status: string; rank_order?: number } = { status }
    if (status === 'active') payload.rank_order = nextTeamProspectRank(rows, candidate.role_id)
    const { error } = await supabase.from('team_prospects').update(payload).eq('id', candidate.id)
    setBusy(false)
    if (error) {
      showToast(`Failed to update: ${error.message}`, 'error')
      return
    }
    // Hiring means we're about to give them constant work — offer the roster handoff.
    if (status === 'hired') {
      setHireKind('sub')
      setHireTarget(candidate)
    }
    await load()
  }

  function openReview(candidate: TeamProspect) {
    const mine = reviews.find((r) => r.team_prospect_id === candidate.id && r.reviewer_user_id === authUserId)
    setReviewDraft(
      mine
        ? {
            rating_ability: mine.rating_ability, rating_drive: mine.rating_drive, rating_integrity: mine.rating_integrity,
            comment_ability: mine.comment_ability ?? '', comment_drive: mine.comment_drive ?? '', comment_integrity: mine.comment_integrity ?? '',
            remarks: mine.remarks ?? '',
          }
        : EMPTY_REVIEW_DRAFT,
    )
    setModalError(null)
    setReviewTarget(candidate)
  }

  async function saveReview() {
    if (!reviewTarget || busy) return
    setBusy(true)
    setModalError(null)
    const { error } = await supabase.from('team_prospect_reviews').upsert(
      {
        team_prospect_id: reviewTarget.id,
        reviewer_user_id: authUserId,
        rating_ability: reviewDraft.rating_ability,
        rating_drive: reviewDraft.rating_drive,
        rating_integrity: reviewDraft.rating_integrity,
        comment_ability: reviewDraft.comment_ability.trim() || null,
        comment_drive: reviewDraft.comment_drive.trim() || null,
        comment_integrity: reviewDraft.comment_integrity.trim() || null,
        remarks: reviewDraft.remarks.trim() || null,
      },
      { onConflict: 'team_prospect_id,reviewer_user_id' },
    )
    setBusy(false)
    if (error) {
      setModalError(error.message)
      return
    }
    setReviewTarget(null)
    await load()
  }

  async function addHireToRoster() {
    if (!hireTarget || busy) return
    setBusy(true)
    setModalError(null)
    const { error } = await supabase.from('people').insert({
      master_user_id: authUserId,
      kind: hireKind,
      name: hireTarget.name,
      phone: hireTarget.phone_number,
      email: hireTarget.email,
      notes: 'Hired from Team Prospects',
    })
    setBusy(false)
    if (error) {
      setModalError(error.message)
      return
    }
    showToast(`${hireTarget.name} added to the roster — see People → Users`, 'success')
    setHireTarget(null)
  }

  /** Cycle one onboarding box: red (pending) → yellow (requested) → green (done) → red. */
  async function cycleOnboardingStatus(prospectId: string, itemId: string) {
    if (busy) return
    const key = `${prospectId}:${itemId}`
    const next = ONBOARDING_STATUS_META[onboardingStatuses.get(key) ?? 'pending'].next
    // Optimistic: boxes should feel instant while working down a checklist.
    setOnboardingStatuses((prev) => new Map(prev).set(key, next))
    const { error } = await supabase.from('team_prospect_onboarding_statuses').upsert(
      { team_prospect_id: prospectId, item_id: itemId, status: next, updated_by: authUserId },
      { onConflict: 'team_prospect_id,item_id' },
    )
    if (error) {
      showToast(`Failed to save: ${error.message}`, 'error')
      await load()
    }
  }

  async function addOnboardingItem() {
    if (busy || !newItemLabel.trim()) return
    setBusy(true)
    const maxPos = onboardingItems.reduce((m, i) => Math.max(m, i.position), 0)
    const { error } = await supabase.from('team_onboarding_items').insert({
      label: newItemLabel.trim(),
      link_url: newItemLink.trim() || null,
      position: maxPos + 1,
    })
    setBusy(false)
    if (error) {
      showToast(`Failed to add: ${error.message}`, 'error')
      return
    }
    setNewItemLabel('')
    setNewItemLink('')
    await load()
  }

  async function saveOnboardingItem(item: TeamOnboardingItem) {
    const draft = itemDrafts[item.id]
    if (busy || !draft || !draft.label.trim()) return
    setBusy(true)
    const { error } = await supabase
      .from('team_onboarding_items')
      .update({ label: draft.label.trim(), link_url: draft.link_url.trim() || null })
      .eq('id', item.id)
    setBusy(false)
    if (error) {
      showToast(`Failed to save: ${error.message}`, 'error')
      return
    }
    setItemDrafts((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    await load()
  }

  async function moveOnboardingItem(item: TeamOnboardingItem, delta: -1 | 1) {
    if (busy) return
    const idx = onboardingItems.findIndex((i) => i.id === item.id)
    const other = onboardingItems[idx + delta]
    if (!other) return
    setBusy(true)
    // Swap normalized positions (index-based so legacy duplicate positions untangle).
    const results = await Promise.all([
      supabase.from('team_onboarding_items').update({ position: idx + delta + 1 }).eq('id', item.id),
      supabase.from('team_onboarding_items').update({ position: idx + 1 }).eq('id', other.id),
    ])
    setBusy(false)
    const err = results.find((r) => r.error)?.error
    if (err) showToast(`Failed to reorder: ${err.message}`, 'error')
    await load()
  }

  async function deleteOnboardingItem(item: TeamOnboardingItem) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.from('team_onboarding_items').delete().eq('id', item.id)
    setBusy(false)
    if (error) {
      showToast(`Failed to delete: ${error.message}`, 'error')
      return
    }
    await load()
  }

  async function markContacted(candidate: TeamProspect) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase
      .from('team_prospects')
      .update({ last_contact: new Date().toISOString() })
      .eq('id', candidate.id)
    setBusy(false)
    if (error) {
      showToast(`Failed to update: ${error.message}`, 'error')
      return
    }
    await load()
  }

  async function addRole() {
    const name = newRoleName.trim()
    if (!name || busy) return
    setBusy(true)
    const masterId = await resolveMasterId()
    if (!masterId) {
      showToast('Unable to determine owner.', 'error')
      setBusy(false)
      return
    }
    const maxPosition = roles.reduce((m, r) => Math.max(m, r.position), 0)
    const { error } = await supabase.from('team_prospect_roles').insert({
      master_user_id: masterId,
      created_by: authUserId,
      name,
      position: maxPosition + 1,
    })
    setBusy(false)
    if (error) {
      showToast(`Failed to add role: ${error.message}`, 'error')
      return
    }
    setNewRoleName('')
    setAddingRole(false)
    await load()
  }

  async function deleteRole(roleId: string) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.from('team_prospect_roles').delete().eq('id', roleId)
    setBusy(false)
    setConfirmDeleteRoleId(null)
    if (error) {
      // FK RESTRICT backstop — the UI already disables delete while candidates reference the role
      const friendly = (error as { code?: string }).code === '23503'
        ? 'This role still has candidates (including Hired/Passed). Delete each of them first.'
        : error.message
      showToast(`Failed to delete role: ${friendly}`, 'error')
      return
    }
    await load()
  }

  function openEdit(candidate: TeamProspect) {
    setEditTarget(candidate)
    setEditDraft({
      name: candidate.name,
      phone_number: candidate.phone_number ?? '',
      email: candidate.email ?? '',
      trade: candidate.trade ?? '',
      source: candidate.source ?? '',
      notes: candidate.notes ?? '',
      role_id: candidate.role_id ?? '',
      rating_ability: candidate.rating_ability,
      rating_drive: candidate.rating_drive,
      rating_integrity: candidate.rating_integrity,
      links: parseCandidateLinks(candidate.links),
    })
    setModalError(null)
    setConfirmingDelete(false)
  }

  function openAdd(roleId: string | null) {
    setAddDraft({ ...EMPTY_DRAFT, role_id: roleId ?? '' })
    setModalError(null)
    setAddOpen(true)
  }

  const modal = (title: string, body: ReactNode, onClose: () => void, opts?: { wide?: boolean }) => (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={() => !busy && onClose()}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', maxWidth: opts?.wide ? 680 : 420, width: opts?.wide ? '95%' : '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem 0' }}>{title}</h3>
        {modalError && <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{modalError}</p>}
        {body}
      </div>
    </div>
  )

  const bucketSection = (
    label: string,
    list: TeamProspect[],
    open: boolean,
    setOpen: (v: boolean) => void,
    id?: string,
  ) => (
    <section id={id} style={{ marginTop: '1rem' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9375rem', padding: 0 }}
      >
        {open ? '▾' : '▸'} {label} ({list.length})
      </button>
      {open && (
        <ul style={{ listStyle: 'none', margin: '0.5rem 0 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {list.map((c) => (
            <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: 6, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.role_id && roleNameById.has(c.role_id) && (
                <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {roleNameById.get(c.role_id)}
                </span>
              )}
              {c.trade && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.trade}</span>}
              <span style={{ flex: 1 }} />
              <button type="button" disabled={busy} onClick={() => openEdit(c)} style={smallButtonStyle(busy)}>
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus(c, 'active')}
                style={{ ...smallButtonStyle(busy), color: 'var(--text-blue-500)' }}
              >
                Back to active
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const renderCard = (c: TeamProspect, rank: number) => (
    <SortableCandidateCard
      key={c.id}
      candidate={c}
      rank={rank}
      busy={busy}
      onEdit={() => openEdit(c)}
      onMarkContacted={() => markContacted(c)}
      onSetStatus={(s) => setStatus(c, s)}
      onPullUp={() => setStatus(c, 'calling')}
    />
  )

  const boardEmpty = roles.length === 0 && rows.length === 0

  const activeCount = Object.values(activeByRole).reduce((n, list) => n + list.length, 0)
  const stageTabs: Array<{ key: 'screen' | 'interview' | 'hire' | 'review'; label: string; count: number }> = [
    { key: 'screen', label: 'Screen', count: activeCount },
    { key: 'interview', label: 'Interview', count: calling.length },
    { key: 'hire', label: 'Hire', count: hired.length },
    { key: 'review', label: 'Review', count: activeUserCount },
  ]

  return (
    <div>
      {/* Stage sub-tabs: the hiring flow left to right with live counts; the active stage gets the blue box. */}
      <div
        role="tablist"
        aria-label="Hiring stages"
        style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}
      >
        {stageTabs.map((tab, i) => {
          const active = stage === tab.key
          return (
            <span key={tab.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStage(tab.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '0.45rem 0.9rem',
                  border: active ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                  borderRadius: 8,
                  background: active ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                  cursor: 'pointer',
                  minWidth: '5.5rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: active ? 'var(--text-blue-700)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {tab.label}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                  {tab.count}
                </span>
              </button>
              {i < stageTabs.length - 1 ? (
                <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '1.1rem' }}>→</span>
              ) : null}
            </span>
          )
        })}
      </div>
      {stage === 'screen' && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          One column per role you&apos;re hiring for — drag cards to re-rank (#1 is the top candidate), then Advance the ones worth interviewing.
        </p>
        {addingRole ? (
          <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
              placeholder="Role name (e.g. Plumber)"
              autoFocus
              style={{ padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            <button
              type="button"
              disabled={busy || !newRoleName.trim()}
              onClick={addRole}
              style={{ padding: '0.45rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy || !newRoleName.trim() ? 'not-allowed' : 'pointer' }}
            >
              Add
            </button>
            <button type="button" disabled={busy} onClick={() => { setAddingRole(false); setNewRoleName('') }} style={smallButtonStyle(busy)}>
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAddingRole(true)}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            + Add role
          </button>
        )}
      </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : stage !== 'screen' ? null : boardEmpty ? (
        <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No roles yet. Add a column for each role you&apos;re hiring for, then add candidates to it.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={boardCollisionDetection} onDragEnd={handleDragEnd}>
          <div id="team-pipeline-board" style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {roles.map((role) => (
              <RoleColumn
                key={role.id}
                roleKey={role.id}
                title={role.name}
                candidates={activeByRole[role.id] ?? []}
                referencedCount={referencedCountByRole.get(role.id) ?? 0}
                busy={busy}
                confirmingDeleteRole={confirmDeleteRoleId === role.id}
                onRequestDeleteRole={() => setConfirmDeleteRoleId(role.id)}
                onConfirmDeleteRole={() => deleteRole(role.id)}
                onCancelDeleteRole={() => setConfirmDeleteRoleId(null)}
                onAddCandidate={() => openAdd(role.id)}
                renderCard={renderCard}
              />
            ))}
            {unsortedActive.length > 0 && (
              <RoleColumn
                roleKey={UNSORTED_ROLE_KEY}
                title="Unsorted"
                candidates={unsortedActive}
                referencedCount={null}
                busy={busy}
                confirmingDeleteRole={false}
                onRequestDeleteRole={() => {}}
                onConfirmDeleteRole={() => {}}
                onCancelDeleteRole={() => {}}
                onAddCandidate={() => openAdd(null)}
                renderCard={renderCard}
              />
            )}
          </div>
        </DndContext>
      )}

      {stage === 'interview' && !loading && (
        calling.length === 0 ? (
          <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No one in Interview yet — hit <strong>Advance</strong> on a Screen card to move them here.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {[...roles.map((r) => ({ key: r.id as string, title: r.name })), { key: UNSORTED_ROLE_KEY, title: 'Unsorted' }].map(({ key, title }) => {
              const list = calling.filter((c) => (c.role_id ?? UNSORTED_ROLE_KEY) === key)
              if (key === UNSORTED_ROLE_KEY && list.length === 0) return null
              return (
                <div key={key} style={{ minWidth: 280, flex: '1 0 280px', border: '1px solid #d97706', borderRadius: 8, background: 'var(--bg-amber-tint)', padding: '0.5rem' }}>
                  <header style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.15rem 0.25rem 0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({list.length})</span>
                  </header>
                  {list.length === 0 ? (
                    <p style={{ margin: 0, padding: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No one yet.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {list.map((c) => {
                        const candidateReviews = reviewsByProspect.get(c.id) ?? []
                        const mine = candidateReviews.find((r) => r.reviewer_user_id === authUserId)
                        return (
                          <li key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700 }}>{c.name}</span>
                              {c.phone_number ? (
                                <a
                                  href={`tel:${c.phone_number.replace(/[^0-9+]/g, '')}`}
                                  style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#16a34a', textDecoration: 'none', border: '1px solid #16a34a', borderRadius: 999, padding: '0.1rem 0.55rem' }}
                                >
                                  📞 {c.phone_number}
                                </a>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>no phone on file</span>
                              )}
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatLastContact(c.last_contact)}</span>
                            </div>
                            <CandidateLinkChips links={parseCandidateLinks(c.links)} />
                            <CandidateRatingBars candidate={c} />
                            {candidateReviews.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: '0.45rem 0 0 0' }}>
                                {candidateReviews.map((r) => {
                                  const dimensionComments = RATING_DEFS.flatMap((def) => {
                                    const text = r[COMMENT_KEY_BY_RATING[def.key]]
                                    return text != null && text.trim() !== '' ? [{ short: def.short, text }] : []
                                  })
                                  return (
                                    <div key={r.id} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{reviewerNames.get(r.reviewer_user_id) ?? 'Reviewer'}</span>
                                      {': '}
                                      <span style={{ fontVariantNumeric: 'tabular-nums' }} title="Ability · Drive · Integrity">
                                        {[r.rating_ability, r.rating_drive, r.rating_integrity].map((v) => (v == null ? '—' : v)).join(' · ')}
                                      </span>
                                      {r.remarks ? <span> — {r.remarks}</span> : null}
                                      {dimensionComments.map((d) => (
                                        <div key={d.short} style={{ margin: '0.1rem 0 0 1rem' }}>
                                          <span style={{ fontWeight: 600 }}>{d.short}</span> — {d.text}
                                        </div>
                                      ))}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                              <button type="button" disabled={busy} onClick={() => openReview(c)} style={{ ...smallButtonStyle(busy), color: 'var(--text-blue-500)', fontWeight: 600 }}>
                                {mine ? 'Edit my review' : 'My review'}
                              </button>
                              <button type="button" disabled={busy} onClick={() => markContacted(c)} title="Stamp last contact as now" style={smallButtonStyle(busy)}>
                                Talked today
                              </button>
                              <button type="button" disabled={busy} onClick={() => setStatus(c, 'active')} title="Send back to the Screen board" style={smallButtonStyle(busy)}>
                                Back to Screen
                              </button>
                              <button type="button" disabled={busy} onClick={() => setStatus(c, 'hired')} title="Advance to Hire" style={{ ...smallButtonStyle(busy), background: '#16a34a', color: 'white', border: 'none' }}>
                                Advance
                              </button>
                              <button type="button" disabled={busy} onClick={() => setStatus(c, 'passed')} style={{ ...smallButtonStyle(busy), color: 'var(--text-red-600)' }}>
                                Passed
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
      {stage === 'hire' && !loading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Onboarding: each box goes red → yellow (requested) → green (done). Tap a box to move it along; tap 🔗 to open that item&apos;s document.
            </p>
            {isDev && (
              <button
                type="button"
                onClick={() => setOnboardingSettingsOpen(true)}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}
              >
                ⚙ Onboarding settings
              </button>
            )}
          </div>
          {hired.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hires yet — Advance someone from Interview when they're a fit.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {hired.map((c) => {
                const doneCount = onboardingItems.filter((i) => onboardingStatuses.get(`${c.id}:${i.id}`) === 'done').length
                return (
                  <li key={c.id} style={{ padding: '0.55rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      {c.role_id && roleNameById.has(c.role_id) && (
                        <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          {roleNameById.get(c.role_id)}
                        </span>
                      )}
                      {c.trade && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.trade}</span>}
                      {onboardingItems.length > 0 && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: doneCount === onboardingItems.length ? '#16a34a' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {doneCount}/{onboardingItems.length} done
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      <button type="button" disabled={busy} onClick={() => openEdit(c)} style={smallButtonStyle(busy)}>
                        Edit
                      </button>
                      <button type="button" disabled={busy} onClick={() => setStatus(c, 'calling')} style={{ ...smallButtonStyle(busy), color: 'var(--text-blue-500)' }}>
                        Back to Interview
                      </button>
                    </div>
                    {onboardingItems.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {onboardingItems.map((item) => {
                          const st = onboardingStatuses.get(`${c.id}:${item.id}`) ?? 'pending'
                          const meta = ONBOARDING_STATUS_META[st]
                          return (
                            <span key={item.id} style={{ display: 'inline-flex', alignItems: 'stretch' }}>
                              <button
                                type="button"
                                onClick={() => void cycleOnboardingStatus(c.id, item.id)}
                                title={`${item.label} — ${meta.label}. Tap: ${ONBOARDING_STATUS_META[meta.next].label.toLowerCase()}.`}
                                aria-label={`${item.label} for ${c.name}: ${meta.label}. Tap to change.`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  border: `1px solid ${meta.color}`,
                                  borderRadius: item.link_url ? '6px 0 0 6px' : 6,
                                  background: 'var(--surface)',
                                  color: 'var(--text-strong)',
                                  cursor: 'pointer',
                                }}
                              >
                                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: meta.color, flexShrink: 0 }} />
                                {item.label}
                              </button>
                              {item.link_url ? (
                                <a
                                  href={item.link_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`Open the document for: ${item.label}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '0.25rem 0.4rem',
                                    fontSize: '0.75rem',
                                    border: `1px solid ${meta.color}`,
                                    borderLeft: 'none',
                                    borderRadius: '0 6px 6px 0',
                                    background: 'var(--surface)',
                                    textDecoration: 'none',
                                  }}
                                >
                                  🔗
                                </a>
                              ) : null}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {onboardingItems.length === 0 && hired.length > 0 && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No onboarding items defined yet{isDev ? ' — set them up in ⚙ Onboarding settings.' : '.'}
            </p>
          )}
        </>
      )}
      {stage === 'review' && <TeamReviewSection authUserId={authUserId} />}
      {stage === 'screen' && !loading && passed.length > 0 && bucketSection('Passed', passed, passedOpen, setPassedOpen)}

      {stage === 'screen' && !loading && sourceSummary.length > 0 && (
        <section style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => setSourcesOpen(!sourcesOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9375rem', padding: 0 }}
          >
            {sourcesOpen ? '▾' : '▸'} Source success ({sourceSummary.length})
          </button>
          {sourcesOpen && (
            <div style={{ marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Source</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Candidates</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Active</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Hired</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Passed</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }} title="Hired ÷ (Hired + Passed) — undecided candidates don't count against a source">
                      Hire rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sourceSummary.map((s) => (
                    <tr key={s.key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.label}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.total}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{s.active}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: s.hired > 0 ? '#16a34a' : undefined, fontWeight: s.hired > 0 ? 600 : undefined }}>{s.hired}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{s.passed}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {s.hireRate === null ? '—' : `${Math.round(s.hireRate * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {addOpen &&
        modal(
          'Add candidate',
          <>
            <CandidateFields draft={addDraft} setDraft={setAddDraft} roles={roles} knownSources={knownSources} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={saveNewCandidate}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </>,
          () => setAddOpen(false),
        )}

      {editTarget &&
        modal(
          'Edit candidate',
          <>
            <CandidateFields draft={editDraft} setDraft={setEditDraft} roles={roles} knownSources={knownSources} />
            <RatingSliders values={editDraft} onChange={(k, v) => setEditDraft({ ...editDraft, [k]: v })} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <span style={{ flex: 1 }} />
              {confirmingDelete ? (
                <button
                  type="button"
                  onClick={deleteCandidate}
                  disabled={busy}
                  style={{ padding: '0.5rem 1rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  Confirm delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                  style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-red-600)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  Delete
                </button>
              )}
            </div>
          </>,
          () => setEditTarget(null),
          { wide: true },
        )}

      {reviewTarget &&
        modal(
          `My review — ${reviewTarget.name}`,
          <>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Your own read after talking to them — shown alongside everyone else&rsquo;s under Interviews.
            </p>
            <RatingSliders
              values={reviewDraft}
              onChange={(k, v) => setReviewDraft({ ...reviewDraft, [k]: v })}
              comments={{
                rating_ability: reviewDraft.comment_ability,
                rating_drive: reviewDraft.comment_drive,
                rating_integrity: reviewDraft.comment_integrity,
              }}
              onCommentChange={(k, v) => setReviewDraft({ ...reviewDraft, [COMMENT_KEY_BY_RATING[k]]: v })}
            />
            <label style={{ display: 'block', marginTop: '0.85rem' }}>
              <span style={labelSpanStyle}>Remarks</span>
              <textarea
                value={reviewDraft.remarks}
                onChange={(e) => setReviewDraft({ ...reviewDraft, remarks: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={saveReview}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? 'Saving…' : 'Save review'}
              </button>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </>,
          () => setReviewTarget(null),
          { wide: true },
        )}

      {hireTarget &&
        modal(
          `Add ${hireTarget.name} to the People roster?`,
          <>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              They&rsquo;re hired — adding them to the roster makes them available for sub labor sheets and
              payments under People → Users (External). When they get an app login later, use{' '}
              <strong>Link account</strong> there to tie it together.
            </p>
            <label>
              <span style={labelSpanStyle}>Roster kind</span>
              <select value={hireKind} onChange={(e) => setHireKind(e.target.value as 'sub' | 'helper')} style={inputStyle}>
                <option value="sub">Subcontractor</option>
                <option value="helper">Helper</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={addHireToRoster}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? 'Adding…' : 'Add to roster'}
              </button>
              <button
                type="button"
                onClick={() => setHireTarget(null)}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Not now
              </button>
            </div>
          </>,
          () => setHireTarget(null),
        )}

      {onboardingSettingsOpen &&
        modal(
          'Onboarding settings',
          <>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Each item becomes a red/yellow/green box on every hire. The optional link is the document to
              share (or where to find it) — onboarders get a 🔗 next to the box.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
              {onboardingItems.length === 0 && (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No items yet — add the first one below.</p>
              )}
              {onboardingItems.map((item, idx) => {
                const draft = itemDrafts[item.id] ?? { label: item.label, link_url: item.link_url ?? '' }
                const dirty = draft.label !== item.label || draft.link_url !== (item.link_url ?? '')
                return (
                  <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <input
                      type="text"
                      value={draft.label}
                      onChange={(e) => setItemDrafts((prev) => ({ ...prev, [item.id]: { ...draft, label: e.target.value } }))}
                      aria-label={`Item ${idx + 1} question`}
                      style={inputStyle}
                    />
                    <input
                      type="url"
                      value={draft.link_url}
                      placeholder="Link (optional) — document to share or where to find it"
                      onChange={(e) => setItemDrafts((prev) => ({ ...prev, [item.id]: { ...draft, link_url: e.target.value } }))}
                      aria-label={`Item ${idx + 1} link`}
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <button type="button" disabled={busy || idx === 0} onClick={() => void moveOnboardingItem(item, -1)} style={smallButtonStyle(busy)}>
                        ↑
                      </button>
                      <button type="button" disabled={busy || idx === onboardingItems.length - 1} onClick={() => void moveOnboardingItem(item, 1)} style={smallButtonStyle(busy)}>
                        ↓
                      </button>
                      <span style={{ flex: 1 }} />
                      {dirty && (
                        <button type="button" disabled={busy || !draft.label.trim()} onClick={() => void saveOnboardingItem(item)} style={{ ...smallButtonStyle(busy), background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600 }}>
                          Save
                        </button>
                      )}
                      <button type="button" disabled={busy} onClick={() => void deleteOnboardingItem(item)} title="Delete this item (clears its boxes on every hire)" style={{ ...smallButtonStyle(busy), color: 'var(--text-red-600)' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <input
                type="text"
                value={newItemLabel}
                placeholder="New item — e.g. Did we collect a copy of their driver's license?"
                onChange={(e) => setNewItemLabel(e.target.value)}
                aria-label="New onboarding item question"
                style={inputStyle}
              />
              <input
                type="url"
                value={newItemLink}
                placeholder="Link (optional)"
                onChange={(e) => setNewItemLink(e.target.value)}
                aria-label="New onboarding item link"
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={busy || !newItemLabel.trim()}
                  onClick={() => void addOnboardingItem()}
                  style={{ padding: '0.45rem 0.9rem', background: busy || !newItemLabel.trim() ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: busy || !newItemLabel.trim() ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                >
                  Add item
                </button>
                <button
                  type="button"
                  onClick={() => setOnboardingSettingsOpen(false)}
                  disabled={busy}
                  style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </>,
          () => setOnboardingSettingsOpen(false),
          { wide: true },
        )}
    </div>
  )
}
