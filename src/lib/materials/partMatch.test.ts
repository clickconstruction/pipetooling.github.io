import { describe, expect, it } from 'vitest'
import {
  alreadyInBook,
  foldCode,
  foldName,
  indexBook,
  indexHouseCodes,
  matchRow,
  modelNumbersIn,
  sameModelGroups,
  sameWords,
  sizesAgree,
  sizesIn,
  wordsOf,
} from './partMatch'

// Every part, maker, model number and house number here is made up.
const BOOK = [
  { id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD', manufacturer: 'Arlo' },
  { id: 'trap', name: 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP W/C.O. & BRASS NUTS', manufacturer: 'Arlo' },
  { id: 'trapBare', name: 'AX8702-9BPC' },
  { id: 'rinse', name: 'B0133-ADF12 TANNER PRE-RINSE WALL MNT 8IN', manufacturer: 'Tanner' },
  { id: 'hyd34', name: '3/4 FROSTPROOF WALL HYDRANT 8 IN W/ KEY' },
  { id: 'hyd12', name: '1/2 FROSTPROOF WALL HYDRANT 8 IN W/ KEY' },
  { id: 'valve34', name: 'LF90QT 3/4' },
  { id: 'valve12', name: 'LF90QT 1/2IN' },
  { id: 'nipBlk', name: '1-1/2XCL BLK STL NIPP S40' },
  { id: 'nipGalv', name: '1-1/2XCL GALV STL NIPP S40' },
  { id: 'tee1', name: '4INX4INX2IN TEE CAST IRON' },
  { id: 'wye1', name: '4INX4INX2IN WYE CAST IRON' },
]
const book = indexBook(BOOK)

describe('foldCode and foldName', () => {
  it('folds a number the same however it is dashed or spaced', () => {
    expect(foldCode('AX8802XL-LR-PC')).toBe('AX8802XLLRPC')
    expect(foldCode('ax 8802xl lr pc')).toBe('AX8802XLLRPC')
    expect(foldCode(null)).toBe('')
  })
  it('folds a name past case and punctuation', () => {
    expect(foldName('  P-TRAP  w/C.O. & Brass Nuts ')).toBe('p trap w c o brass nuts')
  })
})

describe('modelNumbersIn', () => {
  it('reads a model number, folded', () => {
    expect(modelNumbersIn('AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD')).toEqual(['AX8802XLLRPC'])
    expect(modelNumbersIn('KESSLER K-4410 CLOSET CARRIER')).toEqual(['K4410'])
    expect(modelNumbersIn('889-CC MOP HANGER BRKT')).toEqual(['889CC'])
  })
  it('reads more than one, in order, once each', () => {
    expect(modelNumbersIn('JQ1996-MH TANNER MOP HGR PN: JQ1996MH LF2165LK')).toEqual(['JQ1996MH', 'LF2165LK'])
  })
  it('never takes a size or a rating for a model number', () => {
    for (const name of [
      '4INX3IN WYE PVC',
      '4INX4INX2IN TEE CAST IRON',
      '3/4INX3/4INX1/2IN TEE PEX',
      '1-1/2XCL GALV STL NIPP S40',
      '2" SCH40 PVC DWV PE PIPE',
      '60A/3P GD NF SAFETY SWITCH 240V NEMA 1',
      'SWITCH TOGGLE SP 20A 120/277V',
      '1/2 CLIP ON 105-115F AQUASTAT KIT',
      'BOLT-ON GFCI 5MA 1 POLE 10KAIC 20A',
      '1-1/2 X 1-PLASTIC PEX PRESS TEE',
      '3/4 X 1PLASTIC PEX PRESS CPLG',
      '50G COMM ELEC 480V 12.3KW 3PH',
    ]) {
      expect(modelNumbersIn(name), name).toEqual([])
    }
  })
  it('does not call a long number with no letter a model number', () => {
    expect(modelNumbersIn('512207 SUPPLY KIT')).toEqual([])
  })
})

describe('sizesIn and sizesAgree', () => {
  it('reads a mixed number however it is typed', () => {
    expect(sizesIn('1-1/2 X 1-1/4 TRAP')).toEqual([1.25, 1.5])
    expect(sizesIn('11/2 17GA P-TRAP')).toEqual([1.5, 17])
    expect(sizesIn('4INX4INX2IN TEE')).toEqual([2, 4, 4])
  })
  it('a piece of a model number typed apart is not a size', () => {
    expect(sizesIn('ARLO AX8702 9B PC P-TRAP')).toEqual([])
    expect(sizesIn('3 NO HUB CLEANOUT 4NH')).toEqual([3, 4])
  })
  it('reads a size with inch marks, a close mark or a dash after it', () => {
    expect(sizesIn("1'' PRESSURE REDUCING VALVE")).toEqual([1])
    expect(sizesIn('2XCL BLK STL NIPP')).toEqual([2])
    expect(sizesIn('1-X 3/4 PLASTIC PEX PRESS TEE')).toEqual([0.75, 1])
  })
  it('a wire gauge is its own size', () => {
    expect(sizesAgree('THHN 2/0 STR', 'THHN 4/0 STR')).toBe(false)
  })
  it('leaves a model number’s own digits out', () => {
    expect(sizesIn('AX8802XL-LR-PC ARLO SUPPLY KIT')).toEqual([])
  })
  it('strict: the two lists must be the same', () => {
    expect(sizesAgree('3/4 FROST PROOF WALL HYDRANT 8IN', '3/4 FROSTPROOF WALL HYDRANT 8 IN W/ KEY')).toBe(true)
    expect(sizesAgree('3/4 FROST PROOF WALL HYDRANT 8IN', '1/2 FROSTPROOF WALL HYDRANT 8 IN W/ KEY')).toBe(false)
  })
  it('loose: one name may leave sizes out, and may not carry a different one', () => {
    expect(sizesAgree('AX8702-9BPC', 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP', true)).toBe(true)
    expect(sizesAgree('LF90QT 3/4', 'LF90QT 1/2IN', true)).toBe(false)
  })
})

describe('wordsOf and sameWords', () => {
  it('gives each word one spelling and leaves the sizes out', () => {
    expect(wordsOf('1-1/2 Chrome Plated 17GA P-Trap w/ Cleanout')).toEqual(['cleanout', 'cp', 'p', 'trap'])
    expect(wordsOf('11/2 CP 17 GAUGE P-TRAP WITH CLEANOUT')).toEqual(['cleanout', 'cp', 'p', 'trap'])
  })
  it('the same words, spelled or abbreviated another way', () => {
    expect(sameWords('3/4 ATMOSPHERIC VACUM BREAKER', '3/4 atmospheric vac breaker')).toBe(true)
    expect(sameWords('1INX1INX1/2IN TEE COPPER', '1INX1INX1/2IN T COPPER')).toBe(true)
    expect(sameWords('MAGUIRE CP 1-1/4 PO PLUG W/OPEN GRID', 'MAGUIR CP 1-1/4 PO PLUG W/ OPEN GRID')).toBe(true)
    expect(sameWords('FROST PROOF WALL HYDRANT', 'FROSTPROOF WALL HYDRANT')).toBe(true)
  })
  it('one different word is a different part', () => {
    expect(sameWords('2X3 BLK STL NIPP S40', '2X3 GALV STL NIPP S40')).toBe(false)
    expect(sameWords('11/2IN 90 PVC', '11/2IN 90 PEX')).toBe(false)
    expect(sameWords('3IN T PVC', '3IN Y PVC')).toBe(false)
    expect(sameWords('PROPRESS 1/2 FEMALE ADAPTER', 'PROPRESS 1/2 MALE ADAPTER')).toBe(false)
    expect(sameWords('3/4IN BALL VALVE CPVC', '3/4IN BALL VALVE PVC')).toBe(false)
    expect(sameWords('1/2IN COPPER', '1/2IN T COPPER')).toBe(false)
    expect(sameWords('P-TRAP W/ CLEANOUT', 'P-TRAP L/ CLEANOUT')).toBe(false)
    expect(sameWords('MR-375', 'MR-370')).toBe(false)
  })
})

describe('matchRow', () => {
  it('finds a part by its model number however the dashes fall', () => {
    const m = matchRow({ description: 'ARLO AX8802XL LR PC SUPPLY KIT' }, book)
    expect(m.how).toBe('model_number')
    expect(m.part?.id).toBe('kit')
    expect(m.model).toBe('AX8802XLLRPC')
  })
  it('reads the model number from the row’s own column too', () => {
    const m = matchRow({ mfrNumber: 'b0133adf12', description: 'PRE RINSE SPRAY WALL MNT 8"' }, book)
    expect(m.how).toBe('model_number')
    expect(m.part?.id).toBe('rinse')
  })
  it('one model number on two parts: both come back and neither is picked', () => {
    const m = matchRow({ description: 'AX87029BPC ARLO 1-1/2 17GA P-TRAP' }, book)
    expect(m.how).toBe('model_number')
    expect(m.part).toBeNull()
    expect(m.rivals.map((p) => p.id).sort()).toEqual(['trap', 'trapBare'])
  })
  it('a model number shared by two sizes matches only the size named', () => {
    const m = matchRow({ description: 'LF90-QT 3/4 BALL VALVE' }, book)
    expect(m.part?.id).toBe('valve34')
  })
  it('the same name, punctuated another way', () => {
    const m = matchRow({ description: '4inx4inx2in tee, cast iron' }, book)
    expect(m.how).toBe('same_name')
    expect(m.part?.id).toBe('tee1')
  })
  it('the words are offered only where every size agrees', () => {
    const m = matchRow({ description: '3/4 FROST PROOF WALL HYDRANT 8IN WITH KEY' }, book)
    expect(m.how).toBe('words')
    expect(m.part?.id).toBe('hyd34')
    expect(m.rivals.map((p) => p.id)).not.toContain('hyd12')
  })
  it('a word more or a word less is another part', () => {
    expect(matchRow({ description: '3/4 FROSTPROOF WALL HYDRANT 8 IN' }, book).how).toBe('none')
    expect(matchRow({ description: '4INX4INX2IN CAST IRON' }, book).how).toBe('none')
  })
  it('a few letters apart is another part: black and galvanized, a tee and a wye', () => {
    expect(matchRow({ description: '1-1/2XCL BRASS NIPP S40' }, book).how).toBe('none')
    expect(matchRow({ description: '4INX4INX2IN Y CAST IRON' }, book).part?.id).toBe('wye1')
    expect(matchRow({ description: '4INX4INX2IN T CAST IRON' }, book).part?.id).toBe('tee1')
  })
  it('a different size of a part on file is nothing on file', () => {
    expect(matchRow({ description: '1 FROSTPROOF WALL HYDRANT 8 IN W/ KEY' }, book).how).toBe('none')
  })
  it('nothing on file', () => {
    const m = matchRow({ description: 'NORDIC NW-2BL BI-LEVEL COOLER W/ BOTTLE FILLER' }, book)
    expect(m).toEqual({ how: 'none', part: null, rivals: [], model: null })
  })

  const codes = indexHouseCodes([
    { supplyHouseId: 'hill', code: '512207', partId: 'kit' },
    { supplyHouseId: 'hill', code: '440118', partId: null, notAPart: true },
    { supplyHouseId: 'bord', code: '77120-B', partId: 'rinse' },
  ])
  it('the house’s own number wins, whatever the words say', () => {
    const m = matchRow({ supplyHouseId: 'hill', houseCode: '512207', description: 'SUPPLY KIT' }, book, codes)
    expect(m.how).toBe('house_number')
    expect(m.part?.id).toBe('kit')
  })
  it('a house’s number means nothing under another house', () => {
    const m = matchRow({ supplyHouseId: 'bord', houseCode: '512207', description: 'SUPPLY KIT' }, book, codes)
    expect(m.how).toBe('none')
  })
  it('a catch-all number is never matched to a part', () => {
    const m = matchRow({ supplyHouseId: 'hill', houseCode: '440118', description: 'MISC CHARGE' }, book, codes)
    expect(m.how).toBe('not_a_part')
    expect(m.part).toBeNull()
  })
  it('the same part under two houses’ numbers: the second house finds it by the model number', () => {
    const m = matchRow({ supplyHouseId: 'hill', houseCode: '277310', description: 'B0133-ADF12 TANNER BRASS EZ-INSTALL PRE RINSE SPRAY WALL MNT 8"' }, book, codes)
    expect(m.how).toBe('model_number')
    expect(m.part?.id).toBe('rinse')
  })
  it('leaves out the part being edited', () => {
    expect(matchRow({ description: 'AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD' }, book, undefined, 'kit').how).toBe('none')
  })
})

describe('alreadyInBook', () => {
  it('says nothing while the name is too short', () => {
    expect(alreadyInBook('AX8', book)).toBeNull()
  })
  it('names the part by its model number', () => {
    const w = alreadyInBook('ARLO AX8802XL LR PC SUPPLY KIT', book)
    expect(w?.headline).toBe('Already in the book, by its model number.')
    expect(w?.parts.map((p) => p.id)).toEqual(['kit'])
  })
  it('names the part by its name', () => {
    expect(alreadyInBook('1-1/2xcl blk stl nipp s40', book)?.how).toBe('same_name')
  })
  it('a name that differs only by a size raises nothing', () => {
    expect(alreadyInBook('2XCL BLK STL NIPP S40', book)).toBeNull()
    expect(alreadyInBook('1 FROSTPROOF WALL HYDRANT 8 IN W/ KEY', book)).toBeNull()
  })
  it('a new name raises nothing', () => {
    expect(alreadyInBook('NORDIC NW-2BL BI-LEVEL COOLER', book)).toBeNull()
  })
})

describe('sameModelGroups', () => {
  it('groups two spellings of one model number and leaves two sizes apart', () => {
    const groups = sameModelGroups(BOOK)
    expect(groups.map((g) => g.parts.map((p) => p.id).sort())).toEqual([['trap', 'trapBare']])
  })
})
