import OpenAI from 'openai'
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions'
import { isSafeBashCommand, runBash } from './bashTool.ts'
import type { CliConfig } from './config.ts'

const MAX_TOOL_ROUNDS = 8

type TransportMode = 'chat' | 'responses'

const BASH_TOOL_CHAT: ChatCompletionTool = {
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

const BASH_TOOL_RESPONSES = {
  type: 'function',
  name: 'Bash',
  description: '执行 shell 命令并返回 stdout/stderr。',
  strict: false,
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
} as const

export interface AgentState {
  messages: ChatCompletionMessageParam[]
  transportMode?: TransportMode
  previousResponseId?: string
}

export interface RunTurnResult {
  answer: string
  toolCalls: number
}

export type PermissionChecker = (description: string) => Promise<boolean>

export const createAgentState = (): AgentState => ({ messages: [] })

const toAssistantMessage = (
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
): ChatCompletionAssistantMessageParam => {
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

const executeBashToolWithPermission = async (
  toolCallId: string,
  command: string,
  timeout: number | undefined,
  state: AgentState,
  config: CliConfig,
  askPermission: PermissionChecker,
): Promise<string> => {
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
    tool_call_id: toolCallId,
    content: result,
  })

  return result
}

const isUnsupportedOperationError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return (
    message.includes('unsupported') ||
    message.includes('requested operation is unsupported')
  )
}

const getSystemInstruction = (state: AgentState): string | undefined => {
  const system = state.messages.find((msg) => msg.role === 'system')
  if (!system) {
    return undefined
  }
  return typeof system.content === 'string' ? system.content : undefined
}

const extractResponseText = (response: {
  output_text?: string
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
}): string => {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text
  }

  const segments: string[] = []
  for (const item of response.output ?? []) {
    if (item.type !== 'message') {
      continue
    }
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && typeof part.text === 'string') {
        segments.push(part.text)
      }
    }
  }
  return segments.join('\n').trim()
}

interface ResponseFunctionCallItem {
  type: 'function_call'
  call_id: string
  name: string
  arguments: string
}

const extractFunctionCalls = (response: {
  output?: Array<{
    type?: string
    call_id?: string | null
    name?: string
    arguments?: string
  }>
}): ResponseFunctionCallItem[] => {
  const calls: ResponseFunctionCallItem[] = []

  for (const item of response.output ?? []) {
    if (item.type !== 'function_call') {
      continue
    }
    if (typeof item.call_id !== 'string' || !item.name) {
      continue
    }
    calls.push({
      type: 'function_call',
      call_id: item.call_id,
      name: item.name,
      arguments: item.arguments ?? '{}',
    })
  }

  return calls
}

const runResponsesTurn = async (
  client: OpenAI,
  state: AgentState,
  userInput: string,
  config: CliConfig,
  askPermission: PermissionChecker,
): Promise<RunTurnResult> => {
  let lastAnswer = ''
  let totalToolCalls = 0
  let previousResponseId = state.previousResponseId
  const instructions = getSystemInstruction(state)

  let input: string | Array<{ type: 'function_call_output'; call_id: string; output: string }> = userInput

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.responses.create({
      model: config.model,
      previous_response_id: previousResponseId,
      input,
      instructions,
      tools: [BASH_TOOL_RESPONSES],
      tool_choice: 'auto',
      max_output_tokens: config.maxTokens,
    }) as unknown as {
      id: string
      output_text?: string
      output?: Array<{
        type?: string
        call_id?: string | null
        name?: string
        arguments?: string
        content?: Array<{ type?: string; text?: string }>
      }>
    }

    previousResponseId = response.id
    state.previousResponseId = response.id

    const answer = extractResponseText(response)
    if (answer) {
      lastAnswer = answer
    }

    const functionCalls = extractFunctionCalls(response)
    if (functionCalls.length === 0) {
      state.messages.push({ role: 'assistant', content: lastAnswer || '' })
      return { answer: lastAnswer, toolCalls: totalToolCalls }
    }

    const outputs: Array<{ type: 'function_call_output'; call_id: string; output: string }> = []

    for (const functionCall of functionCalls) {
      if (functionCall.name !== 'Bash') {
        const unsupported = `不支持的工具: ${functionCall.name}`
        outputs.push({
          type: 'function_call_output',
          call_id: functionCall.call_id,
          output: unsupported,
        })
        continue
      }

      totalToolCalls += 1
      const args = parseToolArgs(functionCall.arguments)
      const result = await executeBashToolWithPermission(
        functionCall.call_id,
        args.command,
        args.timeout,
        state,
        config,
        askPermission,
      )
      outputs.push({
        type: 'function_call_output',
        call_id: functionCall.call_id,
        output: result,
      })
    }

    input = outputs
  }

  throw new Error('工具调用轮次过多，已中断（MAX_TOOL_ROUNDS=8）。')
}

const runChatTurn = async (
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
      tools: [BASH_TOOL_CHAT],
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
      if (
        toolCall.type !== 'function' ||
        !('function' in toolCall) ||
        toolCall.function.name !== 'Bash'
      ) {
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
      await executeBashToolWithPermission(
        toolCall.id,
        command,
        timeout,
        state,
        config,
        askPermission,
      )
    }
  }

  throw new Error('工具调用轮次过多，已中断（MAX_TOOL_ROUNDS=8）。')
}

export const runAgentTurn = async (
  client: OpenAI,
  state: AgentState,
  userInput: string,
  config: CliConfig,
  askPermission: PermissionChecker,
): Promise<RunTurnResult> => {
  if (state.transportMode === 'responses') {
    state.messages.push({ role: 'user', content: userInput })
    return runResponsesTurn(client, state, userInput, config, askPermission)
  }

  try {
    return await runChatTurn(client, state, userInput, config, askPermission)
  } catch (error) {
    if (!isUnsupportedOperationError(error)) {
      throw error
    }

    state.transportMode = 'responses'
    return runResponsesTurn(client, state, userInput, config, askPermission)
  }
}
