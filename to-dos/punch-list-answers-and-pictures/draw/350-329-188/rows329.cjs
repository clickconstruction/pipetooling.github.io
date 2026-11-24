// Invented rows for #329: cages G1 to G77 on Cedar Bend Apartments, building C, and one reserved run.
const id = (group, n) => `00000000-0000-4194-${group}-${String(n).padStart(12, '0')}`
const JOB = id('8002', 3)
const ROSA = '00000000-0000-4194-8000-000000000003'
const PLACE = (n) => id('8f01', n)
const BOX = (n) => id('8f02', n)
const at = (day, time = '15:00:00') => `${day}T${time}.000Z`
const places = [
  { id: PLACE(1), job_id: JOB, name: 'Laydown yard', created_at: at('2026-10-01'), created_by: ROSA, painted_map_id: null },
  { id: PLACE(2), job_id: JOB, name: 'Building C, level 1', created_at: at('2026-10-01'), created_by: ROSA, painted_map_id: null },
]
const said = ['2 in. PVC fittings', 'Closet flanges and wax rings', 'Tub and shower valves', '3/4 in. PEX and crimp rings', 'Water heater pans', 'Lavatory faucets', 'Angle stops and supply lines', 'Hangers and strut']
const boxes = []
for (let n = 1; n <= 77; n++) {
  boxes.push({ id: BOX(n), job_id: JOB, label: `G${n}`, kind: 'cage', where_note: n % 9 === 0 ? 'by the north stair' : '', description: said[n % said.length], place_id: n <= 50 ? PLACE(1) : PLACE(2), lat: null, lng: null, retired_at: null,
    created_at: at('2026-10-0' + (1 + (n % 8)), `1${n % 10}:00:00`), created_by: ROSA, label_printed_at: n <= 60 ? at('2026-10-12') : null, pinned_at: null, pinned_by: null, pinned_by_name: null, pin_accuracy_m: null, code: `LB${String(n).padStart(6, '0')}` })
}
const parts = [['2 in. PVC 90', 'Sample Pipe Co.', 40], ['Closet flange, 4 x 3', 'Sample Pipe Co.', 16], ['Tub and shower valve', 'Sample Brass', 8], ['3/4 in. PEX, 100 ft coil', 'Sample Pipe Co.', 6]]
const movements = []
for (let n = 1; n <= 24; n++) {
  const [name, maker, qty] = parts[n % parts.length]
  movements.push({ id: id('8f03', n), job_id: JOB, part_id: null, part_name: name, manufacturer: maker, quantity: qty, reason: 'delivered', from_container_id: null, to_container_id: BOX(n), note: '', source: 'phone', item_id: null, by_user_id: ROSA, by_name: 'Rosa Sample', at: at('2026-10-14', '16:00:00'), take_id: null, recorded_at: at('2026-10-14', '16:00:00'), taken_back_at: null })
}
module.exports = { JOB, BOX, PLACE, id, extra: { tables: { job_places: places, job_containers: boxes, job_material_movements: movements } } }
// State 2: the run G78 to G300 is reserved, none on a box yet.
const RUN = id('8f04', 1)
const hex = (n) => (((n * 2654435761) >>> 0).toString(16).toUpperCase().padStart(8, '0'))
const names = []
for (let n = 78; n <= 300; n++) names.push(`G${n}`)
const run = { id: RUN, job_id: JOB, sticker_count: names.length, first_number: 3, last_number: 2 + names.length, copies: 1, names, name_first: 'G78', name_last: 'G300', printed_by: ROSA, printed_by_name: 'Rosa Sample', printed_at: at('2026-11-17', '16:30:00') }
const stickers = names.map((name, i) => ({ id: id('8f05', i + 1), run_id: RUN, number: 3 + i, code: hex(i + 7), box_name: name, container_id: null, lost_at: null, printed_at: at('2026-11-17', '16:40:00'), created_at: at('2026-11-17', '16:30:00'), placed_at: null, placed_by: null, placed_by_name: '' }))
module.exports.RUN = RUN
module.exports.stickers = stickers
module.exports.reserved = { tables: { ...module.exports.extra.tables, sticker_runs: [run], box_stickers: stickers } }
