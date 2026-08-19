import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { UnifiedSearchResultRow } from '../search/UnifiedSearchResultRow'
import { useJobBidSearchEvidence } from '../../hooks/useJobBidSearchEvidence'
import {
  paidEmailVariantForRole,
  parsePaidJobEmailRecipients,
  serializePaidJobEmailRecipients,
} from '../../lib/paidJobEmail'
import {
  APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS,
  APP_SETTINGS_KEY_PAYMENT_MADE_EMAIL_RECIPIENTS,
  APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS,
  APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_CHANNELS,
} from '../../lib/appSettingsKeys'
import {
  DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS,
  parseReadyToBillNotifyChannels,
  serializeReadyToBillNotifyChannels,
  type ReadyToBillNotifyChannels,
} from '../../lib/readyToBillNotify'
import {
  fetchPaidJobEmailPreview,
  openHtmlInNewTab,
  sendPaidJobEmailTest,
  sendReadyToBillPushTest,
} from '../../lib/paidJobEmailClient'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

/**
 * ⚙ across from the "Paid in Full" section header (Jobs → Stages): configure
 * who gets the "Customer paid" email when a job hits Paid in Full, and preview
 * or test the email itself. Self-contained (loads and saves its own rows).
 *
 * - Gear opens for devs + masters; the recipients editor saves for DEV only
 *   (app_settings RLS is dev-write) — masters see it read-only with a note.
 * - Devs/masters get the DETAILED financial review; everyone else the
 *   sterilized summary (badges via paidEmailVariantForRole).
 * - "Preview & test" (dev AND master): pick a job (search_jobs_ledger, same
 *   idiom as Dispatch Mode PO), then Preview detailed / Preview summary
 *   (opens the rendered HTML in a new tab) or Email me a test (detailed
 *   variant, caller's own address only).
 */

type RecipientUser = {
  id: string
  name: string
  role: string | null
  email: string | null
}

type JobPick = {
  id: string
  label: string
  address: string
  row: {
    id: string
    hcp_number: string | null
    click_number: string | null
    job_name: string | null
    job_address: string | null
    service_type_id?: string | null
    service_type_name?: string | null
  }
}

/** Office-capable roles offered as recipients (mirrors the AR-button office set on this board). */
function isOfficeCapableRole(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
}

/**
 * Which notification stream this modal configures (v2.1310; third stream
 * v2.1836). All streams ride the same edge function and variant split; only
 * the trigger and the recipient list differ. The ready_to_bill stream
 * additionally offers DELIVERY CHANNELS (email and/or web push) — the other
 * two are email-only.
 */
export type PaidEmailSettingsVariant = 'paid_in_full' | 'payment' | 'ready_to_bill'

const VARIANT_COPY: Record<
  PaidEmailSettingsVariant,
  { settingKey: string; ariaLabel: string; heading: string; description: string }
> = {
  paid_in_full: {
    settingKey: APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS,
    ariaLabel: 'Paid in Full email settings',
    heading: 'Paid in Full emails',
    description:
      'When a job reaches Paid in Full, the people below get an email. Devs and masters receive the detailed financial review; everyone else receives a summary with no dollar amounts.',
  },
  payment: {
    settingKey: APP_SETTINGS_KEY_PAYMENT_MADE_EMAIL_RECIPIENTS,
    ariaLabel: 'Payment email settings',
    heading: 'Payment emails',
    description:
      'Whenever any payment is recorded on a job — Mark Paid, a bank-deposit allocation, or a Stripe payment — the people below get an email showing the job’s invoices and payment progress. Devs and masters receive the detailed financial review; everyone else receives a summary with no dollar amounts. When the payment completes the job, only the Paid in Full email is sent.',
  },
  ready_to_bill: {
    settingKey: APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS,
    ariaLabel: 'Ready to Bill notification settings',
    heading: 'Ready to Bill notifications',
    description:
      'When a job moves to Ready to Bill, the people below are notified so billing can start right away — jobs sent back from Billed count too. Devs and masters receive the detailed version with dollar amounts; everyone else receives a summary.',
  },
}

export default function PaidInFullEmailSettingsModal({
  onClose,
  variant = 'paid_in_full',
}: {
  onClose: () => void
  variant?: PaidEmailSettingsVariant
}) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const copy = VARIANT_COPY[variant]
  const canEditRecipients = authRole === 'dev'

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<RecipientUser[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)
  // ready_to_bill only: delivery channels + who has push enabled on a device.
  const isReadyToBill = variant === 'ready_to_bill'
  const [channels, setChannels] = useState<ReadyToBillNotifyChannels>({
    ...DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS,
  })
  const [pushEnabledIds, setPushEnabledIds] = useState<Set<string>>(() => new Set())

  const [jobSearch, setJobSearch] = useState('')
  const [jobSearching, setJobSearching] = useState(false)
  const [jobResults, setJobResults] = useState<JobPick[]>([])
  const [pickedJob, setPickedJob] = useState<JobPick | null>(null)
  const prefixMap = useLedgerPrefixMap()
  const jobResultsUnified = useMemo(
    () =>
      jobResults.map((j) => ({
        source: 'job' as const,
        ...j.row,
        hcp_number: j.row.hcp_number ?? '',
        job_name: j.row.job_name ?? '',
        job_address: j.row.job_address ?? '',
      })),
    [jobResults],
  )
  const { jobEvidence, evidenceMode } = useJobBidSearchEvidence(jobResultsUnified)
  const [previewBusy, setPreviewBusy] = useState<'detailed' | 'summary' | 'test' | 'push' | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [usersRes, settingRes] = await Promise.all([
          withSupabaseRetry(
            () =>
              supabase
                .from('users')
                .select('id, name, role, email, archived_at')
                .is('archived_at', null)
                .order('name'),
            'paid email recipients users',
          ),
          withSupabaseRetry<{ value_text: string | null } | null>(
            () =>
              supabase
                .from('app_settings')
                .select('value_text')
                .eq('key', copy.settingKey)
                .maybeSingle(),
            'paid email recipients setting',
          ),
        ])
        if (cancelled) return
        const rows = ((usersRes ?? []) as Array<RecipientUser & { archived_at: string | null }>).filter((u) =>
          isOfficeCapableRole(u.role),
        )
        setUsers(rows.map((u) => ({ id: u.id, name: (u.name ?? '').trim() || 'Unknown', role: u.role, email: u.email })))
        setSelectedIds(new Set(parsePaidJobEmailRecipients(settingRes?.value_text ?? null)))
        if (variant === 'ready_to_bill') {
          // Channels + push coverage (dev/master can SELECT push_subscriptions).
          const [channelsRes, pushRes] = await Promise.all([
            withSupabaseRetry<{ value_text: string | null } | null>(
              () =>
                supabase
                  .from('app_settings')
                  .select('value_text')
                  .eq('key', APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_CHANNELS)
                  .maybeSingle(),
              'ready to bill channels setting',
            ),
            withSupabaseRetry(
              () => supabase.from('push_subscriptions').select('user_id'),
              'ready to bill push coverage',
            ),
          ])
          if (cancelled) return
          setChannels(parseReadyToBillNotifyChannels(channelsRes?.value_text ?? null))
          setPushEnabledIds(
            new Set(((pushRes ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
          )
        }
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Could not load recipients'), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast, copy.settingKey, variant])

  // Job search (debounced) via the same RPC the Dispatch Mode PO picker uses.
  useEffect(() => {
    const q = jobSearch.trim()
    if (!q) {
      setJobResults([])
      setJobSearching(false)
      return
    }
    setJobSearching(true)
    const t = setTimeout(() => {
      void withSupabaseRetry(() => supabase.rpc('search_jobs_ledger', { search_text: q }), 'paid email job search')
        .then((rows) => {
          const jobs = (rows ?? []) as Array<{
            id: string
            hcp_number: string | null
            click_number: string | null
            job_name: string | null
            job_address: string | null
            service_type_id?: string | null
            service_type_name?: string | null
          }>
          setJobResults(
            jobs.slice(0, 8).map((j) => ({
              id: j.id,
              label: `${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · ${(j.job_name ?? '').trim() || '—'}`,
              address: (j.job_address ?? '').trim(),
              row: j,
            })),
          )
        })
        .catch(() => setJobResults([]))
        .finally(() => setJobSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [jobSearch])

  const toggleRecipient = (id: string) => {
    if (!canEditRecipients) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveRecipients = async () => {
    if (!canEditRecipients || saving) return
    setSaving(true)
    try {
      const ids = users.filter((u) => selectedIds.has(u.id)).map((u) => u.id)
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: copy.settingKey, value_text: serializePaidJobEmailRecipients(ids) },
          { onConflict: 'key' },
        )
      if (error) throw error
      if (isReadyToBill) {
        const { error: chErr } = await supabase
          .from('app_settings')
          .upsert(
            {
              key: APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_CHANNELS,
              value_text: serializeReadyToBillNotifyChannels(channels),
            },
            { onConflict: 'key' },
          )
        if (chErr) throw chErr
      }
      showToast(
        isReadyToBill
          ? 'Ready to Bill notification settings saved.'
          : variant === 'payment'
            ? 'Payment-email recipients saved.'
            : 'Paid-email recipients saved.',
        'success',
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save recipients'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async (previewVariant: 'detailed' | 'summary') => {
    if (!pickedJob || previewBusy) return
    setPreviewBusy(previewVariant)
    try {
      openHtmlInNewTab(
        await fetchPaidJobEmailPreview(pickedJob.id, previewVariant, isReadyToBill ? 'ready_to_bill' : undefined),
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Preview failed'), 'error')
    } finally {
      setPreviewBusy(null)
    }
  }

  const runTestSend = async () => {
    if (!pickedJob || previewBusy) return
    setPreviewBusy('test')
    try {
      await sendPaidJobEmailTest(pickedJob.id, isReadyToBill ? 'ready_to_bill' : undefined)
      showToast('Test email sent to your address.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Test send failed'), 'error')
    } finally {
      setPreviewBusy(null)
    }
  }

  const runTestPush = async () => {
    if (!pickedJob || previewBusy) return
    setPreviewBusy('push')
    try {
      const sent = await sendReadyToBillPushTest(pickedJob.id)
      showToast(
        sent > 0
          ? `Test push sent to ${sent} device${sent === 1 ? '' : 's'}.`
          : 'No push devices found — enable push notifications in Settings → Your account first.',
        sent > 0 ? 'success' : 'error',
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Test push failed'), 'error')
    } finally {
      setPreviewBusy(null)
    }
  }

  const badge = (role: string | null) => {
    const detailed = paidEmailVariantForRole(role) === 'detailed'
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '1px 8px',
          borderRadius: 9999,
          background: detailed ? 'var(--bg-amber-100)' : 'var(--bg-muted)',
          color: detailed ? 'var(--text-amber-800)' : 'var(--text-muted)',
          border: detailed ? '1px solid var(--border-amber)' : '1px solid var(--border)',
          whiteSpace: 'nowrap',
        }}
      >
        {detailed ? 'Detailed' : 'Summary'}
      </span>
    )
  }

  const actionBtnStyle = (disabled: boolean): CSSProperties => ({
    height: 32,
    padding: '0 0.75rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    background: disabled ? 'var(--bg-muted)' : 'var(--surface)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'var(--text-700)',
    fontSize: '0.8125rem',
    fontWeight: 500,
  })

  const selectedCount = useMemo(() => users.filter((u) => selectedIds.has(u.id)).length, [users, selectedIds])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.ariaLabel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          width: 'min(560px, calc(100vw - 2rem))',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{copy.heading}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {copy.description}
        </p>

        {isReadyToBill && (
          <>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Delivery channels</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {(
                [
                  { key: 'email' as const, name: '📧 Email', sub: 'Sent within ~15 minutes, batched' },
                  { key: 'push' as const, name: '🔔 Push notification', sub: 'To recipients with push enabled on a device' },
                ]
              ).map((ch) => (
                <label
                  key={ch.key}
                  style={{
                    flex: '1 1 200px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    cursor: canEditRecipients ? 'pointer' : 'default',
                    border: `1px solid ${channels[ch.key] ? 'var(--text-blue-700)' : 'var(--border-strong)'}`,
                    borderRadius: 6,
                    padding: '0.6rem 0.75rem',
                    background: channels[ch.key] ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    opacity: canEditRecipients ? 1 : 0.8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={channels[ch.key]}
                    disabled={!canEditRecipients}
                    onChange={() => setChannels((prev) => ({ ...prev, [ch.key]: !prev[ch.key] }))}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600 }}>{ch.name}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                      {ch.sub}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {!channels.email && !channels.push && (
              <p style={{ margin: '-0.5rem 0 1rem', fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
                Both channels are off — nobody will be notified.
              </p>
            )}
          </>
        )}

        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Recipients ({selectedCount})</h3>
        {!canEditRecipients && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Read-only — only devs can change the recipient list.
          </p>
        )}
        {loading ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} role="status">
            Loading…
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: '0.75rem', maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem' }}>
            {users.map((u) => (
              <label
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  padding: '3px 4px',
                  cursor: canEditRecipients ? 'pointer' : 'default',
                  opacity: canEditRecipients ? 1 : 0.8,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  disabled={!canEditRecipients}
                  onChange={() => toggleRecipient(u.id)}
                />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name}
                  {u.email ? <span style={{ color: 'var(--text-muted)' }}> · {u.email}</span> : null}
                </span>
                {isReadyToBill && channels.push && !pushEnabledIds.has(u.id) && (
                  <span
                    title="Hasn't enabled push notifications on any device — will receive email only"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '1px 8px',
                      borderRadius: 9999,
                      background: 'var(--bg-muted)',
                      color: 'var(--text-muted)',
                      border: '1px dashed var(--border-strong)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    no push device
                  </span>
                )}
                {badge(u.role)}
              </label>
            ))}
            {users.length === 0 && (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No eligible users found.</p>
            )}
          </div>
        )}
        {canEditRecipients && (
          <button
            type="button"
            onClick={() => void saveRecipients()}
            disabled={saving || loading}
            style={{
              height: 34,
              padding: '0 1rem',
              border: 'none',
              borderRadius: 4,
              background: saving || loading ? 'var(--bg-muted)' : '#2563eb',
              color: saving || loading ? 'var(--text-muted)' : '#fff',
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving…' : 'Save recipients'}
          </button>
        )}

        <hr style={{ margin: '1.25rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

        <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem' }}>Preview &amp; test</h3>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Pick a job to see the email as recipients would, or send yourself a test.
        </p>
        <input
          type="search"
          value={jobSearch}
          onChange={(e) => {
            setJobSearch(e.target.value)
            setPickedJob(null)
          }}
          placeholder="Search jobs (number, name, address…)"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            height: 36,
            padding: '0 0.75rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            color: 'inherit',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
          }}
        />
        {jobSearching && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} role="status">
            Searching…
          </p>
        )}
        {!pickedJob && jobResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: '0.5rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem', maxHeight: 180, overflow: 'auto' }}>
            {jobResultsUnified.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setPickedJob(jobResults[i] ?? null)}
                style={{
                  textAlign: 'left',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 4,
                  fontSize: '0.875rem',
                  color: 'inherit',
                }}
              >
                <UnifiedSearchResultRow
                  result={u}
                  prefixMap={prefixMap}
                  jobEvidence={jobEvidence.get(u.id)}
                  evidenceMode={evidenceMode}
                />
              </button>
            ))}
          </div>
        )}
        {pickedJob && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>
            Selected: <strong>{pickedJob.label}</strong>
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void runPreview('detailed')}
            disabled={!pickedJob || previewBusy !== null}
            style={actionBtnStyle(!pickedJob || previewBusy !== null)}
          >
            {previewBusy === 'detailed' ? 'Building…' : 'Preview detailed'}
          </button>
          <button
            type="button"
            onClick={() => void runPreview('summary')}
            disabled={!pickedJob || previewBusy !== null}
            style={actionBtnStyle(!pickedJob || previewBusy !== null)}
          >
            {previewBusy === 'summary' ? 'Building…' : 'Preview summary'}
          </button>
          <button
            type="button"
            onClick={() => void runTestSend()}
            disabled={!pickedJob || previewBusy !== null}
            style={actionBtnStyle(!pickedJob || previewBusy !== null)}
          >
            {previewBusy === 'test' ? 'Sending…' : 'Email me a test'}
          </button>
          {isReadyToBill && (
            <button
              type="button"
              onClick={() => void runTestPush()}
              disabled={!pickedJob || previewBusy !== null}
              style={actionBtnStyle(!pickedJob || previewBusy !== null)}
            >
              {previewBusy === 'push' ? 'Sending…' : 'Push me a test'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
