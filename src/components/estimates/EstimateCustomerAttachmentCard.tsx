import { useEffect, useId, useState } from 'react'
import type { CustomerAttachmentPayload } from '@/lib/estimateCustomerAttachment'
import { googleDrivePreviewEmbedUrl } from '@/lib/estimateCustomerAttachment'

type Props = {
  attachment: CustomerAttachmentPayload
}

export default function EstimateCustomerAttachmentCard({ attachment }: Props) {
  const headingId = useId()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [wideScreen, setWideScreen] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    function sync() {
      setWideScreen(mq.matches)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const embedUrl = googleDrivePreviewEmbedUrl(attachment.url)
  const defaultLabel = 'Supporting document'
  const title = attachment.label?.trim() || defaultLabel
  const canEmbed = embedUrl !== null

  const cardStyle = {
    marginTop: '1.5rem',
    padding: '1rem 1.15rem',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-page)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  } as const

  const btnOutline = {
    padding: '0.45rem 0.9rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text-strong)',
    cursor: 'pointer' as const,
  }

  return (
    <section style={cardStyle} aria-labelledby={headingId}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.75rem 1rem' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: 'var(--bg-red-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '1.25rem',
          }}
          aria-hidden
        >
          PDF
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <h2 id={headingId} style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            {title}
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            View or download the attached file (opens in a new tab).
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...btnOutline,
                background: '#ea580c',
                color: 'white',
                borderColor: '#c2410c',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Open document
            </a>
            {canEmbed && wideScreen ? (
              <button
                type="button"
                style={btnOutline}
                onClick={() => setPreviewOpen((v) => !v)}
                aria-expanded={previewOpen}
              >
                {previewOpen ? 'Hide preview' : 'Show preview'}
              </button>
            ) : null}
          </div>
          {!wideScreen && canEmbed ? (
            <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--text-faint)' }}>
              Preview works best on a larger screen—use Open document on this device.
            </p>
          ) : null}
        </div>
      </div>
      {canEmbed && previewOpen && wideScreen ? (
        <div style={{ marginTop: '1rem' }}>
          <iframe
            title={`Preview: ${title}`}
            src={embedUrl}
            style={{
              width: '100%',
              minHeight: 480,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
            }}
          />
        </div>
      ) : null}
    </section>
  )
}
