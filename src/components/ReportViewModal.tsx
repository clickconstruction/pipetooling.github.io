type ReportForView = {
  id: string
  template_name: string
  job_display_name: string
  created_at: string
  created_by_name: string
  field_values?: Record<string, string>
  reported_at_lat?: number | null
  reported_at_lng?: number | null
}

type Props = {
  open: boolean
  report: ReportForView | null
  onClose: () => void
}

export default function ReportViewModal({ open, report, onClose }: Props) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{report?.template_name ?? 'Report'}</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              {report?.job_display_name ?? 'Unknown job'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#6b7280', lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {report && (
          <>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              {new Date(report.created_at).toLocaleString()} · {report.created_by_name}
              {report.reported_at_lat != null && report.reported_at_lng != null && (
                <a
                  href={`https://www.google.com/maps?q=${report.reported_at_lat},${report.reported_at_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${Number(report.reported_at_lat).toFixed(4)}, ${Number(report.reported_at_lng).toFixed(4)}`}
                  style={{ color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16}>
                    <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" fill="currentColor" />
                  </svg>
                </a>
              )}
            </div>

            {report.field_values && Object.keys(report.field_values).length > 0 ? (
              <div style={{ fontSize: '0.875rem' }}>
                {Object.entries(report.field_values).map(([label, val]) =>
                  val ? (
                    <div key={label} style={{ marginBottom: '0.75rem' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                        {label}
                      </span>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(val)}</div>
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No content</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
