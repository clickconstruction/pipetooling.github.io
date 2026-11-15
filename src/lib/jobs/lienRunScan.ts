/**
 * Scan › on a Mailed box (v2.7331, PR B of the run's checklist): the phone's camera reads the
 * USPS receipt's barcode and the number lands in the box. Pure: what the page can do, what a
 * barcode's value is as a tracking number, and the words for each way it ends. The camera and
 * the reader live in `LienRunScanPress.tsx`.
 */

export type LienRunScanSupport = 'camera' | 'none'

/** The press shows only where a camera can be asked for: a secure page with `mediaDevices`. The reader itself is found when pressed. */
export function lienRunScanSupport(env: { hasMediaDevices: boolean; secure: boolean }): LienRunScanSupport {
  return env.hasMediaDevices && env.secure ? 'camera' : 'none'
}

/**
 * The tracking number inside a scanned value. A USPS receipt's barcode is the IMpb: the routing
 * code `420` + ZIP (5 or 9 digits) in front of the 22-digit number, sometimes with GS1 brackets
 * `(420)…(92)…`; a label's human line is the 20 or 22 digits alone. Anything else — a QR code's
 * address, a courier's letters-and-digits — comes back trimmed as it was. '' for an empty read.
 */
export function trackingFromScan(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const digits = s.replace(/\D/g, '')
  // Letters in the value: a courier's number (1Z…) or a UPS/FedEx code; keep it as read.
  if (/[A-Za-z]/.test(s) && digits.length < 20) return s
  if (digits.length === 20 || digits.length === 22) return group4(digits)
  if (digits.startsWith('420') && digits.length > 22) {
    // 420 + ZIP5 (8 digits) or 420 + ZIP9 (12 digits) in front of the 22; the number is the tail.
    const tail = digits.slice(-22)
    return group4(tail)
  }
  if (digits.length > 22) return group4(digits.slice(-22))
  return s
}

function group4(d: string): string {
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export type LienRunScanOutcome = 'read' | 'refused' | 'no_camera' | 'no_reader' | 'nothing' | 'closed'

/** What the box says after a scan ends; '' when nothing needs saying. */
export function lienRunScanWords(outcome: LienRunScanOutcome, tracking = ''): string {
  switch (outcome) {
    case 'read':
      return tracking ? `Read ${tracking}. Check it against the slip.` : ''
    case 'refused':
      return 'The camera was refused. Type the number from the slip instead.'
    case 'no_camera':
      return 'No camera on this device. Type the number from the slip instead.'
    case 'no_reader':
      return 'This browser cannot read barcodes. Type the number from the slip instead.'
    case 'nothing':
      return 'Nothing was read. Hold the slip steady under the camera, or type the number.'
    default:
      return ''
  }
}

/** The barcode kinds a USPS receipt, a label and the sheet's own code use. */
export const LIEN_RUN_SCAN_FORMATS = ['code_128', 'code_39', 'itf', 'qr_code', 'ean_13', 'upc_a'] as const

/** A refusal from `getUserMedia`, by its name: the person said no, there is no camera, or something else. */
export function lienRunScanOutcomeFromError(err: unknown): LienRunScanOutcome {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'refused'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'no_camera'
  return 'nothing'
}
