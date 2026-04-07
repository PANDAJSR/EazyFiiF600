import * as pty from 'node-pty'
import os from 'node:os'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const terminals = new Map()
const terminalWindows = new Set()

const POSSIBLE_SHELLS = {
  darwin: ['/bin/zsh', '/bin/bash', '/usr/local/bin/bash'],
  linux: ['/bin/bash', '/bin/sh', '/usr/bin/bash'],
  win32: ['powershell.exe', 'cmd.exe', 'pwsh.exe'],
}

const findAvailableShell = () => {
  const platform = os.platform()
  const candidates = POSSIBLE_SHELLS[platform] || POSSIBLE_SHELLS.linux
  for (const shell of candidates) {
    if (existsSync(shell)) {
      return shell
    }
  }
  return null
}

const getShellArgs = (platform, shellPath) => {
  if (platform === 'win32') {
    return []
  }
  const shellName = shellPath.split('/').pop() || ''
  if (shellName.includes('zsh') || shellName.includes('bash')) {
    return ['-i']
  }
  return []
}

export const createTerminal = (id, cols, rows) => {
  console.log(`[terminalPty] createTerminal called: id=${id}, cols=${cols}, rows=${rows}`)
  if (terminals.has(id)) {
    console.log(`[terminalPty] Terminal ${id} already exists`)
    return { ok: true, error: null }
  }

  const platform = os.platform()
  const shell = platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || findAvailableShell())
  const shellArgs = getShellArgs(platform, shell || '')
  const homeDir = process.env.HOME || os.homedir() || '/tmp'
  const preferredCwd = path.join(homeDir, 'EazyFiiWorkspace')
  if (!existsSync(preferredCwd)) {
    try {
      mkdirSync(preferredCwd, { recursive: true })
    } catch (error) {
      console.error(`[terminalPty] Failed to create workspace dir: ${preferredCwd}`, error)
    }
  }
  const cwd = existsSync(preferredCwd) ? preferredCwd : homeDir
  const env = {
    ...process.env,
    TERM: process.env.TERM || 'xterm-256color',
  }

  if (!shell) {
    const errMsg = `No available shell found for platform ${platform}`
    console.error(`[terminalPty] ${errMsg}`)
    return { ok: false, error: errMsg }
  }

  console.log(`[terminalPty] Spawning shell: ${shell} ${shellArgs.join(' ')}, cwd: ${cwd}, platform: ${platform}`)
  console.log(`[terminalPty] Shell exists: ${existsSync(shell)}`)

  try {
    const term = pty.spawn(shell, shellArgs, {
      cols,
      rows,
      cwd,
      env,
    })
    console.log(`[terminalPty] pty.spawn succeeded for ${id}`)

    terminals.set(id, term)

    term.onData((data) => {
      for (const win of terminalWindows) {
        win.webContents.send('terminal:data', { id, data })
      }
    })

    term.onExit(({ exitCode }) => {
      for (const win of terminalWindows) {
        win.webContents.send('terminal:exit', { id, exitCode })
      }
      terminals.delete(id)
    })

    return { ok: true, error: null }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error(`[terminalPty] pty.spawn failed: ${errMsg}`)
    return { ok: false, error: errMsg }
  }
}

export const writeTerminal = (id, data) => {
  const term = terminals.get(id)
  if (!term) {
    return { ok: false, error: 'Terminal not found' }
  }
  term.write(data)
  return { ok: true, error: null }
}

export const resizeTerminal = (id, cols, rows) => {
  const term = terminals.get(id)
  if (!term) {
    return { ok: false, error: 'Terminal not found' }
  }
  try {
    term.resize(cols, rows)
    return { ok: true, error: null }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: errMsg }
  }
}

export const destroyTerminal = (id) => {
  const term = terminals.get(id)
  if (!term) {
    return { ok: true, error: null }
  }
  try {
    term.kill()
    terminals.delete(id)
    return { ok: true, error: null }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: errMsg }
  }
}

export const registerTerminalWindow = (window) => {
  terminalWindows.add(window)
}

export const unregisterTerminalWindow = (window) => {
  terminalWindows.delete(window)
}
