import type { DroneProgram, ParseResult, ParsedBlock } from '../types/fii'

const LOCAL_DRAFT_STORAGE_KEY = 'fii-local-draft-v1'

export const LOCAL_DRAFT_SOURCE_NAME = '本地草稿'
type DroneStartPosInput = { x: string; y: string }

const createDroneId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local_${crypto.randomUUID()}`
  }
  return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const createInitialProgramBlocks = (droneId: string): ParsedBlock[] => [
  {
    id: `${droneId}-block-start`,
    type: 'Goertek_Start',
    fields: {},
  },
  {
    id: `${droneId}-block-inittime`,
    type: 'block_inittime',
    fields: { time: '00:00' },
  },
  {
    id: `${droneId}-block-horizontal-speed`,
    type: 'Goertek_HorizontalSpeed',
    fields: { VH: '200', AH: '400' },
  },
  {
    id: `${droneId}-block-vertical-speed`,
    type: 'Goertek_VerticalSpeed',
    fields: { VV: '200', AV: '400' },
  },
  {
    id: `${droneId}-block-unlock`,
    type: 'Goertek_UnLock',
    fields: {},
  },
  {
    id: `${droneId}-block-delay-1`,
    type: 'block_delay',
    fields: { time: '1000' },
  },
  {
    id: `${droneId}-block-takeoff`,
    type: 'Goertek_TakeOff2',
    fields: { alt: '100' },
  },
  {
    id: `${droneId}-block-delay-2`,
    type: 'block_delay',
    fields: { time: '3000' },
  },
  {
    id: `${droneId}-block-land`,
    type: 'Goertek_Land',
    fields: {},
  },
]

export const createEmptyDroneProgram = (index: number, startPos?: DroneStartPosInput): DroneProgram => {
  const droneId = createDroneId()
  return {
    drone: {
      id: droneId,
      name: `无人机${index}`,
      actionGroup: `本地动作组${index}`,
      startPos: {
        x: startPos?.x ?? '0',
        y: startPos?.y ?? '0',
        z: '0',
      },
    },
    blocks: createInitialProgramBlocks(droneId),
  }
}

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
