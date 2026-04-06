import { Collapse, Space, Tag, Typography } from 'antd'
import type { ReactNode } from 'react'
import type { AgentToolName } from '../../types/agent'
import AgentMarkdown from './AgentMarkdown'

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

type ToolCallTimelineProps = { text: string; markers: ToolCallBadge[] }

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
  return command
}

const clampOffset = (offset: number, textLength: number) => {
  if (!Number.isFinite(offset)) {
    return 0
  }
  return Math.min(textLength, Math.max(0, Math.floor(offset)))
}

const renderMarker = (marker: ToolCallBadge, index: number) => {
  const label = markerStatus(marker)
  const tagColor = marker.phase === 'exec-end' ? (marker.granted === false ? 'error' : 'success') : 'processing'
  const markerKey = `${marker.toolCallId}_${marker.toolIndex ?? index}`

  return (
    <Collapse
      key={markerKey}
      size="small"
      ghost
      items={[{
        key: markerKey,
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              width: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>{marker.tool}</Tag>
            <Tag color={tagColor} style={{ marginInlineEnd: 0 }}>{label}</Tag>
          </div>
        ),
        children: (
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              调用位置: 第 {Math.max(0, marker.textOffset) + 1} 个字符
            </Typography.Text>
            <Typography.Text type="secondary">调用参数:</Typography.Text>
            <Typography.Paragraph code style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {markerCommand(marker)}
            </Typography.Paragraph>
            {!!marker.resultPreview && (
              <Typography.Text type="secondary">工具返回:</Typography.Text>
            )}
            {!!marker.resultPreview && (
              <Typography.Paragraph code style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {marker.resultPreview}
              </Typography.Paragraph>
            )}
          </Space>
        ),
      }]}
    />
  )
}

export default function ToolCallTimeline({ text, markers }: ToolCallTimelineProps) {
  if (!markers.length) {
    return (
      <div style={{ marginTop: 8, marginBottom: 6 }}>
        <AgentMarkdown text={text} />
      </div>
    )
  }

  const sorted = [...markers].sort((a, b) => {
    const offsetA = Number.isFinite(a.textOffset) ? a.textOffset : 0
    const offsetB = Number.isFinite(b.textOffset) ? b.textOffset : 0
    if (offsetA !== offsetB) {
      return offsetA - offsetB
    }
    return (a.toolIndex ?? Number.MAX_SAFE_INTEGER) - (b.toolIndex ?? Number.MAX_SAFE_INTEGER)
    })

  const timelineNodes: ReactNode[] = []
  let cursor = 0
  sorted.forEach((marker, index) => {
    const markerOffset = clampOffset(marker.textOffset, text.length)
    if (markerOffset > cursor) {
      const segment = text.slice(cursor, markerOffset)
      if (segment) {
        timelineNodes.push(
          <AgentMarkdown key={`text_${cursor}_${markerOffset}_${index}`} text={segment} />,
        )
      }
    }
    timelineNodes.push(renderMarker(marker, index))
    cursor = markerOffset
  })

  if (cursor < text.length || timelineNodes.length === 0) {
    const tailText = text.slice(cursor)
    timelineNodes.push(
      <AgentMarkdown key={`text_tail_${cursor}`} text={tailText} />,
    )
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
      {timelineNodes}
    </Space>
  )
}
