import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Collapse, Input, Space, Switch, Typography } from 'antd'
import type {
  AgentChatResult,
  AgentEnvResult,
  AgentStreamEvent,
  AgentToolTrace,
} from '../types/agent'
import type { ParseResult } from '../types/fii'
import {
  chatWithAgent,
  getAgentEnv,
  isDesktopRuntime,
  onAgentStream,
  setAgentEnv,
  stopAgentRequest,
} from '../utils/desktopBridge'
import type { ToolCallBadge } from './agentChat/ToolCallTimeline'
import type { ReasoningBadge } from './agentChat/ToolCallTimeline'
import {
  newMessageId,
  parseEnvText,
  serializeEnvValues,
  tracesToToolBadges,
} from './agentChat/panelUtils'
import ChatMessageList from './agentChat/ChatMessageList'
import type { TrajectoryIssueContext } from './trajectory/trajectoryIssueContext'
import useFloatingAgentPosition from './agentChat/useFloatingAgentPosition'

type ChatRole = 'user' | 'assistant' | 'system'

type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  traces?: AgentToolTrace[]
  toolBadges?: ToolCallBadge[]
  reasoningBadges?: ReasoningBadge[]
}

type AgentChatPanelProps = {
  projectContext: ParseResult
  rodConfigContext?: unknown
  trajectoryIssueContext?: TrajectoryIssueContext
  onProjectContextPatched?: (next: ParseResult) => void
  onClose?: () => void
}

const upsertToolBadge = (badges: ToolCallBadge[] | undefined, event: Extract<AgentStreamEvent, { type: 'tool-call' }>) => {
  const list = badges ? [...badges] : []
  const matchIndex = list.findIndex((badge) => {
    if (typeof event.toolIndex === 'number' && typeof badge.toolIndex === 'number') {
      return badge.toolIndex === event.toolIndex
    }
    return badge.toolCallId === event.toolCallId
  })

  if (matchIndex < 0) {
    list.push({
      toolCallId: event.toolCallId,
      toolIndex: event.toolIndex,
      tool: event.tool,
      phase: event.phase,
      textOffset: event.textOffset,
      commandPreview: event.commandPreview,
      granted: event.granted,
      resultPreview: event.resultPreview,
    })
    return list
  }

  const prev = list[matchIndex]
  list[matchIndex] = {
    ...prev,
    toolCallId: event.toolCallId || prev.toolCallId,
    toolIndex: event.toolIndex ?? prev.toolIndex,
    phase: event.phase,
    textOffset: Math.min(prev.textOffset, event.textOffset),
    commandPreview: event.commandPreview || prev.commandPreview,
    granted: typeof event.granted === 'boolean' ? event.granted : prev.granted,
    resultPreview: event.resultPreview || prev.resultPreview,
  }
  return list
}

const upsertReasoningBadge = (
  badges: ReasoningBadge[] | undefined,
  event: Extract<AgentStreamEvent, { type: 'reasoning-delta' }>,
) => {
  const list = badges ? [...badges] : []
  const matchIndex = list.findIndex((badge) => badge.blockId === event.blockId)
  if (matchIndex < 0) {
    list.push({
      blockId: event.blockId,
      textOffset: event.textOffset,
      text: event.delta,
    })
    return list
  }
  const prev = list[matchIndex]
  list[matchIndex] = {
    ...prev,
    textOffset: Math.min(prev.textOffset, event.textOffset),
    text: `${prev.text}${event.delta}`,
  }
  return list
}

function AgentChatPanel({
  projectContext,
  rodConfigContext,
  trajectoryIssueContext,
  onProjectContextPatched,
  onClose,
}: AgentChatPanelProps) {
  const sendIcon = <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>▶</span>
  const stopIcon = <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>■</span>
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: newMessageId(),
      role: 'system',
      text: '你好，可以让我帮你改积木，完成科目，或是解决飞行问题',
    },
  ])
  const [input, setInput] = useState('')
  const [enableReasoning, setEnableReasoning] = useState(false)
  const [sending, setSending] = useState(false)
  const [envText, setEnvText] = useState('')
  const [envStoragePath, setEnvStoragePath] = useState<string>('')
  const [savingEnv, setSavingEnv] = useState(false)
  const [envFeedback, setEnvFeedback] = useState<string>('')
  const { panelPosition, startDragPanel } = useFloatingAgentPosition()
  const activeRequestIdRef = useRef<string | null>(null)
  const activeAssistantMessageIdRef = useRef<string | null>(null)
  const reasoningDeltaCountRef = useRef(0)

  useEffect(() => {
    if (!isDesktopRuntime()) {
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
      setEnvText(serializeEnvValues(typed.values))
      setEnvStoragePath(typed.storagePath)
    })()
  }, [enableReasoning, onProjectContextPatched])


  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }

  const patchMessageById = (id: string, patcher: Partial<ChatMessage> | ((message: ChatMessage) => ChatMessage)) => {
    setMessages((prev) => prev.map((item) => {
      if (item.id !== id) {
        return item
      }
      if (typeof patcher === 'function') {
        return patcher(item)
      }
      return { ...item, ...patcher }
    }))
  }

  useEffect(() => {
    if (!isDesktopRuntime()) {
      return
    }
    const unsubscribe = onAgentStream((event: AgentStreamEvent) => {
      if (event.type === 'project-context-patched') {
        onProjectContextPatched?.(event.projectContext)
        return
      }

      const activeRequestId = activeRequestIdRef.current
      const assistantMessageId = activeAssistantMessageIdRef.current
      if (!activeRequestId || !assistantMessageId || event.requestId !== activeRequestId) {
        return
      }

      if (event.type === 'text-delta') {
        patchMessageById(assistantMessageId, (message) => ({
          ...message,
          text: `${message.text}${event.delta}`,
        }))
      }

      if (event.type === 'tool-call') {
        patchMessageById(assistantMessageId, (message) => ({
          ...message,
          toolBadges: upsertToolBadge(message.toolBadges, event),
        }))
      }

      if (event.type === 'reasoning-delta') {
        reasoningDeltaCountRef.current += 1
        console.info('[agent-ui] reasoning delta', {
          requestId: event.requestId,
          blockId: event.blockId,
          deltaLength: event.delta.length,
          textOffset: event.textOffset,
          count: reasoningDeltaCountRef.current,
        })
        patchMessageById(assistantMessageId, (message) => ({
          ...message,
          reasoningBadges: upsertReasoningBadge(message.reasoningBadges, event),
        }))
      }

      if (event.type === 'end' && enableReasoning && reasoningDeltaCountRef.current === 0) {
        console.warn('[agent-ui] no reasoning-delta received for this request', {
          requestId: event.requestId,
        })
      }

      if (event.type === 'error') {
        patchMessageById(assistantMessageId, {
          text: `Agent 错误: ${event.error}`,
        })
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [enableReasoning, onProjectContextPatched])

  const clearConversation = async () => {
    setMessages([{ id: newMessageId(), role: 'system', text: '会话已重置。你可以继续提问。' }])
    if (isDesktopRuntime()) {
      await chatWithAgent({ message: '请重置会话', reset: true })
    }
  }

  const stopMessage = async () => {
    if (!sending) {
      return
    }
    await stopAgentRequest(activeRequestIdRef.current ?? undefined)
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
    reasoningDeltaCountRef.current = 0
    const requestId = newMessageId()
    const assistantMessageId = newMessageId()
    activeRequestIdRef.current = requestId
    activeAssistantMessageIdRef.current = assistantMessageId
    appendMessage({ id: assistantMessageId, role: 'assistant', text: '' })

    try {
      const result = await chatWithAgent({
        message,
        requestId,
        enableReasoning,
        projectContext,
        rodConfigContext,
        trajectoryIssueContext,
      })
      if (!result) {
        patchMessageById(assistantMessageId, { text: '未收到 Agent 返回结果。' })
        return
      }

      const typedResult = result as AgentChatResult
      if (!typedResult.ok) {
        patchMessageById(assistantMessageId, { text: `Agent 错误: ${typedResult.error}` })
        return
      }
      if (enableReasoning && reasoningDeltaCountRef.current === 0) {
        console.warn('[agent-ui] request completed without reasoning stream', {
          requestId,
          provider: typedResult.provider,
          model: typedResult.model,
          transportMode: typedResult.transportMode,
        })
      }

      patchMessageById(assistantMessageId, (messageItem) => ({
        ...messageItem,
        text: typedResult.reply || messageItem.text || '(空回复)',
        traces: typedResult.traces,
        toolBadges: messageItem.toolBadges?.length
          ? messageItem.toolBadges
          : tracesToToolBadges(typedResult.traces, typedResult.reply || messageItem.text || ''),
      }))
      if (typedResult.projectContext) {
        onProjectContextPatched?.(typedResult.projectContext)
      }
    } finally {
      setSending(false)
      activeRequestIdRef.current = null
      activeAssistantMessageIdRef.current = null
    }
  }

  const saveEnvVariables = async () => {
    if (!isDesktopRuntime()) {
      return
    }
    setSavingEnv(true)
    setEnvFeedback('')
    try {
      const result = await setAgentEnv({ values: parseEnvText(envText) })
      if (!result) {
        setEnvFeedback('保存失败：未收到响应')
        return
      }
      const typed = result as AgentEnvResult
      if (!typed.ok) {
        setEnvFeedback(`保存失败: ${typed.error}`)
        return
      }
      setEnvText(serializeEnvValues(typed.values))
      setEnvStoragePath(typed.storagePath)
      setEnvFeedback('已保存。')
    } finally {
      setSavingEnv(false)
    }
  }

  return (
    <section
      className="floating-agent-panel"
      style={panelPosition
        ? {
            left: `${panelPosition.x}px`,
            top: `${panelPosition.y}px`,
            right: 'auto',
            bottom: 'auto',
          }
        : undefined}
    >
      <header className="floating-agent-header" onPointerDown={(event) => startDragPanel(event, '.floating-agent-header-actions')}>
        <Typography.Text strong>Agent 对话</Typography.Text>
        <Space className="floating-agent-header-actions" size={8} onPointerDown={(event) => event.stopPropagation()}>
          <Button onClick={() => void clearConversation()} disabled={sending}>重置</Button>
          <Button
            className="floating-agent-close-btn"
            type="text"
            size="small"
            shape="circle"
            aria-label="关闭 Agent 对话窗口"
            onClick={onClose}
          >
            ×
          </Button>
        </Space>
      </header>

      <div className="floating-agent-body">
        {!isDesktopRuntime() && <Alert type="warning" showIcon message="当前不是 Electron 桌面环境，Agent 面板不可用。" />}
        <ChatMessageList messages={messages} sending={sending} />

        <div className="agent-input-row">
          <Input.TextArea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入你的问题，Shift+Enter 换行"
            autoSize={{ minRows: 2, maxRows: 5 }}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault()
                if (sending) {
                  void stopMessage()
                  return
                }
                void sendMessage()
              }
            }}
            disabled={sending}
          />
          <Button
            type={sending ? 'default' : 'primary'}
            danger={sending}
            shape="circle"
            size="large"
            icon={sending ? stopIcon : sendIcon}
            onClick={() => {
              if (sending) {
                void stopMessage()
                return
              }
              void sendMessage()
            }}
            disabled={!sending && !input.trim()}
          />
        </div>
        <div className="agent-reasoning-row">
          <Space size={8} align="center">
            <Switch
              checked={enableReasoning}
              onChange={setEnableReasoning}
              size="small"
              disabled={sending}
            />
            <Typography.Text type="secondary">
              {enableReasoning ? '已开启模型思考展示（按时序插入）' : '关闭模型思考展示'}
            </Typography.Text>
          </Space>
        </div>

        <Collapse
          size="small"
          items={[{
            key: 'agent-env',
            label: '环境变量',
            children: (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {envStoragePath && <Typography.Text type="secondary">保存位置: {envStoragePath}</Typography.Text>}
                <Input.TextArea
                  value={envText}
                  placeholder={'NANO_PROVIDER=openai\nOPENAI_BASE_URL=http://127.0.0.1:1234/v1\nOPENAI_API_KEY=dummy\nNANO_MODEL=glm-4.7-flash-mlx'}
                  autoSize={{ minRows: 5, maxRows: 12 }}
                  onChange={(event) => setEnvText(event.target.value)}
                />
                {!!envFeedback && <Alert type="info" showIcon message={envFeedback} />}
                <Button onClick={() => void saveEnvVariables()} loading={savingEnv}>保存环境变量</Button>
              </Space>
            ),
          }]}
        />
      </div>
    </section>
  )
}

export default AgentChatPanel
