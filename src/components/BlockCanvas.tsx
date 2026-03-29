import { Empty } from 'antd'
import type { ParsedBlock } from '../types/fii'

type Props = {
  droneName?: string
  blocks: ParsedBlock[]
}

const themeControl = { color: '#17324d', bg: '#eaf3ff', border: '#9bb6de' }
const themeAction = { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' }
const themeKey = { color: '#17324d', bg: '#f1f7ff', border: '#adc3e3' }

const blockTheme: Record<string, { color: string; bg: string; border: string }> = {
  Goertek_Start: themeKey,
  block_inittime: themeKey,
  Goertek_HorizontalSpeed: themeAction,
  Goertek_VerticalSpeed: themeAction,
  Goertek_UnLock: themeAction,
  block_delay: themeControl,
  Goertek_TakeOff2: themeAction,
  Goertek_MoveToCoord2: themeAction,
  Goertek_Move: themeAction,
  Goertek_Land: themeAction,
}

const blockText = (block: ParsedBlock): { title: string; values: string[] } => {
  const f = block.fields
  switch (block.type) {
    case 'Goertek_Start':
      return { title: '开始', values: [] }
    case 'block_inittime':
      return { title: '开始时间', values: [f.time || '00:00'] }
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
            <div className="block-line">
              <span className="block-title">{text.title}</span>
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
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default BlockCanvas
