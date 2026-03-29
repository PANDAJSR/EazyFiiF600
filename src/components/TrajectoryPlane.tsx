import { Empty } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ParsedBlock } from '../types/fii'
import TrajectoryScene3D from './TrajectoryScene3D'
import type { XYZ, Visit } from './trajectory/trajectoryUtils'
import { buildPathVisits, buildTicks, calcTrajectoryBounds } from './trajectory/trajectoryUtils'

type Props = {
  startPos: XYZ
  blocks: ParsedBlock[]
  onLocateBlock?: (blockId: string) => void
  onMovePoint?: (payload: MovePointPayload) => void
  viewMode?: '2d' | '3d'
}

type PointSummary = {
  x: number
  y: number
  count: number
  visits: Visit[]
}

type MovePointPayload = {
  blockId: string
  blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move'
  x: number
  y: number
  baseX?: number
  baseY?: number
}

const VIEWBOX_WIDTH = 680
const VIEWBOX_HEIGHT = 620
const SNAP_STEP = 10
const EDITABLE_BLOCK_TYPES = new Set(['Goertek_MoveToCoord2', 'Goertek_Move'])

const snapToStep = (value: number, step: number) => Math.round(value / step) * step

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

function TrajectoryPlane({ startPos, blocks, onLocateBlock, onMovePoint, viewMode = '2d' }: Props) {
  const visits = useMemo(() => buildPathVisits(startPos, blocks), [blocks, startPos])
  const bounds = useMemo(() => calcTrajectoryBounds(visits), [visits])
  const summarizedPoints = useMemo(() => summarizePoints(visits), [visits])
  const margin = { top: 16, right: 16, bottom: 44, left: 44 }
  const innerWidth = VIEWBOX_WIDTH - margin.left - margin.right
  const innerHeight = VIEWBOX_HEIGHT - margin.top - margin.bottom
  const plotSize = Math.min(innerWidth, innerHeight)
  const plotLeft = margin.left + (innerWidth - plotSize) / 2
  const plotTop = margin.top + (innerHeight - plotSize) / 2

  const toSvgX = (x: number) => plotLeft + ((x - bounds.minX) / bounds.span) * plotSize
  const toSvgY = (y: number) => plotTop + (1 - (y - bounds.minY) / bounds.span) * plotSize
  const [activePointKey, setActivePointKey] = useState<string>()
  const panelRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<MovePointPayload | null>(null)
  const activePoint = activePointKey
    ? summarizedPoints.find((point) => `${point.x},${point.y}` === activePointKey)
    : undefined

  useEffect(() => {
    if (!activePointKey || viewMode !== '2d') {
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
  }, [activePointKey, viewMode])

  useEffect(() => {
    if (viewMode !== '2d') {
      dragRef.current = null
      return
    }

    const onPointerMove = (event: PointerEvent) => {
      const dragging = dragRef.current
      const svg = svgRef.current
      if (!dragging || !svg) {
        return
      }

      const rect = svg.getBoundingClientRect()
      const svgX =
        ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH
      const svgY =
        ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT

      const clampedX = Math.min(Math.max(svgX, plotLeft), plotLeft + plotSize)
      const clampedY = Math.min(Math.max(svgY, plotTop), plotTop + plotSize)
      const x = snapToStep(bounds.minX + ((clampedX - plotLeft) / plotSize) * bounds.span, SNAP_STEP)
      const y = snapToStep(bounds.minY + (1 - (clampedY - plotTop) / plotSize) * bounds.span, SNAP_STEP)

      onMovePoint?.({
        ...dragging,
        x,
        y,
      })
      setActivePointKey(`${x},${y}`)
    }

    const onPointerUp = () => {
      if (!dragRef.current) {
        return
      }
      dragRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [bounds.minX, bounds.minY, bounds.span, onMovePoint, plotLeft, plotSize, plotTop, viewMode])

  if (!visits.length) {
    return <Empty description="暂无可绘制轨迹" />
  }

  const meta =
    viewMode === '3d'
      ? `范围 X: ${bounds.minX} ~ ${bounds.maxX} cm，Y: ${bounds.minY} ~ ${bounds.maxY} cm，Z: ${bounds.minZ} ~ ${bounds.maxZ} cm`
      : `范围 X: ${bounds.minX} ~ ${bounds.maxX} cm，Y: ${bounds.minY} ~ ${bounds.maxY} cm`

  if (viewMode === '3d') {
    return (
      <div className="trajectory-card">
        <div className="trajectory-meta">{meta}</div>
        <TrajectoryScene3D visits={visits} bounds={bounds} onLocateBlock={onLocateBlock} />
      </div>
    )
  }

  const xTicks = buildTicks(bounds.minX, bounds.maxX)
  const yTicks = buildTicks(bounds.minY, bounds.maxY)

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
      <div className="trajectory-meta">{meta}</div>
      <div className="trajectory-canvas-wrap">
        <svg
          ref={svgRef}
          className="trajectory-svg"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          role="img"
        >
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
              <text x={plotLeft - 8} y={toSvgY(tick) + 4} textAnchor="end" className="trajectory-axis-label">
                {tick}
              </text>
            </g>
          ))}
          <polyline points={polylinePoints} className="trajectory-line" />
          {summarizedPoints.map((point) => {
            const key = `${point.x},${point.y}`
            const isActive = activePointKey === key
            const editableVisits = point.visits.filter(
              (visit): visit is Visit & { blockId: string; blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move' } =>
                !!visit.blockId && !!visit.blockType && EDITABLE_BLOCK_TYPES.has(visit.blockType),
            )
            const canDrag = editableVisits.length === 1

            return (
              <g
                key={`point-${point.x}-${point.y}`}
                className="trajectory-point-group"
                onClick={() => setActivePointKey(key)}
                onPointerDown={(event) => {
                  if (!canDrag || !onMovePoint) {
                    return
                  }
                  event.preventDefault()
                  event.stopPropagation()
                  const targetVisit = editableVisits[0]
                  dragRef.current = {
                    blockId: targetVisit.blockId,
                    blockType: targetVisit.blockType,
                    x: targetVisit.x,
                    y: targetVisit.y,
                    baseX: targetVisit.baseX,
                    baseY: targetVisit.baseY,
                  }
                  setActivePointKey(key)
                }}
              >
                <circle
                  cx={toSvgX(point.x)}
                  cy={toSvgY(point.y)}
                  r={isActive ? 7 : 6}
                  className={
                    isActive
                      ? `trajectory-point trajectory-point-active ${canDrag ? 'trajectory-point-draggable' : ''}`
                      : `trajectory-point ${canDrag ? 'trajectory-point-draggable' : ''}`
                  }
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
