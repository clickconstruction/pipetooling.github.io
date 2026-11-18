import { useRef, useState, type CSSProperties } from 'react'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import { putJobFolderFile } from '../../lib/jobs/jobFolderAddFileIo'
import { addFileTooBig } from '../../lib/jobs/jobFolderAddFile'
import { ADD_FILE_FAILURE_WORDS, addFileCanRetry } from '../../lib/jobs/addFileFailure'
import { LIEN_SERVICE_PROOF_WORDS, lienReceiptPhotoName, receiptReadWords, type LienReceiptPaper, type LienReceiptPhotoOf } from '../../lib/jobs/lienServiceProof'
import { LIEN_RECEIPT_ACCEPT, LIEN_RECEIPT_WORDS, lienReceiptFileName, lienReceiptIsPdf, lienReceiptProblem } from '../../lib/jobs/lienReceiptFile'
import { readTrackingFromPhoto } from '../../lib/jobs/lienReceiptReadIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { PhoneSheet } from '../PhoneSheet'

/**
 * One file of a lien paper's proof (punch list #314, change 5): a certified mail receipt for a copy, or a photo of the
 * clerk's stamped page.
 *
 * A receipt is a photo or a PDF (`lienReceiptFile.ts`): the press reads **Add the receipt** on every screen. On a
 * computer it opens the picker. On a phone it opens a sheet with **Take a photo** and **Choose a photo or a PDF**. A
 * photo is shrunk on the device, as a box photo is; a PDF goes up as it is. The clerk's page stays a photo, since its
 * scan has a press of its own (`LienFiledScanPress`).
 *
 * The file goes to the job's Drive folder under Team only, Sent by us, the moment it is picked, so a failure shows
 * here and not after the record is saved. The link comes back through `onSaved`. A saved receipt shows **Open**,
 * **Replace** and, where the form can forget it (`onTakeOff`), **Take off**, which asks first and leaves the file in Drive.
 *
 * With `onRead` (a § 53.056 notice's sends, v2.7557) the press also reads the certified mail number off a photo's
 * barcode and hands it to the form, and says under the press what it read or that it read none. A PDF is not read.
 *
 * A file that does not go up stays in hand (v2.7635): the reason stands under the press, and where a second try can
 * get past it (a lost connection, a busy Drive) **Try again** sends the same file, so nobody takes the photo twice.
 */
export function LienReceiptPhotoPress({
  jobId,
  jobNumber,
  of,
  day,
  url,
  onSaved,
  onTakeOff,
  label,
  compact,
  paper = 'affidavit',
  onRead,
  read = readTrackingFromPhoto,
  put = putJobFolderFile,
}: {
  jobId: string
  jobNumber: string
  of: LienReceiptPhotoOf
  /** The day on the form, for the file's name. */
  day: string
  /** The saved file's link, or '' when none is added yet. */
  url: string
  onSaved: (url: string) => void
  /** Forget the saved receipt. Absent = the saved receipt shows with no way to take it off. */
  onTakeOff?: () => void
  /** The press's words; the receipt's by default. */
  label?: string
  /** The computer's record box draws small presses; the phone's sheet draws them 44 px tall. */
  compact?: boolean
  /** Which paper the receipt is for, for the file's name. */
  paper?: LienReceiptPaper
  /** Read the number off the photo and hand it here; absent, the press only saves the file. */
  onRead?: (tracking: string) => void
  read?: typeof readTrackingFromPhoto
  put?: typeof putJobFolderFile
}) {
  const { showToast } = useToastContext()
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [readSaid, setReadSaid] = useState('')
  const [sheet, setSheet] = useState(false)
  const [asking, setAsking] = useState(false)
  // The file that did not go up, with its reason; `retry` is whether the same file can go again.
  const [failed, setFailed] = useState<{ file: File; words: string; retry: boolean } | null>(null)
  const receipt = of !== 'clerk'
  const words = LIEN_SERVICE_PROOF_WORDS
  const say = label ?? (receipt ? LIEN_RECEIPT_WORDS.add : words.clerkPhoto)

  const take = async (file: File) => {
    setReadSaid('')
    setFailed(null)
    const problem = receipt ? lienReceiptProblem(file) : null
    if (problem) {
      setFailed({ file, words: problem, retry: false })
      showToast(problem, 'error')
      return
    }
    setBusy(true)
    try {
      const pdf = receipt && lienReceiptIsPdf(file)
      let named: File
      if (pdf) {
        named = new File([file], lienReceiptFileName({ of, jobNumber, ymd: day, file, shrunk: false, paper }), { type: 'application/pdf' })
      } else {
        const shot = await shrinkPhoto(file)
        // A shot the browser could not decode goes as it came, under its own extension.
        const name = receipt ? lienReceiptFileName({ of, jobNumber, ymd: day, file, shrunk: shot.shrunk, paper }) : lienReceiptPhotoName(of, jobNumber, day, shot.shrunk ? 'jpg' : (file.name.split('.').pop() ?? 'jpg'), paper)
        named = new File([shot.blob], name, { type: shot.shrunk ? 'image/jpeg' : file.type || 'application/octet-stream' })
        if (addFileTooBig(named.size)) throw new Error('That file is over 10 MB. Take the photo again, closer to the paper.')
      }
      const added = await put(jobId, 'sent', named)
      onSaved(added.url)
      if (onRead) {
        if (pdf) {
          setReadSaid(LIEN_RECEIPT_WORDS.pdfNotRead)
        } else {
          // The number off the full-size shot, which keeps more of the barcode than the shrunk copy.
          const tracking = await read(file)
          if (tracking) onRead(tracking)
          setReadSaid(receiptReadWords(tracking))
        }
      }
    } catch (e) {
      const said = formatErrorMessage(e, receipt ? LIEN_RECEIPT_WORDS.failed : 'Could not save the photo.')
      setFailed({ file, words: said, retry: addFileCanRetry(e) })
      showToast(said, 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
      if (camera.current) camera.current.value = ''
    }
  }

  const press: CSSProperties = compact
    ? { padding: '0.3rem 0.7rem', fontSize: '0.78rem', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: busy ? 'wait' : 'pointer' }
    : { minHeight: 44, padding: '0 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: busy ? 'wait' : 'pointer' }
  // A second press beside a saved receipt: words alone on a computer, a thumb tall on a phone.
  const quiet: CSSProperties = compact ? { padding: 0, fontSize: '0.75rem', fontWeight: 600, background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' } : { ...press, flex: '1 1 8rem' }
  const openLink: CSSProperties = compact
    ? { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)' }
    : { ...press, flex: '1 1 8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-link)', textDecoration: 'none' }
  const sheetRow: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', minHeight: 52, padding: '0.6rem 1rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '1rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }
  const sheetSub: CSSProperties = { fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }

  // A receipt on a phone asks which way first; everything else opens the picker.
  const open = () => (receipt && !compact ? setSheet(true) : input.current?.click())
  const saved = !!url && !busy

  return (
    <span data-lien-receipt-photo={of} style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', minWidth: 0, ...(compact ? {} : { width: '100%' }) }}>
      <input
        ref={input}
        type="file"
        accept={receipt ? LIEN_RECEIPT_ACCEPT : 'image/*'}
        {...(receipt ? {} : { capture: 'environment' as const })}
        aria-label={say}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void take(file)
        }}
        style={{ display: 'none' }}
      />
      {receipt && !compact ? (
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label={`${say}: ${LIEN_RECEIPT_WORDS.photo}`}
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void take(file)
          }}
          style={{ display: 'none' }}
        />
      ) : null}
      {receipt && saved ? (
        <>
          <span data-lien-receipt-saved style={{ fontSize: compact ? '0.75rem' : '0.875rem', fontWeight: 700, color: 'var(--text-green-800)', ...(compact ? {} : { flexBasis: '100%' }) }}>✓ {LIEN_RECEIPT_WORDS.saved}</span>
          <a href={url} target="_blank" rel="noreferrer" aria-label="Open the receipt" style={openLink}>
            {compact ? `${LIEN_RECEIPT_WORDS.open} ›` : 'Open the receipt'}
          </a>
          <button type="button" disabled={asking} onClick={open} aria-haspopup={compact ? undefined : 'dialog'} style={quiet}>
            {LIEN_RECEIPT_WORDS.replace}
          </button>
          {onTakeOff ? (
            <button type="button" disabled={asking} onClick={() => setAsking(true)} style={quiet}>
              {LIEN_RECEIPT_WORDS.takeOff}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <button type="button" disabled={busy} onClick={open} aria-haspopup={receipt && !compact ? 'dialog' : undefined} style={{ ...press, ...(receipt && !compact ? { flex: '1 1 100%' } : {}) }}>
            {busy ? (receipt ? LIEN_RECEIPT_WORDS.saving : words.saving) : url ? words.again : say}
          </button>
          {url && !busy ? (
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: compact ? '0.75rem' : '0.8125rem', fontWeight: 600, color: 'var(--text-link)' }}>
              {words.saved} ›
            </a>
          ) : null}
        </>
      )}
      {asking && onTakeOff ? (
        <span role="group" aria-label={LIEN_RECEIPT_WORDS.takeOffAsk} data-lien-receipt-ask style={{ flexBasis: '100%', display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.55rem', border: '1px solid var(--border-amber)', borderRadius: 7, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: compact ? '0.75rem' : '0.8125rem' }}>
          <span>{LIEN_RECEIPT_WORDS.takeOffAsk}</span>
          <button
            type="button"
            onClick={() => {
              setAsking(false)
              setReadSaid('')
              onTakeOff()
            }}
            style={{ ...press, color: 'var(--text-strong)' }}
          >
            {LIEN_RECEIPT_WORDS.takeOffConfirm}
          </button>
          <button type="button" onClick={() => setAsking(false)} style={{ ...press, color: 'var(--text-strong)' }}>
            {LIEN_RECEIPT_WORDS.keep}
          </button>
        </span>
      ) : null}
      {failed && !busy ? (
        <span role="alert" data-lien-receipt-failed style={{ flexBasis: '100%', display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: compact ? '0.72rem' : '0.8rem', color: 'var(--text-red-700)' }}>
          {failed.words}
          {failed.retry ? (
            <button type="button" data-lien-receipt-retry onClick={() => void take(failed.file)} style={{ ...press, color: 'var(--text-strong)' }}>
              {ADD_FILE_FAILURE_WORDS.tryAgain}
            </button>
          ) : null}
        </span>
      ) : null}
      {readSaid && !busy ? (
        <span role="status" data-lien-receipt-read style={{ flexBasis: '100%', fontSize: compact ? '0.72rem' : '0.8rem', color: 'var(--text-muted)' }}>
          {readSaid}
        </span>
      ) : null}
      {sheet ? (
        <PhoneSheet label={say} title={say} width={420} onClose={() => setSheet(false)}>
          <div role="menu" aria-label={say} data-lien-receipt-sheet style={{ display: 'grid', paddingBottom: '0.25rem' }}>
            <button
              type="button"
              role="menuitem"
              style={sheetRow}
              onClick={() => {
                setSheet(false)
                camera.current?.click()
              }}
            >
              {LIEN_RECEIPT_WORDS.photo}
              <span style={sheetSub}>{LIEN_RECEIPT_WORDS.photoSub}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              style={sheetRow}
              onClick={() => {
                setSheet(false)
                input.current?.click()
              }}
            >
              {LIEN_RECEIPT_WORDS.choose}
              <span style={sheetSub}>{LIEN_RECEIPT_WORDS.chooseSub}</span>
            </button>
            <span style={{ ...sheetSub, padding: '0.5rem 1rem 0' }}>{LIEN_RECEIPT_WORDS.where}</span>
            <button type="button" role="menuitem" style={{ ...sheetRow, borderBottom: 'none', alignItems: 'center', color: 'var(--text-muted)' }} onClick={() => setSheet(false)}>
              {LIEN_RECEIPT_WORDS.notNow}
            </button>
          </div>
        </PhoneSheet>
      ) : null}
    </span>
  )
}

export default LienReceiptPhotoPress
