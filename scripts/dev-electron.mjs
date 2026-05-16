import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 获取 vite 端口（默认 5173）
const port = process.env.VITE_DEV_PORT || '5173'

// 获取 electron 路径
let electronDir
try {
  const electronEntry = require.resolve('electron')
  electronDir = path.dirname(electronEntry)
} catch {
  electronDir = path.resolve('node_modules/electron')
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

const electronPath = path.join(electronDir, 'dist', guessExecutableRelativePath())

// 启动 electron，传递 VITE_DEV_SERVER_URL
const electron = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: `http://localhost:${port}`,
  },
})

electron.on('close', (code) => {
  process.exit(code ?? 0)
})