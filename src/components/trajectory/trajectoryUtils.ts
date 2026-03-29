import type { ParsedBlock } from '../../types/fii'

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
    if (block.type === 'Goertek_MoveToCoord2') {
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
      })
      return
    }

    if (block.type === 'Goertek_Move') {
      const deltaX = toNumber(block.fields.X)
      const deltaY = toNumber(block.fields.Y)
      if (deltaX === null || deltaY === null) {
        return
      }
      const deltaZ = toNumber(block.fields.Z) ?? 0
      currentX += deltaX
      currentY += deltaY
      currentZ += deltaZ
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        blockId: block.id,
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
