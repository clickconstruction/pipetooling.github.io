import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useDispatchNoteRequirements } from '../../contexts/DispatchNoteRequirementsContext'
import {
  upsertDispatchNoteRequirementsConfigToAppSettings,
  type DispatchNoteRequirementsConfigV1,
} from '../../lib/dispatchNoteRequirements'
import {
  fetchJobLabelsByIds,
  searchJobsLedgerForDispatchSettings,
} from '../../lib/dispatchSettingsJobsSearch'
import { filterRosterByQuery } from '../../lib/dispatchSettingsPeopleSearch'
import { ChipsWithSearchPicker, type ChipsWithSearchPickerOption } from './ChipsWithSearchPicker'
import { DispatchSwimLanesSettingsSection } from './DispatchSwimLanesSettingsSection'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useAuth } from '../../hooks/useAuth'
import {
  loadTravelHintsConfig,
  TRAVEL_HINTS_CONFIG_CHANGED_EVENT,
  TRAVEL_HINTS_DEFAULTS,
  upsertTravelHintsConfig,
  type TravelHintsConfig,
} from '../../lib/travelHintsConfig'

export type DispatchSettingsModalRosterRow = {
  userId: string
  displayName: string
}

const UNKNOWN_USER_LABEL = 'Unknown user'
const JOB_LABEL_LOADING = 'Loading…'

export function DispatchSettingsModal({
  open,
  onClose,
  roster,
  onSwimLanesChanged,
}: {
  open: boolean
  onClose: () => void
  roster: DispatchSettingsModalRosterRow[]
  /** Fired after any swim-lane mutation so the grid refreshes its lane grouping. */
  onSwimLanesChanged?: () => void
}) {
  const { showToast } = useToastContext()
  const { config, reload } = useDispatchNoteRequirements()
  const { role } = useAuth()
  /** app_settings writes are dev-only per RLS, so the Travel section renders for devs only. */
  const isDev = role === 'dev'
  const [travel, setTravel] = useState<TravelHintsConfig>(TRAVEL_HINTS_DEFAULTS)

  const [requireIds, setRequireIds] = useState<string[]>([])
  const [skipIds, setSkipIds] = useState<string[]>([])
  const [skipJobIds, setSkipJobIds] = useState<string[]>([])
  const [jobLabels, setJobLabels] = useState<Map<string, string>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setRequireIds([...config.require_note_user_ids])
    setSkipIds([...config.skip_note_user_ids])
    setSkipJobIds([...config.skip_note_job_ids])
    setError(null)
    setBusy(false)
  }, [open, config])

  useEffect(() => {
    if (!open || !isDev) return
    let cancelled = false
    void loadTravelHintsConfig().then((c) => {
      if (!cancelled) setTravel(c)
    })
    return () => {
      cancelled = true
    }
  }, [open, isDev])

  // Resolve labels for any job ids already saved in config so the chips render the same labels
  // we'd see if the user searched for those jobs. Uses `get_jobs_ledger_by_ids` (broad-access
  // RPC) so the lookup works even when the job has been billed/closed since it was added.
  useEffect(() => {
    if (!open) return
    const ids = config.skip_note_job_ids
    if (ids.length === 0) {
      setJobLabels(new Map())
      return
    }
    let cancelled = false
    void fetchJobLabelsByIds(ids).then((m) => {
      if (cancelled) return
      // Merge so any newly-picked labels added during this open session are preserved.
      setJobLabels((prev) => {
        const next = new Map(prev)
        m.forEach((label, id) => next.set(id, label))
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [open, config.skip_note_job_ids])

  const rosterByUserId = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of roster) m.set(r.userId, r.displayName)
    return m
  }, [roster])

  const getLabelForUserId = useCallback(
    (id: string) => rosterByUserId.get(id) ?? UNKNOWN_USER_LABEL,
    [rosterByUserId],
  )
  const getLabelForJobId = useCallback(
    (id: string) => jobLabels.get(id) ?? JOB_LABEL_LOADING,
    [jobLabels],
  )

  // Client-side filter over the in-memory roster — small dataset already loaded by the Hub.
  const searchRoster = useCallback(
    (query: string) => Promise.resolve(filterRosterByQuery(roster, query, 20)),
    [roster],
  )

  // `searchJobsLedgerForDispatchSettings` is referenced by identity so the picker's debounce
  // effect doesn't tear down every render. Stable module export, but we wrap it anyway for
  // clarity and to keep the type narrow.
  const searchJobsRef = useRef(searchJobsLedgerForDispatchSettings)
  const searchJobs = useCallback(
    (query: string, signal: AbortSignal) => searchJobsRef.current(query, signal),
    [],
  )

  const onChangeRequire = useCallback((next: string[]) => {
    setRequireIds(next)
    setSkipIds((prev) => prev.filter((id) => !next.includes(id)))
  }, [])

  const onChangeSkip = useCallback((next: string[]) => {
    setSkipIds(next)
    setRequireIds((prev) => prev.filter((id) => !next.includes(id)))
  }, [])

  const onChangeSkipJobs = useCallback((next: string[]) => {
    setSkipJobIds(next)
  }, [])

  // When a job is picked from the live RPC, cache its label so the new chip renders the same
  // text without a refetch round-trip.
  const onJobPicked = useCallback((opt: ChipsWithSearchPickerOption) => {
    setJobLabels((prev) => {
      if (prev.get(opt.value) === opt.label) return prev
      const next = new Map(prev)
      next.set(opt.value, opt.label)
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const next: DispatchNoteRequirementsConfigV1 = {
        v: 1,
        require_note_user_ids: requireIds,
        skip_note_user_ids: skipIds.filter((id) => !requireIds.includes(id)),
        skip_note_job_ids: skipJobIds,
      }
      await upsertDispatchNoteRequirementsConfigToAppSettings(next)
      if (isDev) {
        const { error: travelErr } = await upsertTravelHintsConfig(travel)
        if (travelErr) throw new Error(travelErr)
        window.dispatchEvent(new Event(TRAVEL_HINTS_CONFIG_CHANGED_EVENT))
      }
      await reload()
      showToast('Dispatch settings saved.', 'success')
      onClose()
    } catch (err) {
      setError(formatErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [requireIds, skipIds, skipJobIds, reload, showToast, onClose, isDev, travel])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation()
        onClose()
      }
    },
    [busy, onClose],
  )

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1005,
      }}
      onClick={() => {
        if (!busy) onClose()
      }}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-settings-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 560,
          width: '92%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dispatch-settings-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
          Dispatch settings
        </h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
          Configure note requirements for schedule blocks. A person can appear in at most one of the
          two people lists; jobs are an independent list.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="dispatch-settings-require-search"
            style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}
          >
            Require a note
          </label>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            When the assignee is in this list, the edit-note icon turns{' '}
            <span style={{ color: 'var(--text-red-600)', fontWeight: 600 }}>red</span> for blocks that have no
            note.
          </p>
          <ChipsWithSearchPicker
            id="dispatch-settings-require"
            value={requireIds}
            onChange={onChangeRequire}
            getLabelForId={getLabelForUserId}
            search={searchRoster}
            placeholder="Search people…"
            searchInputAriaLabel="Search people who require a schedule-block note"
            resultsListAriaLabel="People who require a schedule-block note"
            disabled={busy}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="dispatch-settings-skip-search"
            style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}
          >
            Don&apos;t require a note
          </label>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            When the assignee is in this list, the edit-note icon and the surrounding chains,{' '}
            <span style={{ fontFamily: 'monospace' }}>−</span>, and{' '}
            <span style={{ fontFamily: 'monospace' }}>+</span> icons all render{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>grey</span>. Click handlers still
            work.
          </p>
          <ChipsWithSearchPicker
            id="dispatch-settings-skip"
            value={skipIds}
            onChange={onChangeSkip}
            getLabelForId={getLabelForUserId}
            search={searchRoster}
            placeholder="Search people…"
            searchInputAriaLabel="Search people who don't require a schedule-block note"
            resultsListAriaLabel="People who don't require a schedule-block note"
            disabled={busy}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="dispatch-settings-skip-jobs-search"
            style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}
          >
            Jobs that don&apos;t require a note
          </label>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            When a schedule block is for one of these jobs, the icon cluster renders{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>grey</span>. The{' '}
            <span style={{ fontWeight: 600 }}>Require a note</span> list above still wins for users
            on it.
          </p>
          <ChipsWithSearchPicker
            id="dispatch-settings-skip-jobs"
            value={skipJobIds}
            onChange={onChangeSkipJobs}
            getLabelForId={getLabelForJobId}
            search={searchJobs}
            onOptionPicked={onJobPicked}
            debounceMs={250}
            placeholder="Search jobs by HCP # or name…"
            searchInputAriaLabel="Search jobs that don't require a schedule-block note"
            resultsListAriaLabel="Jobs that don't require a schedule-block note"
            disabled={busy}
          />
        </div>

        <DispatchSwimLanesSettingsSection roster={roster} onChanged={onSwimLanesChanged} />

        {isDev ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>
              Travel time hints (Day view)
            </span>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🚗 chips between a person&rsquo;s jobs and red dots on impossible back-to-backs. Live
              routing asks Google for real drive times and falls back to the straight-line minimum
              whenever routing is unavailable.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-700)' }}>
              <input
                type="checkbox"
                checked={travel.enabled}
                disabled={busy}
                onChange={(e) => setTravel((t) => ({ ...t, enabled: e.target.checked }))}
              />
              Show travel time hints
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-700)' }}>
              Assumed average speed
              <input
                type="number"
                min={5}
                max={90}
                step={5}
                value={travel.assumedMph}
                disabled={busy || !travel.enabled}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setTravel((t) => ({ ...t, assumedMph: Number.isFinite(v) ? Math.min(90, Math.max(5, v)) : t.assumedMph }))
                }}
                style={{ width: 70, padding: '0.25rem 0.35rem', fontSize: '0.875rem' }}
              />
              mph (straight-line estimate)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-700)' }}>
              <input
                type="checkbox"
                checked={travel.useRouting}
                disabled={busy || !travel.enabled}
                onChange={(e) => setTravel((t) => ({ ...t, useRouting: e.target.checked }))}
              />
              Use live routing (Google) with straight-line fallback
            </label>
          </div>
        ) : null}

        {error ? (
          <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>
            {error}
          </p>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            marginTop: '0.25rem',
          }}
        >
          <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.875rem',
                background: busy ? 'var(--bg-200)' : '#2563eb',
                color: busy ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
