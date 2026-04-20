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

export const normalizeAllProgramsAutoDelayBlocks = (result: ParseResult): ParseResult => {
  return {
    ...result,
    programs: result.programs.map((program) => ({
      ...program,
      blocks: normalizeAutoDelayBlocks(program.blocks, program.drone.startPos),
    })),
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

const normalizeNonNegativeIntString = (value: string, fallback: number, min: number, max?: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return String(fallback)
  }
  const rounded = Math.round(parsed)
  const clampedMin = Math.max(min, rounded)
  const clamped = max === undefined ? clampedMin : Math.min(clampedMin, max)
  return String(clamped)
}

const calculateStateBeforeBlockIndex = (
  blocks: ParsedBlock[],
  targetIndex: number,
  startPos: { x: string; y: string; z: string },
) => {
  let currentX = toFieldNumber(startPos.x, 0)
  let currentY = toFieldNumber(startPos.y, 0)
  let currentZ = toFieldNumber(startPos.z, 0)
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
  return { currentX, currentY, currentZ }
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
      if (block.type === 'Goertek_TurnTo' && fieldKey === 'angle') {
        return {
          ...block,
          fields: {
            ...block.fields,
            angle: normalizeNonNegativeIntString(value, 90, 0, 359),
          },
        }
      }
      if (block.type === 'Goertek_Turn' && fieldKey === 'angle') {
        return {
          ...block,
          fields: {
            ...block.fields,
            angle: normalizeNonNegativeIntString(value, 90, 0, 360),
          },
        }
      }
      if (block.type === 'block_delay' && fieldKey === 'time') {
        return {
          ...block,
          fields: {
            ...block.fields,
            time: normalizeNonNegativeIntString(value, 0, 0),
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

export const insertBlocksAfterTarget = (
  result: ParseResult,
  selectedDroneId: string | undefined,
  targetBlockId: string,
  nextBlocks: ParsedBlock[],
): ParseResult => {
  if (!nextBlocks.length) {
    return result
  }
  return updateSelectedProgramBlocks(result, selectedDroneId, (blocks) => {
    const insertIndex = blocks.findIndex((block) => block.id === targetBlockId)
    if (insertIndex < 0) {
      return blocks
    }
    const updatedBlocks = [...blocks]
    updatedBlocks.splice(insertIndex + 1, 0, ...nextBlocks)
    return updatedBlocks
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
  if (!selectedDroneId) {
    return result
  }
  return {
    ...result,
    programs: result.programs.map((program) => {
      if (program.drone.id !== selectedDroneId) {
        return program
      }
      const targetIndex = program.blocks.findIndex((block) => block.id === blockId)
      if (targetIndex < 0) {
        return program
      }
      const targetBlock = program.blocks[targetIndex]
      const { currentX, currentY, currentZ } = calculateStateBeforeBlockIndex(program.blocks, targetIndex, program.drone.startPos)
      const nextBlocks = [...program.blocks]

      if (targetBlock.type === 'Goertek_Turn') {
        nextBlocks[targetIndex] = {
          ...targetBlock,
          type: 'Goertek_TurnTo',
        }
      } else if (targetBlock.type === 'Goertek_TurnTo') {
        nextBlocks[targetIndex] = {
          ...targetBlock,
          type: 'Goertek_Turn',
        }
      } else if (targetBlock.type === 'Goertek_MoveToCoord2') {
        const nextX = toFieldNumber(targetBlock.fields.X, currentX)
        const nextY = toFieldNumber(targetBlock.fields.Y, currentY)
        const nextZ = toFieldNumber(targetBlock.fields.Z, currentZ)
        nextBlocks[targetIndex] = {
          ...targetBlock,
          type: 'Goertek_Move',
          fields: {
            X: String(nextX - currentX),
            Y: String(nextY - currentY),
            Z: String(nextZ - currentZ),
          },
        }
      } else if (targetBlock.type === 'Goertek_Move') {
        const deltaX = toFieldNumber(targetBlock.fields.X, 0)
        const deltaY = toFieldNumber(targetBlock.fields.Y, 0)
        const deltaZ = toFieldNumber(targetBlock.fields.Z, 0)
        nextBlocks[targetIndex] = {
          ...targetBlock,
          type: 'Goertek_MoveToCoord2',
          fields: {
            X: String(clampAsyncMoveX(currentX + deltaX)),
            Y: String(clampAsyncMoveY(currentY + deltaY)),
            Z: String(currentZ + deltaZ),
          },
        }
      } else {
        return program
      }

      return {
        ...program,
        blocks: normalizeAutoDelayBlocks(nextBlocks, program.drone.startPos),
      }
    }),
  }
}
