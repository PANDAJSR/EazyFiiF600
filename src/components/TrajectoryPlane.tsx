import { Empty, Segmented } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ParsedBlock } from '../types/fii'
import TrajectoryScene3D from './TrajectoryScene3D'
import type { TrajectoryDisplay } from './useTrajectoryVisibility'
import type { RodConfig } from './trajectory/rodConfig'
import type { MovePointPayload } from './trajectory/trajectoryScene3dUtils'
import { buildRodMarkers, buildTakeoffZone } from './trajectory/trajectoryPlaneDecorations'
import { buildLightColorSegments, buildPathVisits, buildTicks, calcTrajectoryBounds, type TrajectoryBounds, type XYZ, type Visit } from './trajectory/trajectoryUtils'
import { clamp, clientToSvg, EDITABLE_BLOCK_TYPES, isCountedVisit, snapToStep, SNAP_STEP, summarizePoints } from './trajectory/trajectoryPlaneUtils'
import TrajectoryPlaneOverlay, { type PreviewPoint } from './trajectory/TrajectoryPlaneOverlay'
type Props = {
  startPos: XYZ
  blocks: ParsedBlock[]
  pathDrawingMode?: boolean
  selectedBlockId?: string
  onDrawPathPoint?: (x: number, y: number) => void
  onLocateBlock?: (blockId: string) => void
  onMovePoint?: (payload: MovePointPayload) => void
  viewMode?: '2d' | '3d'
  rodConfig?: RodConfig
  backgroundTrajectories?: TrajectoryDisplay[]
  activeTrajectoryColor?: string
}

type PathLineColorMode = 'fixed' | 'light'
const VIEWBOX_WIDTH = 680, VIEWBOX_HEIGHT = 620
function TrajectoryPlane({
  startPos,
  blocks,
  pathDrawingMode = false,
  selectedBlockId,
  onDrawPathPoint,
  onLocateBlock,
  onMovePoint,
  viewMode = '2d',
  rodConfig,
  backgroundTrajectories = [],
  activeTrajectoryColor = '#1b6ed6',
}: Props) {
  const visits = useMemo(() => {
    const result = buildPathVisits(startPos, blocks)
    console.log('[TrajectoryPlane] visits recomputed, blocks length:', blocks.length, 'visits length:', result.length)
    return result
  }, [blocks, startPos])
  const backgroundVisits = useMemo(() => backgroundTrajectories.map((item) => ({ ...item, visits: buildPathVisits(item.startPos, item.blocks) })), [backgroundTrajectories])
  const allRenderedVisits = useMemo(() => [...visits, ...backgroundVisits.flatMap((item) => item.visits)], [backgroundVisits, visits])
  const bounds = useMemo(() => {
    const result = calcTrajectoryBounds(allRenderedVisits)
    console.log('[TrajectoryPlane] bounds recomputed, span:', result.span)
    return result
  }, [allRenderedVisits])
  const summarizedPoints = useMemo(() => summarizePoints(visits), [visits])
  const lightColorSegments = useMemo(() => buildLightColorSegments(blocks, visits), [blocks, visits])
  const margin = { top: 16, right: 16, bottom: 44, left: 44 }
  const innerWidth = VIEWBOX_WIDTH - margin.left - margin.right
  const innerHeight = VIEWBOX_HEIGHT - margin.top - margin.bottom
  const plotSize = Math.min(innerWidth, innerHeight)
  const plotLeft = margin.left + (innerWidth - plotSize) / 2, plotTop = margin.top + (innerHeight - plotSize) / 2
  const toSvgX = (x: number) => plotLeft + ((x - displayBounds.minX) / displayBounds.span) * plotSize
  const toSvgY = (y: number) => plotTop + (1 - (y - displayBounds.minY) / displayBounds.span) * plotSize
  const [activePointKey, setActivePointKey] = useState<string>()
  const [isDraggingPoint, setIsDraggingPoint] = useState(false)
  const [frozenBounds, setFrozenBounds] = useState<TrajectoryBounds | null>(null)
  const [activePointAnchor, setActivePointAnchor] = useState<{ xPercent: number; yPercent: number }>()
  const [dragPreview, setDragPreview] = useState<PreviewPoint>()
  const [drawPreview, setDrawPreview] = useState<PreviewPoint>()
  const [pathLineColorMode, setPathLineColorMode] = useState<PathLineColorMode>('fixed')
  const panelRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<MovePointPayload | null>(null)
  const dragBoundsRef = useRef<TrajectoryBounds | null>(null)
  const displayBounds = isDraggingPoint && frozenBounds ? frozenBounds : bounds
  const activePoint = activePointKey ? summarizedPoints.find((point) => `${point.x},${point.y}` === activePointKey) : undefined
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
      dragBoundsRef.current = null
      return
    }
    const onPointerMove = (event: PointerEvent) => {
      const dragging = dragRef.current
      const svg = svgRef.current
      if (!dragging || !svg) {
        return
      }
      const svgPoint = clientToSvg(svg, event.clientX, event.clientY)
      if (!svgPoint) {
        return
      }
      const clampedX = Math.min(Math.max(svgPoint.x, plotLeft), plotLeft + plotSize)
      const clampedY = Math.min(Math.max(svgPoint.y, plotTop), plotTop + plotSize)
      const dragBounds = dragBoundsRef.current ?? bounds
      const x = snapToStep(dragBounds.minX + ((clampedX - plotLeft) / plotSize) * dragBounds.span, SNAP_STEP)
      const y = snapToStep(dragBounds.minY + (1 - (clampedY - plotTop) / plotSize) * dragBounds.span, SNAP_STEP)
      onMovePoint?.({
        ...dragging,
        x,
        y,
      })
      setActivePointKey(`${x},${y}`)
      setDragPreview({ clientX: event.clientX, clientY: event.clientY, x, y })
    }
    const onPointerUp = () => {
      if (!dragRef.current) {
        return
      }
      dragRef.current = null
      dragBoundsRef.current = null
      setFrozenBounds(null)
      setIsDraggingPoint(false)
      setDragPreview(undefined)
      setActivePointKey(undefined)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [bounds, onMovePoint, plotLeft, plotSize, plotTop, viewMode])
  useEffect(() => {
    if (viewMode !== '2d' || isDraggingPoint || !activePoint) {
      return
    }
    const svg = svgRef.current
    const wrap = canvasWrapRef.current
    if (!svg || !wrap) {
      return
    }
    const updateAnchor = () => {
      const svgPointX = plotLeft + ((activePoint.x - displayBounds.minX) / displayBounds.span) * plotSize
      const svgPointY = plotTop + (1 - (activePoint.y - displayBounds.minY) / displayBounds.span) * plotSize
      const ctm = svg.getScreenCTM()
      if (!ctm) {
        return
      }
      const point = svg.createSVGPoint()
      point.x = svgPointX
      point.y = svgPointY
      const screenPoint = point.matrixTransform(ctm)
      const wrapRect = wrap.getBoundingClientRect()
      const xPercent = clamp(((screenPoint.x - wrapRect.left) / wrapRect.width) * 100, 18, 82)
      const yPercent = ((screenPoint.y - wrapRect.top) / wrapRect.height) * 100
      setActivePointAnchor({ xPercent, yPercent })
    }
    const rafId = window.requestAnimationFrame(updateAnchor)
    window.addEventListener('resize', updateAnchor)
    window.addEventListener('scroll', updateAnchor, true)
    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', updateAnchor)
      window.removeEventListener('scroll', updateAnchor, true)
    }
  }, [activePoint, displayBounds.maxX, displayBounds.maxY, displayBounds.minX, displayBounds.minY, displayBounds.span, isDraggingPoint, plotLeft, plotSize, plotTop, viewMode])
  if (!allRenderedVisits.length) {
    return <Empty description="暂无可绘制轨迹" />
  }
  const meta = viewMode === '3d' ? `范围 X: ${displayBounds.minX} ~ ${displayBounds.maxX} cm，Y: ${displayBounds.minY} ~ ${displayBounds.maxY} cm，Z: ${displayBounds.minZ} ~ ${displayBounds.maxZ} cm` : `范围 X: ${displayBounds.minX} ~ ${displayBounds.maxX} cm，Y: ${displayBounds.minY} ~ ${displayBounds.maxY} cm`
  if (viewMode === '3d') {
    return (
      <div className="trajectory-card">
        <div className="trajectory-meta">{meta}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#666' }}>路径线颜色：</span>
          <Segmented<PathLineColorMode>
            size="small"
            value={pathLineColorMode}
            onChange={(value) => setPathLineColorMode(value)}
            options={[
              { label: '固定颜色', value: 'fixed' },
              { label: '灯光颜色', value: 'light' },
            ]}
          />
        </div>
        <TrajectoryScene3D
          visits={visits}
          bounds={bounds}
          rodConfig={rodConfig}
          selectedBlockId={selectedBlockId}
          onLocateBlock={onLocateBlock}
          onMovePoint={onMovePoint}
          backgroundTrajectories={backgroundVisits}
          activeTrajectoryColor={activeTrajectoryColor}
          lightColorSegments={pathLineColorMode === 'light' ? lightColorSegments : []}
        />
      </div>
    )
  }
  const [xTicks, yTicks] = [buildTicks(displayBounds.minX, displayBounds.maxX), buildTicks(displayBounds.minY, displayBounds.maxY)], polylinePoints = visits.map((point) => `${toSvgX(point.x)},${toSvgY(point.y)}`).join(' ')
  const rodMarkers = buildRodMarkers(rodConfig)
  const takeoffZonePoints = buildTakeoffZone(rodConfig), takeoffZonePolygon = takeoffZonePoints.map((point) => `${toSvgX(point.x)},${toSvgY(point.y)}`).join(' ')
  const panelDirection = activePointAnchor && activePointAnchor.yPercent > 54 ? 'trajectory-visit-panel-up' : 'trajectory-visit-panel-down'
  const resolveDrawPreviewPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) {
      return null
    }
    const svgPoint = clientToSvg(svg, clientX, clientY)
    if (!svgPoint) {
      return null
    }
    if (svgPoint.x < plotLeft || svgPoint.x > plotLeft + plotSize || svgPoint.y < plotTop || svgPoint.y > plotTop + plotSize) {
      return null
    }
    const x = snapToStep(displayBounds.minX + ((svgPoint.x - plotLeft) / plotSize) * displayBounds.span, SNAP_STEP)
    const y = snapToStep(displayBounds.minY + (1 - (svgPoint.y - plotTop) / plotSize) * displayBounds.span, SNAP_STEP)
    return {
      clientX,
      clientY,
      x,
      y,
      svgX: toSvgX(x),
      svgY: toSvgY(y),
    }
  }
  const activeDrawPreview = pathDrawingMode ? drawPreview : undefined
  const drawPreviewLinePoints = activeDrawPreview ? `${toSvgX(visits[visits.length - 1].x)},${toSvgY(visits[visits.length - 1].y)} ${toSvgX(activeDrawPreview.x)},${toSvgY(activeDrawPreview.y)}` : ''
  return (
    <div className="trajectory-card">
      <div className="trajectory-meta">{meta}</div>
      <div ref={canvasWrapRef} className="trajectory-canvas-wrap">
        <svg
          ref={svgRef}
          className={`trajectory-svg${pathDrawingMode ? ' trajectory-svg-drawing' : ''}`}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          role="img"
          onPointerMove={(event) => {
            if (!pathDrawingMode) {
              return
            }
            const preview = resolveDrawPreviewPoint(event.clientX, event.clientY)
            if (!preview) {
              setDrawPreview(undefined)
              return
            }
            setDrawPreview({ clientX: preview.clientX, clientY: preview.clientY, x: preview.x, y: preview.y })
          }}
          onPointerLeave={() => {
            if (!pathDrawingMode) {
              return
            }
            setDrawPreview(undefined)
          }}
          onClick={(event) => {
            if (!pathDrawingMode || !onDrawPathPoint) {
              return
            }
            const preview = resolveDrawPreviewPoint(event.clientX, event.clientY)
            if (!preview) {
              return
            }
            onDrawPathPoint(preview.x, preview.y)
            setDrawPreview(undefined)
          }}
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
          {takeoffZonePoints.length === 4 && <polygon points={takeoffZonePolygon} className="trajectory-takeoff-zone" />}
          {backgroundVisits.map((item) => <polyline key={`trajectory-bg-${item.droneId}`} points={item.visits.map((point) => `${toSvgX(point.x)},${toSvgY(point.y)}`).join(' ')} className="trajectory-line" style={{ stroke: item.color, opacity: 0.8 }} />)}
          <polyline points={polylinePoints} className="trajectory-line" style={{ stroke: activeTrajectoryColor }} />
          {rodMarkers.map((marker, index) => (
            <g key={`rod-${index}-${marker.marker}-${marker.x}-${marker.y}`} className="trajectory-rod-marker">
              <circle cx={toSvgX(marker.x)} cy={toSvgY(marker.y)} r={10} className="trajectory-rod-marker-circle" />
              <text x={toSvgX(marker.x)} y={toSvgY(marker.y) + 4} textAnchor="middle" className="trajectory-rod-marker-text">
                {marker.marker}
              </text>
            </g>
          ))}
          {!!activeDrawPreview && (
            <>
              <polyline points={drawPreviewLinePoints} className="trajectory-draw-preview-line" />
              <circle cx={toSvgX(activeDrawPreview.x)} cy={toSvgY(activeDrawPreview.y)} r={6} className="trajectory-draw-preview-point" />
            </>
          )}
          {summarizedPoints.map((point) => {
            const key = `${point.x},${point.y}`
            const isActive = activePointKey === key
            const isSelected = selectedBlockId ? point.visits.some((v) => v.blockId === selectedBlockId) : false
            const editableVisits = point.visits.filter(
              (visit): visit is Visit & { blockId: string; blockType: MovePointPayload['blockType'] } =>
                !!visit.blockId && !!visit.blockType && EDITABLE_BLOCK_TYPES.has(visit.blockType),
            )
            const countedVisits = point.visits.filter(isCountedVisit)
            const canDrag = editableVisits.length === 1
            return (
              <g
                key={`point-${point.x}-${point.y}`}
                className="trajectory-point-group"
                onClick={(event) => {
                  if (pathDrawingMode) {
                    event.stopPropagation()
                    onDrawPathPoint?.(point.x, point.y)
                    return
                  }
                  if (countedVisits.length === 1) {
                    onLocateBlock?.(countedVisits[0].blockId)
                    setActivePointKey(undefined)
                    return
                  }
                  setActivePointKey(key)
                }}
                onPointerDown={(event) => {
                  if (pathDrawingMode || !canDrag || !onMovePoint) {
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
                  dragBoundsRef.current = bounds
                  setFrozenBounds(bounds)
                  setIsDraggingPoint(true)
                  setActivePointKey(key)
                  setDragPreview({
                    clientX: event.clientX,
                    clientY: event.clientY,
                    x: targetVisit.x,
                    y: targetVisit.y,
                  })
                }}
              >
                <circle
                  cx={toSvgX(point.x)}
                  cy={toSvgY(point.y)}
                  r={isActive ? 7 : 6}
                  className={
                    isActive
                      ? `trajectory-point trajectory-point-active ${canDrag ? 'trajectory-point-draggable' : ''}`
                      : isSelected
                        ? `trajectory-point trajectory-point-selected ${canDrag ? 'trajectory-point-draggable' : ''}`
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
        <div ref={panelRef}>
          <TrajectoryPlaneOverlay
            activePoint={pathDrawingMode ? undefined : activePoint}
            activePointAnchor={activePointAnchor}
            activePointKey={activePointKey}
            panelDirection={panelDirection}
            isDraggingPoint={isDraggingPoint}
            dragPreview={dragPreview}
            drawPreview={activeDrawPreview}
            onLocateBlock={onLocateBlock}
          />
        </div>
      </div>
    </div>
  )
}
export default TrajectoryPlane
