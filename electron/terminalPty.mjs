import * as pty from 'node-pty'
import os from 'node:os'

const terminals = new Map()

export const createTerminal = (id, cols, rows) => {
  console.log(`[terminalPty] createTerminal called: id=${id}, cols=${cols}, rows=${rows}`)
  if (terminals.has(id)) {
    console.log(`[terminalPty] Terminal ${id} already exists`)
    return { ok: true, error: null }
  }

  const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'
  const cwd = process.env.HOME || os.homedir()
  console.log(`[terminalPty] Spawning shell: ${shell}, cwd: ${cwd}, platform: ${os.platform()}`)

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
  if (!globalThis.getTerminalWindows) {
    globalThis.getTerminalWindows = () => new Set()
  }
  globalThis.getTerminalWindows().add(window)
}

export const unregisterTerminalWindow = (window) => {
  if (globalThis.getTerminalWindows) {
    globalThis.getTerminalWindows().delete(window)
  }
}