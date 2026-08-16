import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, Dispatch, MutableRefObject, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobFormBidLinkTitle, type JobFormLinkedBidSummary } from '../../lib/jobs/jobFormBidLinkTitle'
import { developmentPickerOptions, type JobFormDevelopmentRow } from '../../lib/jobs/jobDevelopments'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'

const projectFilesPlansJumpLinkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  color: 'var(--text-link)',
  font: 'inherit',
  fontWeight: 400,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
}

const projectFilesPlansPlainSegmentStyle: CSSProperties = {
  fontWeight: 400,
  color: 'var(--text-muted)',
  fontSize: 'inherit',
}

const projectFilesPlansPipeStyle: CSSProperties = {
  color: 'var(--text-faint)',
  userSelect: 'none',
  fontWeight: 400,
  fontSize: 'inherit',
}

/** Structural subset of the shell's ProjectOption the section reads. */
type LinksSectionProject = {
  id: string
  name: string
  customer_id: string
  customers: { name: string } | null
}

/**
 * The Project select-or-disconnect editor. Shared by the classic (New Job)
 * links section and the Edit-tab fact rows (v2.1681).
 */
export function JobFormProjectEditor({
  projectId,
  setProjectId,
  customerId,
  setCustomerId,
  projects,
  projectDisconnectRef,
  projectSelectRef,
  showLabel = true,
}: {
  projectId: string | null
  setProjectId: (v: string | null) => void
  /** Selecting a project implies the project's customer when none is linked yet. */
  customerId: string | null
  setCustomerId: (v: string | null) => void
  projects: LinksSectionProject[]
  /** Shell-owned so the project-link modal's onLinked can focus it after linking. */
  projectDisconnectRef: MutableRefObject<HTMLButtonElement | null>
  projectSelectRef?: MutableRefObject<HTMLSelectElement | null>
  showLabel?: boolean
}) {
  const { showToast } = useToastContext()
  return (
    <>
      {showLabel ? (
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Project</label>
      ) : null}
      {projectId ? (
        (() => {
          const linkedName = projects.find((p) => p.id === projectId)?.name ?? 'project'
          const disconnectLabel = `Disconnect from ${linkedName}`
          return (
            <>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                Linked to: <strong>{linkedName}</strong>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {/* One-click open lived on the header's "Link to" cluster until
                    v2.1695 retired it — the Bid editor's "Open cover letter" twin. */}
                <Link
                  to={`/workflows/${projectId}`}
                  aria-label="Open linked project workflow"
                  style={{
                    fontSize: '0.875rem',
                    padding: '0.35rem 0.65rem',
                    background: 'var(--bg-blue-tint)',
                    color: 'var(--text-blue-700)',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Open project
                </Link>
                <button
                  ref={projectDisconnectRef}
                  type="button"
                  onClick={() => {
                    setProjectId(null)
                    showToast('Unlinked from project. Save the job to apply.', 'info')
                  }}
                  title={disconnectLabel}
                  aria-label={disconnectLabel}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    background: 'var(--bg-subtle)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--text-700)',
                    fontWeight: 500,
                  }}
                >
                  {disconnectLabel}
                </button>
              </div>
            </>
          )
        })()
      ) : (
        <>
          <select
            ref={projectSelectRef}
            value={projectId ?? ''}
            aria-label="Project"
            onChange={(e) => {
              const pid = e.target.value || null
              setProjectId(pid)
              if (pid) {
                const proj = projects.find((p) => p.id === pid)
                if (proj && !customerId) {
                  setCustomerId(proj.customer_id)
                }
              }
            }}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.customers?.name ? ` (${p.customers.name})` : ''}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            Link job to a multi-phase project for billing after each phase
          </span>
        </>
      )}
    </>
  )
}

/** The Bid link-or-disconnect editor (+ "Open cover letter"). Shared like {@link JobFormProjectEditor}. */
export function JobFormBidEditor({
  bidId,
  setBidId,
  linkedBidSummary,
  setLinkedBidSummary,
  onOpenBidLinkChoice,
  bidDisconnectRef,
  bidLinkButtonRef,
  showLabel = true,
}: {
  bidId: string | null
  setBidId: (v: string | null) => void
  linkedBidSummary: JobFormLinkedBidSummary | null
  setLinkedBidSummary: (v: JobFormLinkedBidSummary | null) => void
  onOpenBidLinkChoice: () => void
  bidDisconnectRef?: MutableRefObject<HTMLButtonElement | null>
  bidLinkButtonRef?: MutableRefObject<HTMLButtonElement | null>
  showLabel?: boolean
}) {
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  return (
    <>
      {showLabel ? (
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Bid proposal</label>
      ) : null}
      {bidId ? (
        <>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
            Linked: <strong>{formatJobFormBidLinkTitle(prefixMap, linkedBidSummary)}</strong>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <Link
              to={`/bids?bidId=${encodeURIComponent(bidId)}&tab=cover-letter`}
              style={{
                fontSize: '0.875rem',
                padding: '0.35rem 0.65rem',
                background: 'var(--bg-blue-tint)',
                color: 'var(--text-blue-700)',
                borderRadius: 4,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Open cover letter
            </Link>
            <button
              ref={bidDisconnectRef}
              type="button"
              onClick={() => {
                setBidId(null)
                setLinkedBidSummary(null)
                showToast('Unlinked bid proposal. Save the job to apply.', 'info')
              }}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-subtle)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--text-700)',
                fontWeight: 500,
              }}
            >
              Disconnect bid
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            ref={bidLinkButtonRef}
            type="button"
            onClick={onOpenBidLinkChoice}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--text-link)',
              fontWeight: 500,
            }}
          >
            Link a bid proposal
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            Tie this job to a bid for quick access (optional)
          </span>
        </>
      )}
    </>
  )
}

/** The Development picker (select + inline create). Shared like {@link JobFormProjectEditor}. */
export function JobFormDevelopmentEditor({
  developmentId,
  setDevelopmentId,
  developments,
  onCreateDevelopment,
  developmentSelectRef,
  showLabel = true,
}: {
  developmentId: string | null
  setDevelopmentId: (v: string | null) => void
  developments: JobFormDevelopmentRow[]
  /** Inserts a name-only development; resolves the new id, or null on failure (shell toasts). */
  onCreateDevelopment: (name: string) => Promise<string | null>
  developmentSelectRef?: MutableRefObject<HTMLSelectElement | null>
  showLabel?: boolean
}) {
  const [newDevelopmentOpen, setNewDevelopmentOpen] = useState(false)
  const [newDevelopmentName, setNewDevelopmentName] = useState('')
  const [creatingDevelopment, setCreatingDevelopment] = useState(false)

  async function submitNewDevelopment() {
    if (creatingDevelopment) return
    setCreatingDevelopment(true)
    try {
      const newId = await onCreateDevelopment(newDevelopmentName)
      if (newId) {
        setDevelopmentId(newId)
        setNewDevelopmentName('')
        setNewDevelopmentOpen(false)
      }
    } finally {
      setCreatingDevelopment(false)
    }
  }

  return (
    <>
      {showLabel ? (
        <label
          htmlFor="job-form-development-select"
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}
        >
          <DevelopmentHouseIcon size={13} style={{ flexShrink: 0 }} />
          Development
        </label>
      ) : null}
      <select
        id="job-form-development-select"
        ref={developmentSelectRef}
        aria-label={showLabel ? undefined : 'Development'}
        value={developmentId ?? ''}
        onChange={(e) => setDevelopmentId(e.target.value || null)}
        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
      >
        <option value="">None</option>
        {developmentPickerOptions(developments, developmentId).map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
        Group this job with others in the same development for review
      </span>
      {newDevelopmentOpen ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newDevelopmentName}
            onChange={(e) => setNewDevelopmentName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submitNewDevelopment()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                setNewDevelopmentOpen(false)
                setNewDevelopmentName('')
              }
            }}
            placeholder="Development name…"
            aria-label="New development name"
            autoFocus
            style={{ flex: '1 1 10rem', minWidth: '8rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          />
          <button
            type="button"
            onClick={() => void submitNewDevelopment()}
            disabled={creatingDevelopment}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.875rem',
              border: 'none',
              background: 'var(--bg-blue-tint)',
              color: 'var(--text-blue-700)',
              borderRadius: 4,
              cursor: creatingDevelopment ? 'default' : 'pointer',
              fontWeight: 500,
              opacity: creatingDevelopment ? 0.6 : 1,
            }}
          >
            {creatingDevelopment ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => {
              setNewDevelopmentOpen(false)
              setNewDevelopmentName('')
            }}
            style={{
              padding: '0.4rem 0.65rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-subtle)',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--text-700)',
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNewDevelopmentOpen(true)}
          style={{
            marginTop: '0.5rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px dashed var(--border-strong)',
            background: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--text-link)',
            fontWeight: 500,
          }}
        >
          + New development
        </button>
      )}
    </>
  )
}

type JobFormLinksSectionProps = {
  /** Shell-owned: resetNewForm and the link-choice modal callbacks also write it. */
  expanded: boolean
  setExpanded: Dispatch<SetStateAction<boolean>>
  projectId: string | null
  setProjectId: (v: string | null) => void
  /** Selecting a project implies the project's customer when none is linked yet. */
  customerId: string | null
  setCustomerId: (v: string | null) => void
  projects: LinksSectionProject[]
  jobPlansLink: string
  setJobPlansLink: (v: string) => void
  bidId: string | null
  setBidId: (v: string | null) => void
  linkedBidSummary: JobFormLinkedBidSummary | null
  setLinkedBidSummary: (v: JobFormLinkedBidSummary | null) => void
  /** Opens the shell-level JobBidLinkChoiceModal (also opened from the header row). */
  onOpenBidLinkChoice: () => void
  /** Shell-owned so the project-link modal's onLinked can focus it after linking. */
  projectDisconnectRef: MutableRefObject<HTMLButtonElement | null>
  /** Development (group of jobs, v2.1199) — autosaves via the identity slice, like Plans. */
  developmentId: string | null
  setDevelopmentId: (v: string | null) => void
  developments: JobFormDevelopmentRow[]
  /** Inserts a name-only development; resolves the new id, or null on failure (shell toasts). */
  onCreateDevelopment: (name: string) => Promise<string | null>
}

/**
 * The collapsible "Project | Plans | Bid | Development" links section of the
 * New Job modal: jump-link row (scroll + focus into the expanded panel),
 * Project select-or-disconnect, Job Plans URL, Bid proposal link-or-disconnect
 * (+ "Open cover letter"), and the Development picker (select + inline
 * create). Project/Bid link/unlink here is staged — "Save the job to apply" —
 * in contrast to the customer block's immediate writes (map quirk #19);
 * Plans and Development ride the identity autosave slice instead. The
 * expanded flag stays shell state; the individual editors are the shared
 * {@link JobFormProjectEditor} / {@link JobFormBidEditor} /
 * {@link JobFormDevelopmentEditor} (also used by the Edit-tab fact rows,
 * v2.1681).
 */
export function JobFormLinksSection({
  expanded,
  setExpanded,
  projectId,
  setProjectId,
  customerId,
  setCustomerId,
  projects,
  jobPlansLink,
  setJobPlansLink,
  bidId,
  setBidId,
  linkedBidSummary,
  setLinkedBidSummary,
  onOpenBidLinkChoice,
  projectDisconnectRef,
  developmentId,
  setDevelopmentId,
  developments,
  onCreateDevelopment,
}: JobFormLinksSectionProps) {
  const jobFormProjectSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormProjectSelectRef = useRef<HTMLSelectElement | null>(null)
  const jobFormJobPlansSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormJobPlansInputRef = useRef<HTMLInputElement | null>(null)
  const jobFormBidSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormBidDisconnectRef = useRef<HTMLButtonElement | null>(null)
  const jobFormBidLinkButtonRef = useRef<HTMLButtonElement | null>(null)
  const jobFormDevelopmentSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormDevelopmentSelectRef = useRef<HTMLSelectElement | null>(null)

  const scrollToProjectSection = useCallback(() => {
    setExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormProjectSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        if (projectId) {
          projectDisconnectRef.current?.focus()
        } else {
          jobFormProjectSelectRef.current?.focus()
        }
      })
    })
  }, [projectId, projectDisconnectRef, setExpanded])

  const scrollToJobPlansSection = useCallback(() => {
    setExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormJobPlansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        jobFormJobPlansInputRef.current?.focus()
      })
    })
  }, [setExpanded])

  const scrollToBidSection = useCallback(() => {
    setExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormBidSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        if (bidId) {
          jobFormBidDisconnectRef.current?.focus()
        } else {
          jobFormBidLinkButtonRef.current?.focus()
        }
      })
    })
  }, [bidId, setExpanded])

  const scrollToDevelopmentSection = useCallback(() => {
    setExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormDevelopmentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        jobFormDevelopmentSelectRef.current?.focus()
      })
    })
  }, [setExpanded])

  return (
    <div style={{ marginBottom: expanded ? '0.5rem' : 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.25rem',
          width: '100%',
        }}
      >
        <button
          type="button"
          id="job-form-project-files-plans-trigger"
          aria-expanded={expanded}
          aria-controls="job-form-project-files-plans-panel"
          aria-label="Expand or collapse project, plans, bid, and development"
          onClick={() => setExpanded((p) => !p)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 'inherit',
            color: 'inherit',
            minWidth: '1.25rem',
          }}
        >
          <span aria-hidden>{expanded ? '▼' : '▶'}</span>
        </button>
        {projectId ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              scrollToProjectSection()
            }}
            style={projectFilesPlansJumpLinkStyle}
            aria-label="Show Project"
          >
            Project
          </button>
        ) : (
          <span style={projectFilesPlansPlainSegmentStyle}>Project</span>
        )}
        <span aria-hidden style={projectFilesPlansPipeStyle}>
          {' | '}
        </span>
        {jobPlansLink.trim() ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              scrollToJobPlansSection()
            }}
            style={projectFilesPlansJumpLinkStyle}
            aria-label="Show Job Plans"
          >
            Plans
          </button>
        ) : (
          <span style={projectFilesPlansPlainSegmentStyle}>Plans</span>
        )}
        <span aria-hidden style={projectFilesPlansPipeStyle}>
          {' | '}
        </span>
        {bidId ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              scrollToBidSection()
            }}
            style={projectFilesPlansJumpLinkStyle}
            aria-label="Show bid link"
          >
            Bid
          </button>
        ) : (
          <span style={projectFilesPlansPlainSegmentStyle}>Bid</span>
        )}
        <span aria-hidden style={projectFilesPlansPipeStyle}>
          {' | '}
        </span>
        {developmentId ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              scrollToDevelopmentSection()
            }}
            style={projectFilesPlansJumpLinkStyle}
            aria-label="Show development"
          >
            Development
          </button>
        ) : (
          <span style={projectFilesPlansPlainSegmentStyle}>Development</span>
        )}
      </div>
      {expanded && (
        <div
          id="job-form-project-files-plans-panel"
          role="region"
          aria-label="Project, plans, bid, and development"
          style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--border)' }}
        >
          <div ref={jobFormProjectSectionRef} style={{ marginBottom: '0.75rem' }}>
            <JobFormProjectEditor
              projectId={projectId}
              setProjectId={setProjectId}
              customerId={customerId}
              setCustomerId={setCustomerId}
              projects={projects}
              projectDisconnectRef={projectDisconnectRef}
              projectSelectRef={jobFormProjectSelectRef}
            />
          </div>
          <div ref={jobFormJobPlansSectionRef} style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Plans</label>
              <input
                ref={jobFormJobPlansInputRef}
                type="url"
                value={jobPlansLink}
                onChange={(e) => setJobPlansLink(e.target.value)}
                placeholder="https://drive.google.com/..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
          </div>
          <div ref={jobFormBidSectionRef} style={{ marginBottom: '0.75rem' }}>
            <JobFormBidEditor
              bidId={bidId}
              setBidId={setBidId}
              linkedBidSummary={linkedBidSummary}
              setLinkedBidSummary={setLinkedBidSummary}
              onOpenBidLinkChoice={onOpenBidLinkChoice}
              bidDisconnectRef={jobFormBidDisconnectRef}
              bidLinkButtonRef={jobFormBidLinkButtonRef}
            />
          </div>
          <div ref={jobFormDevelopmentSectionRef} style={{ marginBottom: '0.75rem' }}>
            <JobFormDevelopmentEditor
              developmentId={developmentId}
              setDevelopmentId={setDevelopmentId}
              developments={developments}
              onCreateDevelopment={onCreateDevelopment}
              developmentSelectRef={jobFormDevelopmentSelectRef}
            />
          </div>
        </div>
      )}
    </div>
  )
}
