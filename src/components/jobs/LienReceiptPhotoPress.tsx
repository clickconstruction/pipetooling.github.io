import { useRef, useState, type CSSProperties } from 'react'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import { putJobFolderFile } from '../../lib/jobs/jobFolderAddFileIo'
import { addFileTooBig } from '../../lib/jobs/jobFolderAddFile'
import { ADD_FILE_FAILURE_WORDS, addFileCanRetry } from '../../lib/jobs/addFileFailure'
import { LIEN_SERVICE_PROOF_WORDS, lienReceiptPhotoName, receiptReadWords, type LienReceiptPaper, type LienReceiptPhotoOf } from '../../lib/jobs/lienServiceProof'
import { LIEN_RECEIPT_ACCEPT, LIEN_RECEIPT_WORDS, lienReceiptFileName, lienReceiptIsPdf, lienReceiptProblem, lienReceiptTakeOffAsk } from '../../lib/jobs/lienReceiptFile'
import { TAKE_OFF_FILE_WORDS, driveFileIdOfUrl, fileTakenOffWords, type FileTakenOff } from '../../lib/jobs/jobFolderTrash'
import { takeFileToTrash, untrashJobFolderFile } from '../../lib/jobs/jobFolderTrashIo'
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
 * **Replace** and, where the form can forget it (`onTakeOff`), **Take off**, which asks first.
 *
 * A wrong receipt taken off goes to Drive's trash (v2.7743), as a wrong mailed copy does (`jobFolderTrash.ts`). The
 * link comes off first: `onTakeOff` and `onSaved` may answer a promise, and the press waits for it, because the
 * function refuses to move a file a lien record still names. A caller whose write did not land rejects, and the file
 * stays where it is. The line under the press says where the file is now, with **Put it back** and, where a second
 * try can help, **Try again**. **Replace** sends the file it took the place of to the trash the same way. A link that
 * is not a Drive file's is only forgotten. The clerk's page is not a receipt, and its file is left alone.
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
  trash = takeFileToTrash,
  untrash = untrashJobFolderFile,
}: {
  jobId: string
  jobNumber: string
  of: LienReceiptPhotoOf
  /** The day on the form, for the file's name. */
  day: string
  /** The saved file's link, or '' when none is added yet. */
  url: string
  /**
   * The record takes the link. A caller that writes the record at once answers its write's promise, and rejects when
   * the write did not land; a caller that only holds the link in its form answers nothing.
   */
  onSaved: (url: string) => void | Promise<void>
  /** Forget the saved receipt, under the same rule. Absent = the saved receipt shows with no way to take it off. */
  onTakeOff?: () => void | Promise<void>
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
  trash?: typeof takeFileToTrash
  untrash?: typeof untrashJobFolderFile
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
  // The file whose link just came off, and where it is now: `outcome` is null while the first move is under way.
  const [off, setOff] = useState<{ url: string; id: string; after: 'take_off' | 'replace'; outcome: FileTakenOff | null; working: 'trash' | 'back' | null } | null>(null)
  const receipt = of !== 'clerk'
  const words = LIEN_SERVICE_PROOF_WORDS
  const say = label ?? (receipt ? LIEN_RECEIPT_WORDS.add : words.clerkPhoto)

  /** The file goes to Drive's trash once no record names it. Never throws: the outcome is the line under the press. */
  const toTrash = async (was: string, id: string, after: 'take_off' | 'replace') => {
    setOff({ url: was, id, after, outcome: null, working: 'trash' })
    const outcome = await trash(jobId, id)
    setOff((now) => (now && now.id === id ? (outcome ? { ...now, outcome, working: null } : null) : now))
  }

  const takeOff = async () => {
    if (!onTakeOff) return
    const was = url
    setAsking(false)
    setReadSaid('')
    setOff(null)
    try {
      await onTakeOff()
    } catch {
      // The record kept the link, and the caller said why. The file stays where it is.
      return
    }
    const id = receipt ? driveFileIdOfUrl(was) : null
    if (id) await toTrash(was, id, 'take_off')
  }

  const trashAgain = async () => {
    const o = off
    if (!o || o.working) return
    setOff({ ...o, working: 'trash' })
    const outcome = await trash(jobId, o.id)
    setOff((now) => (now && now.id === o.id ? { ...now, outcome: outcome ?? now.outcome, working: null } : now))
  }

  const putBack = async () => {
    const o = off
    if (!o || o.working || o.after !== 'take_off') return
    setOff({ ...o, working: 'back' })
    let inDrive = o.outcome?.where !== 'trash'
    try {
      if (!inDrive) {
        await untrash(jobId, o.id)
        inDrive = true
      }
      await onSaved(o.url)
      setOff((now) => (now && now.id === o.id ? null : now))
    } catch (e) {
      const said = formatErrorMessage(e, TAKE_OFF_FILE_WORDS.putBackFailed)
      // Out of the trash but not on the record: the line says the file is in Drive, and both presses still stand.
      setOff((now) => (now && now.id === o.id ? { ...now, working: null, outcome: inDrive && now.outcome?.where === 'trash' ? { where: 'drive', why: said, retry: true } : now.outcome } : now))
      showToast(said, 'error')
    }
  }

  const take = async (file: File) => {
    const was = url
    setReadSaid('')
    setFailed(null)
    setOff(null)
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
      let landed = true
      try {
        await onSaved(added.url)
      } catch {
        // The file is in Drive and the caller said why the record did not take it. Sending it again would add a second file.
        landed = false
      }
      // Replace: the record names the new file, so the one it took the place of goes to Drive's trash.
      const oldId = landed && receipt ? driveFileIdOfUrl(was) : null
      const oldGone = oldId && oldId !== driveFileIdOfUrl(added.url) ? toTrash(was, oldId, 'replace') : null
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
      await oldGone
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
  const ask = lienReceiptTakeOffAsk(url)
  const moving = off?.working != null

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
          <button type="button" disabled={asking || moving} onClick={open} aria-haspopup={compact ? undefined : 'dialog'} style={quiet}>
            {LIEN_RECEIPT_WORDS.replace}
          </button>
          {onTakeOff ? (
            <button type="button" disabled={asking || moving} onClick={() => setAsking(true)} style={quiet}>
              {LIEN_RECEIPT_WORDS.takeOff}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <button type="button" disabled={busy || moving} onClick={open} aria-haspopup={receipt && !compact ? 'dialog' : undefined} style={{ ...press, ...(receipt && !compact ? { flex: '1 1 100%' } : {}) }}>
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
        <span role="group" aria-label={ask} data-lien-receipt-ask style={{ flexBasis: '100%', display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.55rem', border: '1px solid var(--border-amber)', borderRadius: 7, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: compact ? '0.75rem' : '0.8125rem' }}>
          <span>{ask}</span>
          <button type="button" onClick={() => void takeOff()} style={{ ...press, color: 'var(--text-strong)' }}
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
      {off && !asking && !(busy && off.after === 'take_off') ? (
        <span role="status" data-lien-receipt-off={off.outcome?.where ?? 'moving'} style={{ flexBasis: '100%', display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: compact ? '0.72rem' : '0.8rem', color: 'var(--text-muted)' }}>
          <span>{off.working === 'back' ? TAKE_OFF_FILE_WORDS.puttingBack : off.working === 'trash' || !off.outcome ? TAKE_OFF_FILE_WORDS.moving : fileTakenOffWords(off.outcome, off.after)}</span>
          {off.outcome?.where === 'drive' && off.outcome.retry && !off.working ? (
            <button type="button" data-lien-receipt-trash-again onClick={() => void trashAgain()} style={{ ...press, color: 'var(--text-strong)' }}>
              {TAKE_OFF_FILE_WORDS.tryAgain}
            </button>
          ) : null}
          {off.after === 'take_off' && off.outcome && !off.working ? (
            <button type="button" data-lien-receipt-put-back onClick={() => void putBack()} style={{ ...press, color: 'var(--text-strong)' }}>
              {TAKE_OFF_FILE_WORDS.putBack}
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
