import { describe, expect, it } from 'vitest'
import { LIEN_RUN_SCAN_FORMATS, lienRunScanOutcomeFromError, lienRunScanSupport, lienRunScanWords, trackingFromScan } from './lienRunScan'

describe('lienRunScan', () => {
  it('the press shows only where a camera can be asked for', () => {
    expect(lienRunScanSupport({ hasMediaDevices: true, secure: true })).toBe('camera')
    expect(lienRunScanSupport({ hasMediaDevices: false, secure: true })).toBe('none')
    expect(lienRunScanSupport({ hasMediaDevices: true, secure: false })).toBe('none')
  })

  it('reads the tracking number out of a USPS receipt’s barcode, a label’s digits, and leaves a courier’s code alone', () => {
    // The IMpb on a receipt: 420 + ZIP5 + the 22 digits.
    expect(trackingFromScan('42078154' + '9407111898765432109812')).toBe('9407 1118 9876 5432 1098 12')
    // With GS1 brackets and a ZIP+4.
    expect(trackingFromScan('(420)781541234(92)9407111898765432109812')).toBe('9407 1118 9876 5432 1098 12')
    // The 20 digits off a label's human line, already grouped or not.
    expect(trackingFromScan('9407 1118 9876 5432 1098')).toBe('9407 1118 9876 5432 1098')
    expect(trackingFromScan('94071118987654321098')).toBe('9407 1118 9876 5432 1098')
    // A courier's number keeps its letters.
    expect(trackingFromScan('1Z999AA10123456784')).toBe('1Z999AA10123456784')
    expect(trackingFromScan('  ')).toBe('')
    // A QR code's address comes back as it was.
    expect(trackingFromScan('https://clicktooling.com/lien-desk?run=it1&mail=1')).toBe('https://clicktooling.com/lien-desk?run=it1&mail=1')
  })

  it('says how a scan ended', () => {
    expect(lienRunScanWords('read', '9407 1118')).toBe('Read 9407 1118. Check it against the slip.')
    expect(lienRunScanWords('refused')).toBe('The camera was refused. Type the number from the slip instead.')
    expect(lienRunScanWords('no_camera')).toContain('No camera')
    expect(lienRunScanWords('no_reader')).toContain('cannot read barcodes')
    expect(lienRunScanWords('nothing')).toContain('Nothing was read')
    expect(lienRunScanWords('closed')).toBe('')
  })

  it('names a refusal by the error the camera answered with', () => {
    expect(lienRunScanOutcomeFromError({ name: 'NotAllowedError' })).toBe('refused')
    expect(lienRunScanOutcomeFromError({ name: 'NotFoundError' })).toBe('no_camera')
    expect(lienRunScanOutcomeFromError(new Error('x'))).toBe('nothing')
    expect(lienRunScanOutcomeFromError(null)).toBe('nothing')
    expect(LIEN_RUN_SCAN_FORMATS).toContain('code_128')
  })
})
