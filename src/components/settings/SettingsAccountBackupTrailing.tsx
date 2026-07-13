/** Settings → Your account: the SettingsGroup titleTrailing header — "time since manual DB backup"
 * label + export-all-backup icon button (dev only). Presentational. */
import type { UserRole } from '../../hooks/useAuth'

/** Whole days between an ISO timestamp and now (null if unparseable; clamped at 0). */
function wholeDaysSince(iso: string): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const days = Math.floor((Date.now() - t) / 86400000)
  return Math.max(0, days)
}

export default function SettingsAccountBackupTrailing({
  myRole,
  lastFullBackupAtIso,
  exportAllBackup,
  exportBackupBusy,
}: {
  myRole: UserRole | null
  lastFullBackupAtIso: string | null
  exportAllBackup: () => Promise<void> | void
  exportBackupBusy: boolean
}) {
  return (
          myRole === 'dev' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                justifyContent: 'flex-end',
                        gap: '0.5rem',
                flexShrink: 1,
                minWidth: 0,
                maxWidth: 'min(100%, 22rem)',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.35,
                  textAlign: 'right',
                }}
              >
                Time since manual DB backup:{' '}
                {lastFullBackupAtIso == null
                  ? 'Never'
                  : (() => {
                      const d = wholeDaysSince(lastFullBackupAtIso)
                      return d === null ? 'Never' : `${d} day${d === 1 ? '' : 's'}`
                    })()}
              </span>
                        <button
                          type="button"
                onClick={() => {
                  void exportAllBackup()
                }}
                disabled={exportBackupBusy}
                aria-label="Export all backup"
                title="Export all backup"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  padding: '0.35rem',
                  border: 'none',
                  borderRadius: 6,
                  background: 'transparent',
                  color: 'var(--text-700)',
                  cursor: exportBackupBusy ? 'not-allowed' : 'pointer',
                  opacity: exportBackupBusy ? 0.55 : 1,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden style={{ width: '1.25rem', height: '1.25rem', display: 'block' }}>
                  <path fill="currentColor" d="M544 269.8C529.2 279.6 512.2 287.5 494.5 293.8C447.5 310.6 385.8 320 320 320C254.2 320 192.4 310.5 145.5 293.8C127.9 287.5 110.8 279.6 96 269.8L96 352C96 396.2 196.3 432 320 432C443.7 432 544 396.2 544 352L544 269.8zM544 192L544 144C544 99.8 443.7 64 320 64C196.3 64 96 99.8 96 144L96 192C96 236.2 196.3 272 320 272C443.7 272 544 236.2 544 192zM494.5 453.8C447.6 470.5 385.9 480 320 480C254.1 480 192.4 470.5 145.5 453.8C127.9 447.5 110.8 439.6 96 429.8L96 496C96 540.2 196.3 576 320 576C443.7 576 544 540.2 544 496L544 429.8C529.2 439.6 512.2 447.5 494.5 453.8z" />
                </svg>
                        </button>
                    </div>
          ) : null
  )
}
