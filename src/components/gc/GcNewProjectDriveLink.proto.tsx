import type { CSSProperties, Dispatch } from 'react'
import {
  SAMPLE_DRIVE_OPEN,
  SAMPLE_DRIVE_RESTRICTED,
  driveAccessStandIn,
  driveLink,
  shortDate,
  type GcAction,
  type PlanSet,
} from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'
import { FIELD_HEIGHT_PX } from './GcNewProjectPickerRows'

/**
 * GC mode design spike: the plans live in Google Drive (the owner, 2026-10-04: "I want to always
 * have it go to a Google Drive link where there is a notification that says this link is accessible
 * by anyone, this works, versus this link is only accessible by some, please correct"). A link only
 * some people can open is a warning, never a stop: "When the link is blocked and our helper cannot
 * see the link without an account, we should give a warning."
 */

/** The words for a link only some people can open: what is wrong, and how to fix it in Drive. */
export const DRIVE_RESTRICTED_WORDS =
  'Our helper could not open this link without signing in to Google, so the trades cannot either. In Drive: Share → General access → Anyone with the link → Viewer.'

const notice = (tone: 'green' | 'red' | 'amber'): CSSProperties => ({
  padding: '0.45rem 0.6rem',
  borderRadius: 6,
  fontSize: '0.82rem',
  background: tone === 'green' ? 'var(--bg-green-tint)' : tone === 'red' ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)',
  color: tone === 'green' ? 'var(--text-green-700)' : tone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-700)',
  display: 'grid',
  gap: '0.3rem',
})

/**
 * The set's Google Drive link and the notice under it. `fixed` is the prototype's stand-in for
 * the office fixing the sharing in Drive: Check again on a restricted link sets it.
 */
export function DriveLinkField({
  url,
  onUrl,
  fixed,
  onCheckAgain,
  label = 'Google Drive link to the plans',
}: {
  url: string
  onUrl: (url: string) => void
  fixed: boolean
  onCheckAgain: () => void
  label?: string
}) {
  const typed = url.trim() !== ''
  const link = typed ? driveLink(url) : null
  const check = typed ? driveAccessStandIn(url, fixed) : null
  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.875rem' }}>
      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <input
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…"
          style={{ ...input, width: '100%', boxSizing: 'border-box', height: FIELD_HEIGHT_PX }}
        />
      </label>
      {!typed && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          <span>Every company we ask opens the plans from this link.</span>
          <Btn kind="quiet" onClick={() => onUrl(SAMPLE_DRIVE_OPEN)}>Try a made-up open link</Btn>
          <Btn kind="quiet" onClick={() => onUrl(SAMPLE_DRIVE_RESTRICTED)}>Try a made-up restricted link</Btn>
        </div>
      )}
      {typed && !link && (
        <div role="status" style={notice('amber')}>
          This is not a Google Drive link. It looks like drive.google.com/file/d/… or drive.google.com/drive/folders/….
        </div>
      )}
      {check?.access === 'anyone' && (
        <div role="status" style={notice('green')}>
          <span>
            <strong>Anyone with the link can open it.</strong> This works.
          </span>
          {check.assumed && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>The prototype cannot reach Drive, so it treats this link as open.</span>
          )}
          {fixed && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>The prototype treats Check again as the sharing fixed in Drive.</span>}
        </div>
      )}
      {check?.access === 'restricted' && (
        <div role="status" style={notice('red')}>
          <span>
            <strong>Only some people can open this link.</strong> Please correct it. {DRIVE_RESTRICTED_WORDS} Then press Check again.
          </span>
          <div>
            <Btn onClick={onCheckAgain}>Check again</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * A set's Drive link where the set is shown: Open in Google Drive, and the warning while only some
 * people can open it, with Check again when `dispatch` is given. Nothing when the set has no link.
 */
export function PlanSetDriveLine({ projectId, set, dispatch }: { projectId: string; set: PlanSet; dispatch?: Dispatch<GcAction> }) {
  const drive = set.drive
  if (!drive) return null
  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <a href={drive.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>
          Open in Google Drive ↗
        </a>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {drive.access === 'anyone' ? 'anyone with the link can open it' : 'only some people can open it'} · checked {shortDate(drive.checkedOn)}
        </span>
      </div>
      {drive.access === 'restricted' && (
        <div style={notice('red')}>
          <span>
            {DRIVE_RESTRICTED_WORDS} {dispatch ? 'Then press Check again.' : 'Then check it again on the Plans tab.'}
          </span>
          {dispatch && (
            <div>
              <Btn
                onClick={() =>
                  // The prototype's stand-in: Check again reads the link as fixed in Drive.
                  dispatch({ type: 'checkPlanSetDrive', projectId, rev: set.rev, access: driveAccessStandIn(drive.url, true)?.access ?? 'restricted' })
                }
              >
                Check again
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
