import type { Visit } from './trajectoryUtils'
import { AUTO_DELAY_BLOCK_TYPE } from '../../utils/autoDelayBlocks'

export type PointSummary = {
  x: number
  y: number
  count: number
  visits: Visit[]
}

export const SNAP_STEP = 10
export const EDITABLE_BLOCK_TYPES = new Set(['Goertek_MoveToCoord2', 'Goertek_Move', AUTO_DELAY_BLOCK_TYPE])
const NON_COUNTED_BLOCK_TYPES = new Set(['Goertek_TakeOff2', 'Goertek_Land'])

export const snapToStep = (value: number, step: number) => Math.round(value / step) * step
export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const clientToSvg = (svg: SVGSVGElement, clientX: number, clientY: number) => {
  const ctm = svg.getScreenCTM()
  if (!ctm) {
    return null
  }
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  const transformed = point.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

export const isCountedVisit = (visit: Visit): visit is Visit & { blockId: string; blockType: string } =>
  !!visit.blockId && !!visit.blockType && !NON_COUNTED_BLOCK_TYPES.has(visit.blockType)

export const summarizePoints = (visits: Visit[]): PointSummary[] => {
  const pointMap = new Map<string, PointSummary>()

  visits.forEach((point) => {
    const key = `${point.x},${point.y}`
    const existing = pointMap.get(key)
    const counted = isCountedVisit(point)
    if (existing) {
      if (counted) {
        existing.count += 1
      }
      existing.visits.push(point)
      return
    }
    pointMap.set(key, { x: point.x, y: point.y, count: counted ? 1 : 0, visits: [point] })
  })

  return [...pointMap.values()]
}
