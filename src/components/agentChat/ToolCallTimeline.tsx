import { Collapse, Space, Tag, Typography } from 'antd'
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
  return command.length > 120 ? `${command.slice(0, 120)}...` : command
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
    const offsetA = Number.isFinite(a.textOffset) ? a.textOffset : 0
    const offsetB = Number.isFinite(b.textOffset) ? b.textOffset : 0
    if (offsetA !== offsetB) {
      return offsetA - offsetB
    }
    return (a.toolIndex ?? Number.MAX_SAFE_INTEGER) - (b.toolIndex ?? Number.MAX_SAFE_INTEGER)
  })

  return (
    <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
      <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {text}
      </Typography.Paragraph>
      {sorted.map((marker, index) => {
        const label = markerStatus(marker)
        const tagColor = marker.phase === 'exec-end' ? (marker.granted === false ? 'error' : 'success') : 'processing'
        return (
          <Collapse
            key={`${marker.toolCallId}_${marker.toolIndex ?? index}`}
            size="small"
            ghost
            items={[{
              key: `${marker.toolCallId}_${marker.toolIndex ?? index}`,
              label: (
                <Space size={8} wrap>
                  <Tag color="blue">{marker.tool}</Tag>
                  <Tag color={tagColor}>{label}</Tag>
                  <Typography.Text type="secondary" ellipsis style={{ maxWidth: 260 }}>
                    {markerCommand(marker)}
                  </Typography.Text>
                </Space>
              ),
              children: (
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    调用位置: 第 {Math.max(0, marker.textOffset) + 1} 个字符
                  </Typography.Text>
                  <Typography.Paragraph code style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {markerCommand(marker)}
                  </Typography.Paragraph>
                  {!!marker.resultPreview && (
                    <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {marker.resultPreview}
                    </Typography.Paragraph>
                  )}
                </Space>
              ),
            }]}
          />
        )
      })}
    </Space>
  )
}
