import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fillAiaG702G703Workbook } from './fillAiaG702G703Workbook'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const templatePath = join(repoRoot, 'public', 'templates', 'aia-g702-g703-mission-hills.xlsx')

describe('fillAiaG702G703Workbook', () => {
  it('does not write NaN in sheet2 when g703_k4 is omitted (Excel repair fix)', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g702_n6_period_to: 'March 31st 2026',
      g703_k3_application_date: 'Wed, Apr 23, 2026, 12:00 PM CDT',
      g703_k2_project: 'Mission Hills Park: Phase 2',
      g703_k5_architect_project_no: '240393cz',
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet2 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet2.xml'], { encoding: 'utf8' })
      const shared = execFileSync('unzip', ['-p', tmp, 'xl/sharedStrings.xml'], { encoding: 'utf8' })
      expect(sheet2).not.toMatch(/<v>NaN<\/v>/)
      expect(sheet2 + shared).toContain('March 31st 2026')
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('writes Previous Month Change Order Additions (G702 F49) when g702_f49_previous_month_change_order_additions is set', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g702_f49_previous_month_change_order_additions: 1500.75,
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet1 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' })
      expect(sheet1).toMatch(/<c r="F49"[^>]*>\s*<v>1500\.75<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('writes Previous Month Change Order Deductions (G702 H49) when g702_h49_previous_month_change_order_deductions is set', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g702_h49_previous_month_change_order_deductions: 333.125,
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet1 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' })
      expect(sheet1).toMatch(/<c r="H49"[^>]*>\s*<v>333\.125<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('writes This Month Change Order Additions (G702 F50) when g702_f50_this_month_change_order_additions is set', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g702_f50_this_month_change_order_additions: 2200.25,
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet1 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' })
      expect(sheet1).toMatch(/<c r="F50"[^>]*>\s*<v>2200\.25<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('writes This Month Change Order Deductions (G702 H50) when g702_h50_this_month_change_order_deductions is set', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g702_h50_this_month_change_order_deductions: 99.5,
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet1 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' })
      expect(sheet1).toMatch(/<c r="H50"[^>]*>\s*<v>99\.5<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('writes Retainage % (G702 C28) as Excel fraction when g702_c28_retainage_percent is human percent', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g702_c28_retainage_percent: 10,
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet1 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' })
      expect(sheet1).toMatch(/<c r="C28"[^>]*>\s*<v>0\.1<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('writes Retainage of Material % (G702 C31) as Excel fraction when g702_c31_retainage_material_percent is human percent', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g702_c31_retainage_material_percent: 10,
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet1 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8' })
      expect(sheet1).toMatch(/<c r="C31"[^>]*>\s*<v>0\.1<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('writes THIS PERIOD (F13) when g703_f13_this_period is set', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g703_f13_this_period: 1234.5,
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet2 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet2.xml'], { encoding: 'utf8' })
      expect(sheet2).toMatch(/<c r="F13"[^>]*>\s*<v>1234\.5<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('writes MATERIALS STORED ON SITE (G13) when g703_g13_materials_stored is set', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g703_g13_materials_stored: 777.25,
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet2 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet2.xml'], { encoding: 'utf8' })
      expect(sheet2).toMatch(/<c r="G13"[^>]*>\s*<v>777\.25<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })

  it('materializes G13 to a plain value when g703_g13_materials_stored is omitted (template has formula)', async () => {
    const fileBuf = readFileSync(templatePath)
    const templateAb = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength)

    const out = await fillAiaG702G703Workbook(templateAb, {
      g702_n6_period_to: 'March 31st 2026',
      g703_k3_application_date: 'Wed, Apr 23, 2026, 12:00 PM CDT',
      g703_k2_project: 'Mission Hills Park: Phase 2',
      g703_k5_architect_project_no: '240393cz',
    })

    const tmp = join(tmpdir(), `aia-test-${randomBytes(8).toString('hex')}.xlsx`)
    writeFileSync(tmp, Buffer.from(out))

    try {
      const sheet2 = execFileSync('unzip', ['-p', tmp, 'xl/worksheets/sheet2.xml'], { encoding: 'utf8' })
      expect(sheet2).not.toMatch(/<v>NaN<\/v>/)
      expect(sheet2).toMatch(/<c r="G13"[^>]*>\s*<v>18228(\.0)?<\/v>\s*<\/c>/)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
  })
})
