/**
 * The sample painted map (punch list #345, PR 4): what `/way/sample` draws on Settings → What
 * customers see, so the office can look at the shared page as a customer or a driver gets it.
 * Every name and every point is made up. It sits in the middle of the country, on nobody's land,
 * and no link, table or function is read to draw it.
 */
import type { SharedPaintedMap } from './paintedMapLink'

/** Nobody's place: the middle of the lower 48. */
const AT = { lat: 39.5, lng: -98.35 }
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
    { id: 'sample-gate', number: 1, name: 'Truck gate', words: 'Chain is looped, not locked. Close it behind you.', lat: p(1, 11)[0], lng: p(1, 11)[1], photo: false },
    { id: 'sample-yard', number: 2, name: 'Laydown yard', words: 'Drop pipe by the blue box.', lat: p(70, 44)[0], lng: p(70, 44)[1], photo: false },
    { id: 'sample-stub', number: 3, name: 'Water stub', words: 'Blue riser at the back of the slab.', lat: p(190, 108)[0], lng: p(190, 108)[1], photo: false },
  ],
}

/** The company the sample page names: the words a real page takes from the function. */
export const SAMPLE_PAINTED_WAY_COMPANY = { name: 'Your company', phone: '' } as const
