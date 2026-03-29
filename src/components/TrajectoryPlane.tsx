import { Empty } from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { ParsedBlock } from '../types/fii'

type XYZ = {
  x: string
  y: string
  z: string
}

type Props = {
  startPos: XYZ
  blocks: ParsedBlock[]
  onLocateBlock?: (blockId: string) => void
}

type Visit = {
  x: number
  y: number
  z: number
  blockId?: string
}

type PointSummary = {
  x: number
  y: number
  count: number
  visits: Visit[]
}

const VIEWBOX_WIDTH = 780
const VIEWBOX_HEIGHT = 620
const GRID_STEP = 20

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const buildPathVisits = (startPos: XYZ, blocks: ParsedBlock[]): Visit[] => {
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

const buildTicks = (min: number, max: number): number[] => {
  const ticks: number[] = []
  for (let value = min; value <= max; value += GRID_STEP) {
    ticks.push(value)
  }
  return ticks
}

const summarizePoints = (visits: Visit[]): PointSummary[] => {
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

function TrajectoryPlane({ startPos, blocks, onLocateBlock }: Props) {
  const visits = buildPathVisits(startPos, blocks)
  const summarizedPoints = summarizePoints(visits)
  const [activePointKey, setActivePointKey] = useState<string>()
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const activePoint = activePointKey
    ? summarizedPoints.find((point) => `${point.x},${point.y}` === activePointKey)
    : undefined

  useEffect(() => {
    if (!activePointKey) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }

      if (panelRef.current?.contains(target)) {
        return
      }

      if (target.closest('.trajectory-point-group')) {
        return
      }

      setActivePointKey(undefined)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [activePointKey])

  if (!visits.length) {
    return <Empty description="暂无可绘制轨迹" />
  }

  const rawMinX = Math.min(0, ...visits.map((point) => point.x))
  const rawMaxX = Math.max(360, ...visits.map((point) => point.x))
  const rawMinY = Math.min(0, ...visits.map((point) => point.y))
  const rawMaxY = Math.max(360, ...visits.map((point) => point.y))

  const minXBase = Math.floor(rawMinX / GRID_STEP) * GRID_STEP
  const maxXBase = Math.ceil(rawMaxX / GRID_STEP) * GRID_STEP
  const minYBase = Math.floor(rawMinY / GRID_STEP) * GRID_STEP
  const maxYBase = Math.ceil(rawMaxY / GRID_STEP) * GRID_STEP

  const margin = { top: 16, right: 16, bottom: 44, left: 44 }
  const innerWidth = VIEWBOX_WIDTH - margin.left - margin.right
  const innerHeight = VIEWBOX_HEIGHT - margin.top - margin.bottom
  const xSpanBase = Math.max(maxXBase - minXBase, GRID_STEP)
  const ySpanBase = Math.max(maxYBase - minYBase, GRID_STEP)
  const span = Math.max(xSpanBase, ySpanBase)

  const minX = minXBase
  const maxX = minXBase + span
  const minY = minYBase
  const maxY = minYBase + span

  const plotSize = Math.min(innerWidth, innerHeight)
  const plotLeft = margin.left + (innerWidth - plotSize) / 2
  const plotTop = margin.top + (innerHeight - plotSize) / 2

  const toSvgX = (x: number) => plotLeft + ((x - minX) / span) * plotSize
  const toSvgY = (y: number) => plotTop + (1 - (y - minY) / span) * plotSize

  const xTicks = buildTicks(minX, maxX)
  const yTicks = buildTicks(minY, maxY)

  const polylinePoints = visits.map((point) => `${toSvgX(point.x)},${toSvgY(point.y)}`).join(' ')
  const activePointAnchor = activePoint
    ? {
        xPercent: Math.max(18, Math.min(82, (toSvgX(activePoint.x) / VIEWBOX_WIDTH) * 100)),
        yPercent: (toSvgY(activePoint.y) / VIEWBOX_HEIGHT) * 100,
      }
    : undefined
  const panelDirection =
    activePointAnchor && activePointAnchor.yPercent > 54 ? 'trajectory-visit-panel-up' : 'trajectory-visit-panel-down'

  return (
    <div className="trajectory-card">
      <div className="trajectory-meta">
        范围 X: {minX} ~ {maxX} cm，Y: {minY} ~ {maxY} cm
      </div>
      <div ref={wrapRef} className="trajectory-canvas-wrap">
        <svg className="trajectory-svg" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img">
          <rect
            x={plotLeft}
            y={plotTop}
            width={plotSize}
            height={plotSize}
            className="trajectory-grid-bg"
          />
          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={toSvgX(tick)}
                y1={plotTop}
                x2={toSvgX(tick)}
                y2={plotTop + plotSize}
                className="trajectory-grid-line"
              />
              <text
                x={toSvgX(tick)}
                y={plotTop + plotSize + 18}
                textAnchor="middle"
                className="trajectory-axis-label"
              >
                {tick}
              </text>
            </g>
          ))}
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={plotLeft}
                y1={toSvgY(tick)}
                x2={plotLeft + plotSize}
                y2={toSvgY(tick)}
                className="trajectory-grid-line"
              />
              <text
                x={plotLeft - 8}
                y={toSvgY(tick) + 4}
                textAnchor="end"
                className="trajectory-axis-label"
              >
                {tick}
              </text>
            </g>
          ))}
          <polyline points={polylinePoints} className="trajectory-line" />
          {summarizedPoints.map((point) => {
            const key = `${point.x},${point.y}`
            const isActive = activePointKey === key
            return (
              <g
                key={`point-${point.x}-${point.y}`}
                className="trajectory-point-group"
                onClick={() => setActivePointKey(key)}
              >
                <circle
                  cx={toSvgX(point.x)}
                  cy={toSvgY(point.y)}
                  r={isActive ? 7 : 6}
                  className={isActive ? 'trajectory-point trajectory-point-active' : 'trajectory-point'}
                />
                {point.count > 1 && (
                  <text
                    x={toSvgX(point.x)}
                    y={toSvgY(point.y) + 3.8}
                    textAnchor="middle"
                    className="trajectory-point-count"
                  >
                    {point.count}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {!!activePoint && !!activePointAnchor && (
          <div
            ref={panelRef}
            className={`trajectory-visit-panel ${panelDirection}`}
            style={{ left: `${activePointAnchor.xPercent}%`, top: `${activePointAnchor.yPercent}%` }}
          >
            <div className="trajectory-visit-title">
              点位 ({activePoint.x}, {activePoint.y}) 经过记录：{activePoint.count} 次
            </div>
            <div className="trajectory-visit-list">
              {activePoint.visits.map((visit, index) => (
                <div key={`${activePointKey}-${index}`} className="trajectory-visit-item">
                  <span>
                    第 {index + 1} 次：X {visit.x}，Y {visit.y}，Z {visit.z}
                  </span>
                  {!!visit.blockId && (
                    <button
                      type="button"
                      className="trajectory-locate-btn"
                      onClick={() => {
                        if (visit.blockId) {
                          onLocateBlock?.(visit.blockId)
                        }
                      }}
                    >
                      定位代码
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrajectoryPlane
