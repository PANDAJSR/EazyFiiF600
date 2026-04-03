import { useMemo, useState } from 'react'
import { Button, Drawer, Empty, Input, Space, Tag, Typography } from 'antd'
import type { AgentChatResult, AgentToolTrace } from '../types/agent'
import { chatWithAgent, isDesktopRuntime } from '../utils/desktopBridge'

type ChatRole = 'user' | 'assistant' | 'system'

type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  traces?: AgentToolTrace[]
  meta?: string
}

type AgentChatPanelProps = {
  open: boolean
  onClose: () => void
}

const newMessageId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const traceSummary = (trace: AgentToolTrace) => {
  if (trace.phase === 'start') {
    return `开始: ${trace.command}`
  }
  const status = trace.granted ? '已执行' : '已拒绝'
  return `结束(${status}): ${trace.resultPreview ?? ''}`
}

function AgentChatPanel({ open, onClose }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: newMessageId(),
      role: 'system',
      text: '可以在这里直接问 Agent。当前仅支持 Bash 工具调用。',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const runtimeHint = useMemo(() => {
    if (isDesktopRuntime()) {
      return null
    }
    return '当前不是 Electron 桌面环境，Agent 面板不可用。'
  }, [])

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }

  const clearConversation = async () => {
    setMessages([
      {
        id: newMessageId(),
        role: 'system',
        text: '会话已重置。你可以继续提问。',
      },
    ])
    if (isDesktopRuntime()) {
      await chatWithAgent({ message: '请重置会话', reset: true })
    }
  }

  const sendMessage = async () => {
    const message = input.trim()
    if (!message || sending) {
      return
    }

    appendMessage({ id: newMessageId(), role: 'user', text: message })
    setInput('')

    if (!isDesktopRuntime()) {
      appendMessage({
        id: newMessageId(),
        role: 'assistant',
        text: '当前运行环境不支持 Agent IPC。请在 Electron 下使用。',
      })
      return
    }

    setSending(true)
    try {
      const result = await chatWithAgent({ message })
      if (!result) {
        appendMessage({
          id: newMessageId(),
          role: 'assistant',
          text: '未收到 Agent 返回结果。',
        })
        return
      }

      const typedResult = result as AgentChatResult
      if (!typedResult.ok) {
        appendMessage({
          id: newMessageId(),
          role: 'assistant',
          text: `Agent 错误: ${typedResult.error}`,
        })
        return
      }

      appendMessage({
        id: newMessageId(),
        role: 'assistant',
        text: typedResult.reply || '(空回复)',
        traces: typedResult.traces,
        meta: `${typedResult.provider} · ${typedResult.model} · ${typedResult.transportMode}`,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Drawer
      title="Agent 对话"
      placement="right"
      width={460}
      open={open}
      onClose={onClose}
      extra={(
        <Space>
          <Button onClick={() => void clearConversation()} disabled={sending}>重置会话</Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {runtimeHint && <Typography.Text type="warning">{runtimeHint}</Typography.Text>}
        <div style={{ maxHeight: '56vh', overflow: 'auto', paddingRight: 4 }}>
          {messages.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无消息" />}
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  background: message.role === 'user' ? '#e6f4ff' : '#f7f7f7',
                  border: '1px solid #e5e5e5',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <Space size={8} wrap>
                  <Tag color={message.role === 'user' ? 'blue' : message.role === 'assistant' ? 'green' : 'gold'}>
                    {message.role}
                  </Tag>
                  {message.meta && <Typography.Text type="secondary">{message.meta}</Typography.Text>}
                </Space>
                <Typography.Paragraph style={{ marginTop: 8, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                  {message.text}
                </Typography.Paragraph>
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
          </Space>
        </div>
        <Input.TextArea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="输入你的问题，例如：帮我看下当前目录有哪些文件"
          autoSize={{ minRows: 3, maxRows: 7 }}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault()
              void sendMessage()
            }
          }}
          disabled={sending}
        />
        <Button type="primary" onClick={() => void sendMessage()} loading={sending}>
          发送
        </Button>
      </Space>
    </Drawer>
  )
}

export default AgentChatPanel
