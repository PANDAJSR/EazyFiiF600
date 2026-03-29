import { Tag } from 'antd'
import type { DroneProgram } from '../types/fii'

type Props = {
  programs: DroneProgram[]
  selectedId?: string
  onSelect: (id: string) => void
}

function DroneSidebar({ programs, selectedId, onSelect }: Props) {
  return (
    <div className="drone-sidebar">
      <div className="sidebar-title">无人机列表</div>
      {programs.map(({ drone, blocks }, index) => {
        const active = drone.id === selectedId
        return (
          <button
            type="button"
            key={drone.id}
            className={`drone-item ${active ? 'active' : ''}`}
            onClick={() => onSelect(drone.id)}
          >
            <div className="drone-item-head">
              <span>{drone.name || `无人机${index + 1}`}</span>
              <Tag color={active ? 'gold' : 'default'}>{blocks.length} 块</Tag>
            </div>
            <div className="drone-item-meta">动作组: {drone.actionGroup || '-'}</div>
            <div className="drone-item-meta">
              起点: X {drone.startPos.x || '-'} / Y {drone.startPos.y || '-'} / Z{' '}
              {drone.startPos.z || '-'}
            </div>
          </button>
        )
      })}
      {!programs.length && <div className="sidebar-empty">请先导入 .fii 文件</div>}
    </div>
  )
}

export default DroneSidebar
