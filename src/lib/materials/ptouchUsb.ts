/**
 * The P-touch over USB from the browser (punch list #304): the WebUSB side of `ptouchRaster.ts`. Chrome and Edge on a
 * computer have WebUSB; Safari and Firefox do not. The browser asks which device once, by its own chooser, and
 * remembers the grant, so a later visit connects with no question.
 *
 * Two rules, both learned on the PT-D610BT on 2026-11-10. Nothing may be sent while a label prints: a second label
 * sent early printed blank strips. And the printer does not always say when a label is done, so the wait is the
 * label's own length in time, cut short when the printer does say, and the next label opens with a status request the
 * printer must answer before any dots go.
 */
import { BROTHER_USB_VENDOR_ID, chainsToNext, cmdInit, cmdStatusRequest, labelPrintMs, parsePtouchStatus, PTOUCH_BUSY, PTOUCH_NOT_ANSWERING, ptouchLabelJob, ptouchTapeFits, type PtouchStatus } from './ptouchRaster'

// The slice of WebUSB this file uses; the DOM typings the app builds with do not carry it.
type UsbEndpoint = { endpointNumber: number; direction: 'in' | 'out'; type: string }
type UsbInterface = { interfaceNumber: number; alternate: { interfaceClass: number; endpoints: UsbEndpoint[] } }
type UsbDevice = {
  productName?: string
  opened: boolean
  configuration: { interfaces: UsbInterface[] } | null
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(n: number): Promise<void>
  claimInterface(n: number): Promise<void>
  transferOut(endpoint: number, data: Uint8Array): Promise<unknown>
  transferIn(endpoint: number, length: number): Promise<{ data?: DataView }>
}
type Usb = {
  requestDevice(options: { filters: Array<{ vendorId: number }> }): Promise<UsbDevice>
  getDevices(): Promise<UsbDevice[]>
}

function usb(): Usb | null {
  return typeof navigator !== 'undefined' && 'usb' in navigator ? (navigator as unknown as { usb: Usb }).usb : null
}

/** Whether this browser can reach a USB printer at all. */
export function ptouchUsbAvailable(): boolean {
  return usb() != null
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** A transfer that gives up: a printer left mid-job stops reading, and without this the window would wait for ever. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, no) => setTimeout(() => no(new Error(PTOUCH_NOT_ANSWERING)), ms))])
}

export type PtouchLink = {
  model: string
  /** The printer's last answer. */
  status: PtouchStatus
  /** Prints the labels one at a time, each cut from the next and the last fed out; `onLabel` is told how many are done. Stops at the first error with its reason. */
  print(labels: ReadonlyArray<ReadonlyArray<Uint8Array>>, onLabel?: (done: number) => void): Promise<void>
  close(): Promise<void>
}

/** The person closed the browser's device list without picking. Not an error to show. */
export class PtouchPickCancelled extends Error {
  constructor() {
    super('No printer was picked.')
    this.name = 'PtouchPickCancelled'
  }
}

async function openLink(device: UsbDevice): Promise<PtouchLink> {
  try {
    if (!device.opened) await device.open()
    if (!device.configuration) await device.selectConfiguration(1)
    const iface = device.configuration?.interfaces.find((f) => f.alternate.interfaceClass === 7) ?? device.configuration?.interfaces[0]
    const epOut = iface?.alternate.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk')?.endpointNumber
    const epIn = iface?.alternate.endpoints.find((e) => e.direction === 'in' && e.type === 'bulk')?.endpointNumber
    if (!iface || epOut == null || epIn == null) throw new Error('This USB device is not a label printer the app knows.')
    try {
      await device.claimInterface(iface.interfaceNumber)
    } catch {
      throw new Error(PTOUCH_BUSY)
    }
    const send = (bytes: Uint8Array) => within(device.transferOut(epOut, bytes), 5000)
    /** One status if the printer has one waiting, else null: a read never blocks the page. */
    const readOne = async (): Promise<PtouchStatus | null> => {
      const r = await within(device.transferIn(epIn, 32), 5000)
      if (!r.data || r.data.byteLength < 32) return null
      return parsePtouchStatus(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength))
    }
    /** Ask, then wait for the answer: the printer does not answer while it prints, so this is also the gate before a label. */
    const ask = async (tries: number): Promise<PtouchStatus> => {
      for (let attempt = 0; attempt < tries; attempt++) {
        await send(cmdInit())
        await send(cmdStatusRequest())
        const until = Date.now() + 2500
        while (Date.now() < until) {
          const st = await readOne()
          if (st && st.statusType === 0) return st
          if (st && st.errors.length > 0) return st
          await sleep(100)
        }
        await sleep(1000)
      }
      throw new Error(PTOUCH_NOT_ANSWERING)
    }
    const link: PtouchLink = {
      model: device.productName || 'P-touch',
      status: await ask(1),
      async print(labels, onLabel) {
        for (let n = 0; n < labels.length; n++) {
          const lines = labels[n]!
          const before = await ask(n === 0 ? 2 : 8)
          link.status = before
          if (before.errors.length > 0) throw new Error(before.errors.join(' '))
          if (!ptouchTapeFits(before)) throw new Error(`The printer has ${before.tapeMm} mm tape in it. Load 18 or 24 mm tape for box labels.`)
          // Every label but the run's last stays in the printer for the next to print against: one blank lead-in a run.
          for (const chunk of ptouchLabelJob(lines, before.tapeMm, chainsToNext(n, labels.length))) await send(chunk)
          // Wait out the print. The printer may say when it is done; when it does not, the label's own time is the wait.
          const until = Date.now() + labelPrintMs(lines.length)
          while (Date.now() < until) {
            const st = await readOne()
            if (st && (st.statusType === 2 || st.errors.length > 0)) throw new Error(st.errors.join(' ') || 'The printer reported an error.')
            if (st && st.statusType === 1) break
            await sleep(150)
          }
          await sleep(600)
          onLabel?.(n + 1)
        }
      },
      async close() {
        try {
          await device.close()
        } catch {
          /* already gone */
        }
      },
    }
    return link
  } catch (e) {
    try {
      await device.close()
    } catch {
      /* nothing to close */
    }
    throw e
  }
}

/**
 * Connect to the P-touch. With `ask` the browser shows its device list (a press must have called this); without it,
 * only a printer the browser already has leave to use is opened, and null means there is none.
 */
export async function connectPtouch(options: { ask: boolean }): Promise<PtouchLink | null> {
  const api = usb()
  if (!api) return null
  const known = (await api.getDevices()).find((d) => /^PT-|P-touch/i.test(d.productName ?? ''))
  if (known) return openLink(known)
  if (!options.ask) return null
  let device: UsbDevice
  try {
    device = await api.requestDevice({ filters: [{ vendorId: BROTHER_USB_VENDOR_ID }] })
  } catch {
    throw new PtouchPickCancelled()
  }
  return openLink(device)
}
