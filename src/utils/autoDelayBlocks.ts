import type { ParsedBlock } from '../types/fii'
import { clampAsyncMoveX, clampAsyncMoveY, clampAsyncMoveZ, MIN_ABSOLUTE_MOVE_Z } from './moveBlockConstraints'
import { loadAppSettings } from './appSettings'

type XYZ = {
  x: string
  y: string
  z: string
}

export const AUTO_DELAY_BLOCK_TYPE = 'EazyFii_MoveToCoordAutoDelay'
export const AUTO_DELAY_UUID_KEY = 'eazyfii_block_uuid'

const AUTO_DELAY_DELAY_ANCHORS = [
  { distanceCm: 20, delayMs: 600 },
  { distanceCm: 30, delayMs: 700 },
  { distanceCm: 40, delayMs: 800 },
  { distanceCm: 50, delayMs: 900 },
  { distanceCm: 60, delayMs: 1000 },
  { distanceCm: 70, delayMs: 1000 },
  { distanceCm: 80, delayMs: 1100 },
  { distanceCm: 90, delayMs: 1100 },
  { distanceCm: 100, delayMs: 1200 },
  { distanceCm: 110, delayMs: 1200 },
  { distanceCm: 120, delayMs: 1300 },
] as const

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const createRuntimeUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const toFieldNumber = (value: string | undefined, fallback: number) => {
  const parsed = toNumber(value)
  return parsed ?? fallback
}

export const isAutoDelayBlock = (block: ParsedBlock) => block.type === AUTO_DELAY_BLOCK_TYPE

const estimateDelayByDistance = (distanceCm: number): number => {
  const safeDistance = Number.isFinite(distanceCm) ? Math.max(0, distanceCm) : 0
  const first = AUTO_DELAY_DELAY_ANCHORS[0]
  const last = AUTO_DELAY_DELAY_ANCHORS[AUTO_DELAY_DELAY_ANCHORS.length - 1]

  if (safeDistance <= first.distanceCm) {
    const right = AUTO_DELAY_DELAY_ANCHORS[1]
    const ratio = (safeDistance - first.distanceCm) / (right.distanceCm - first.distanceCm)
    return Math.round(first.delayMs + (right.delayMs - first.delayMs) * ratio)
  }

  if (safeDistance >= last.distanceCm) {
    const left = AUTO_DELAY_DELAY_ANCHORS[AUTO_DELAY_DELAY_ANCHORS.length - 2]
    const ratio = (safeDistance - left.distanceCm) / (last.distanceCm - left.distanceCm)
    return Math.round(left.delayMs + (last.delayMs - left.delayMs) * ratio)
  }

  for (let i = 1; i < AUTO_DELAY_DELAY_ANCHORS.length; i += 1) {
    const left = AUTO_DELAY_DELAY_ANCHORS[i - 1]
    const right = AUTO_DELAY_DELAY_ANCHORS[i]
    if (safeDistance > right.distanceCm) {
      continue
    }
    if (safeDistance === left.distanceCm) {
      return left.delayMs
    }
    if (safeDistance === right.distanceCm) {
      return right.delayMs
    }
    const ratio = (safeDistance - left.distanceCm) / (right.distanceCm - left.distanceCm)
    return Math.round(left.delayMs + (right.delayMs - left.delayMs) * ratio)
  }

  return last.delayMs
}

export const estimateAutoDelayMs = (distanceCm: number, offsetMs = loadAppSettings().autoDelayOffsetMs): number => {
  const baseDelayMs = estimateDelayByDistance(distanceCm)
  return Math.max(0, Math.round(baseDelayMs + offsetMs))
}

export const createAutoDelayComment = (uuid: string) => JSON.stringify({ [AUTO_DELAY_UUID_KEY]: uuid })

export const readAutoDelayUuidFromComment = (comment?: string): string | undefined => {
  if (!comment?.trim()) {
    return undefined
  }
  try {
    const parsed = JSON.parse(comment)
    const value = parsed?.[AUTO_DELAY_UUID_KEY]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  } catch {
    return undefined
  }
  return undefined
}

export const collapseAutoDelayBlocks = (blocks: ParsedBlock[]): ParsedBlock[] => {
  const next: ParsedBlock[] = []
  for (let i = 0; i < blocks.length; i += 1) {
    const current = blocks[i]
    const maybeDelay = blocks[i + 1]
    if (current?.type === 'Goertek_MoveToCoord2' && maybeDelay?.type === 'block_delay') {
      const moveUuid = readAutoDelayUuidFromComment(current.comment)
      const delayUuid = readAutoDelayUuidFromComment(maybeDelay.comment)
      if (moveUuid && delayUuid && moveUuid === delayUuid) {
        next.push({
          id: current.id,
          type: AUTO_DELAY_BLOCK_TYPE,
          fields: {
            X: current.fields.X ?? '0',
            Y: current.fields.Y ?? '0',
            Z: current.fields.Z ?? '100',
            time: maybeDelay.fields.time ?? '0',
          },
          comment: current.comment,
        })
        i += 1
        continue
      }
    }
    next.push(current)
  }
  return next
}

export const expandAutoDelayBlocks = (blocks: ParsedBlock[], startPos: XYZ): ParsedBlock[] => {
  const next: ParsedBlock[] = []
  let currentX = toFieldNumber(startPos.x, 0)
  let currentY = toFieldNumber(startPos.y, 0)
  let currentZ = toFieldNumber(startPos.z, 0)

  blocks.forEach((block) => {
    if (block.type === 'Goertek_TakeOff2') {
      const nextAlt = toNumber(block.fields.alt)
      if (nextAlt !== null) {
        currentZ = nextAlt
      }
      next.push(block)
      return
    }

    if (block.type === 'Goertek_MoveToCoord2') {
      const nextX = clampAsyncMoveX(toFieldNumber(block.fields.X, currentX))
      const nextY = clampAsyncMoveY(toFieldNumber(block.fields.Y, currentY))
      const nextZ = clampAsyncMoveZ(toFieldNumber(block.fields.Z, currentZ))
      currentX = nextX
      currentY = nextY
      currentZ = nextZ
      next.push({
        ...block,
        fields: {
          ...block.fields,
          X: String(nextX),
          Y: String(nextY),
          Z: String(nextZ),
        },
      })
      return
    }

    if (block.type === 'Goertek_Move') {
      const deltaX = toFieldNumber(block.fields.X, 0)
      const deltaY = toFieldNumber(block.fields.Y, 0)
      const deltaZ = toFieldNumber(block.fields.Z, 0)
      currentX += deltaX
      currentY += deltaY
      currentZ += deltaZ
      next.push(block)
      return
    }

    if (!isAutoDelayBlock(block)) {
      if (block.type === 'Goertek_Land') {
        currentZ = 0
      }
      next.push(block)
      return
    }

    const existedUuid = readAutoDelayUuidFromComment(block.comment)
    const blockUuid = existedUuid ?? createRuntimeUuid()
    const comment = createAutoDelayComment(blockUuid)
    const nextX = toFieldNumber(block.fields.X, currentX)
    const nextY = toFieldNumber(block.fields.Y, currentY)
    const nextZ = toFieldNumber(block.fields.Z, currentZ)
    const nextTime = block.fields.time ?? '0'

    if (nextZ < MIN_ABSOLUTE_MOVE_Z) {
      next.push({
        id: `${block.id}__move`,
        type: 'Goertek_Move',
        fields: {
          X: String(nextX - currentX),
          Y: String(nextY - currentY),
          Z: String(nextZ - currentZ),
        },
        comment,
      })
      currentX = nextX
      currentY = nextY
      currentZ = nextZ
    } else {
      const safeX = clampAsyncMoveX(nextX)
      const safeY = clampAsyncMoveY(nextY)
      const safeZ = clampAsyncMoveZ(nextZ)
      next.push({
        id: `${block.id}__move`,
        type: 'Goertek_MoveToCoord2',
        fields: {
          X: String(safeX),
          Y: String(safeY),
          Z: String(safeZ),
        },
        comment,
      })
      currentX = safeX
      currentY = safeY
      currentZ = safeZ
    }
    next.push({
      id: `${block.id}__delay`,
      type: 'block_delay',
      fields: {
        time: nextTime,
      },
      comment,
    })
  })

  return next
}

export const normalizeAutoDelayBlocks = (blocks: ParsedBlock[], startPos: XYZ): ParsedBlock[] => {
  const startX = toFieldNumber(startPos.x, 0)
  const startY = toFieldNumber(startPos.y, 0)
  const startZ = toFieldNumber(startPos.z, 0)

  let currentX = startX
  let currentY = startY
  let currentZ = startZ
  const autoDelayOffsetMs = loadAppSettings().autoDelayOffsetMs

  return blocks.map((block) => {
    if (block.type === 'Goertek_TakeOff2') {
      const nextAlt = toNumber(block.fields.alt)
      if (nextAlt !== null) {
        currentZ = nextAlt
      }
      return block
    }

    if (block.type === 'Goertek_MoveToCoord2' || block.type === AUTO_DELAY_BLOCK_TYPE) {
      const nextX = toFieldNumber(block.fields.X, currentX)
      const nextY = toFieldNumber(block.fields.Y, currentY)
      const nextZ = toFieldNumber(block.fields.Z, currentZ)

      if (block.type === AUTO_DELAY_BLOCK_TYPE) {
        const distance = Math.hypot(nextX - currentX, nextY - currentY, nextZ - currentZ)
        const delay = String(estimateAutoDelayMs(distance, autoDelayOffsetMs))
        const safeUuid = readAutoDelayUuidFromComment(block.comment) ?? createRuntimeUuid()
        const comment = createAutoDelayComment(safeUuid)
        currentX = nextX
        currentY = nextY
        currentZ = nextZ
        return {
          ...block,
          fields: {
            ...block.fields,
            X: String(nextX),
            Y: String(nextY),
            Z: String(nextZ),
            time: delay,
          },
          comment,
        }
      }

      currentX = nextX
      currentY = nextY
      currentZ = nextZ
      return block
    }

    if (block.type === 'Goertek_Move') {
      const deltaX = toFieldNumber(block.fields.X, 0)
      const deltaY = toFieldNumber(block.fields.Y, 0)
      const deltaZ = toFieldNumber(block.fields.Z, 0)
      currentX += deltaX
      currentY += deltaY
      currentZ += deltaZ
      return block
    }

    if (block.type === 'Goertek_Land') {
      currentZ = 0
      return block
    }

    return block
  })
}
