/**
 * The sample painted map (punch list #345, PR 4): what `/way/sample` draws on Settings → What
 * customers see, so the office can look at the shared page as a customer or a driver gets it.
 * Every name and every point is made up, and no link, table or function is read to draw it.
 *
 * It sits on dry public ground near the middle of the country: scrub beside a gravel road inside
 * Glen Elder Wildlife Area in Kansas, which the state keeps, with no building near. Until v2.8311
 * it sat two kilometres off at 39.5, -98.35, which is the water of Waconda Lake, so the page's
 * road map drew the way in across a lake. `paintedWaySample.test.ts` holds it to the ground that
 * was checked: move the point, and check the new ground on the road map and the photograph first.
 */
import type { SharedPaintedMap } from './paintedMapLink'

/** Nobody's home or business: the truck gate, on the gravel road through the wildlife area. */
const AT = { lat: 39.4822, lng: -98.3632 }
/** A point so many metres east and north of there. */
const p = (eastM: number, northM: number): [number, number] => [
  Math.round((AT.lat + northM / 111_195) * 1e6) / 1e6,
  Math.round((AT.lng + eastM / (111_195 * Math.cos((AT.lat * Math.PI) / 180))) * 1e6) / 1e6,
]

export const SAMPLE_PAINTED_WAY: SharedPaintedMap = {
  name: 'The way in for deliveries',
  words: 'Start at the truck gate on the county road, not the sales entrance.',
  lines: [
    { how: 'walked', points: [p(0, 0), p(2, 22), p(4, 50), p(44, 68), p(98, 77), p(152, 82), p(180, 87)], poorParts: [], fixedByHand: true, lengthM: 213, marginM: 12, measuredFt: null, measuredHow: null },
    { how: 'drawn', points: [p(180, 87), p(188, 105)], poorParts: [], fixedByHand: false, lengthM: 20, marginM: 2.1, measuredFt: null, measuredHow: null },
  ],
  places: [
    { id: 'sample-gate', number: 1, name: 'Truck gate', words: 'Chain is looped, not locked. Close it behind you.', lat: p(1, 11)[0], lng: p(1, 11)[1], photo: false, kind: 'gate' },
    { id: 'sample-yard', number: 2, name: 'Laydown yard', words: 'Drop pipe by the blue box.', lat: p(70, 44)[0], lng: p(70, 44)[1], photo: false },
    { id: 'sample-stub', number: 3, name: 'Water stub', words: 'Blue riser at the back of the slab.', lat: p(190, 108)[0], lng: p(190, 108)[1], photo: false },
  ],
}

/** The company the sample page names: the words a real page takes from the function. */
export const SAMPLE_PAINTED_WAY_COMPANY = { name: 'Your company', phone: '' } as const
