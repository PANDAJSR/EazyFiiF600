import { Empty } from 'antd'
import type { ParsedBlock } from '../types/fii'

type Props = {
  droneName?: string
  blocks: ParsedBlock[]
}

type BlockToken = {
  text: string
  value?: boolean
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

const token = (text: string, value = false): BlockToken => ({ text, value })

const blockText = (block: ParsedBlock): { title: string; values: BlockToken[] } => {
  const f = block.fields
  switch (block.type) {
    case 'Goertek_Start':
      return { title: '开始', values: [] }
    case 'block_inittime':
      return { title: '开始时间', values: [token(f.time || '00:00', true)] }
    case 'Goertek_HorizontalSpeed':
      return {
        title: '水平速度',
        values: [
          token('速度'),
          token(`${f.VH ?? '-'} cm/s`, true),
          token('加速度'),
          token(`${f.AH ?? '-'} cm/s²`, true),
        ],
      }
    case 'Goertek_VerticalSpeed':
      return {
        title: '垂直速度',
        values: [
          token('速度'),
          token(`${f.VV ?? '-'} cm/s`, true),
          token('加速度'),
          token(`${f.AV ?? '-'} cm/s²`, true),
        ],
      }
    case 'Goertek_UnLock':
      return { title: '解锁', values: [] }
    case 'block_delay':
      return { title: '延时', values: [token('ms'), token(f.time ?? '-', true)] }
    case 'Goertek_TakeOff2':
      return { title: '起飞', values: [token(f.alt ?? '-', true), token('cm')] }
    case 'Goertek_MoveToCoord2':
      return {
        title: '直线移至',
        values: [
          token('X'),
          token(f.X ?? '-', true),
          token('cm'),
          token('Y'),
          token(f.Y ?? '-', true),
          token('cm'),
          token('Z'),
          token(f.Z ?? '-', true),
          token('cm'),
        ],
      }
    case 'Goertek_Move':
      return {
        title: '方向移动',
        values: [
          token('X'),
          token(f.X ?? '-', true),
          token('cm'),
          token('Y'),
          token(f.Y ?? '-', true),
          token('cm'),
          token('Z'),
          token(f.Z ?? '-', true),
          token('cm'),
        ],
      }
    case 'Goertek_Land':
      return { title: '降落', values: [] }
    default:
      return {
        title: block.type,
        values: Object.entries(f).flatMap(([k, v]) => [token(k), token(v, true)]),
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
                      className={value.value ? 'block-chip block-chip-value' : 'block-chip'}
                    >
                      {value.text}
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
