import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
      preload: path.join(__dirname, 'preload.mjs'),
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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})
