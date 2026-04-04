import { Tag, Typography } from 'antd'
import type { ReactNode } from 'react'
import type { AgentToolName } from '../../types/agent'

export type ToolCallBadge = {
  toolCallId: string
  toolIndex?: number
  tool: AgentToolName
  phase: 'model' | 'exec-start' | 'exec-end'
  textOffset: number
  commandPreview?: string
  granted?: boolean
  resultPreview?: string
}

type ToolCallTimelineProps = {
  text: string
  markers: ToolCallBadge[]
}

const clampOffset = (offset: number, max: number) => {
  if (!Number.isFinite(offset)) {
    return 0
  }
  return Math.max(0, Math.min(max, Math.floor(offset)))
}

const markerStatus = (marker: ToolCallBadge) => {
  if (marker.phase === 'model') {
    return '模型发起'
  }
  if (marker.phase === 'exec-start') {
    return '工具执行中'
  }
  return marker.granted === false ? '工具已拒绝' : '工具已完成'
}

const markerCommand = (marker: ToolCallBadge) => {
  const command = marker.commandPreview?.trim()
  if (!command) {
    return '(参数解析中...)'
  }
  return command.length > 120 ? `${command.slice(0, 120)}...` : command
}

const renderMarker = (marker: ToolCallBadge) => {
  const label = markerStatus(marker)
  return (
    <span
      key={`${marker.toolCallId}_${marker.toolIndex ?? 'na'}`}
      style={{
        display: 'block',
        margin: '6px 0',
        padding: '6px 8px',
        border: '1px solid #cfe1ff',
        borderRadius: 8,
        background: '#f6faff',
      }}
    >
      <Tag color="blue">{marker.tool}</Tag>
      <Tag color={marker.phase === 'exec-end' ? 'green' : 'processing'}>{label}</Tag>
      <Typography.Text type="secondary" style={{ marginLeft: 4 }}>
        调用位置: 第 {marker.textOffset + 1} 个字符
      </Typography.Text>
      <Typography.Paragraph code style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
        {markerCommand(marker)}
      </Typography.Paragraph>
    </span>
  )
}

export default function ToolCallTimeline({ text, markers }: ToolCallTimelineProps) {
  if (!markers.length) {
    return (
      <Typography.Paragraph style={{ marginTop: 8, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
        {text}
      </Typography.Paragraph>
    )
  }

  const sorted = [...markers].sort((a, b) => {
    if (a.textOffset !== b.textOffset) {
      return a.textOffset - b.textOffset
    }
    return (a.toolIndex ?? Number.MAX_SAFE_INTEGER) - (b.toolIndex ?? Number.MAX_SAFE_INTEGER)
  })

  const groups = new Map<number, ToolCallBadge[]>()
  for (const marker of sorted) {
    const key = clampOffset(marker.textOffset, text.length)
    const current = groups.get(key) ?? []
    current.push(marker)
    groups.set(key, current)
  }

  const offsets = [...groups.keys()].sort((a, b) => a - b)
  const nodes: ReactNode[] = []
  let cursor = 0

  offsets.forEach((offset, index) => {
    if (offset > cursor) {
      nodes.push(<span key={`text_${index}`}>{text.slice(cursor, offset)}</span>)
    }
    for (const marker of groups.get(offset) ?? []) {
      nodes.push(renderMarker(marker))
    }
    cursor = offset
  })

  if (cursor < text.length) {
    nodes.push(<span key="text_tail">{text.slice(cursor)}</span>)
  }

  return (
    <Typography.Paragraph style={{ marginTop: 8, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
      {nodes}
    </Typography.Paragraph>
  )
}
