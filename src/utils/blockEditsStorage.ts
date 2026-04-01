import type { ParseResult } from '../types/fii'

type SavedEdits = {
  [sourceName: string]: {
    [droneId: string]: {
      [blockId: string]: Record<string, string>
    }
  }
}

const EDIT_STORAGE_KEY = 'fii-block-edits-v1'

const readSavedEdits = (): SavedEdits => {
  try {
    const raw = localStorage.getItem(EDIT_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed) {
      return parsed as SavedEdits
    }
    return {}
  } catch {
    return {}
  }
}

export const saveResultEdits = (sourceName: string, programs: ParseResult['programs']) => {
  if (!sourceName) {
    return
  }
  const allSaved = readSavedEdits()
  allSaved[sourceName] = programs.reduce<SavedEdits[string]>((droneAcc, program) => {
    droneAcc[program.drone.id] = program.blocks.reduce<SavedEdits[string][string]>((blockAcc, block) => {
      blockAcc[block.id] = block.fields
      return blockAcc
    }, {})
    return droneAcc
  }, {})
  localStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify(allSaved))
}

export const applySavedEdits = (result: ParseResult): ParseResult => {
  if (!result.sourceName) {
    return result
  }

  const sourceSaved = readSavedEdits()[result.sourceName]
  if (!sourceSaved) {
    return result
  }

  return {
    ...result,
    programs: result.programs.map((program) => {
      const droneSaved = sourceSaved[program.drone.id]
      if (!droneSaved) {
        return program
      }
      return {
        ...program,
        blocks: program.blocks.map((block) => {
          const blockSaved = droneSaved[block.id]
          if (!blockSaved) {
            return block
          }
          return {
            ...block,
            fields: {
              ...block.fields,
              ...blockSaved,
            },
          }
        }),
      }
    }),
  }
}
