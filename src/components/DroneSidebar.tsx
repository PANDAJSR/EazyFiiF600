import { Button, Checkbox, Tag } from 'antd'
import type { DroneProgram } from '../types/fii'

type Props = {
  programs: DroneProgram[]
  selectedId?: string
  visibleTrajectoryIds?: string[]
  onSelect: (id: string) => void
  onCreateDrone?: () => void
  onEditDrone?: (id: string) => void
  onToggleTrajectoryVisibility?: (id: string, checked: boolean) => void
}

function DroneSidebar({
  programs,
  selectedId,
  visibleTrajectoryIds = [],
  onSelect,
  onCreateDrone,
  onEditDrone,
  onToggleTrajectoryVisibility,
}: Props) {
  const visibleSet = new Set(visibleTrajectoryIds)

  return (
    <div className="drone-sidebar">
      <div className="sidebar-title-wrap">
        <div className="sidebar-title">无人机列表</div>
        <Button size="small" type="primary" onClick={onCreateDrone}>
          新建无人机
        </Button>
      </div>
      {programs.map(({ drone, blocks }, index) => {
        const active = drone.id === selectedId
        const checked = visibleSet.has(drone.id)

        return (
          <div
            role="button"
            tabIndex={0}
            key={drone.id}
            className={`drone-item ${active ? 'active' : ''}`}
            onClick={() => onSelect(drone.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(drone.id)
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              onEditDrone?.(drone.id)
            }}
          >
            <div className="drone-item-head">
              <label className="drone-item-title-wrap" onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={checked}
                  onChange={(event) => onToggleTrajectoryVisibility?.(drone.id, event.target.checked)}
                  aria-label={`${drone.name || `无人机${index + 1}`}轨迹可见`}
                />
                <span>{drone.name || `无人机${index + 1}`}</span>
              </label>
              <Tag color={active ? 'gold' : 'default'}>{blocks.length} 块</Tag>
            </div>
            <div className="drone-item-meta">动作组: {drone.actionGroup || '-'}</div>
            <div className="drone-item-meta">
              起点: X {drone.startPos.x || '-'} / Y {drone.startPos.y || '-'} / Z {drone.startPos.z || '-'}
            </div>
          </div>
        )
      })}
      {!programs.length && <div className="sidebar-empty">暂无无人机，请先新建</div>}
    </div>
  )
}

export default DroneSidebar
