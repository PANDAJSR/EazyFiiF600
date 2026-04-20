import type { ParseResult } from '../types/fii'
import { parseFiiFromTextFiles } from './fiiParser'
import { serializeProjectFiles } from './fiiSerializer'
import { pickOpenDirectory, pickSaveDirectory, writeProjectFiles } from './desktopBridge'
import { normalizeResultForSave } from './saveValidation'

export type OpenDesktopProjectResult = {
  directoryPath: string
  parseResult: ParseResult
}

export const openDesktopProject = async (): Promise<OpenDesktopProjectResult | null> => {
  const openResult = await pickOpenDirectory()
  if (!openResult) {
    return null
  }
  const parseResult = await parseFiiFromTextFiles(openResult.files)
  return {
    directoryPath: openResult.directoryPath,
    parseResult,
  }
}

export type SaveDesktopProjectResult = {
  directoryPath: string
  writtenCount: number
}

export const saveDesktopProject = async (
  result: ParseResult,
  currentDirectoryPath?: string,
): Promise<SaveDesktopProjectResult | null> => {
  const saveDirectory = currentDirectoryPath || (await pickSaveDirectory())
  if (!saveDirectory) {
    return null
  }

  const files = serializeProjectFiles(normalizeResultForSave(result))
  const writeResult = await writeProjectFiles({
    directoryPath: saveDirectory,
    files,
  })

  if (!writeResult) {
    return null
  }

  return {
    directoryPath: saveDirectory,
    writtenCount: writeResult.writtenCount,
  }
}
