import type { ParseResult, ParsedBlock } from '../types/fii'

type MovePointPayload = {
  blockId: string
  blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move'
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
        blocks: updateBlocks(program.blocks),
      }
    }),
  }
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
      if (payload.blockType === 'Goertek_MoveToCoord2') {
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
