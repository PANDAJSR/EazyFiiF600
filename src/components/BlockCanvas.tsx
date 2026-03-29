import { Empty } from 'antd'
import type { ParsedBlock } from '../types/fii'

type Props = {
  droneName?: string
  blocks: ParsedBlock[]
}

const blockTheme: Record<string, { color: string; bg: string; border: string }> = {
  Goertek_Start: { color: '#5b1f2d', bg: '#ffd1de', border: '#ff7aa2' },
  block_inittime: { color: '#5e2b17', bg: '#ffe2c5', border: '#ffac5f' },
  Goertek_HorizontalSpeed: { color: '#ffffff', bg: '#4d52c5', border: '#7d83ff' },
  Goertek_VerticalSpeed: { color: '#ffffff', bg: '#3f46af', border: '#7077f7' },
  Goertek_UnLock: { color: '#1c5b51', bg: '#b8f3e6', border: '#66d6bf' },
  block_delay: { color: '#1f6a4f', bg: '#c6ffe6', border: '#66dcad' },
  Goertek_TakeOff2: { color: '#ffffff', bg: '#6a53c9', border: '#8d78eb' },
  Goertek_MoveToCoord2: { color: '#ffffff', bg: '#5960db', border: '#8690ff' },
  Goertek_Move: { color: '#ffffff', bg: '#5b65df', border: '#8c94ff' },
  Goertek_Land: { color: '#ffffff', bg: '#5f51ba', border: '#8a79df' },
}

const blockText = (block: ParsedBlock): { title: string; values: string[] } => {
  const f = block.fields
  switch (block.type) {
    case 'Goertek_Start':
      return { title: '开始', values: [] }
    case 'block_inittime':
      return { title: 'Start at', values: [f.time || '00:00'] }
    case 'Goertek_HorizontalSpeed':
      return {
        title: '水平速度',
        values: [`${f.VH ?? '-'} cm/s`, '水平加速度', `${f.AH ?? '-'} cm/s²`],
      }
    case 'Goertek_VerticalSpeed':
      return {
        title: '垂直速度',
        values: [`${f.VV ?? '-'} cm/s`, '垂直加速度', `${f.AV ?? '-'} cm/s²`],
      }
    case 'Goertek_UnLock':
      return { title: '解锁', values: [] }
    case 'block_delay':
      return { title: '延时', values: ['ms', f.time ?? '-'] }
    case 'Goertek_TakeOff2':
      return { title: '起飞', values: [f.alt ?? '-', 'cm'] }
    case 'Goertek_MoveToCoord2':
      return {
        title: '直线移至',
        values: ['X', f.X ?? '-', 'cm', 'Y', f.Y ?? '-', 'cm', 'Z', f.Z ?? '-', 'cm'],
      }
    case 'Goertek_Move':
      return {
        title: '方向移动',
        values: ['X', f.X ?? '-', 'cm', 'Y', f.Y ?? '-', 'cm', 'Z', f.Z ?? '-', 'cm'],
      }
    case 'Goertek_Land':
      return { title: '降落', values: [] }
    default:
      return {
        title: block.type,
        values: Object.entries(f).flatMap(([k, v]) => [k, v]),
      }
  }
}

function BlockCanvas({ droneName, blocks }: Props) {
  if (!blocks.length) {
    return (
      <div className="blocks-empty">
        <Empty description={droneName ? `${droneName} 暂无可展示积木` : '请先选择无人机'} />
      </div>
    )
  }

  return (
    <div className="blocks-wrap">
      {blocks.map((block) => {
        const text = blockText(block)
        const theme = blockTheme[block.type] ?? {
          color: '#17324d',
          bg: '#deefff',
          border: '#8db8e6',
        }

        return (
          <section
            key={block.id}
            className="block-card"
            style={{
              color: theme.color,
              background: theme.bg,
              borderColor: theme.border,
            }}
          >
            <div className="block-title">{text.title}</div>
            {!!text.values.length && (
              <div className="block-values">
                {text.values.map((value, idx) => (
                  <span
                    key={`${block.id}-${idx}`}
                    className={idx % 2 === 1 ? 'block-chip block-chip-value' : 'block-chip'}
                  >
                    {value}
                  </span>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default BlockCanvas
