import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import electronPath from 'electron'

const projectRoot = resolve(import.meta.dirname, '..')
const testDataDir = mkdtempSync(join(tmpdir(), 'ben-mahmoud-stock-test-'))

try {
  const result = spawnSync(
    electronPath,
    ['.', '--integration-test', `--test-data-dir=${testDataDir}`],
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
