import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  fetchStreetViewImageBlob,
  fetchStreetViewMeta,
  googleStreetViewPanoUrl,
} from '../../lib/fetchStreetViewPreview'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useJobThreadNotesForModal } from '../../hooks/useJobThreadNotesForModal'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import { readsCustomerLinesInJobUpdates } from '../../lib/gc/access'
import { useJobMessages } from '../../hooks/useJobMessages'
import { customerLinesForJobUpdates } from '../../lib/jobs/jobUpdatesCustomerLines'
import { JobStageChecklistStrip } from '../stageChecklists/JobStageChecklistStrip'
import { JobModePhotosLine } from './JobModePhotosLine'
import { JobFirstLookStrip } from '../firstLook/JobFirstLookStrip'
import { JobPaintedMapsStrip } from '../paintedMap/JobPaintedMapsStrip'
import { TicketPress } from '../tickets/TicketPress'
import { JobModeMachinesLine } from '../machines/JobModeMachinesLine'

type CustomerContact = {
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  /** For the customer's lines (v2.5527): which of them the job takes. */
  status?: string | null
  created_at?: string | null
  /** The job's Plans folder, the door a checklist's plan-sheet chip opens (#237 PR 1b). */
  job_plans_link?: string | null
  /** The job's development (#345): its painted maps show on the job, since a site's way in serves every lot. */
  development_id?: string | null
}

const sectionLabel: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
}

/** The copy press beside the customer's address (#125 PR 7). */
const copyPress: CSSProperties = {
  flexShrink: 0,
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  background: 'var(--surface)',
  color: 'var(--text-muted)',
  font: 'inherit',
  fontSize: '0.8125rem',
  lineHeight: 1,
  padding: '0.2rem 0.45rem',
  cursor: 'pointer',
}

/** Message the customer under the address (#125 PR 7): the card's own door, in the quiet look of the contact lines. */
const messagePress: CSSProperties = {
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.3rem 0.7rem',
  border: '1px solid var(--border-orange)',
  borderRadius: 999,
  background: 'var(--bg-orange-tint)',
  color: 'var(--text-orange-700)',
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
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
/** The customer line for a job the reader cannot read yet: it opens to a superintendent at the clock-in. */
export const CUSTOMER_CONTACT_AFTER_CLOCK_IN_WORDS = 'Shows once you clock in here.'

export default function JobModeDetailsSection({
  jobId,
  jobAddress,
  hcpNumber,
  jobName,
  updatesRev = 0,
  onMessageCustomer,
}: {
  jobId: string
  jobAddress: string
  /** The job's number and name, for the Job photos window's head (punch list #244); absent on the next job's card. */
  hcpNumber?: string | null
  jobName?: string | null
  /** Goes up when the card wrote to the job (Message the customer's note or text): Job updates reads again. */
  updatesRev?: number
  /**
   * The card's Message the customer door (#125 PR 7, v2.6717): a press under the customer's address opens it, so the
   * tech texts from the company number. Left out (the next job's card, or a role the door is not offered to), the
   * address stands alone. A tech never emails the customer from Job Mode (the owner's call 4, 2026-11-08): the address
   * is text with a copy press, not a `mailto:`.
   */
  onMessageCustomer?: () => void
}) {
  const { user: authUser, profileName, role } = useAuth()
  const { showToast } = useToastContext()
  const promptDialog = usePromptDialog()
  const jobDetailModal = useJobDetailModal()

  const [contact, setContact] = useState<CustomerContact | null>(null)
  /**
   * Why there is no contact once the read landed (v2.6706): the read came back with no row, which for a
   * superintendent means a job they have not clocked onto yet (the job opens to them at the clock-in),
   * or it failed. Null while it reads. Until then the line said *Loading…* for good.
   */
  const [contactWhyNone, setContactWhyNone] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setContact(null)
    setContactWhyNone(null)
    void (async () => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger')
              .select('customer_name, customer_phone, customer_email, status, created_at, job_plans_link, development_id')
              .eq('id', jobId)
              .maybeSingle(),
          'job mode load customer contact',
        )
        if (cancelled) return
        setContact((row ?? null) as CustomerContact | null)
        if (!row) setContactWhyNone(CUSTOMER_CONTACT_AFTER_CLOCK_IN_WORDS)
      } catch (e) {
        if (cancelled) return
        setContact(null)
        setContactWhyNone(formatErrorMessage(e, 'Could not read the customer’s contact'))
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
    // A note kept on the phone (punch list #163 PR 3) is listed by the job's address, the card's own words for it.
    about: jobAddress,
  })
  const reloadUpdates = threadNotes.reload
  useEffect(() => {
    if (updatesRev > 0) reloadUpdates()
  }, [updatesRev, reloadUpdates])

  // The tech's door to the customer (v2.5527): the job's lines with them, in Job updates under a Customer pill.
  const readsLines = readsCustomerLinesInJobUpdates(role)
  // A text from Message the customer bumps `updatesRev` too, so its line shows without a reopen (v2.5528).
  const messages = useJobMessages(readsLines && contact ? { id: jobId, status: contact.status ?? null, createdAt: contact.created_at ?? null } : null, updatesRev)
  const customerLines = useMemo(
    () => (!readsLines ? undefined : contact && messages ? customerLinesForJobUpdates(messages) : null),
    [readsLines, contact, messages],
  )

  const name = contact?.customer_name?.trim() ?? ''
  const phone = contact?.customer_phone?.trim() ?? ''
  const email = contact?.customer_email?.trim() ?? ''
  const hasContact = Boolean(name || phone || email)

  /** The address, copied (#125 PR 7): the clipboard, or a window to copy from when the app cannot reach it. */
  const copyEmail = async () => {
    if (!email) return
    try {
      await navigator.clipboard.writeText(email)
      showToast('Email address copied', 'success')
    } catch {
      await promptDialog({ title: 'Copy the email address', message: 'The app could not reach the clipboard. Select the address below and copy it.', defaultValue: email, confirmLabel: 'I copied it' })
    }
  }

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
      {/* Painted maps (punch list #345): the way in and what is where. The person standing on the site is the one who
          can mark it, so the press to paint one is here, beside the address and out of the day's press bar. */}
      <JobPaintedMapsStrip jobId={jobId} developmentId={contact?.development_id ?? null} jobLabel={[hcpNumber, jobName].filter(Boolean).join(' · ') || null} address={jobAddress} />
      {/* What the customer sent before the visit (punch list #319 PR 6): a First look's photos, video and words. Nothing for a job with none. */}
      <JobFirstLookStrip jobId={jobId} />
      {/* A checklist per stage (punch list #164, PR 3): the job's stages with a checklist, each opening its sheet. */}
      <JobStageChecklistStrip jobId={jobId} rev={updatesRev} plansUrl={contact?.job_plans_link} />
      {/* Equipment pre-use check (punch list #270): a line per machine on the job, under the stage checklists */}
      <JobModeMachinesLine jobId={jobId} jobWords={[hcpNumber, jobName].filter(Boolean).join(' · ')} />
      {/* The field's door to the job's photos (punch list #244, PR 4): the same window the Pipeline row's camera opens. */}
      <JobModePhotosLine jobId={jobId} hcpNumber={hcpNumber} jobName={jobName} jobAddress={jobAddress} />
      {/* A photo of the supply house ticket (punch list #295, PR 4): the same press as Tally's, this job picked first. */}
      {authUser?.id ? <TicketPress variant="line" jobId={jobId} userId={authUser.id} byName={profileName ?? authUser.email?.split('@')[0] ?? 'someone'} /> : null}
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
          {contact == null && contactWhyNone ? (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-faint)' }}>{contactWhyNone}</span>
          ) : !hasContact ? (
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, maxWidth: '100%' }}>
                  <span style={{ ...contactLinkBtn, cursor: 'text', textDecoration: 'none', color: 'var(--text-700)' }} data-testid="job-mode-customer-email">
                    {email}
                  </span>
                  <button type="button" style={copyPress} aria-label="Copy the customer’s email address" title="Copy the email address" onClick={() => void copyEmail()} data-testid="job-mode-customer-email-copy">
                    ⧉
                  </button>
                </span>
              ) : null}
              {onMessageCustomer ? (
                <button type="button" style={messagePress} aria-label="Message the customer by text" onClick={onMessageCustomer} data-testid="job-mode-details-message-customer">
                  <span aria-hidden>💬</span>
                  Message the customer
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
          customerLines={customerLines}
        />
      </div>
    </div>
  )
}
