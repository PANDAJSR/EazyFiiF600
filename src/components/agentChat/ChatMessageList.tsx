import { Empty, Space, Spin, Tag, Typography } from 'antd'
import type { AgentToolTrace } from '../../types/agent'
import ToolCallTimeline, { type ToolCallBadge } from './ToolCallTimeline'
import { traceSummary } from './panelUtils'

type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessageItem = {
  id: string
  role: ChatRole
  text: string
  traces?: AgentToolTrace[]
  toolBadges?: ToolCallBadge[]
  meta?: string
}

type ChatMessageListProps = {
  messages: ChatMessageItem[]
  sending: boolean
}

const MessageBody = ({ message }: { message: ChatMessageItem }) => {
  if (message.role === 'assistant') {
    return <ToolCallTimeline text={message.text} markers={message.toolBadges ?? []} />
  }

  return (
    <Typography.Paragraph style={{ marginTop: 8, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
      {message.text}
    </Typography.Paragraph>
  )
}

export default function ChatMessageList({ messages, sending }: ChatMessageListProps) {
  return (
    <div style={{ maxHeight: '55vh', overflow: 'auto', paddingRight: 4 }}>
      {messages.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无消息" />}
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              background: message.role === 'user' ? '#e6f4ff' : '#f7f7f7',
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Space size={8} wrap>
              <Tag color={message.role === 'user' ? 'blue' : message.role === 'assistant' ? 'green' : 'gold'}>
                {message.role}
              </Tag>
              {message.meta && <Typography.Text type="secondary">{message.meta}</Typography.Text>}
            </Space>

            <MessageBody message={message} />

            {!!message.traces?.length && (
              <div style={{ background: '#fff', border: '1px dashed #d9d9d9', borderRadius: 8, padding: 8 }}>
                <Typography.Text type="secondary">工具调用日志</Typography.Text>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {message.traces.map((trace, index) => (
                    <li key={`${message.id}_${index}`} style={{ marginBottom: 4 }}>
                      <Typography.Text code>{traceSummary(trace)}</Typography.Text>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div style={{ border: '1px dashed #91caff', borderRadius: 10, padding: 10, background: '#f0f8ff' }}>
            <Space>
              <Spin size="small" />
              <Typography.Text type="secondary">Agent 正在处理中...</Typography.Text>
            </Space>
          </div>
        )}
      </Space>
    </div>
  )
}
