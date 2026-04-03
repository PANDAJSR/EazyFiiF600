import type { ParsedBlock } from '../types/fii'
import type { XYZ } from '../components/trajectory/trajectoryUtils'
import { AUTO_DELAY_BLOCK_TYPE } from './autoDelayBlocks'

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export const getPathDrawingInheritedZ = (
  startPos: XYZ,
  blocks: ParsedBlock[],
  targetBlockId: string,
): number | null => {
  const targetIndex = blocks.findIndex((block) => block.id === targetBlockId)
  if (targetIndex < 0) {
    return null
  }

  let currentZ = toNumber(startPos.z) ?? 0

  for (let index = 0; index <= targetIndex; index += 1) {
    const block = blocks[index]

    if (block.type === 'Goertek_TakeOff2') {
      const nextZ = toNumber(block.fields.alt)
      if (nextZ !== null) {
        currentZ = nextZ
      }
      continue
    }

    if (block.type === 'Goertek_MoveToCoord2' || block.type === AUTO_DELAY_BLOCK_TYPE) {
      const nextZ = toNumber(block.fields.Z)
      if (nextZ !== null) {
        currentZ = nextZ
      }
      continue
    }

    if (block.type === 'Goertek_Move') {
      const deltaZ = toNumber(block.fields.Z) ?? 0
      currentZ += deltaZ
      continue
    }

    if (block.type === 'Goertek_Land') {
      currentZ = 0
    }
  }

  return currentZ
}
