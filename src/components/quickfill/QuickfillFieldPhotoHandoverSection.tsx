import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { isDriveLinkValid, type HandoverGroup, type HandoverPhotoRow } from '../../lib/quickfill/fieldPhotoHandover'
import { FIELD_PHOTOS_LIMIT_DAYS, fieldPhotoAgeRows, fieldPhotosCounts, fieldPhotosSince, type FieldPhotosSince } from '../../lib/quickfill/fieldPhotosAge'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatDayLabel, formatMarkTime } from '../../lib/quickfill/markHistory'

/**
 * Quickfill → "Field photos → Drive" (v2.2300). Quick Estimate photos land in
 * Supabase Storage because the master can't do Google Drive from the field —
 * but long-term every customer photo lives in Drive. This section is the
 * handover: each estimate still holding Supabase photos shows its photos
 * (open/download via signed URLs); the office moves them into Drive, pastes
 * the folder link, and "Replace photos with this link" records the handover
 * (`estimate_photo_handover`) and deletes the moved photos from the bucket.
 * The estimate detail then shows the Drive link where the photos were.
 * Section disappears row by row as the backlog is worked.
 *
 * Since v2.5888 (punch list #180, PR 5) the list is read at page level by `useQuickfillFieldPhotos`,
 * so the count reaches every mark, the round's included, and each estimate shows its days in
 * storage (`lib/quickfill/fieldPhotosAge.ts`); this body signs the photo URLs when it is on screen.
 */

type SignedPhoto = HandoverPhotoRow & { url: string | null }
type SignedGroup = Omit<HandoverGroup, 'photos'> & { photos: SignedPhoto[] }

export function QuickfillFieldPhotoHandoverSection({
  groups: pageGroups,
  handovers = [],
  loading,
  problem = null,
  onMoved,
  lastMarkedAt = null,
  limitDays = FIELD_PHOTOS_LIMIT_DAYS,
}: {
  /** The estimates still holding photos, from the page's read; null until the first load. */
  groups: HandoverGroup[] | null
  handovers?: ReadonlyArray<{ moved_at: string }>
  loading: boolean
  problem?: string | null
  /** An estimate's photos were moved: the page drops it from the list. */
  onMoved: (estimateId: string) => void
  /** The station's last mark, anyone's: what "since the last look" counts from. */
  lastMarkedAt?: string | null
  limitDays?: number
}) {
  const { showToast } = useToastContext()
  const [groups, setGroups] = useState<SignedGroup[]>([])
  const [signing, setSigning] = useState(false)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  // The photos open full size through signed URLs, made here while the body is on screen.
  useEffect(() => {
    let cancelled = false
    if (!pageGroups) return
    setSigning(true)
    void Promise.all(
      pageGroups.map(async (g) => ({
        ...g,
        photos: await Promise.all(
          g.photos.map(async (p) => {
            try {
              // v2.4610 · the picture opens to be looked at; a link that forced a download made Safari ask about two sites.
              const { data: s } = await supabase.storage.from('estimate-field-photos').createSignedUrl(p.storage_path, 3600)
              return { ...p, url: s?.signedUrl ?? null }
            } catch {
              return { ...p, url: null }
            }
          }),
        ),
      })),
    )
      .then((signed) => {
        if (!cancelled) setGroups(signed)
      })
      .catch((e: unknown) => {
        if (!cancelled) showToast(formatErrorMessage(e, 'Could not load field photos'), 'error')
      })
      .finally(() => {
        if (!cancelled) setSigning(false)
      })
    return () => {
      cancelled = true
    }
  }, [pageGroups, showToast])

  const nowIso = new Date().toISOString()
  const rows = useMemo(() => fieldPhotoAgeRows(groups, nowIso, limitDays), [groups, limitDays, nowIso])
  const counts = useMemo(() => fieldPhotosCounts(rows), [rows])
  const since: FieldPhotosSince | null = useMemo(
    () => fieldPhotosSince(rows, handovers, lastMarkedAt, (iso) => `${formatDayLabel(calendarYmdInAppTzFromIso(iso))} at ${formatMarkTime(iso)}`),
    [rows, handovers, lastMarkedAt],
  )

  const replaceWithLink = useCallback(
    async (g: SignedGroup) => {
      const link = (links[g.estimateId] ?? '').trim()
      if (!isDriveLinkValid(link) || busyId) return
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth?.user?.id
      if (!uid) return
      setBusyId(g.estimateId)
      try {
        const { error: insErr } = await supabase
          .from('estimate_photo_handover')
          .upsert({ estimate_id: g.estimateId, drive_link: link, moved_by: uid }, { onConflict: 'estimate_id' })
        if (insErr) throw insErr
        // Best-effort cleanup: the handover row is already the source of truth,
        // so a failed delete just leaves orphans for a later sweep.
        const paths = g.photos.map((p) => p.storage_path)
        const { error: rmErr } = await supabase.storage.from('estimate-field-photos').remove(paths)
        if (rmErr) console.warn('field photo storage cleanup failed', rmErr)
        const { error: delErr } = await supabase
          .from('estimate_field_photos')
          .delete()
          .eq('estimate_id', g.estimateId)
        if (delErr) console.warn('field photo row cleanup failed', delErr)
        setGroups((prev) => prev.filter((x) => x.estimateId !== g.estimateId))
        onMoved(g.estimateId)
        showToast(`Photos replaced with the Drive link on ${g.label}.`, 'success')
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not record the handover'), 'error')
      } finally {
        setBusyId(null)
      }
    },
    [links, busyId, showToast, onMoved],
  )

  if (loading || (pageGroups && pageGroups.length > 0 && signing && groups.length === 0)) return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading field photos…</p>
  if (problem) return <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{problem}</p>
  if (!pageGroups || pageGroups.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }} data-field-photos="clean">
        No field photos waiting — every write-up's photos are in Google Drive. ✓
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} data-field-photos="rows">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-muted)' }} data-field-photos-count-line>
        <b style={{ color: counts.past > 0 ? 'var(--text-red-700)' : 'var(--text-700)' }}>
          {counts.estimates} {counts.estimates === 1 ? 'estimate' : 'estimates'} holding photos
        </b>
        {counts.past > 0 && (
          <span>
            · <b style={{ color: 'var(--text-red-700)' }}>{counts.past} past {limitDays} days</b>
          </span>
        )}
        {counts.oldestDays != null && <span>· oldest {counts.oldestDays}d · {counts.photos} photos</span>}
      </div>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Photos from field write-ups, still in app storage. Download each set, put it in the customer's Google
        Drive folder, then paste the folder link — the link replaces the photos on the estimate.
      </p>
      {rows.map(({ group: g, ageDays, past }) => {
        const link = links[g.estimateId] ?? ''
        const valid = isDriveLinkValid(link)
        const busy = busyId === g.estimateId
        return (
          <div
            key={g.estimateId}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              padding: '0.7rem 0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              {g.estimateNumber != null ? (
                <Link to={`/estimates/${g.estimateNumber}`} style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {g.label}
                </Link>
              ) : (
                <strong style={{ fontSize: '0.9rem' }}>{g.label}</strong>
              )}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {g.photos.length} photo{g.photos.length === 1 ? '' : 's'}
              </span>
              <span
                title={`${ageDays} days since the first photo landed`}
                data-field-photos-age={past ? 'past' : 'fresh'}
                style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0 6px', borderRadius: 999, background: past ? 'var(--bg-red-100)' : 'var(--bg-subtle)', color: past ? 'var(--text-red-800)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}
              >
                {ageDays}d in storage
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {g.photos.map((p) =>
                p.url ? (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    title={`${p.filename ?? 'photo'} — opens full size`}
                  >
                    <img
                      src={p.url}
                      alt={p.filename ?? 'field photo'}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        display: 'block',
                      }}
                    />
                  </a>
                ) : (
                  <span key={p.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    (photo unavailable)
                  </span>
                ),
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="url"
                value={link}
                placeholder="https://drive.google.com/… (the customer's folder)"
                onChange={(e) => setLinks((prev) => ({ ...prev, [g.estimateId]: e.target.value }))}
                style={{
                  flex: '1 1 16rem',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  color: 'var(--text-strong)',
                }}
              />
              <button
                type="button"
                disabled={!valid || busy}
                onClick={() => void replaceWithLink(g)}
                title="Records the Drive link on the estimate and deletes these photos from app storage"
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  background: valid && !busy ? '#16a34a' : 'var(--bg-muted)',
                  color: valid && !busy ? 'white' : 'var(--text-muted)',
                  cursor: valid && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? 'Replacing…' : 'Replace photos with this link'}
              </button>
            </div>
          </div>
        )
      })}
      {since && (
        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-700)', padding: '0.15rem 0.1rem 0' }} data-field-photos-since>
          <span>{since.words}:</span>
          <b style={{ color: 'var(--text-link)' }}>+{since.newSince} new</b>
          <b style={{ color: 'var(--text-green-800)' }}>{since.movedSince} moved to Drive</b>
          <b>{since.stillSince} still here</b>
        </div>
      )}
    </div>
  )
}
