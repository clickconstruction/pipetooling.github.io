import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { loadReportPhotoSize, setReportPhotoSize } from '../../lib/photos/reportPhotosIo'
import { REPORT_PHOTO_SIZES, type ReportPhotoSize } from '../../lib/photos/shrink'
import { formatErrorMessage } from '../../utils/errorHandling'

const ORDER: ReportPhotoSize[] = ['small', 'medium', 'large']

/**
 * Settings → Jobs & billing → Photos (punch list #189, PR 5b; the mock-up's section 6, frame 4): the long edge the
 * phone shrinks a report photo to before it leaves. Small 1200 px, Medium 1600 (the default), Large 2400. One row of
 * `app_settings` (`report_photo_size`), set by a master or a dev, read by every phone when a report opens. Saves on
 * the pick; self-contained like the other blocks on the tab.
 */
export default function ReportPhotoSizeSettingsBlock({ canSet }: { canSet: boolean }) {
  const { showToast } = useToastContext()
  const [size, setSize] = useState<ReportPhotoSize | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadReportPhotoSize().then(setSize)
  }, [])

  const pick = async (next: ReportPhotoSize) => {
    if (!canSet || saving || next === size) return
    const before = size
    setSize(next)
    setSaving(true)
    try {
      await setReportPhotoSize(next)
      showToast(`Saved. Report photos leave the phone at ${REPORT_PHOTO_SIZES[next].words}, ${REPORT_PHOTO_SIZES[next].edge} px on the long edge.`, 'success')
    } catch (e) {
      setSize(before)
      showToast(formatErrorMessage(e, 'The size did not change.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }} data-testid="report-photo-size-block">
      <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Photos</h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        A report photo is shrunk on the phone before it leaves, to this long edge. The full size shot never leaves the phone. Drive gets the small copy.
      </p>
      <div role="radiogroup" aria-label="Report photo size" style={{ display: 'grid', gap: '0.4rem' }}>
        {ORDER.map((s) => {
          const on = size === s
          const row = REPORT_PHOTO_SIZES[s]
          return (
            <label
              key={s}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '0.6rem',
                alignItems: 'center',
                padding: '0.6rem 0.75rem',
                border: on ? '1px solid var(--border-blue)' : '1px solid var(--border)',
                background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                borderRadius: 8,
                cursor: canSet && !saving ? 'pointer' : 'default',
                minHeight: 44,
                boxSizing: 'border-box',
              }}
            >
              <input type="radio" name="report-photo-size" value={s} checked={on} disabled={!canSet || saving || size == null} onChange={() => void pick(s)} />
              <span>
                <span style={{ fontWeight: 600 }}>{row.words}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: 8 }}>
                  {row.edge} px · {row.about}
                </span>
              </span>
              {on ? <span aria-hidden style={{ color: 'var(--text-link)', fontWeight: 700 }}>✓</span> : <span />}
            </label>
          )
        })}
      </div>
      <p style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        A 12 MP shot is 3 to 5 MB. Medium reads fine on a desktop and goes up on one bar of signal. The bucket refuses anything over 2 MB.
        {canSet ? null : ' A master or a dev picks the size.'}
      </p>
    </div>
  )
}
