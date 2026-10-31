import { KEPT_READ_RETRY_LABEL, keptReadStampWords, type KeptReadTimeFormat } from '../lib/keptRead'

/**
 * The stamp at the top of a kept page (#183 PR 2, v2.6031): one line in the age chip's amber that
 * says the rows on screen are the read this device kept. *Read at 7:52 AM · reading again…* while
 * the live read runs; *Read at 7:52 AM · could not read again · Retry* once it failed, Retry being
 * the page's own read again. Each page passes its own lead: Quickfill *Counts from*, Messages
 * *Who was waiting at*, the phone's day *Your day as read at*. The page's root carries
 * `data-kept-read` beside it, so its figures mute (`index.css`).
 */
export interface KeptReadStampProps {
  /** Epoch ms the kept rows were read (`useKeptRead`'s `readAt`). */
  readAt: number
  /** The page's own words before the time; *Read at* when unset. */
  lead?: string
  /** The page's own word for the read in flight; *reading again…* when unset (Quickfill: *counting again…*). */
  again?: string
  /** The live read failed: the stamp says so and offers Retry. */
  failed?: boolean
  onRetry?: () => void
  /** The device's own zone and locale when unset; a test pins them. */
  format?: KeptReadTimeFormat
  className?: string
}

export function KeptReadStamp({ readAt, lead, again, failed = false, onRetry, format, className }: KeptReadStampProps) {
  const words = keptReadStampWords({ readAt, lead, again, failed, format })
  return (
    <p className={className ? `keptReadStamp ${className}` : 'keptReadStamp'} role="status" data-kept-read-stamp={failed ? 'failed' : 'reading'}>
      <strong>{words.stamp}</strong>
      <span aria-hidden="true"> · </span>
      <span>{words.state}</span>
      {words.retry && onRetry && (
        <>
          <span aria-hidden="true"> · </span>
          <button type="button" className="keptReadStampRetry" onClick={onRetry}>
            {KEPT_READ_RETRY_LABEL}
          </button>
        </>
      )}
    </p>
  )
}

export default KeptReadStamp
