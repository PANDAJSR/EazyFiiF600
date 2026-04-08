import * as pty from 'node-pty'
import os from 'node:os'
import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

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

export const createTerminal = (id, cols, rows) => {
  console.log(`[terminalPty] createTerminal called: id=${id}, cols=${cols}, rows=${rows}`)
  if (terminals.has(id)) {
    console.log(`[terminalPty] Terminal ${id} already exists`)
    return { ok: true, error: null }
  }

  const platform = os.platform()
  const shell = platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || findAvailableShell())
  const homeDir = process.env.HOME || os.homedir() || '/tmp'
  const workspaceDir = `${homeDir}/EazyFiiWorkspace`
  let cwd = homeDir
  try {
    if (!existsSync(workspaceDir)) {
      mkdirSync(workspaceDir, { recursive: true })
    }
    cwd = workspaceDir
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn(`[terminalPty] Failed to prepare workspace dir, fallback to home: ${errMsg}`)
    cwd = homeDir
  }

  if (!shell) {
    const errMsg = `No available shell found for platform ${platform}`
    console.error(`[terminalPty] ${errMsg}`)
    return { ok: false, error: errMsg }
  }

  console.log(`[terminalPty] Spawning shell: ${shell}, cwd: ${cwd}, platform: ${platform}`)
  console.log(`[terminalPty] Shell exists: ${existsSync(shell)}`)

  try {
    const term = pty.spawn(shell, [], {
      cols,
      rows,
      cwd,
      env: process.env,
    })
    console.log(`[terminalPty] pty.spawn succeeded for ${id}`)

    terminals.set(id, term)

    term.onData((data) => {
      const windows = globalThis.getTerminalWindows?.()
      if (windows) {
        for (const win of windows) {
          win.webContents.send('terminal:data', { id, data })
        }
      }
    })

    term.onExit(({ exitCode }) => {
      const windows = globalThis.getTerminalWindows?.()
      if (windows) {
        for (const win of windows) {
          win.webContents.send('terminal:exit', { id, exitCode })
        }
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
  globalThis.getTerminalWindows = () => terminalWindows
}

export const unregisterTerminalWindow = (window) => {
  terminalWindows.delete(window)
  if (globalThis.getTerminalWindows) {
    globalThis.getTerminalWindows = () => terminalWindows
  }
}
