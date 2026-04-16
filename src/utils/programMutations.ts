import type { ParseResult, ParsedBlock } from '../types/fii'
import { AUTO_DELAY_BLOCK_TYPE, normalizeAutoDelayBlocks } from './autoDelayBlocks'
import { clampAsyncMoveFieldValue, clampAsyncMoveX, clampAsyncMoveY, clampAutoDelayFieldValue, MIN_ABSOLUTE_MOVE_Z } from './moveBlockConstraints'

type MovePointPayload = {
  blockId: string
  blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move' | typeof AUTO_DELAY_BLOCK_TYPE
  x: number
  y: number
  baseX?: number
  baseY?: number
}

const updateSelectedProgramBlocks = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  updateBlocks: (blocks: ParsedBlock[]) => ParsedBlock[],
): ParseResult => {
  if (!selectedDroneId) {
    return result
  }
  return {
    ...result,
    programs: result.programs.map((program) => {
      if (program.drone.id !== selectedDroneId) {
        return program
      }
      return {
        ...program,
        blocks: normalizeAutoDelayBlocks(updateBlocks(program.blocks), program.drone.startPos),
      }
    }),
  }
}

const createRuntimeBlockId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom_${crypto.randomUUID()}`
  }
  return `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`
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

export const updateBlockField = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  blockId: string,
  fieldKey: string,
  value: string,
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) =>
    blocks.map((block) => {
      if (block.id !== blockId) {
        return block
      }
      return {
        ...block,
        fields: {
          ...block.fields,
          [fieldKey]: value,
        },
      }
    }),
  )
}

export const normalizeBlockFieldOnBlur = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  blockId: string,
  fieldKey: string,
  value: string,
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) =>
    blocks.map((block) => {
      if (block.id !== blockId) {
        return block
      }
      if (block.type === 'Goertek_MoveToCoord2') {
        return {
          ...block,
          fields: {
            ...block.fields,
            [fieldKey]: clampAsyncMoveFieldValue(fieldKey, value),
          },
        }
      }
      if (block.type === AUTO_DELAY_BLOCK_TYPE) {
        return {
          ...block,
          fields: {
            ...block.fields,
            [fieldKey]: clampAutoDelayFieldValue(fieldKey, value),
          },
        }
      }
      return block
    }),
  )
}

export const updateMovePoint = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  payload: MovePointPayload,
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) =>
    blocks.map((block) => {
      if (block.id !== payload.blockId) {
        return block
      }
      if (payload.blockType === 'Goertek_MoveToCoord2' || payload.blockType === AUTO_DELAY_BLOCK_TYPE) {
        if (payload.blockType === 'Goertek_MoveToCoord2') {
          return {
            ...block,
            fields: {
              ...block.fields,
              X: String(clampAsyncMoveX(payload.x)),
              Y: String(clampAsyncMoveY(payload.y)),
            },
          }
        }
        return {
          ...block,
          fields: {
            ...block.fields,
            X: String(payload.x),
            Y: String(payload.y),
          },
        }
      }
      const baseX = payload.baseX ?? 0
      const baseY = payload.baseY ?? 0
      return {
        ...block,
        fields: {
          ...block.fields,
          X: String(payload.x - baseX),
          Y: String(payload.y - baseY),
        },
      }
    }),
  )
}

export const removeBlockById = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  blockId: string,
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) =>
    blocks.filter((block) => block.id !== blockId),
  )
}

export const duplicateBlockAfterTarget = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  targetBlockId: string,
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) => {
    const targetIndex = blocks.findIndex((block) => block.id === targetBlockId)
    if (targetIndex < 0) {
      return blocks
    }
    const sourceBlock = blocks[targetIndex]
    const duplicatedBlock: ParsedBlock = {
      ...sourceBlock,
      id: createRuntimeBlockId(),
      fields: { ...sourceBlock.fields },
    }
    const nextBlocks = [...blocks]
    nextBlocks.splice(targetIndex + 1, 0, duplicatedBlock)
    return nextBlocks
  })
}

export const splitAutoDelayBlockById = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  blockId: string,
): ParseResult => {
  if (!selectedDroneId) {
    return result
  }
  return {
    ...result,
    programs: result.programs.map((program) => {
      if (program.drone.id !== selectedDroneId) {
        return program
      }
      const blocks = program.blocks
      const targetIndex = blocks.findIndex((block) => block.id === blockId && block.type === AUTO_DELAY_BLOCK_TYPE)
      if (targetIndex < 0) {
        return program
      }
      const sourceBlock = blocks[targetIndex]
      let currentX = toFieldNumber(program.drone.startPos.x, 0)
      let currentY = toFieldNumber(program.drone.startPos.y, 0)
      let currentZ = toFieldNumber(program.drone.startPos.z, 0)

      for (let i = 0; i < targetIndex; i += 1) {
        const block = blocks[i]
        if (block.type === 'Goertek_TakeOff2') {
          const nextZ = toNumber(block.fields.alt)
          if (nextZ !== null) {
            currentZ = nextZ
          }
          continue
        }
        if (block.type === 'Goertek_MoveToCoord2' || block.type === AUTO_DELAY_BLOCK_TYPE) {
          currentX = toFieldNumber(block.fields.X, currentX)
          currentY = toFieldNumber(block.fields.Y, currentY)
          currentZ = toFieldNumber(block.fields.Z, currentZ)
          continue
        }
        if (block.type === 'Goertek_Move') {
          currentX += toFieldNumber(block.fields.X, 0)
          currentY += toFieldNumber(block.fields.Y, 0)
          currentZ += toFieldNumber(block.fields.Z, 0)
          continue
        }
        if (block.type === 'Goertek_Land') {
          currentZ = 0
        }
      }

      const nextX = toFieldNumber(sourceBlock.fields.X, currentX)
      const nextY = toFieldNumber(sourceBlock.fields.Y, currentY)
      const nextZ = toFieldNumber(sourceBlock.fields.Z, currentZ)
      const moveBlock: ParsedBlock =
        nextZ < MIN_ABSOLUTE_MOVE_Z
          ? {
            id: createRuntimeBlockId(),
            type: 'Goertek_Move',
            fields: {
              X: String(nextX - currentX),
              Y: String(nextY - currentY),
              Z: String(nextZ - currentZ),
            },
            comment: sourceBlock.comment,
          }
          : {
            id: createRuntimeBlockId(),
            type: 'Goertek_MoveToCoord2',
            fields: {
              X: sourceBlock.fields.X ?? '0',
              Y: sourceBlock.fields.Y ?? '0',
              Z: sourceBlock.fields.Z ?? '100',
            },
            comment: sourceBlock.comment,
          }
      const delayBlock: ParsedBlock = {
        id: createRuntimeBlockId(),
        type: 'block_delay',
        fields: {
          time: sourceBlock.fields.time ?? '800',
        },
        comment: sourceBlock.comment,
      }
      const nextBlocks = [...blocks]
      nextBlocks.splice(targetIndex, 1, moveBlock, delayBlock)
      return {
        ...program,
        blocks: normalizeAutoDelayBlocks(nextBlocks, program.drone.startPos),
      }
    }),
  }
}

export const replaceSelectedProgramBlocks = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  nextBlocks: ParsedBlock[],
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, () => nextBlocks)
}

export const insertBlockAfterTarget = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  targetBlockId: string,
  nextBlock: ParsedBlock,
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) => {
    const insertIndex = blocks.findIndex((block) => block.id === targetBlockId)
    if (insertIndex < 0) {
      return blocks
    }
    const nextBlocks = [...blocks]
    nextBlocks.splice(insertIndex + 1, 0, nextBlock)
    return nextBlocks
  })
}

export const insertFirstBlockWhenEmpty = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  firstBlock: ParsedBlock,
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) =>
    blocks.length ? blocks : [firstBlock],
  )
}

export const convertTurnBlockById = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  blockId: string,
): ParseResult => {
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) =>
    blocks.map((block) => {
      if (block.id !== blockId) {
        return block
      }
      if (block.type === 'Goertek_Turn') {
        return {
          ...block,
          type: 'Goertek_TurnTo',
        }
      }
      if (block.type === 'Goertek_TurnTo') {
        return {
          ...block,
          type: 'Goertek_Turn',
        }
      }
      return block
    }),
  )
}
