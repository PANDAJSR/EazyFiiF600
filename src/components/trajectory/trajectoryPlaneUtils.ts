import type { Visit } from './trajectoryUtils'

export type PointSummary = {
  x: number
  y: number
  count: number
  visits: Visit[]
}

export const SNAP_STEP = 10
export const EDITABLE_BLOCK_TYPES = new Set(['Goertek_MoveToCoord2', 'Goertek_Move'])

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

export const summarizePoints = (visits: Visit[]): PointSummary[] => {
  const pointMap = new Map<string, PointSummary>()

  visits.forEach((point) => {
    const key = `${point.x},${point.y}`
    const existing = pointMap.get(key)
    if (existing) {
      existing.count += 1
      existing.visits.push(point)
      return
    }
    pointMap.set(key, { x: point.x, y: point.y, count: 1, visits: [point] })
  })

  return [...pointMap.values()]
}
