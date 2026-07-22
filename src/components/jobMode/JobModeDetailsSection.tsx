import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  fetchStreetViewImageBlob,
  fetchStreetViewMeta,
  googleStreetViewPanoUrl,
} from '../../lib/fetchStreetViewPreview'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useJobThreadNotesForModal } from '../../hooks/useJobThreadNotesForModal'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'

type CustomerContact = {
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
}

const sectionLabel: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
}

const contactLinkBtn: CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.9375rem',
  color: 'var(--text-link)',
  textAlign: 'left',
  textDecoration: 'underline',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
}

function googleMapsSearchUrlForAddress(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
}

/**
 * Job Mode card tail for the CURRENT job: customer contact (tap-to-call /
 * tap-to-email), a Job Detail opener, the address Street View photo, and the
 * job updates thread (same feed + composer as the Job Detail modal).
 */
export default function JobModeDetailsSection({
  jobId,
  jobAddress,
}: {
  jobId: string
  jobAddress: string
}) {
  const { user: authUser, profileName, role } = useAuth()
  const { showToast } = useToastContext()
  const jobDetailModal = useJobDetailModal()

  const [contact, setContact] = useState<CustomerContact | null>(null)

  useEffect(() => {
    let cancelled = false
    setContact(null)
    void (async () => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger')
              .select('customer_name, customer_phone, customer_email')
              .eq('id', jobId)
              .maybeSingle(),
          'job mode load customer contact',
        )
        if (!cancelled) setContact((row ?? null) as CustomerContact | null)
      } catch {
        if (!cancelled) setContact(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  // Street View: meta first (null = no imagery), then the image blob. Same
  // pattern as DetailJobModal, including blob-URL revocation.
  const [streetViewImgUrl, setStreetViewImgUrl] = useState<string | null>(null)
  const [streetViewLatLng, setStreetViewLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [streetViewLoading, setStreetViewLoading] = useState(false)
  const streetViewBlobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const revokeBlobUrl = () => {
      if (streetViewBlobUrlRef.current) {
        URL.revokeObjectURL(streetViewBlobUrlRef.current)
        streetViewBlobUrlRef.current = null
      }
    }
    const address = jobAddress.trim()
    revokeBlobUrl()
    setStreetViewImgUrl(null)
    setStreetViewLatLng(null)
    if (!address) {
      setStreetViewLoading(false)
      return () => {
        cancelled = true
      }
    }
    setStreetViewLoading(true)
    void (async () => {
      try {
        const meta = await fetchStreetViewMeta(address)
        if (cancelled || !meta) return
        setStreetViewLatLng(meta)
        const blob = await fetchStreetViewImageBlob(address)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        streetViewBlobUrlRef.current = url
        setStreetViewImgUrl(url)
      } catch {
        if (!cancelled) {
          revokeBlobUrl()
          setStreetViewImgUrl(null)
          setStreetViewLatLng(null)
        }
      } finally {
        if (!cancelled) setStreetViewLoading(false)
      }
    })()
    return () => {
      cancelled = true
      revokeBlobUrl()
    }
  }, [jobAddress])

  const openStreetView = () => {
    const address = jobAddress.trim()
    if (!address) return
    if (streetViewLatLng) {
      openInExternalBrowser(googleStreetViewPanoUrl(streetViewLatLng.lat, streetViewLatLng.lng))
      return
    }
    openInExternalBrowser(googleMapsSearchUrlForAddress(address))
  }

  const threadNotes = useJobThreadNotesForModal(jobId, true, {
    authUserId: authUser?.id,
    showToast,
    authorDisplayName: authUser?.id ? profileName : undefined,
  })

  const name = contact?.customer_name?.trim() ?? ''
  const phone = contact?.customer_phone?.trim() ?? ''
  const email = contact?.customer_email?.trim() ?? ''
  const hasContact = Boolean(name || phone || email)

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        paddingTop: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={sectionLabel}>Customer</span>
          {!hasContact ? (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-faint)' }}>
              {contact == null ? 'Loading…' : 'No customer contact on file'}
            </span>
          ) : (
            <>
              {name ? (
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-gray-800)' }}>
                  {name}
                </span>
              ) : null}
              {phone ? (
                <button
                  type="button"
                  style={contactLinkBtn}
                  aria-label={`Call customer at ${phone}`}
                  onClick={() => openInExternalBrowser(`tel:${phone}`)}
                >
                  {phone}
                </button>
              ) : null}
              {email ? (
                <button
                  type="button"
                  style={contactLinkBtn}
                  aria-label={`Email customer at ${email}`}
                  onClick={() => openInExternalBrowser(`mailto:${email}`)}
                >
                  {email}
                </button>
              ) : null}
            </>
          )}
        </div>
        {jobDetailModal ? (
          <button
            type="button"
            onClick={() => jobDetailModal.openJobDetail({ jobId })}
            aria-label="Open job detail"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.45rem 0.7rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text-700)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
            </svg>
            Job detail
          </button>
        ) : null}
      </div>

      {streetViewLoading || streetViewImgUrl ? (
        <button
          type="button"
          onClick={openStreetView}
          aria-label="Open Street View for the job address"
          title="Open Street View"
          style={{
            padding: 0,
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
            background: 'var(--bg-subtle)',
            cursor: streetViewImgUrl ? 'pointer' : 'default',
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {streetViewImgUrl ? (
            <img
              src={streetViewImgUrl}
              alt={`Street View of ${jobAddress}`}
              style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 200 }}
            />
          ) : (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Loading Street View…</span>
          )}
        </button>
      ) : null}

      <div>
        <JobThreadNotesPanel
          activity={threadNotes.activity}
          loading={threadNotes.loading}
          canPost={threadNotes.canPost}
          draft={threadNotes.draft}
          onDraftChange={threadNotes.setDraft}
          onSubmit={() => void threadNotes.submitNote()}
          submitting={threadNotes.submitting}
          sectionTitle="Job updates"
          showSectionTitle
          showEmptyPlaceholder={false}
          viewerRole={role}
        />
      </div>
    </div>
  )
}
