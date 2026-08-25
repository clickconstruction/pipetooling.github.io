import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  groupFieldPhotosByEstimate,
  isDriveLinkValid,
  type HandoverEstimateRow,
  type HandoverGroup,
  type HandoverPhotoRow,
} from '../../lib/quickfill/fieldPhotoHandover'

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
 */

type SignedPhoto = HandoverPhotoRow & { url: string | null }
type SignedGroup = Omit<HandoverGroup, 'photos'> & { photos: SignedPhoto[] }

export function QuickfillFieldPhotoHandoverSection() {
  const { showToast } = useToastContext()
  const [groups, setGroups] = useState<SignedGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: photos } = await supabase
        .from('estimate_field_photos')
        .select('id, estimate_id, storage_path, filename, created_at')
        .order('created_at', { ascending: true })
        .limit(400)
      const photoRows = (photos ?? []) as HandoverPhotoRow[]
      if (photoRows.length === 0) {
        setGroups([])
        return
      }
      const estimateIds = [...new Set(photoRows.map((p) => p.estimate_id))]
      const [{ data: ests }, { data: handovers }] = await Promise.all([
        supabase
          .from('estimates')
          .select('id, estimate_number, doc_kind, title, status, customers(name)')
          .in('id', estimateIds),
        supabase.from('estimate_photo_handover').select('estimate_id').in('estimate_id', estimateIds),
      ])
      const moved = new Set(
        ((handovers ?? []) as Array<{ estimate_id: string }>).map((h) => h.estimate_id),
      )
      const estimateRows: HandoverEstimateRow[] = ((ests ?? []) as Array<{
        id: string
        estimate_number: number | null
        doc_kind: string
        title: string
        status: string
        customers: { name: string } | null
      }>)
        .filter((e) => !moved.has(e.id))
        .map((e) => ({
          id: e.id,
          estimate_number: e.estimate_number,
          doc_kind: e.doc_kind,
          title: e.title,
          status: e.status,
          customerName: e.customers?.name ?? null,
        }))
      const grouped = groupFieldPhotosByEstimate(photoRows, estimateRows)
      const signed: SignedGroup[] = await Promise.all(
        grouped.map(async (g) => ({
          ...g,
          photos: await Promise.all(
            g.photos.map(async (p) => {
              const { data: s } = await supabase.storage
                .from('estimate-field-photos')
                .createSignedUrl(p.storage_path, 3600, { download: p.filename ?? true })
              return { ...p, url: s?.signedUrl ?? null }
            }),
          ),
        })),
      )
      setGroups(signed)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load field photos'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

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
        showToast(`Photos replaced with the Drive link on ${g.label}.`, 'success')
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not record the handover'), 'error')
      } finally {
        setBusyId(null)
      }
    },
    [links, busyId, showToast],
  )

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading field photos…</p>
  if (groups.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No field photos waiting — every write-up's photos are in Google Drive. ✓
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Photos from field write-ups, still in app storage. Download each set, put it in the customer's Google
        Drive folder, then paste the folder link — the link replaces the photos on the estimate.
      </p>
      {groups.map((g) => {
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
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {g.photos.map((p) =>
                p.url ? (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    title={`${p.filename ?? 'photo'} — opens/downloads full size`}
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
    </div>
  )
}
