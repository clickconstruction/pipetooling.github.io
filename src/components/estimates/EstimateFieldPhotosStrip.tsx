import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Field photos on an estimate/CO draft (Quick Estimate, v2.2293). Self-loading
 * thumbnail strip: renders nothing when the draft has no field photos, so it
 * mounts unconditionally in the estimate detail. Tapping a photo opens the
 * full-size signed URL in a new tab.
 */
export function EstimateFieldPhotosStrip({ estimateId }: { estimateId: string }) {
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; filename: string }>>([])
  const [driveLink, setDriveLink] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Handover (v2.2300): once the office moved the photos to Google Drive,
        // the link stands in for them.
        const { data: handover } = await supabase
          .from('estimate_photo_handover')
          .select('drive_link')
          .eq('estimate_id', estimateId)
          .maybeSingle()
        if (!cancelled) setDriveLink((handover as { drive_link?: string } | null)?.drive_link ?? null)
        const { data } = await supabase
          .from('estimate_field_photos')
          .select('id, storage_path, filename')
          .eq('estimate_id', estimateId)
          .order('created_at', { ascending: true })
        const rows = (data ?? []) as Array<{ id: string; storage_path: string; filename: string | null }>
        if (rows.length === 0) {
          if (!cancelled) setPhotos([])
          return
        }
        const signed = await Promise.all(
          rows.map(async (r) => {
            const { data: s } = await supabase.storage
              .from('estimate-field-photos')
              .createSignedUrl(r.storage_path, 3600)
            return s?.signedUrl ? { id: r.id, url: s.signedUrl, filename: r.filename ?? 'photo' } : null
          }),
        )
        if (!cancelled) setPhotos(signed.filter((p): p is { id: string; url: string; filename: string } => p != null))
      } catch {
        if (!cancelled) setPhotos([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [estimateId])

  if (photos.length === 0 && !driveLink) return null

  if (photos.length === 0 && driveLink) {
    return (
      <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        📁{' '}
        <a href={driveLink} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
          Field photos — moved to Google Drive
        </a>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
        📷 Photos from the field
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {photos.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={p.filename}>
            <img
              src={p.url}
              alt={p.filename}
              style={{
                width: 84,
                height: 84,
                objectFit: 'cover',
                borderRadius: 10,
                border: '1px solid var(--border)',
                display: 'block',
              }}
            />
          </a>
        ))}
      </div>
    </div>
  )
}
