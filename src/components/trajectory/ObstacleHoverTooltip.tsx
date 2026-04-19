import type { RodObstacleHoverInfo } from './trajectoryObstacleHover'

type Props = {
  tooltip?: {
    clientX: number
    clientY: number
    info: RodObstacleHoverInfo
  }
}

function ObstacleHoverTooltip({ tooltip }: Props) {
  if (!tooltip) {
    return null
  }

  return (
    <div
      className="trajectory-obstacle-hover-tooltip"
      style={{
        left: `${tooltip.clientX + 14}px`,
        top: `${tooltip.clientY + 14}px`,
      }}
    >
      <div className="trajectory-obstacle-hover-title">
        {tooltip.info.subjectLabel} · {tooltip.info.typeLabel}
      </div>
      {tooltip.info.details.map((detail, index) => (
        <div key={`${tooltip.info.key}-${index}`} className="trajectory-obstacle-hover-detail">
          {detail}
        </div>
      ))}
    </div>
  )
}

export default ObstacleHoverTooltip
