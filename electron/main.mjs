import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chatWithAgent, getAgentStatus, resetAgentSession } from './agentService.mjs'
import { createAgentEnvStore } from './agentEnvStore.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const agentEnvFile = path.resolve(__dirname, '../.agent-env.json')
const agentEnvStore = createAgentEnvStore(agentEnvFile)

const collectTextFiles = async (rootDir, currentDir = rootDir, acc = []) => {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await collectTextFiles(rootDir, absolutePath, acc)
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/')
    try {
      const text = await fs.readFile(absolutePath, 'utf8')
      acc.push({ name: entry.name, relativePath, text })
    } catch {
      // Ignore binary or unreadable files.
    }
  }
  return acc
}

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    await mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  const indexHtml = path.resolve(__dirname, '../dist/index.html')
  await mainWindow.loadFile(indexHtml)
}

ipcMain.handle('desktop:pick-open-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  if (canceled || filePaths.length === 0) {
    return null
  }

  const directoryPath = filePaths[0]
  const files = await collectTextFiles(directoryPath)
  return { directoryPath, files }
})

ipcMain.handle('desktop:pick-save-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
  })
  if (canceled || filePaths.length === 0) {
    return null
  }
  return filePaths[0]
})

ipcMain.handle('desktop:write-project-files', async (_event, payload) => {
  const { directoryPath, files } = payload ?? {}
  if (!directoryPath || !Array.isArray(files)) {
    throw new Error('invalid write payload')
  }
  if (!existsSync(directoryPath)) {
    await fs.mkdir(directoryPath, { recursive: true })
  }

  for (const file of files) {
    const targetPath = path.join(directoryPath, file.relativePath)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, file.content, 'utf8')
  }

  return { writtenCount: files.length }
})

ipcMain.handle('desktop:read-text-file', async (_event, payload) => {
  const { directoryPath, relativePath } = payload ?? {}
  if (!directoryPath || !relativePath) {
    throw new Error('invalid read payload')
  }

  const targetPath = path.join(directoryPath, relativePath)
  try {
    const content = await fs.readFile(targetPath, 'utf8')
    return { content }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { content: null }
    }
    throw error
  }
})

ipcMain.handle('desktop:write-text-file', async (_event, payload) => {
  const { directoryPath, relativePath, content } = payload ?? {}
  if (!directoryPath || !relativePath || typeof content !== 'string') {
    throw new Error('invalid text write payload')
  }

  if (!existsSync(directoryPath)) {
    await fs.mkdir(directoryPath, { recursive: true })
  }

  const targetPath = path.join(directoryPath, relativePath)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, content, 'utf8')
  return { written: true }
})

ipcMain.handle('agent:chat', async (_event, payload) => {
  const { message, reset, requestId, projectContext } = payload ?? {}
  try {
    const timeoutMs = Number(process.env.NANO_AGENT_REQUEST_TIMEOUT_MS ?? 120000)
    _event.sender.send('agent:stream', {
      requestId,
      type: 'start',
    })
    const result = await Promise.race([
      chatWithAgent({
        message,
        reset: Boolean(reset),
        envOverrides: agentEnvStore.get(),
        projectContext,
        onEvent: (event) => {
          _event.sender.send('agent:stream', {
            requestId,
            ...event,
          })
        },
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`请求超时（>${Math.floor(timeoutMs / 1000)}s）`)), timeoutMs)
      }),
    ])
    _event.sender.send('agent:stream', {
      requestId,
      type: 'end',
    })
    return { ok: true, ...result }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    _event.sender.send('agent:stream', {
      requestId,
      type: 'error',
      error: errMessage,
    })
    return { ok: false, error: errMessage }
  }
})

ipcMain.handle('agent:get-status', () => {
  try {
    return { ok: true, status: getAgentStatus() }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    return { ok: false, error: errMessage }
  }
})

ipcMain.handle('agent:get-env', () => {
  try {
    return {
      ok: true,
      values: agentEnvStore.get(),
      allowedKeys: agentEnvStore.allowedKeys,
      storagePath: agentEnvFile,
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    return { ok: false, error: errMessage }
  }
})

ipcMain.handle('agent:set-env', async (_event, payload) => {
  const { values } = payload ?? {}
  try {
    const next = await agentEnvStore.setMany(values)
    return {
      ok: true,
      values: next,
      allowedKeys: agentEnvStore.allowedKeys,
      storagePath: agentEnvFile,
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    return { ok: false, error: errMessage }
  }
})

app.whenReady().then(async () => {
  await agentEnvStore.load()
  await createWindow()
})

app.on('window-all-closed', () => {
  resetAgentSession()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})
