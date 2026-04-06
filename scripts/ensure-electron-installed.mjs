import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function resolveElectronDir() {
  try {
    const electronEntry = require.resolve('electron')
    return path.dirname(electronEntry)
  } catch {
    return path.resolve('node_modules/electron')
  }
}

function hasElectronExecutable(electronDir) {
  const pathFile = path.join(electronDir, 'path.txt')
  if (!existsSync(pathFile)) {
    return false
  }

  const relativeExecPath = readFileSync(pathFile, 'utf8').trim()
  if (!relativeExecPath) {
    return false
  }

  const executablePath = path.join(electronDir, 'dist', relativeExecPath)
  return existsSync(executablePath)
}

function guessExecutableRelativePath() {
  if (process.platform === 'darwin') {
    return 'Electron.app/Contents/MacOS/Electron'
  }
  if (process.platform === 'win32') {
    return 'electron.exe'
  }
  return 'electron'
}

function repairPathFileIfMissing(electronDir) {
  const pathFile = path.join(electronDir, 'path.txt')
  if (existsSync(pathFile)) {
    return false
  }

  const relativeExecPath = guessExecutableRelativePath()
  const executablePath = path.join(electronDir, 'dist', relativeExecPath)
  if (!existsSync(executablePath)) {
    return false
  }

  writeFileSync(pathFile, `${relativeExecPath}\n`, 'utf8')
  return true
}

function installElectron() {
  const installScript = path.resolve('node_modules/electron/install.js')
  if (!existsSync(installScript)) {
    console.error('[ensure-electron-installed] 未找到 electron/install.js，请先执行 pnpm install')
    process.exit(1)
  }

  console.log('[ensure-electron-installed] 检测到 Electron 二进制缺失，正在自动安装...')
  const result = spawnSync(process.execPath, [installScript], {
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const electronDir = resolveElectronDir()
repairPathFileIfMissing(electronDir)

if (!hasElectronExecutable(electronDir)) {
  installElectron()
}
