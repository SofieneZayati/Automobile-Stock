import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import packageJson from '../package.json' with { type: 'json' }

const projectRoot = resolve(import.meta.dirname, '..')
const unpackedDir = join(projectRoot, 'release', 'win-unpacked')
const deliveryDir = join(projectRoot, 'delivery', 'BEN MAHMOUD STOCK - RAPIDE')
const backupDir = join(deliveryDir, 'SAUVEGARDES')
const builtExecutable = join(unpackedDir, 'Ben Mahmoud Stock.exe')
const deliveryExecutableName = 'OUVRIR BEN MAHMOUD STOCK.exe'

if (!existsSync(builtExecutable)) {
  throw new Error('L’application Windows non compressée est introuvable dans release/win-unpacked.')
}

rmSync(deliveryDir, { recursive: true, force: true })
mkdirSync(dirname(deliveryDir), { recursive: true })
cpSync(unpackedDir, deliveryDir, { recursive: true })
renameSync(
  join(deliveryDir, 'Ben Mahmoud Stock.exe'),
  join(deliveryDir, deliveryExecutableName)
)
mkdirSync(backupDir, { recursive: true })

copyFileSync(
  join(projectRoot, 'docs', 'LIRE-MOI.txt'),
  join(deliveryDir, 'LIRE-MOI.txt')
)
copyFileSync(
  join(projectRoot, 'docs', "FONCTIONS DE L'APPLICATION.txt"),
  join(deliveryDir, "FONCTIONS DE L'APPLICATION.txt")
)
copyFileSync(
  join(projectRoot, 'docs', 'SAUVEGARDES-README.txt'),
  join(backupDir, 'README.txt')
)
writeFileSync(
  join(deliveryDir, 'VERSION.txt'),
  `Ben Mahmoud Stock ${packageJson.version}\r\n` +
    'Prêt pour utilisation en magasin\r\n',
  'utf8'
)

const visibleItems = new Set([
  deliveryExecutableName,
  "FONCTIONS DE L'APPLICATION.txt",
  'LIRE-MOI.txt',
  'VERSION.txt',
  'SAUVEGARDES'
])

if (process.platform === 'win32') {
  for (const item of readdirSync(deliveryDir)) {
    if (visibleItems.has(item)) continue
    execFileSync('attrib.exe', ['+h', join(deliveryDir, item)], {
      stdio: 'ignore'
    })
  }
}

console.log(`Dossier client prêt: ${deliveryDir}`)
