import type { ParsedBlock } from '../../types/fii'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

type XYPoint = {
  x: number
  y: number
}

type RingCrossEvent = {
  ringIndex: number
  visitIndex: number
  blockId?: string
}

type RingPathWindow = {
  first: RingCrossEvent
  second: RingCrossEvent
  third: RingCrossEvent
}

export type Subject7CheckResult = 'ok' | 'no-path' | 'color-not-enough'

const SUBJECT7_RING_HEIGHTS = [100, 125, 150] as const
const SUBJECT7_RING_RADIUS_CM = 32.5
const SUBJECT7_RING_RADIUS_TOLERANCE_CM = 3
const AXIS_EPSILON = 1e-6
const ALL_LIGHT_BLOCK_TYPE = 'Goertek_LEDTurnOnAllSingleColor2'

const normalizeColorText = (value?: string): string | null => {
  if (!value) {
    return null
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  if (normalized === 'green') {
    return 'rgb(0,128,0)'
  }
  if (normalized === 'lime') {
    return 'rgb(0,255,0)'
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

const findRingCrossEvents = (
  center: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): RingCrossEvent[] => {
  const visits = buildPathVisits(startPos, blocks)
  const events: RingCrossEvent[] = []

  for (let visitIndex = 1; visitIndex < visits.length; visitIndex += 1) {
    const start = visits[visitIndex - 1]
    const end = visits[visitIndex]
    const deltaZ = end.z - start.z
    if (Math.abs(deltaZ) < AXIS_EPSILON) {
      continue
    }

    for (let ringIndex = 0; ringIndex < SUBJECT7_RING_HEIGHTS.length; ringIndex += 1) {
      const ringHeight = SUBJECT7_RING_HEIGHTS[ringIndex]
      if (!(start.z < ringHeight && end.z >= ringHeight)) {
        continue
      }

      const ratio = (ringHeight - start.z) / deltaZ
      if (ratio < 0 || ratio > 1) {
        continue
      }
      const crossX = start.x + (end.x - start.x) * ratio
      const crossY = start.y + (end.y - start.y) * ratio
      const distanceXY = Math.hypot(crossX - center.x, crossY - center.y)
      if (distanceXY > SUBJECT7_RING_RADIUS_CM + SUBJECT7_RING_RADIUS_TOLERANCE_CM) {
        continue
      }

      events.push({
        ringIndex,
        visitIndex,
        blockId: end.blockId,
      })
    }
  }

  return events
}

const findMinimalBottomToTopPath = (events: RingCrossEvent[]): RingPathWindow | null => {
  let best: RingPathWindow | null = null
  let bestSpan = Number.POSITIVE_INFINITY

  for (let i = 0; i < events.length; i += 1) {
    if (events[i].ringIndex !== 0) {
      continue
    }
    for (let j = i + 1; j < events.length; j += 1) {
      if (events[j].ringIndex !== 1) {
        continue
      }
      for (let k = j + 1; k < events.length; k += 1) {
        if (events[k].ringIndex !== 2) {
          continue
        }
        const span = events[k].visitIndex - events[i].visitIndex
        if (span < bestSpan) {
          bestSpan = span
          best = { first: events[i], second: events[j], third: events[k] }
        }
      }
    }
  }

  return best
}

const MOVE_BLOCK_TYPES = new Set([
  'Goertek_MoveToCoord2',
  'Goertek_Move',
  'Goertek_TakeOff2',
  'Goertek_Land',
])

const countDistinctAllLightColorsInRange = (
  blocks: ParsedBlock[],
  blockIndexById: Map<string, number>,
  startBlockId: string,
  endBlockId: string,
): number => {
  const startBlockIndex = blockIndexById.get(startBlockId)
  const endBlockIndex = blockIndexById.get(endBlockId)
  if (startBlockIndex === undefined || endBlockIndex === undefined || endBlockIndex < startBlockIndex) {
    return 0
  }

  const colors = new Set<string>()

  for (let index = startBlockIndex; index <= endBlockIndex; index += 1) {
    const block = blocks[index]
    if (block.type !== ALL_LIGHT_BLOCK_TYPE) {
      continue
    }
    const normalizedColor = normalizeColorText(block.fields.color1)
    if (normalizedColor) {
      colors.add(normalizedColor)
    }
  }

  for (let index = endBlockIndex + 1; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (MOVE_BLOCK_TYPES.has(block.type)) {
      break
    }
    if (block.type !== ALL_LIGHT_BLOCK_TYPE) {
      continue
    }
    const normalizedColor = normalizeColorText(block.fields.color1)
    if (normalizedColor) {
      colors.add(normalizedColor)
    }
  }

  return colors.size
}

export const checkSubject7PassThreeRingsWithColorChanges = (
  rodA: XYPoint,
  rodB: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): Subject7CheckResult => {
  const center = {
    x: (rodA.x + rodB.x) / 2,
    y: (rodA.y + rodB.y) / 2,
  }
  const events = findRingCrossEvents(center, startPos, blocks)
  const pathWindow = findMinimalBottomToTopPath(events)
  if (!pathWindow || !pathWindow.first.blockId || !pathWindow.third.blockId) {
    return 'no-path'
  }

  const blockIndexById = new Map<string, number>()
  blocks.forEach((block, index) => blockIndexById.set(block.id, index))
  const distinctColorCount = countDistinctAllLightColorsInRange(
    blocks,
    blockIndexById,
    pathWindow.first.blockId,
    pathWindow.third.blockId,
  )
  if (distinctColorCount < 3) {
    return 'color-not-enough'
  }

  return 'ok'
}
