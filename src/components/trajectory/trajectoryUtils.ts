import type { ParsedBlock } from '../../types/fii'
import { AUTO_DELAY_BLOCK_TYPE } from '../../utils/autoDelayBlocks'

export const ALL_LIGHT_BLOCK_TYPE = 'Goertek_LEDTurnOnAllSingleColor2'

export type XYZ = {
  x: string
  y: string
  z: string
}

export type Visit = {
  x: number
  y: number
  z: number
  blockId?: string
  blockType?: string
  baseX?: number
  baseY?: number
  baseZ?: number
}

export const GRID_STEP = 20

export const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export const buildPathVisits = (startPos: XYZ, blocks: ParsedBlock[]): Visit[] => {
  const startX = toNumber(startPos.x) ?? 0
  const startY = toNumber(startPos.y) ?? 0
  const startZ = toNumber(startPos.z) ?? 0
  const visits: Visit[] = [{ x: startX, y: startY, z: startZ }]

  let currentX = startX
  let currentY = startY
  let currentZ = startZ

  blocks.forEach((block) => {
    if (block.type === 'Goertek_TakeOff2') {
      const nextZ = toNumber(block.fields.alt)
      if (nextZ === null) {
        return
      }
      currentZ = nextZ
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        blockId: block.id,
        blockType: block.type,
      })
      return
    }

    if (block.type === 'Goertek_MoveToCoord2' || block.type === AUTO_DELAY_BLOCK_TYPE) {
      const baseX = currentX
      const baseY = currentY
      const baseZ = currentZ
      const nextX = toNumber(block.fields.X)
      const nextY = toNumber(block.fields.Y)
      if (nextX === null || nextY === null) {
        return
      }
      const nextZ = toNumber(block.fields.Z)
      currentX = nextX
      currentY = nextY
      currentZ = nextZ ?? currentZ
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        blockId: block.id,
        blockType: block.type,
        baseX,
        baseY,
        baseZ,
      })
      return
    }

    if (block.type === 'Goertek_Move') {
      const deltaX = toNumber(block.fields.X)
      const deltaY = toNumber(block.fields.Y)
      if (deltaX === null || deltaY === null) {
        return
      }
      const baseX = currentX
      const baseY = currentY
      const baseZ = currentZ
      const deltaZ = toNumber(block.fields.Z) ?? 0
      currentX += deltaX
      currentY += deltaY
      currentZ += deltaZ
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        blockId: block.id,
        blockType: block.type,
        baseX,
        baseY,
        baseZ,
      })
      return
    }

    if (block.type === 'Goertek_Land') {
      currentZ = 0
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        blockId: block.id,
        blockType: block.type,
      })
    }
  })

  return visits
}

export const buildTicks = (min: number, max: number): number[] => {
  const ticks: number[] = []
  for (let value = min; value <= max; value += GRID_STEP) {
    ticks.push(value)
  }
  return ticks
}

export type TrajectoryBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  span: number
}

export const calcTrajectoryBounds = (visits: Visit[]): TrajectoryBounds => {
  const rawMinX = Math.min(0, ...visits.map((point) => point.x))
  const rawMaxX = Math.max(360, ...visits.map((point) => point.x))
  const rawMinY = Math.min(0, ...visits.map((point) => point.y))
  const rawMaxY = Math.max(360, ...visits.map((point) => point.y))
  const minZ = Math.min(...visits.map((point) => point.z))
  const maxZ = Math.max(...visits.map((point) => point.z))

  const minXBase = Math.floor(rawMinX / GRID_STEP) * GRID_STEP
  const maxXBase = Math.ceil(rawMaxX / GRID_STEP) * GRID_STEP
  const minYBase = Math.floor(rawMinY / GRID_STEP) * GRID_STEP
  const maxYBase = Math.ceil(rawMaxY / GRID_STEP) * GRID_STEP

  const xSpanBase = Math.max(maxXBase - minXBase, GRID_STEP)
  const ySpanBase = Math.max(maxYBase - minYBase, GRID_STEP)
  const span = Math.max(xSpanBase, ySpanBase)

  return {
    minX: minXBase,
    maxX: minXBase + span,
    minY: minYBase,
    maxY: minYBase + span,
    minZ,
    maxZ,
    span,
  }
}

const normalizeColorText = (value?: string): string | null => {
  if (!value) {
    return null
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  if (normalized === 'green') {
    return '#008000'
  }
  if (normalized === 'lime') {
    return '#00ff00'
  }

  const withoutPrefix = normalized.startsWith('#')
    ? normalized.slice(1)
    : normalized.startsWith('0x')
      ? normalized.slice(2)
      : normalized

  const hex =
    withoutPrefix.length === 3
      ? withoutPrefix
          .split('')
          .map((char) => char + char)
          .join('')
      : withoutPrefix

  if (/^[0-9a-f]{6}$/.test(hex)) {
    return `#${hex}`
  }

  return normalized
}

export type LightColorSegment = {
  startVisitIndex: number
  endVisitIndex: number
  color: string
  startRatio?: number
  endRatio?: number
}

const findLightColorChangeBlocksBetweenIndices = (
  blocks: ParsedBlock[],
  startIndex: number,
  endIndex: number,
): Array<{ blockIndex: number; color: string }> => {
  const changes: Array<{ blockIndex: number; color: string }> = []
  for (let i = startIndex; i <= endIndex; i += 1) {
    const block = blocks[i]
    if (block.type !== ALL_LIGHT_BLOCK_TYPE) {
      continue
    }
    const normalizedColor = normalizeColorText(block.fields.color1)
    if (normalizedColor) {
      changes.push({ blockIndex: i, color: normalizedColor })
    }
  }
  return changes
}

export const buildLightColorSegments = (
  blocks: ParsedBlock[],
  visits: Visit[],
): LightColorSegment[] => {
  if (!blocks.length || !visits.length) {
    return []
  }

  const blockIndexById = new Map<string, number>()
  blocks.forEach((block, index) => blockIndexById.set(block.id, index))

  const visitIndexByBlockId = new Map<string, number>()
  visits.forEach((visit, index) => {
    if (visit.blockId) {
      visitIndexByBlockId.set(visit.blockId, index)
    }
  })

  const segments: LightColorSegment[] = []
  let currentColor = '#ffffff'

  for (let visitIdx = 0; visitIdx < visits.length - 1; visitIdx += 1) {
    const nextVisitIdx = visitIdx + 1
    const startVisit = visits[visitIdx]
    const endVisit = visits[nextVisitIdx]

    if (!startVisit.blockId || !endVisit.blockId) {
      segments.push({
        startVisitIndex: visitIdx,
        endVisitIndex: nextVisitIdx,
        color: currentColor,
      })
      continue
    }

    const startBlockIndex = blockIndexById.get(startVisit.blockId)
    const endBlockIndex = blockIndexById.get(endVisit.blockId)

    if (startBlockIndex === undefined || endBlockIndex === undefined) {
      segments.push({
        startVisitIndex: visitIdx,
        endVisitIndex: nextVisitIdx,
        color: currentColor,
      })
      continue
    }

    const changes = findLightColorChangeBlocksBetweenIndices(blocks, startBlockIndex, endBlockIndex)

    if (changes.length === 0) {
      segments.push({
        startVisitIndex: visitIdx,
        endVisitIndex: nextVisitIdx,
        color: currentColor,
      })
      continue
    }

    // 计算在同一段平移区间内（startBlockIndex 到 endBlockIndex）所有延时块的时间总和
    const calcDelayBetween = (fromBlockIndex: number, toBlockIndex: number): number => {
      let total = 0
      for (let i = fromBlockIndex; i < toBlockIndex; i += 1) {
        if (blocks[i].type === AUTO_DELAY_BLOCK_TYPE) {
          total += toNumber(blocks[i].fields.time) ?? 0
        }
      }
      return total
    }

    // 计算整个区间的总延时
    const totalDelay = calcDelayBetween(startBlockIndex, endBlockIndex)
    let accumulatedDelay = 0

    for (let i = 0; i < changes.length; i += 1) {
      const change = changes[i]
      currentColor = change.color

      const nextChange = changes[i + 1]
      const segmentEndBlockIndex = nextChange ? nextChange.blockIndex : endBlockIndex

      // 计算从当前变灯块到下一个变灯块（或endBlock）之间的延时
      const segmentDelay = calcDelayBetween(change.blockIndex, segmentEndBlockIndex)

      const startRatio = totalDelay > 0 ? accumulatedDelay / totalDelay : 0
      accumulatedDelay += segmentDelay
      const endRatio = totalDelay > 0 ? accumulatedDelay / totalDelay : 1

      segments.push({
        startVisitIndex: visitIdx,
        endVisitIndex: nextVisitIdx,
        color: currentColor,
        startRatio: i === 0 ? 0 : startRatio,
        endRatio: i === changes.length - 1 ? 1 : endRatio,
      })
    }

    if (changes.length > 0) {
      currentColor = changes[changes.length - 1].color
    }
  }

  return segments
}
