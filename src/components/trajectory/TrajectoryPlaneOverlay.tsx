import { isCountedVisit, type PointSummary } from './trajectoryPlaneUtils'

type PreviewPoint = {
  clientX: number
  clientY: number
  x: number
  y: number
}

type Props = {
  activePoint?: PointSummary
  activePointAnchor?: { xPercent: number; yPercent: number }
  activePointKey?: string
  panelDirection: 'trajectory-visit-panel-up' | 'trajectory-visit-panel-down'
  isDraggingPoint: boolean
  dragPreview?: PreviewPoint
  drawPreview?: PreviewPoint
  onLocateBlock?: (blockId: string) => void
}

function TrajectoryPlaneOverlay({
  activePoint,
  activePointAnchor,
  activePointKey,
  panelDirection,
  isDraggingPoint,
  dragPreview,
  drawPreview,
  onLocateBlock,
}: Props) {
  const countedVisits = activePoint?.visits.filter(isCountedVisit) ?? []
  return (
    <>
      {!!activePoint && !!activePointAnchor && !isDraggingPoint && (
        <div
          className={`trajectory-visit-panel ${panelDirection}`}
          style={{ left: `${activePointAnchor.xPercent}%`, top: `${activePointAnchor.yPercent}%` }}
        >
          <div className="trajectory-visit-title">
            点位 ({activePoint.x}, {activePoint.y}) 经过记录：{activePoint.count} 次
          </div>
          <div className="trajectory-visit-list">
            {countedVisits.map((visit, index) => (
              <div key={`${activePointKey}-${index}`} className="trajectory-visit-item">
                <span>
                  第 {index + 1} 次：X {visit.x}，Y {visit.y}，Z {visit.z}
                </span>
                <button
                  type="button"
                  className="trajectory-locate-btn"
                  onClick={() => onLocateBlock?.(visit.blockId)}
                >
                  定位代码
                </button>
              </div>
            ))}
            {!countedVisits.length && <div className="trajectory-visit-item">无可定位的经过记录</div>}
          </div>
        </div>
      )}
      {!!dragPreview && (
        <div
          className="trajectory-drag-preview"
          style={{
            left: `${dragPreview.clientX + 14}px`,
            top: `${dragPreview.clientY + 14}px`,
          }}
        >
          X {dragPreview.x} · Y {dragPreview.y}
        </div>
      )}
      {!!drawPreview && !dragPreview && (
        <div
          className="trajectory-draw-preview-label"
          style={{
            left: `${drawPreview.clientX + 14}px`,
            top: `${drawPreview.clientY + 14}px`,
          }}
        >
          落点 X {drawPreview.x} · Y {drawPreview.y}
        </div>
      )}
    </>
  )
}

export type { PreviewPoint }
export default TrajectoryPlaneOverlay
