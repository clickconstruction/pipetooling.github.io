/** The dev seat's check of one plumbing number against the board's own files (punch list #411, v2.8317). */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { tsbpeFile, tsbpeRows } from '../../../supabase/functions/_shared/licenseRoll'
import {
  TSBPE_CHECK_LEVELS,
  TSBPE_CHECK_TIMEOUT_REASON,
  TSBPE_FEWEST_ROWS,
  TSBPE_LIST_URL,
  tsbpeAnswer,
  tsbpeFilesForLevel,
  tsbpeHolder,
} from '../../../supabase/functions/_shared/licenseRollCheck'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const LICENSE_TEXT = readFileSync('src/lib/logbook/licenseText.ts', 'utf8')
const LICENSE_TEXT_COPY = readFileSync('supabase/functions/_shared/gcKernels/lib/logbook/licenseText.ts', 'utf8')

// Every person, number and company here is made up. The repo is public: no line of a real state file goes in a test.
const JP = tsbpeFile('JP')!
const MP = tsbpeFile('MP')!
const RMP = tsbpeFile('RMP')!

const JP_TEXT = [
  'RANK,LICENSE_NBR,LIC_STATUS,LICENSE_DATE,EXPIRATION_DTE,LAST_NAME,FIRST_NAME,MIDDLE_NAME,SUFFIX,ZIP,COUNTY,MEDGAS_ENDR,MRF_ENDR,WS_ENDR',
  'J,000412,Current,11/12/2026,08/31/2027,FENWICK,MARLON,T,,78130,COMAL,Yes,No,No',
  'J,000209,Expired,03/04/2012,06/30/2026,QUILL,TEODORO,,JR,78666-1234,HAYS,No,No,Yes',
].join('\r\n')
const MP_TEXT = [
  'RANK,LICENSE_NBR,LIC_STATUS,LICENSE_DATE,EXPIRATION_DTE,LAST_NAME,FIRST_NAME,MIDDLE_NAME,SUFFIX,ZIP,COUNTY,MEDGAS_ENDR,MRF_ENDR,WS_ENDR',
  'M,000044,Expired,06/01/2009,05/31/2025,PRUETT,HARLAN,,,78155,GUADALUPE,No,No,No',
  'M,000051,Current,02/02/2015,01/31/2027,ALDANA,ROSALIND,K,,78201,BEXAR,No,Yes,No',
].join('\n')
const RMP_TEXT = [
  'RANK,LICENSE_NBR,LIC_STATUS,LICENSE_DATE,EXPIRATION_DTE,LAST_NAME,FIRST_NAME,MIDDLE_NAME,SUFFIX,ADDR1,ADDR2,ADDR3,CITY,STATE,ZIP,PHONE,COUNTY,MEDGAS_ENDR,MRF_ENDR,WS_ENDR,INS_EXPIRY_DTE,PLUMB_COMPANY,INSURANCE_COMPANY,AGENT_PHONE',
  'M,000044,Current,06/01/2009,05/31/2027,PRUETT,HARLAN,,,12 Sample Rd,,,Seguin,TX,78155,8305550100,GUADALUPE,No,No,No,12/02/2026,PRUETT PLUMBING,Sample Mutual,830-555-0111',
].join('\n')

const jp = { file: JP, rows: tsbpeRows(JP, JP_TEXT).rows }
const mp = { file: MP, rows: tsbpeRows(MP, MP_TEXT).rows }
const rmp = { file: RMP, rows: tsbpeRows(RMP, RMP_TEXT).rows }

describe('the files a plumbing license of each level is found in', () => {
  it('reads one file a level, and both master files for a master', () => {
    expect(TSBPE_CHECK_LEVELS).toEqual(['apprentice', 'tradesman', 'journeyman', 'master'])
    expect(tsbpeFilesForLevel('apprentice').map((f) => f.file)).toEqual(['PA'])
    expect(tsbpeFilesForLevel('tradesman').map((f) => f.file)).toEqual(['TP'])
    expect(tsbpeFilesForLevel(' Journeyman ').map((f) => f.file)).toEqual(['JP'])
    expect(tsbpeFilesForLevel('master').map((f) => f.file)).toEqual(['MP', 'RMP'])
  })
  it('names no file for a level the board does not issue', () => {
    expect(tsbpeFilesForLevel('contractor')).toEqual([])
    expect(tsbpeFilesForLevel('')).toEqual([])
  })
})

describe('tsbpeAnswer', () => {
  it('finds a number however it is written, with the holder, the level, the status and the days', () => {
    for (const typed of ['000412', '412', '#412', 'J-000412']) {
      expect(tsbpeAnswer([jp], typed).answer).toEqual({
        kind: 'found',
        holder: 'MARLON T FENWICK',
        type: 'Journeyman Plumber',
        status: 'current',
        expiryYmd: '2027-08-31',
        licensedYmd: '2026-11-12',
        endorsements: ['medical_gas'],
        company: null,
        insuranceEndsYmd: null,
      })
    }
  })
  it('says a lapsed license is expired, and keeps the suffix on the holder', () => {
    expect(tsbpeAnswer([jp], '209').answer).toMatchObject({ kind: 'found', holder: 'TEODORO QUILL JR', status: 'expired', expiryYmd: '2026-06-30' })
    expect(tsbpeHolder({ first_name: ' INES ', middle_name: '', last_name: 'HARROW', suffix: '' })).toBe('INES HARROW')
  })
  it('answers a master on both master files with the row that is current, and lists both', () => {
    const { answer, every } = tsbpeAnswer([mp, rmp], '44')
    expect(answer).toMatchObject({ kind: 'found', type: 'Responsible Master Plumber', status: 'current', expiryYmd: '2027-05-31', company: 'PRUETT PLUMBING', insuranceEndsYmd: '2026-12-02' })
    expect(every.map((l) => [l.file, l.status])).toEqual([['MP', 'expired'], ['RMP', 'current']])
  })
  it('answers a master on one file alone', () => {
    expect(tsbpeAnswer([mp, rmp], '51')).toMatchObject({ answer: { kind: 'found', holder: 'ROSALIND K ALDANA', type: 'Master Plumber', endorsements: ['fire_sprinkler'] }, every: [{ file: 'MP' }] })
  })
  it('gives no ZIP, county, street or phone', () => {
    const said = JSON.stringify(tsbpeAnswer([mp, rmp], '44'))
    for (const kept of ['78155', 'GUADALUPE', 'Sample Rd', '8305550100']) expect(said).not.toContain(kept)
  })
  it('names the files read when none has the number, and says a zipped file can be a week behind', () => {
    expect(tsbpeAnswer([jp], '999').answer).toEqual({ kind: 'none', reason: "TSBPE's journeyman file has no license under that number. The board refreshes that file about weekly, so a license issued in the last week may not be on it yet." })
    expect(tsbpeAnswer([mp, rmp], '999').answer).toEqual({ kind: 'none', reason: "TSBPE's master and responsible master files have no license under that number." })
  })
  it('never matches a number with no digit', () => {
    expect(tsbpeAnswer([jp], 'none')).toMatchObject({ answer: { kind: 'none' }, every: [] })
  })
})

describe('the seat reads the board’s files for a plumbing number', () => {
  const block = SERVER.slice(SERVER.indexOf("    case 'check_license':"), SERVER.indexOf("    case 'read_on_site':"))
  it('no longer says the board keeps no open list, in the seat, the README or the logbook’s kernel and its copy', () => {
    for (const text of [SERVER, README, LICENSE_TEXT, LICENSE_TEXT_COPY]) {
      expect(text).not.toContain('no open list')
      expect(text).not.toContain('keeps no open list')
    }
    expect(SERVER).not.toContain('plumbing is refused')
  })
  it('reads each file of the level, refuses one too short to be the roll, and answers through the kernel', () => {
    expect(block).toContain('tsbpeFilesForLevel(level)')
    expect(block).toContain('rollNumberKey(number)')
    expect(block).toContain('TSBPE_FEWEST_ROWS')
    expect(block).toContain('tsbpeAnswer(reads, number)')
    expect(block).toContain('AbortSignal.timeout(TSBPE_CHECK_TIMEOUT_MS)')
    expect(block).toContain('TSBPE_CHECK_TIMEOUT_REASON')
    expect(TSBPE_FEWEST_ROWS).toBe(200)
    expect(TSBPE_CHECK_TIMEOUT_REASON).toBe('TSBPE did not answer within 30 seconds. Try again in a minute.')
    expect(TSBPE_LIST_URL).toBe('https://tsbpe.texas.gov/free-licensee-list/')
  })
  it('writes nothing: the case reads the board and never the database', () => {
    expect(block).not.toContain('.from(')
    expect(block).not.toContain('.rpc(')
    expect(block).not.toContain('insert(')
  })
  it('is pinned to its server version and named in the README', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.136.0'")
    expect(README).toContain("A plumbing number is read from TSBPE's free files")
  })
})
