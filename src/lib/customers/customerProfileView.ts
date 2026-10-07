import { readDeviceString, writeDeviceString } from '../deviceString'

/**
 * The Customer profile window's two views (punch list #97): the Profile and the Timeline.
 * The last one picked is remembered on the device; a door that names a view wins.
 */
export type CustomerProfileView = 'profile' | 'timeline'

export const CUSTOMER_PROFILE_VIEW_KEY = 'customer-profile-view'

export function parseCustomerProfileView(raw: string | null | undefined): CustomerProfileView {
  return raw === 'timeline' ? 'timeline' : 'profile'
}

export function readCustomerProfileView(): CustomerProfileView {
  try {
    return parseCustomerProfileView(readDeviceString(CUSTOMER_PROFILE_VIEW_KEY))
  } catch {
    return 'profile'
  }
}

export function writeCustomerProfileView(view: CustomerProfileView): void {
  try {
    writeDeviceString(CUSTOMER_PROFILE_VIEW_KEY, view)
  } catch {
    // A device that will not store it opens on the Profile next time.
  }
}
