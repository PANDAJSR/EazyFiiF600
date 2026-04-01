import type { DroneProgram, ParseResult } from '../types/fii'

const LOCAL_DRAFT_STORAGE_KEY = 'fii-local-draft-v1'

export const LOCAL_DRAFT_SOURCE_NAME = '本地草稿'

const createDroneId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local_${crypto.randomUUID()}`
  }
  return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export const createEmptyDroneProgram = (index: number): DroneProgram => ({
  drone: {
    id: createDroneId(),
    name: `无人机${index}`,
    actionGroup: `本地动作组${index}`,
    startPos: {
      x: '0',
      y: '0',
      z: '0',
    },
  },
  blocks: [],
})

export const createDefaultLocalResult = (): ParseResult => ({
  programs: [createEmptyDroneProgram(1)],
  warnings: [],
  sourceName: LOCAL_DRAFT_SOURCE_NAME,
})

export const readLocalDraftResult = (): ParseResult => {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY)
    if (!raw) {
      return createDefaultLocalResult()
    }
    const parsed = JSON.parse(raw) as { programs?: DroneProgram[] }
    if (!Array.isArray(parsed.programs) || parsed.programs.length === 0) {
      return createDefaultLocalResult()
    }
    return {
      programs: parsed.programs,
      warnings: [],
      sourceName: LOCAL_DRAFT_SOURCE_NAME,
    }
  } catch {
    return createDefaultLocalResult()
  }
}

export const saveLocalDraftPrograms = (programs: DroneProgram[]) => {
  try {
    localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify({ programs }))
  } catch {
    // Ignore quota/storage errors and keep app usable.
  }
}
