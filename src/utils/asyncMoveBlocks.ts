import type { ParsedBlock } from '../types/fii'
import { clampAsyncMoveX, clampAsyncMoveY, clampAsyncMoveZ, MIN_ABSOLUTE_MOVE_Z } from './moveBlockConstraints'

type XYZ = {
  x: string
  y: string
  z: string
}

const GENERATED_RELATIVE_ASYNC_MOVE_KEY = 'eazyfii_generated_relative_async_move'
const GENERATED_RELATIVE_ASYNC_MOVE_NOTE = '这个是我们生成的，实际上应该是异步平移，就是加载出来显示的时候，显示成绝对的坐标。'

type GeneratedRelativeAsyncMovePayload = {
  [GENERATED_RELATIVE_ASYNC_MOVE_KEY]: true
  note: string
}

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const toFieldNumber = (value: string | undefined, fallback: number) => {
  const parsed = toNumber(value)
  return parsed ?? fallback
}

const buildGeneratedRelativeAsyncMoveComment = () => {
  const payload: GeneratedRelativeAsyncMovePayload = {
    [GENERATED_RELATIVE_ASYNC_MOVE_KEY]: true,
    note: GENERATED_RELATIVE_ASYNC_MOVE_NOTE,
  }
  return JSON.stringify(payload)
}

const isGeneratedRelativeAsyncMoveComment = (comment?: string) => {
  if (!comment?.trim()) {
    return false
  }
  try {
    const parsed = JSON.parse(comment)
    return parsed?.[GENERATED_RELATIVE_ASYNC_MOVE_KEY] === true
  } catch {
    return false
  }
}

export const expandAsyncMoveBlocks = (blocks: ParsedBlock[], startPos: XYZ): ParsedBlock[] => {
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
      const nextX = toFieldNumber(block.fields.X, currentX)
      const nextY = toFieldNumber(block.fields.Y, currentY)
      const nextZ = toFieldNumber(block.fields.Z, currentZ)

      if (nextZ < MIN_ABSOLUTE_MOVE_Z) {
        next.push({
          ...block,
          type: 'Goertek_Move',
          fields: {
            X: String(nextX - currentX),
            Y: String(nextY - currentY),
            Z: String(nextZ - currentZ),
          },
          // 保存层兼容：低空绝对异步平移落盘改为相对平移；加载时会按注释还原为绝对异步平移显示。
          comment: buildGeneratedRelativeAsyncMoveComment(),
        })
        currentX = nextX
        currentY = nextY
        currentZ = nextZ
        return
      }

      const safeX = clampAsyncMoveX(nextX)
      const safeY = clampAsyncMoveY(nextY)
      const safeZ = clampAsyncMoveZ(nextZ)
      next.push({
        ...block,
        fields: {
          ...block.fields,
          X: String(safeX),
          Y: String(safeY),
          Z: String(safeZ),
        },
      })
      currentX = safeX
      currentY = safeY
      currentZ = safeZ
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

    if (block.type === 'Goertek_Land') {
      currentZ = 0
    }

    next.push(block)
  })

  return next
}

export const collapseGeneratedRelativeAsyncMoveBlocks = (blocks: ParsedBlock[], startPos: XYZ): ParsedBlock[] => {
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

    if (block.type === 'Goertek_Move' && isGeneratedRelativeAsyncMoveComment(block.comment)) {
      const deltaX = toFieldNumber(block.fields.X, 0)
      const deltaY = toFieldNumber(block.fields.Y, 0)
      const deltaZ = toFieldNumber(block.fields.Z, 0)
      const nextX = currentX + deltaX
      const nextY = currentY + deltaY
      const nextZ = currentZ + deltaZ
      next.push({
        ...block,
        type: 'Goertek_MoveToCoord2',
        fields: {
          X: String(nextX),
          Y: String(nextY),
          Z: String(nextZ),
        },
        comment: undefined,
      })
      currentX = nextX
      currentY = nextY
      currentZ = nextZ
      return
    }

    if (block.type === 'Goertek_MoveToCoord2') {
      currentX = toFieldNumber(block.fields.X, currentX)
      currentY = toFieldNumber(block.fields.Y, currentY)
      currentZ = toFieldNumber(block.fields.Z, currentZ)
      next.push(block)
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

    if (block.type === 'Goertek_Land') {
      currentZ = 0
    }

    next.push(block)
  })

  return next
}
