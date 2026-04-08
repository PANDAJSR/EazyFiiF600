import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { chatWithAgent, getAgentStatus, resetAgentSession, stopAgentRequest } from './agentService.mjs'
import { createAgentEnvStore } from './agentEnvStore.mjs'
import {
  createTerminal,
  writeTerminal,
  resizeTerminal,
  destroyTerminal,
  registerTerminalWindow,
  unregisterTerminalWindow,
} from './terminalPty.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const agentEnvFile = path.resolve(__dirname, '../.agent-env.json')
const agentEnvStore = createAgentEnvStore(agentEnvFile)
const trajectoryIssuesWaiters = new Map()

const AGENT_PORT_FILE = '.eazyfii-agent-port'
const getAgentPortFilePath = () => path.join(os.homedir(), AGENT_PORT_FILE)
const WORKSPACE_SKILLS_DIRS = [
  path.join(os.homedir(), 'EazyFiiWorkspace', '.agents', 'skills'),
  path.join(os.homedir(), 'EazyFiiWorkspace', '.agent', 'skills'),
]
const PROJECT_SKILL_DIR = path.resolve(__dirname, '../eazyfii-skill')

let agentHttpServer = null
let currentProjectContext = null

const writeAgentPortFile = async (port) => {
  const portFilePath = getAgentPortFilePath()
  try {
    await fs.writeFile(portFilePath, String(port), 'utf8')
    console.info(`[agent][http] Port file written: ${portFilePath} = ${port}`)
  } catch (error) {
    console.error(`[agent][http] Failed to write port file: ${error.message}`)
  }
}

const startAgentHttpServer = () => {
  if (agentHttpServer) {
    return
  }

  agentHttpServer = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/agent') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Not found' }))
      return
    }

    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body)
        const { method, params = {}, id = null } = payload
        const result = await handleAgentHttpRequest(method, params)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, result, id }))
      } catch (error) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(error), id: null }))
      }
    })
  })

  agentHttpServer.listen(0, '127.0.0.1', () => {
    const port = agentHttpServer.address().port
    console.info(`[agent][http] Server listening on port ${port}`)
    writeAgentPortFile(port)
  })

  agentHttpServer.on('error', (err) => {
    console.error(`[agent][http] Server error: ${err.message}`)
  })
}

const stopAgentHttpServer = async () => {
  if (agentHttpServer) {
    agentHttpServer.close()
    agentHttpServer = null
    try {
      await fs.unlink(getAgentPortFilePath())
    } catch {
      // Ignore
    }
  }
}

const handleAgentHttpRequest = async (method, params) => {
  switch (method) {
    case 'chat': {
      const { message, reset, enableReasoning } = params
      const result = await chatWithAgent({
        message,
        reset: Boolean(reset),
        enableReasoning: Boolean(enableReasoning),
        envOverrides: agentEnvStore.get(),
        projectContext: currentProjectContext,
        onEvent: () => {},
      })
      if (result?.projectContext) {
        currentProjectContext = result.projectContext
      }
      return result
    }
    case 'getStatus':
      return getAgentStatus()
    case 'stop':
      stopAgentRequest(params?.requestId)
      return { ok: true }
    case 'getEnv':
      return {
        values: agentEnvStore.get(),
        allowedKeys: agentEnvStore.allowedKeys,
        storagePath: agentEnvFile,
      }
    case 'setEnv': {
      const { values } = params
      const next = await agentEnvStore.setMany(values)
      return {
        values: next,
        allowedKeys: agentEnvStore.allowedKeys,
        storagePath: agentEnvFile,
      }
    }
    case 'listDrones': {
      const { executeProjectToolCall } = await import('./agentProjectTools.mjs')
      const result = executeProjectToolCall({
        name: 'ListProjectDrones',
        rawArguments: '{}',
        projectContext: currentProjectContext,
      })
      return JSON.parse(result.output)
    }
    case 'getDroneBlocks': {
      const { executeProjectToolCall } = await import('./agentProjectTools.mjs')
      const result = executeProjectToolCall({
        name: 'GetDroneBlocks',
        rawArguments: JSON.stringify(params),
        projectContext: currentProjectContext,
      })
      return JSON.parse(result.output)
    }
    case 'patchDrone': {
      const { executeProjectToolCall } = await import('./agentProjectTools.mjs')
      const { droneId, droneName, operations } = params
      const result = executeProjectToolCall({
        name: 'PatchDroneProgram',
        rawArguments: JSON.stringify({ droneId, droneName, operations }),
        projectContext: currentProjectContext,
      })
      const parsed = JSON.parse(result.output)
      if (result?.nextProjectContext) {
        currentProjectContext = result.nextProjectContext
      }
      return parsed
    }
    case 'getRodConfig': {
      const { executeProjectToolCall } = await import('./agentProjectTools.mjs')
      const result = executeProjectToolCall({
        name: 'GetRodConfig',
        rawArguments: '{}',
        projectContext: currentProjectContext,
      })
      return JSON.parse(result.output)
    }
    case 'getBlockCatalog': {
      const { executeProjectToolCall } = await import('./agentProjectTools.mjs')
      const result = executeProjectToolCall({
        name: 'GetBlockCatalog',
        rawArguments: '{}',
        projectContext: currentProjectContext,
      })
      return JSON.parse(result.output)
    }
    case 'getTrajectoryIssues': {
      const { executeProjectToolCall } = await import('./agentProjectTools.mjs')
      const result = executeProjectToolCall({
        name: 'GetTrajectoryIssuesDetailed',
        rawArguments: '{}',
        projectContext: currentProjectContext,
      })
      return JSON.parse(result.output)
    }
    case 'getTrajectoryDebug': {
      const { executeProjectToolCall } = await import('./agentProjectTools.mjs')
      const result = executeProjectToolCall({
        name: 'GetTrajectoryDebugSnapshot',
        rawArguments: JSON.stringify(params),
        projectContext: currentProjectContext,
      })
      return JSON.parse(result.output)
    }
    case 'setProjectContext': {
      currentProjectContext = params?.projectContext || null
      return { ok: true, hasProjectContext: currentProjectContext !== null }
    }
    case 'getProjectContext': {
      return currentProjectContext
    }
    default:
      throw new Error(`Unknown method: ${method}`)
  }
}

const syncEazyfiiSkillToWorkspace = async () => {
  try {
    for (const skillsDir of WORKSPACE_SKILLS_DIRS) {
      const targetDir = path.join(skillsDir, 'eazyfii-skill')
      await fs.mkdir(skillsDir, { recursive: true })
      await fs.rm(targetDir, { recursive: true, force: true })
      await fs.cp(PROJECT_SKILL_DIR, targetDir, { recursive: true, force: true })
      console.info(`[agent][skills] Synced skill to ${targetDir}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[agent][skills] Failed to sync eazyfii-skill: ${message}`)
  }
}

ipcMain.on('agent:trajectory-issues:response', (event, payload) => {
  const token = typeof payload?.token === 'string' ? payload.token : ''
  if (!token) {
    return
  }
  const waiter = trajectoryIssuesWaiters.get(token)
  if (!waiter) {
    return
  }
  if (event.sender.id !== waiter.senderId) {
    return
  }
  clearTimeout(waiter.timeout)
  trajectoryIssuesWaiters.delete(token)
  waiter.resolve(payload?.trajectoryIssueContext)
})

const requestTrajectoryIssuesFromRenderer = (sender, requestId) => new Promise((resolve) => {
  const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  const timeout = setTimeout(() => {
    trajectoryIssuesWaiters.delete(token)
    resolve(null)
  }, 2000)
  trajectoryIssuesWaiters.set(token, {
    senderId: sender.id,
    timeout,
    resolve,
  })
  sender.send('agent:trajectory-issues:request', { token, requestId })
})

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

  registerTerminalWindow(mainWindow)

  mainWindow.on('closed', () => {
    unregisterTerminalWindow(mainWindow)
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
  const {
    message,
    reset,
    requestId,
    enableReasoning,
    projectContext,
    rodConfigContext,
    trajectoryIssueContext,
  } = payload ?? {}
  const projectProgramCount = Array.isArray(projectContext?.programs) ? projectContext.programs.length : 0
  console.info('[agent][main] request received', {
    requestId,
    reset: Boolean(reset),
    messageLength: typeof message === 'string' ? message.length : 0,
    projectProgramCount,
  })
  try {
    const timeoutMs = Number(process.env.NANO_AGENT_REQUEST_TIMEOUT_MS ?? 1000000)
    _event.sender.send('agent:stream', {
      requestId,
      type: 'start',
    })
    const result = await Promise.race([
      chatWithAgent({
        message,
        reset: Boolean(reset),
        requestId,
        enableReasoning: Boolean(enableReasoning),
        envOverrides: agentEnvStore.get(),
        projectContext,
        rodConfigContext,
        trajectoryIssueContext,
        requestTrajectoryIssueContext: () => requestTrajectoryIssuesFromRenderer(_event.sender, requestId),
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
    console.info('[agent][main] request finished', {
      requestId,
      ok: true,
      transportMode: result?.transportMode,
      traces: Array.isArray(result?.traces) ? result.traces.length : 0,
    })
    if (result?.projectContext) {
      currentProjectContext = result.projectContext
    }
    return { ok: true, ...result }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    _event.sender.send('agent:stream', {
      requestId,
      type: 'error',
      error: errMessage,
    })
    console.error('[agent][main] request failed', {
      requestId,
      error: errMessage,
    })
    return { ok: false, error: errMessage }
  }
})

ipcMain.handle('agent:stop', async (_event, payload) => {
  try {
    stopAgentRequest(payload?.requestId)
    return { ok: true }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
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

ipcMain.handle('terminal:create', (_event, { id, cols, rows }) => {
  return createTerminal(id, cols, rows)
})

ipcMain.handle('terminal:write', (_event, { id, data }) => {
  return writeTerminal(id, data)
})

ipcMain.handle('terminal:resize', (_event, { id, cols, rows }) => {
  return resizeTerminal(id, cols, rows)
})

ipcMain.handle('terminal:destroy', (_event, { id }) => {
  return destroyTerminal(id)
})

ipcMain.handle('agent:update-project-context', (_event, projectContext) => {
  currentProjectContext = projectContext
  return { ok: true }
})

app.whenReady().then(async () => {
  await agentEnvStore.load()
  await syncEazyfiiSkillToWorkspace()
  await createWindow()
  startAgentHttpServer()
})

app.on('window-all-closed', () => {
  resetAgentSession()
  stopAgentHttpServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})
