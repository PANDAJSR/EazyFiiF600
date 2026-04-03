import OpenAI from 'openai'
import type { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { isSafeBashCommand, runBash } from './bashTool.ts'
import type { CliConfig } from './config.ts'

const MAX_TOOL_ROUNDS = 8

const BASH_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'Bash',
    description: '执行 shell 命令并返回 stdout/stderr。',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的 shell 命令。',
        },
        timeout: {
          type: 'integer',
          description: '超时秒数，可选。',
        },
      },
      required: ['command'],
    },
  },
}

export interface AgentState {
  messages: ChatCompletionMessageParam[]
}

export interface RunTurnResult {
  answer: string
  toolCalls: number
}

export type PermissionChecker = (description: string) => Promise<boolean>

export const createAgentState = (): AgentState => ({ messages: [] })

const toAssistantMessage = (message: OpenAI.Chat.Completions.ChatCompletionMessage): ChatCompletionAssistantMessageParam => {
  const content = typeof message.content === 'string' ? message.content : null
  return {
    role: 'assistant',
    content,
    tool_calls: message.tool_calls,
  }
}

const parseToolArgs = (raw: string): { command: string; timeout?: number } => {
  try {
    const parsed = JSON.parse(raw) as { command?: unknown; timeout?: unknown }
    if (typeof parsed.command !== 'string' || parsed.command.trim().length === 0) {
      throw new Error('参数 command 缺失')
    }
    const timeout = typeof parsed.timeout === 'number' ? parsed.timeout : undefined
    return {
      command: parsed.command,
      timeout,
    }
  } catch {
    throw new Error(`工具参数不是合法 JSON: ${raw}`)
  }
}

export const runAgentTurn = async (
  client: OpenAI,
  state: AgentState,
  userInput: string,
  config: CliConfig,
  askPermission: PermissionChecker,
): Promise<RunTurnResult> => {
  state.messages.push({ role: 'user', content: userInput })

  let lastAnswer = ''
  let totalToolCalls = 0

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: state.messages,
      tools: [BASH_TOOL],
      tool_choice: 'auto',
      max_tokens: config.maxTokens,
    })

    const message = completion.choices[0]?.message
    if (!message) {
      throw new Error('模型没有返回有效消息。')
    }

    state.messages.push(toAssistantMessage(message))

    if (typeof message.content === 'string' && message.content.trim()) {
      lastAnswer = message.content
    }

    const toolCalls = message.tool_calls ?? []
    if (toolCalls.length === 0) {
      return { answer: lastAnswer, toolCalls: totalToolCalls }
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function' || !('function' in toolCall) || toolCall.function.name !== 'Bash') {
        const toolName = 'function' in toolCall ? toolCall.function.name : toolCall.type
        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `不支持的工具: ${toolName}`,
        })
        continue
      }

      totalToolCalls += 1
      const { command, timeout } = parseToolArgs(toolCall.function.arguments)
      const safe = isSafeBashCommand(command)
      let granted = config.permissionMode === 'accept-all'

      if (!granted) {
        if (safe) {
          granted = true
        } else {
          granted = await askPermission(`执行命令: ${command}`)
        }
      }

      const result = granted
        ? await runBash(command, timeout ?? config.timeoutSec)
        : 'Denied: 用户拒绝执行该命令'

      state.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      })
    }
  }

  throw new Error('工具调用轮次过多，已中断（MAX_TOOL_ROUNDS=8）。')
}
