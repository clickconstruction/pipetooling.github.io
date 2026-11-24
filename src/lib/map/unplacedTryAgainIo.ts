/**
 * **Try again** on an address the map cannot place (punch list #408, step 3): one call to
 * `geocode-address-batch` for the one address, with `retry: true`, so the function asks the map
 * services past its memory of the miss. The answer is read by `tryAgainOutcome`. It never throws:
 * a failed ask comes back as an outcome that carries its reason.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import { normalizeAddressForGeocodeKey } from './normalizeAddressForGeocode'
import { tryAgainOutcome, type TryAgainOutcome } from './unplacedMemory'

export async function tryPlaceAgain(addressLabel: string): Promise<TryAgainOutcome> {
  const key = normalizeAddressForGeocodeKey(addressLabel)
  try {
    const { data, error } = await supabase.functions.invoke('geocode-address-batch', { body: { addresses: [addressLabel], retry: true } })
    if (error) {
      const said = await readEdgeFunctionErrorBody(error).catch(() => null)
      return { kind: 'failed', reason: said || formatErrorMessage(error, 'The request did not go through.') }
    }
    return tryAgainOutcome(data, key)
  } catch (e) {
    return { kind: 'failed', reason: formatErrorMessage(e, 'The request did not go through.') }
  }
}
