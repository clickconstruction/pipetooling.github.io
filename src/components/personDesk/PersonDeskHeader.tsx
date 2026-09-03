import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useUserReviewModal } from '../../contexts/UserReviewModalContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { cascadePersonNameInPayTables } from '../../lib/cascadePersonName'
import { loginAsUser } from '../../lib/loginAsUser'
import { describeLastSeen, describePersonGap, type PersonGap, type PersonKey } from '../../lib/people/personKey'
import { canImitate, type PersonDeskViewer } from '../../lib/people/personDeskGates'
import { buildApprovalsQueue } from '../../lib/people/approvalsQueue'
import { fetchAllPendingClockSessions } from '../../lib/people/fetchAllPendingClockSessions'
import { formatHoursShort } from '../../lib/myTeamApprovals'
import { shortJobOrBidLabelFromEmbeds } from '../../types/clockSessions'
import { denverCalendarDayKey, formatDenverTimeOnly } from '../../utils/dateUtils'
import { BTN, BTN_AMBER, BTN_QUIET, Chip, deskBtn, initials } from './personDeskShared'
import type { PersonDeskUserRow } from '../../hooks/usePersonDesk'
import type { PersonKeyPersonRow } from '../../lib/people/personKey'

type OpenSession = { id: string; clocked_in_at: string; label: string | null }

const ROLE_LABEL: Record<string, string> = {
  dev: 'Dev',
  master_technician: 'Master',
  assistant: 'Assistant',
  controller: 'Controller',
  subcontractor: 'Subcontractor',
  helpers: 'Helper',
  estimator: 'Estimator',
  primary: 'Primary',
  superintendent: 'Superintendent',
}
const KIND_LABEL: Record<string, string> = { sub: 'Subcontractor', helper: 'Helper', assistant: 'Assistant', master_technician: 'Master', estimator: 'Estimator', primary: 'Primary', superintendent: 'Superintendent', dev: 'Dev', controller: 'Controller' }

const KINDS: Array<{ value: string; label: string }> = [
  { value: 'helper', label: 'Helper' },
  { value: 'sub', label: 'Subcontractor' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'estimator', label: 'Estimator' },
  { value: 'master_technician', label: 'Master' },
  { value: 'superintendent', label: 'Superintendent' },
  { value: 'primary', label: 'Primary' },
]
const ROLE_TO_KIND: Record<string, string> = { helpers: 'helper', subcontractor: 'sub', assistant: 'assistant', controller: 'assistant', estimator: 'estimator', master_technician: 'master_technician', superintendent: 'superintendent', primary: 'primary', dev: 'dev' }

export function PersonDeskHeader({
  personKey,
  user,
  person,
  viewer,
  serviceTypeNames,
  changeKey,
  onChanged,
  onClose,
  placeholderName,
}: {
  personKey: PersonKey | null
  user: PersonDeskUserRow | null
  person: PersonKeyPersonRow | null
  viewer: PersonDeskViewer
  serviceTypeNames: Map<string, string>
  changeKey: number
  onChanged: () => void
  onClose: () => void
  placeholderName: string | null
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const userReview = useUserReviewModal()
  const prefixMap = useLedgerPrefixMap()
  const [openSession, setOpenSession] = useState<OpenSession | null>(null)
  const [pending, setPending] = useState<{ count: number; hours: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [kindPick, setKindPick] = useState<string>('')

  const userId = personKey?.userId ?? null

  useEffect(() => {
    if (!userId) {
      setOpenSession(null)
      setPending(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [{ data: open }, rows] = await Promise.all([
          supabase
            .from('clock_sessions')
            .select('id, clocked_in_at, jobs_ledger!clock_sessions_job_ledger_id_fkey(hcp_number, click_number, job_name, job_address, service_type_id), bids!clock_sessions_bid_id_fkey(bid_number, project_name, address, service_type_id, customers(name))')
            .eq('user_id', userId)
            .is('clocked_out_at', null)
            .is('revoked_at', null)
            .order('clocked_in_at', { ascending: false })
            .limit(1),
          viewer.canAccessHours || viewer.canAccessPay ? fetchAllPendingClockSessions({ userId }) : Promise.resolve([]),
        ])
        if (cancelled) return
        const row = (open ?? [])[0] as (Record<string, unknown> & { id: string; clocked_in_at: string }) | undefined
        setOpenSession(
          row
            ? {
                id: row.id,
                clocked_in_at: row.clocked_in_at,
                label: shortJobOrBidLabelFromEmbeds(row as never, prefixMap),
              }
            : null,
        )
        const q = buildApprovalsQueue(rows, { todayYmd: denverCalendarDayKey(Date.now()) })
        setPending({ count: q.count, hours: q.hours })
      } catch {
        if (!cancelled) {
          setOpenSession(null)
          setPending(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, changeKey, viewer.canAccessHours, viewer.canAccessPay, prefixMap])

  const name = personKey?.displayName ?? placeholderName ?? 'Loading…'
  const roleLabel = personKey?.role ? ROLE_LABEL[personKey.role] ?? personKey.role : personKey?.personKind ? KIND_LABEL[personKey.personKind] ?? personKey.personKind : null
  const serviceTypeIds = user
    ? user.role === 'estimator'
      ? user.estimator_service_type_ids
      : user.role === 'primary'
        ? user.primary_service_type_ids
        : user.role === 'superintendent'
          ? user.superintendent_service_type_ids
          : user.role === 'subcontractor'
            ? user.subcontractor_service_type_ids
            : user.role === 'helpers'
              ? user.helpers_service_type_ids
              : null
    : null
  const trades = (serviceTypeIds ?? []).map((id) => serviceTypeNames.get(id) ?? '').filter(Boolean)

  async function runGap(gap: PersonGap) {
    if (!personKey || viewer.readOnly) return
    setBusy(gap)
    try {
      if (gap === 'unlinked_email_match' && personKey.emailMatchedPersonId && personKey.userId) {
        const ok = await confirmDialog({
          message: `Link roster row "${personKey.emailMatchedPersonName}" to ${name}'s account? Their hours, portal and paperwork become one identity.`,
          confirmLabel: 'Link account',
        })
        if (!ok) return
        const { error } = await supabase.from('people').update({ account_user_id: personKey.userId }).eq('id', personKey.emailMatchedPersonId)
        if (error) throw error
        showToast('Account linked', 'success')
        onChanged()
      } else if (gap === 'pay_name_mismatch' && person && personKey.payName) {
        const ok = await confirmDialog({
          message: `Rename roster row "${person.name}" to "${personKey.payName}" and cascade every pay table? This is the one rename path the app has.`,
          confirmLabel: 'Reconcile',
        })
        if (!ok) return
        const { error } = await supabase.from('people').update({ name: personKey.payName }).eq('id', person.id)
        if (error) throw error
        await cascadePersonNameInPayTables(person.name, personKey.payName)
        showToast(`Roster row renamed to "${personKey.payName}"`, 'success')
        onChanged()
      } else if (gap === 'no_roster_row' && personKey.userId && authUser?.id) {
        const kind = kindPick || ROLE_TO_KIND[personKey.role ?? ''] || ''
        if (!kind || kind === 'dev') {
          showToast('Pick a kind first', 'warning')
          return
        }
        const ok = await confirmDialog({
          message: `Create a roster row for ${name} as ${KINDS.find((k) => k.value === kind)?.label ?? kind}? Nothing else changes.`,
          confirmLabel: 'Create roster row',
        })
        if (!ok) return
        const { error } = await supabase.from('people').insert({
          master_user_id: authUser.id,
          kind,
          name: personKey.displayName,
          email: personKey.email,
          account_user_id: personKey.userId,
        })
        if (error) throw error
        showToast('Roster row created', 'success')
        onChanged()
      } else if (gap === 'no_pay_config') {
        showToast('Pay setup lives on People → Payroll → pay config until the Pay section ships (PR 2).', 'info')
      } else if (gap === 'no_login') {
        showToast('Invite from the Users row: find them under their kind and tap "Invite as user".', 'info')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That did not save', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function imitate() {
    if (!user?.email) return
    const ok = await confirmDialog({ message: `Sign in as ${name}? Your own session ends until you sign back in.`, confirmLabel: 'Imitate' })
    if (!ok) return
    try {
      await loginAsUser({ email: user.email })
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not imitate', 'error')
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: '0.6rem 0.85rem', padding: '0.85rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div
        aria-hidden
        style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', fontWeight: 800, display: 'grid', placeItems: 'center', fontSize: '0.9375rem', border: '1px solid #93c5fd' }}
      >
        {initials(name)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-strong)' }}>{name}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {[roleLabel, ...trades].filter(Boolean).join(' · ')}
            {personKey?.archived ? ' · archived' : ''}
          </span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: 'var(--text-muted)', padding: '0 0.15rem' }}>
            ×
          </button>
        </div>
        {personKey ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', fontSize: '0.75rem', color: 'var(--text-700)', marginTop: '0.2rem' }}>
            <IdDot ok={Boolean(personKey.userId)}>
              {personKey.userId ? (
                <>
                  Login{user?.email ? ` · ${user.email}` : ''} · {describeLastSeen(user?.last_sign_in_at, Date.now())}
                </>
              ) : (
                'No login'
              )}
            </IdDot>
            <IdDot ok={Boolean(personKey.personId)}>{personKey.personId ? 'Roster row' : 'No roster row'}</IdDot>
            <IdDot ok={Boolean(personKey.payName) && !personKey.gaps.includes('pay_name_mismatch') && !personKey.gaps.includes('no_pay_config')}>
              {personKey.payName ? `Pay name "${personKey.payName}"` : 'No pay name'}
            </IdDot>
          </div>
        ) : null}
        {personKey && personKey.gaps.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.45rem' }}>
            {personKey.gaps.map((gap) => {
              const d = describePersonGap(gap, personKey)
              const actionable = !viewer.readOnly && (gap === 'unlinked_email_match' || gap === 'pay_name_mismatch' || gap === 'no_roster_row')
              return (
                <div key={gap} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--bg-amber-tint)', border: '1px solid #f59e0b', borderRadius: 4, padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>{d.label}</span>
                  <span style={{ color: 'var(--text-muted)', flex: '1 1 12rem', minWidth: 0 }}>{d.detail}</span>
                  {gap === 'no_roster_row' && actionable ? (
                    <select value={kindPick || ROLE_TO_KIND[personKey.role ?? ''] || ''} onChange={(e) => setKindPick(e.target.value)} style={{ fontSize: '0.75rem', padding: '0.1rem 0.3rem' }} aria-label="Roster kind">
                      <option value="">Kind…</option>
                      {KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button type="button" style={deskBtn(actionable ? BTN_AMBER : BTN_QUIET, busy != null)} disabled={busy != null} onClick={() => void runGap(gap)}>
                    {busy === gap ? 'Working…' : d.action}
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' }}>
          {openSession ? (
            <Chip tone="green" title={`Since ${formatDenverTimeOnly(new Date(openSession.clocked_in_at).getTime())}`}>
              On the clock{openSession.label ? ` · ${openSession.label.replace(/\n/g, ' ')}` : ''}
            </Chip>
          ) : null}
          {pending && pending.count > 0 ? (
            <Chip tone="amber">
              {pending.count} session{pending.count === 1 ? '' : 's'} waiting · {formatHoursShort(pending.hours)}
            </Chip>
          ) : null}
          {personKey?.archived ? <Chip tone="gray">Archived</Chip> : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.55rem' }}>
          {personKey?.userId ? (
            <button type="button" style={BTN} onClick={() => userReview?.open({ userId: personKey.userId!, displayName: name })}>
              Day · week · month
            </button>
          ) : null}
          {user?.email ? (
            <a href={`mailto:${user.email}`} style={{ ...BTN, textDecoration: 'none' }}>
              Email
            </a>
          ) : null}
          {canImitate(viewer) && user?.email ? (
            <button type="button" style={BTN_QUIET} onClick={() => void imitate()} title="Sign in as this person (dev only)">
              Imitate
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function IdDot({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#22c55e' : 'transparent', border: ok ? 'none' : '2px solid #f59e0b', display: 'inline-block' }} />
      {children}
    </span>
  )
}
