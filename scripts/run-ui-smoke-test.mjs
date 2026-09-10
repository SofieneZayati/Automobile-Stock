import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import electronPath from 'electron'

const projectRoot = resolve(import.meta.dirname, '..')
const testDataDir = mkdtempSync(join(tmpdir(), 'ben-mahmoud-stock-ui-test-'))
const outputDir = join(projectRoot, 'tmp', 'pdfs')
const screenshotPath = join(outputDir, 'new-invoice.png')
const pdfPath = join(outputDir, 'new-invoice.pdf')
mkdirSync(outputDir, { recursive: true })

try {
  const result = spawnSync(
    electronPath,
    [
      '.',
      '--ui-smoke-test',
      `--test-data-dir=${testDataDir}`,
      `--screenshot-path=${screenshotPath}`,
      `--pdf-path=${pdfPath}`
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
      },
      stdio: 'inherit'
    }
  )

  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  rmSync(testDataDir, { recursive: true, force: true })
}
