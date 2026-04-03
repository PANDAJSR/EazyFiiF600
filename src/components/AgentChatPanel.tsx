import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Collapse,
  Drawer,
  Empty,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import type {
  AgentChatResult,
  AgentEnvResult,
  AgentEnvValues,
  AgentRuntimeStatus,
  AgentStatusResult,
  AgentToolTrace,
} from '../types/agent'
import {
  chatWithAgent,
  getAgentEnv,
  getAgentStatus,
  isDesktopRuntime,
  setAgentEnv,
} from '../utils/desktopBridge'

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

const formatElapsed = (startedAt: number | null) => {
  if (!startedAt) {
    return '0s'
  }
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  return `${sec}s`
}

const readStatus = async (): Promise<AgentRuntimeStatus | null> => {
  const result = await getAgentStatus()
  if (!result) {
    return null
  }
  const typed = result as AgentStatusResult
  if (!typed.ok) {
    return null
  }
  return typed.status
}

const ENV_FIELDS: Array<{ key: string; label: string; secret?: boolean; placeholder?: string }> = [
  { key: 'NANO_PROVIDER', label: 'Provider', placeholder: 'openai 或 azure' },
  { key: 'NANO_MODEL', label: 'Model/Deployment' },
  { key: 'NANO_PERMISSION_MODE', label: 'Permission Mode', placeholder: 'manual 或 accept-all' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', secret: true },
  { key: 'OPENAI_BASE_URL', label: 'OpenAI Base URL' },
  { key: 'AZURE_OPENAI_ENDPOINT', label: 'Azure Endpoint' },
  { key: 'AZURE_OPENAI_API_KEY', label: 'Azure API Key', secret: true },
  { key: 'AZURE_OPENAI_API_VERSION', label: 'Azure API Version' },
  { key: 'AZURE_OPENAI_DEPLOYMENT', label: 'Azure Deployment' },
  { key: 'NANO_OPENAI_TIMEOUT_MS', label: 'OpenAI Timeout(ms)' },
  { key: 'NANO_AGENT_REQUEST_TIMEOUT_MS', label: 'Request Timeout(ms)' },
  { key: 'NANO_BASH_TIMEOUT_SEC', label: 'Bash Timeout(s)' },
]

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
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatus | null>(null)
  const [envValues, setEnvValues] = useState<AgentEnvValues>({})
  const [envStoragePath, setEnvStoragePath] = useState<string>('')
  const [savingEnv, setSavingEnv] = useState(false)
  const [envFeedback, setEnvFeedback] = useState<string>('')

  const runtimeHint = useMemo(() => {
    if (isDesktopRuntime()) {
      return null
    }
    return '当前不是 Electron 桌面环境，Agent 面板不可用。'
  }, [])

  useEffect(() => {
    if (!open || !isDesktopRuntime()) {
      return
    }
    void readStatus().then((status) => setRuntimeStatus(status))
    const timer = setInterval(() => {
      void readStatus().then((status) => setRuntimeStatus(status))
    }, 800)
    return () => clearInterval(timer)
  }, [open, sending])

  useEffect(() => {
    if (!open || !isDesktopRuntime()) {
      return
    }
    void (async () => {
      const envResult = await getAgentEnv()
      if (!envResult) {
        return
      }
      const typed = envResult as AgentEnvResult
      if (!typed.ok) {
        setEnvFeedback(`读取环境变量失败: ${typed.error}`)
        return
      }
      setEnvValues(typed.values)
      setEnvStoragePath(typed.storagePath)
    })()
  }, [open])

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
      const status = await readStatus()
      setRuntimeStatus(status)
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
      const status = await readStatus()
      setRuntimeStatus(status)
    }
  }

  const saveEnvVariables = async () => {
    if (!isDesktopRuntime()) {
      return
    }
    setSavingEnv(true)
    setEnvFeedback('')
    try {
      const result = await setAgentEnv({ values: envValues })
      if (!result) {
        setEnvFeedback('保存失败：未收到响应')
        return
      }
      const typed = result as AgentEnvResult
      if (!typed.ok) {
        setEnvFeedback(`保存失败: ${typed.error}`)
        return
      }
      setEnvValues(typed.values)
      setEnvStoragePath(typed.storagePath)
      setEnvFeedback('已保存，后续请求将自动使用这些变量。')
    } finally {
      setSavingEnv(false)
    }
  }

  const elapsed = formatElapsed(runtimeStatus?.startedAt ?? null)
  const stuckWarning =
    sending && runtimeStatus?.startedAt && Date.now() - runtimeStatus.startedAt > 25000
      ? '请求耗时较长，通常是模型端排队或网络延迟，可继续等待。'
      : null

  return (
    <Drawer
      title="Agent 对话"
      placement="right"
      width={500}
      open={open}
      onClose={onClose}
      extra={(
        <Space>
          <Button onClick={() => void clearConversation()} disabled={sending}>重置会话</Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {runtimeHint && <Alert type="warning" showIcon message={runtimeHint} />}
        {!runtimeHint && (
          <Alert
            type={runtimeStatus?.phase === 'error' ? 'error' : sending ? 'info' : 'success'}
            showIcon
            message={(
              <Space size={10} align="center">
                <Badge status={sending ? 'processing' : runtimeStatus?.phase === 'error' ? 'error' : 'success'} />
                <Typography.Text>
                  {runtimeStatus?.detail ?? (sending ? '处理中' : '空闲')}
                </Typography.Text>
                <Tag color="default">耗时 {elapsed}</Tag>
                <Tag color="blue">#{runtimeStatus?.requestCount ?? 0}</Tag>
              </Space>
            )}
            description={runtimeStatus?.lastError ?? stuckWarning ?? undefined}
          />
        )}

        <Collapse
          items={[
            {
              key: 'agent-env',
              label: 'Agent 环境变量',
              children: (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    仅影响 Agent 调用，不影响系统全局环境变量。
                  </Typography.Text>
                  {envStoragePath && (
                    <Typography.Text type="secondary">
                      保存位置: {envStoragePath}
                    </Typography.Text>
                  )}
                  {ENV_FIELDS.map((field) => (
                    <div key={field.key}>
                      <Typography.Text>{field.label}</Typography.Text>
                      {field.secret ? (
                        <Input.Password
                          value={envValues[field.key] ?? ''}
                          placeholder={field.placeholder}
                          onChange={(event) => {
                            const next = event.target.value
                            setEnvValues((prev) => ({ ...prev, [field.key]: next }))
                          }}
                        />
                      ) : (
                        <Input
                          value={envValues[field.key] ?? ''}
                          placeholder={field.placeholder}
                          onChange={(event) => {
                            const next = event.target.value
                            setEnvValues((prev) => ({ ...prev, [field.key]: next }))
                          }}
                        />
                      )}
                    </div>
                  ))}
                  {!!envFeedback && <Alert type="info" showIcon message={envFeedback} />}
                  <Button onClick={() => void saveEnvVariables()} loading={savingEnv}>
                    保存环境变量
                  </Button>
                </Space>
              ),
            },
          ]}
        />

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
