import type { ParsedBlock } from '../types/fii'

type XYZ = {
  x: string
  y: string
  z: string
}

export const AUTO_DELAY_BLOCK_TYPE = 'EazyFii_MoveToCoordAutoDelay'
export const AUTO_DELAY_UUID_KEY = 'eazyfii_block_uuid'

const AUTO_DELAY_MIN_MS = 800
const AUTO_DELAY_STEP_CM = 40
const AUTO_DELAY_STEP_MS = 200
const AUTO_DELAY_BASE_CM = 20

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

export const estimateAutoDelayMs = (distanceCm: number): number => {
  const safeDistance = Number.isFinite(distanceCm) ? Math.max(0, distanceCm) : 0
  const step = Math.floor(Math.max(0, safeDistance - AUTO_DELAY_BASE_CM) / AUTO_DELAY_STEP_CM)
  return AUTO_DELAY_MIN_MS + step * AUTO_DELAY_STEP_MS
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

export const expandAutoDelayBlocks = (blocks: ParsedBlock[]): ParsedBlock[] =>
  blocks.flatMap((block) => {
    if (!isAutoDelayBlock(block)) {
      return [block]
    }
    const existedUuid = readAutoDelayUuidFromComment(block.comment)
    const blockUuid = existedUuid ?? createRuntimeUuid()
    const comment = createAutoDelayComment(blockUuid)
    return [
      {
        id: `${block.id}__move`,
        type: 'Goertek_MoveToCoord2',
        fields: {
          X: block.fields.X ?? '0',
          Y: block.fields.Y ?? '0',
          Z: block.fields.Z ?? '100',
        },
        comment,
      },
      {
        id: `${block.id}__delay`,
        type: 'block_delay',
        fields: {
          time: block.fields.time ?? '0',
        },
        comment,
      },
    ]
  })

export const normalizeAutoDelayBlocks = (blocks: ParsedBlock[], startPos: XYZ): ParsedBlock[] => {
  const startX = toFieldNumber(startPos.x, 0)
  const startY = toFieldNumber(startPos.y, 0)
  const startZ = toFieldNumber(startPos.z, 0)

  let currentX = startX
  let currentY = startY
  let currentZ = startZ

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
        const delay = String(estimateAutoDelayMs(distance))
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
