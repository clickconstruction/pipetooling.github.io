import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  fetchStreetViewImageBlob,
  fetchStreetViewMeta,
  googleStreetViewPanoUrl,
} from '../../lib/fetchStreetViewPreview'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useAuth } from '../../hooks/useAuth'
import { useJobLeadContact } from '../../hooks/useJobLeadContact'
import { useFirstAssistantDispatchPhone } from '../../hooks/useFirstAssistantDispatchPhone'
import { ourLeadWords, showsOurLead } from '../../lib/jobs/jobWindowCrewPhone'
import { useToastContext } from '../../contexts/ToastContext'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useJobThreadNotesForModal } from '../../hooks/useJobThreadNotesForModal'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import { readsCustomerLinesInJobUpdates } from '../../lib/gc/access'
import { useJobMessages } from '../../hooks/useJobMessages'
import { customerLinesForJobUpdates } from '../../lib/jobs/jobUpdatesCustomerLines'
import { JobModeArrivalCheck } from './JobModeArrivalCheck'
import { JobStageChecklistStrip } from '../stageChecklists/JobStageChecklistStrip'
import { JobModePhotosLine } from './JobModePhotosLine'
import { JobFirstLookStrip } from '../firstLook/JobFirstLookStrip'
import { JobPaintedMapsStrip } from '../paintedMap/JobPaintedMapsStrip'
import { TicketPress } from '../tickets/TicketPress'
import { JobModeMachinesLine } from '../machines/JobModeMachinesLine'
import { JOB_CARD_FIRST_ROW_WORDS, JOB_CARD_ROW_WORDS, phoneAsWritten, rowCountWords } from '../../lib/phoneLayout/jobCard'
import { CARD_PRESS, CardFold, CardRow } from './JobModePhoneCardParts'

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

/** What the card hands the section under the new phone layout: its own pieces, drawn in the section's new order. */
export type JobModeDetailsPhone = {
  /** Opens directions to the job's address. Null with no address to route to, and then no Directions press. */
  onDirections: (() => void) | null
  /**
   * Text: the card's own Message the customer door in the first row's shape, where the role and the day already
   * offer it. Null where they do not, and then the row has no Text press. Never a new way to text a customer.
   */
  textPress: ReactNode | null
  /** Today's stops, the trip and a failed read of the day: drawn under the contact lines. */
  day: ReactNode
  /** The card's own doors, as rows: Materials on site first, Job calendar last. */
  materialsRow: ReactNode
  calendarRow: ReactNode
  /** My spend: the last press of the row Paint a map and Place on this job share. */
  pressRowEnd: ReactNode
  /** The card's quiet presses: Make change order, Hand the phone, My statement. */
  links: ReactNode
  /** Tells the press record that Job details was opened from the card, where the square's presses were counted. */
  onJobDetailsPressed?: () => void
}

/** The first row's presses share the width equally: one, two or three of them. */
const firstRow: CSSProperties = { display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 6 }
/** The quiet line under the first row: whose number, and the number as a phone number. */
const phoneLine: CSSProperties = { margin: 0, textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.35 }
/** The customer's address as a 44 px press that copies it: the words at the left, what the press does at the end. */
const emailPress: CSSProperties = { ...CARD_PRESS, width: '100%', justifyContent: 'flex-start', padding: '0 0.7rem', fontWeight: 600 }

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
  arrivalAbove = false,
  phone: phoneCard,
}: {
  jobId: string
  jobAddress: string
  /** The job's number and name, for the Job photos window's head (punch list #244); absent on the next job's card. */
  hcpNumber?: string | null
  jobName?: string | null
  /** Goes up when the card wrote to the job (Message the customer's note or text): Job updates reads again. */
  updatesRev?: number
  /**
   * The mount draws **Is it as told?** itself, above this section. The short page does: its details sit behind
   * **Open this job**, and the look on arrival is asked before anything is unloaded, so it cannot wait behind a fold.
   */
  arrivalAbove?: boolean
  /**
   * The card's Message the customer door (#125 PR 7, v2.6717): a press under the customer's address opens it, so the
   * tech texts from the company number. Left out (the next job's card, or a role the door is not offered to), the
   * address stands alone. A tech never emails the customer from Job Mode (the owner's call 4, 2026-11-08): the address
   * is text with a copy press, not a `mailto:`.
   */
  onMessageCustomer?: () => void
  /**
   * The new phone layout (`lib/phoneLayout/jobCard.ts`): the same pieces in the card's new order. Call, Directions
   * and Text first, the number as a phone number under them, then the card's rows. The card hands over the pieces
   * it owns, to be drawn in their place. Left out, the section is the section it was.
   */
  phone?: JobModeDetailsPhone
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

  // A subcontractor reads who runs the job for us and their number, never the customer's number or email (punch
  // list #355, v2.7380, Taunya's "Our lead's"): the same rule as their job window.
  const forSub = showsOurLead(role)
  const jobLead = useJobLeadContact(jobId, forSub)
  const officePhone = useFirstAssistantDispatchPhone(forSub)
  const ourLead = forSub && jobLead.loaded ? ourLeadWords(jobLead.lead, officePhone?.display ?? null) : null
  /** Job updates is one of the card's rows under the new phone layout, opening in place. Shut until pressed. */
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const name = contact?.customer_name?.trim() ?? ''
  const phone = forSub ? '' : (contact?.customer_phone?.trim() ?? '')
  const email = forSub ? '' : (contact?.customer_email?.trim() ?? '')
  const hasContact = Boolean(name || phone || email || ourLead)

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

  // The new phone layout: the same pieces, each once, in the order a thumb needs them. Every press opens what it
  // opens in the layout under this one, and nothing here reads or writes anything the old layout does not.
  if (phoneCard) {
    const callNumber = phone || ourLead?.phone || ''
    const callAria = phone ? `Call customer at ${phone}` : ourLead?.phone ? `Call ${ourLead.name} at ${ourLead.phone}` : undefined
    const updatesCount = threadNotes.loading ? null : threadNotes.activity.length + (customerLines?.length ?? 0)
    const hasFirstRow = Boolean(callNumber || phoneCard.onDirections || phoneCard.textPress)
    return (
      <div data-job-mode-details="phone" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0 }}>
        {hasFirstRow ? (
          <div style={firstRow} data-testid="job-card-first-row">
            {callNumber ? (
              // The same call the number's link made: the number as it is kept, handed to the phone.
              <button type="button" style={CARD_PRESS} aria-label={callAria} onClick={() => openInExternalBrowser(`tel:${callNumber}`)} data-job-card-press="call">
                <span aria-hidden>📞</span>
                {JOB_CARD_FIRST_ROW_WORDS.call}
              </button>
            ) : null}
            {phoneCard.onDirections ? (
              <button type="button" style={CARD_PRESS} aria-label="Directions to the job’s address" onClick={phoneCard.onDirections} data-job-card-press="directions">
                <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none' }}>
                  <path d="M12 2 22 12 12 22 2 12Z" />
                  <path d="M9 14v-2a2 2 0 0 1 2-2h4" />
                  <path d="m13 8 2 2-2 2" />
                </svg>
                {JOB_CARD_FIRST_ROW_WORDS.directions}
              </button>
            ) : null}
            {phoneCard.textPress}
          </div>
        ) : null}
        <p style={phoneLine} data-testid="job-card-phone-line">
          {contact == null && contactWhyNone ? (
            contactWhyNone
          ) : !hasContact ? (
            // An empty line names the next step: the office is who adds a customer to a job.
            contact == null ? 'Loading…' : 'This job has no customer contact yet. Ask the office to add one.'
          ) : phone ? (
            <>
              Customer <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{phoneAsWritten(phone)}</b>
            </>
          ) : ourLead?.phone ? (
            <>
              {ourLead.name} {ourLead.note} <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{phoneAsWritten(ourLead.phone)}</b>
            </>
          ) : (
            'This job has no phone number yet. Ask the office to add one.'
          )}
        </p>
        {phoneCard.day}
        <JobModeArrivalCheck jobId={jobId} />
        <div data-job-card-rows style={{ display: 'grid', gap: 6 }}>
          {phoneCard.materialsRow}
          <JobModePhotosLine row jobId={jobId} hcpNumber={hcpNumber} jobName={jobName} jobAddress={jobAddress} />
          <CardFold row="updates" title={JOB_CARD_ROW_WORDS.updates} count={rowCountWords(updatesCount)} open={updatesOpen} onToggle={() => setUpdatesOpen((o) => !o)} testId="job-card-updates">
            <JobThreadNotesPanel
              activity={threadNotes.activity}
              loading={threadNotes.loading}
              canPost={threadNotes.canPost}
              draft={threadNotes.draft}
              onDraftChange={threadNotes.setDraft}
              onSubmit={() => void threadNotes.submitNote()}
              tagJobId={jobId}
              tagViewerId={authUser?.id ?? null}
              onSubmitTagged={(tagged) => void threadNotes.submitNote(tagged)}
              submitting={threadNotes.submitting}
              sectionTitle="Job updates"
              showSectionTitle={false}
              // The row's own box is the one box: the panel and its note box are flat inside it.
              hostCard
              showEmptyPlaceholder={false}
              viewerRole={role}
              customerLines={customerLines}
            />
          </CardFold>
          {jobDetailModal ? (
            <CardRow
              row="details"
              title={JOB_CARD_ROW_WORDS.details}
              ariaLabel="Open job detail"
              onPress={() => {
                phoneCard.onJobDetailsPressed?.()
                jobDetailModal.openJobDetail({ jobId })
              }}
            />
          ) : null}
          {phoneCard.calendarRow}
        </div>
        <JobPaintedMapsStrip jobId={jobId} developmentId={contact?.development_id ?? null} jobLabel={[hcpNumber, jobName].filter(Boolean).join(' · ') || null} address={jobAddress} card={{ end: phoneCard.pressRowEnd }} />
        {phoneCard.links}
        <JobFirstLookStrip jobId={jobId} />
        <JobStageChecklistStrip jobId={jobId} rev={updatesRev} plansUrl={contact?.job_plans_link} hideWhileEmpty />
        <JobModeMachinesLine jobId={jobId} jobWords={[hcpNumber, jobName].filter(Boolean).join(' · ')} />
        {authUser?.id ? <TicketPress variant="line" jobId={jobId} userId={authUser.id} byName={profileName ?? authUser.email?.split('@')[0] ?? 'someone'} /> : null}
        {name || ourLead || email ? (
          <div data-testid="job-card-customer" style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <span style={sectionLabel}>Customer</span>
            {name ? <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-gray-800)' }}>{name}</span> : null}
            {ourLead ? (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="job-mode-our-lead">
                <span style={{ fontWeight: 600, color: 'var(--text-gray-800)' }}>{ourLead.name}</span> {ourLead.note}
              </span>
            ) : null}
            {email ? (
              // A tech never emails the customer from Job Mode: the address is copied, as before, by a press a thumb can hit.
              <button type="button" style={emailPress} aria-label="Copy the customer’s email address" title="Copy the email address" onClick={() => void copyEmail()} data-testid="job-mode-customer-email-copy">
                <span aria-hidden>✉</span>
                <span data-testid="job-mode-customer-email" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email}
                </span>
                <span style={{ marginLeft: 'auto', flex: 'none', paddingLeft: 8, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>COPY</span>
              </button>
            ) : null}
          </div>
        ) : null}
        {streetViewLoading || streetViewImgUrl ? (
          <button
            type="button"
            onClick={openStreetView}
            aria-label="Open Street View for the job address"
            title="Open Street View"
            style={{ padding: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-subtle)', cursor: streetViewImgUrl ? 'pointer' : 'default', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {streetViewImgUrl ? (
              <img src={streetViewImgUrl} alt={`Street View of ${jobAddress}`} style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 200 }} />
            ) : (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Loading Street View…</span>
            )}
          </button>
        ) : null}
      </div>
    )
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
      {/* Is it as told? (punch list #382, PR 10): the look on arrival leads the job's details, since it is asked before
          anything is unloaded. Nothing when there is nothing to ask. The short page draws it above its fold instead. */}
      {arrivalAbove ? null : <JobModeArrivalCheck jobId={jobId} />}
      {/* Painted maps (punch list #345): the way in and what is where. The person standing on the site is the one who
          can mark it, so the press to paint one is here, beside the address and out of the day's press bar. */}
      <JobPaintedMapsStrip jobId={jobId} developmentId={contact?.development_id ?? null} jobLabel={[hcpNumber, jobName].filter(Boolean).join(' · ') || null} address={jobAddress} />
      {/* What the customer sent before the visit (punch list #319 PR 6): a First look's photos, video and words. Nothing for a job with none. */}
      <JobFirstLookStrip jobId={jobId} />
      {/* A checklist per stage (punch list #164, PR 3): the job's stages with a checklist, each opening its sheet.
          Nothing while no stage has a question to answer (punch list #384): the job window keeps the empty rows. */}
      <JobStageChecklistStrip jobId={jobId} rev={updatesRev} plansUrl={contact?.job_plans_link} hideWhileEmpty />
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
              {ourLead ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="job-mode-our-lead">
                  <span style={{ fontWeight: 600, color: 'var(--text-gray-800)' }}>{ourLead.name}</span> {ourLead.note}
                </span>
              ) : null}
              {ourLead?.phone ? (
                <button type="button" style={contactLinkBtn} aria-label={`Call ${ourLead.name} at ${ourLead.phone}`} onClick={() => openInExternalBrowser(`tel:${ourLead.phone}`)}>
                  {ourLead.phone}
                </button>
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
          tagJobId={jobId}
          tagViewerId={authUser?.id ?? null}
          onSubmitTagged={(tagged) => void threadNotes.submitNote(tagged)}
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
