import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import OpenAI, { AzureOpenAI } from 'openai'
import {
  getAgentStatus,
  resetAgentStatus,
  setAgentBusy,
  setAgentDone,
  setAgentError,
  updateAgentPhase,
} from './agentStatus.mjs'

const execAsync = promisify(exec)
const MAX_TOOL_ROUNDS = 8

const SAFE_PREFIXES = [
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'pwd',
  'echo',
  'printf',
  'date',
  'which',
  'type',
  'env',
  'printenv',
  'uname',
  'whoami',
  'id',
  'git status',
  'git log',
  'git diff',
  'git show',
  'find ',
  'grep ',
  'rg ',
]

const SYSTEM_PROMPT = `你是一个命令行编码助手，运行在 Electron 主进程里。
你只允许使用 Bash 工具，不要假装执行命令。
若需要执行危险命令，请先解释风险。`

const state = {
  messages: [{ role: 'system', content: SYSTEM_PROMPT }],
  transportMode: undefined,
  previousResponseId: undefined,
}

const BASH_TOOL_CHAT = {
  type: 'function',
  function: {
    name: 'Bash',
    description: '执行 shell 命令并返回 stdout/stderr。',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的 shell 命令。' },
        timeout: { type: 'integer', description: '超时秒数，可选。' },
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
      command: { type: 'string', description: '要执行的 shell 命令。' },
      timeout: { type: 'integer', description: '超时秒数，可选。' },
    },
    required: ['command'],
  },
}

const parseToolArgs = (raw) => {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.command !== 'string' || parsed.command.trim().length === 0) {
      throw new Error('参数 command 缺失')
    }
    const timeout = typeof parsed.timeout === 'number' ? parsed.timeout : undefined
    return { command: parsed.command, timeout }
  } catch {
    throw new Error(`工具参数不是合法 JSON: ${raw}`)
  }
}

const isSafeBashCommand = (command) => {
  const normalized = String(command ?? '').trim()
  return SAFE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

const runBash = async (command, timeoutSec) => {
  updateAgentPhase('tool-running', `Bash: ${command.slice(0, 80)}`)
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutSec * 1000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    })
    const output = [stdout, stderr ? `[stderr]\n${stderr}` : ''].filter(Boolean).join('\n').trim()
    return output || '(no output)'
  } catch (error) {
    if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
      const output = [error.stdout, error.stderr ? `[stderr]\n${error.stderr}` : ''].filter(Boolean).join('\n').trim()
      return output || `Error: ${error.message}`
    }
    return `Error: ${String(error)}`
  }
}

const createClientBundle = () => {
  updateAgentPhase('init', '初始化模型客户端')
  const providerEnv = process.env.NANO_PROVIDER
  const provider = providerEnv === 'azure' || providerEnv === 'openai'
    ? providerEnv
    : (process.env.AZURE_OPENAI_ENDPOINT ? 'azure' : 'openai')

  if (provider === 'azure') {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? ''
    const apiKey = process.env.AZURE_OPENAI_API_KEY ?? ''
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? process.env.OPENAI_API_VERSION ?? '2024-10-21'
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.NANO_AZURE_DEPLOYMENT
    const model = deployment || process.env.NANO_MODEL || 'gpt-4o-mini'

    if (!endpoint || !apiKey) {
      throw new Error('缺少 AZURE_OPENAI_ENDPOINT 或 AZURE_OPENAI_API_KEY')
    }

    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
      deployment,
      timeout: Number(process.env.NANO_OPENAI_TIMEOUT_MS ?? 60000),
    })

    return { client, model, provider }
  }

  const apiKey = process.env.OPENAI_API_KEY ?? ''
  const baseURL = process.env.OPENAI_BASE_URL
  const model = process.env.NANO_MODEL || 'gpt-4o-mini'

  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY')
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: Number(process.env.NANO_OPENAI_TIMEOUT_MS ?? 60000),
  })
  return { client, model, provider }
}

const unsupportedOperationError = (error) => {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return message.includes('unsupported') || message.includes('requested operation is unsupported')
}

const executeBashWithPolicy = async ({ command, timeoutSec, traces }) => {
  updateAgentPhase('tool-check', `校验命令权限: ${command.slice(0, 80)}`)
  traces.push({ phase: 'start', tool: 'Bash', command, timeoutSec })

  const acceptAll = process.env.NANO_PERMISSION_MODE === 'accept-all'
  const granted = acceptAll || isSafeBashCommand(command)
  const output = granted
    ? await runBash(command, timeoutSec)
    : 'Denied: 当前前端面板只允许安全命令。可设置 NANO_PERMISSION_MODE=accept-all 关闭限制。'

  traces.push({
    phase: 'end',
    tool: 'Bash',
    command,
    timeoutSec,
    granted,
    resultPreview: output.slice(0, 180),
  })

  return output
}

const extractResponseText = (response) => {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text
  }

  const chunks = []
  for (const item of response?.output ?? []) {
    if (item?.type !== 'message') {
      continue
    }
    for (const part of item?.content ?? []) {
      if (part?.type === 'output_text' && typeof part?.text === 'string') {
        chunks.push(part.text)
      }
    }
  }
  return chunks.join('\n').trim()
}

const runResponsesTurn = async ({ client, model, userInput, timeoutSec, traces }) => {
  updateAgentPhase('llm-responses', '使用 Responses API 推理')
  let lastAnswer = ''
  let input = userInput

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.responses.create({
      model,
      previous_response_id: state.previousResponseId,
      input,
      instructions: SYSTEM_PROMPT,
      tools: [BASH_TOOL_RESPONSES],
      tool_choice: 'auto',
      max_output_tokens: 4096,
    })

    state.previousResponseId = response.id

    const answer = extractResponseText(response)
    if (answer) {
      lastAnswer = answer
    }

    const calls = []
    for (const item of response.output ?? []) {
      if (item?.type === 'function_call' && typeof item.call_id === 'string' && item.name) {
        calls.push({
          callId: item.call_id,
          name: item.name,
          arguments: item.arguments ?? '{}',
        })
      }
    }

    if (calls.length === 0) {
      state.messages.push({ role: 'assistant', content: lastAnswer || '' })
      return lastAnswer
    }

    const outputs = []
    for (const call of calls) {
      if (call.name !== 'Bash') {
        outputs.push({
          type: 'function_call_output',
          call_id: call.callId,
          output: `不支持的工具: ${call.name}`,
        })
        continue
      }

      const args = parseToolArgs(call.arguments)
      const result = await executeBashWithPolicy({
        command: args.command,
        timeoutSec: args.timeout ?? timeoutSec,
        traces,
      })

      outputs.push({
        type: 'function_call_output',
        call_id: call.callId,
        output: result,
      })
    }

    input = outputs
  }

  throw new Error('工具调用轮次过多，已中断')
}

const runChatTurn = async ({ client, model, userInput, timeoutSec, traces }) => {
  updateAgentPhase('llm-chat', '使用 Chat Completions 推理')
  state.messages.push({ role: 'user', content: userInput })

  let lastAnswer = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages: state.messages,
      tools: [BASH_TOOL_CHAT],
      tool_choice: 'auto',
      max_tokens: 4096,
    })

    const message = completion.choices[0]?.message
    if (!message) {
      throw new Error('模型没有返回有效消息')
    }

    state.messages.push({
      role: 'assistant',
      content: typeof message.content === 'string' ? message.content : null,
      tool_calls: message.tool_calls,
    })

    if (typeof message.content === 'string' && message.content.trim()) {
      lastAnswer = message.content
    }

    const toolCalls = message.tool_calls ?? []
    if (toolCalls.length === 0) {
      return lastAnswer
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function' || !('function' in toolCall) || toolCall.function.name !== 'Bash') {
        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `不支持的工具: ${'function' in toolCall ? toolCall.function.name : toolCall.type}`,
        })
        continue
      }

      const args = parseToolArgs(toolCall.function.arguments)
      const result = await executeBashWithPolicy({
        command: args.command,
        timeoutSec: args.timeout ?? timeoutSec,
        traces,
      })

      state.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      })
    }
  }

  throw new Error('工具调用轮次过多，已中断')
}

export const resetAgentSession = () => {
  state.messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  state.transportMode = undefined
  state.previousResponseId = undefined
  resetAgentStatus()
}

export const chatWithAgent = async ({ message, reset = false }) => {
  if (reset) {
    resetAgentSession()
  }

  const prompt = String(message ?? '').trim()
  if (!prompt) {
    throw new Error('消息不能为空')
  }

  setAgentBusy('请求已接收，准备调用模型')
  try {
    const { client, model, provider } = createClientBundle()
    const traces = []
    const timeoutSec = Number(process.env.NANO_BASH_TIMEOUT_SEC ?? 30)

    if (state.transportMode === 'responses') {
      state.messages.push({ role: 'user', content: prompt })
      const reply = await runResponsesTurn({ client, model, userInput: prompt, timeoutSec, traces })
      setAgentDone('已完成（Responses）')
      return { reply, traces, provider, model, transportMode: 'responses' }
    }

    try {
      const reply = await runChatTurn({ client, model, userInput: prompt, timeoutSec, traces })
      setAgentDone('已完成（Chat）')
      return { reply, traces, provider, model, transportMode: 'chat' }
    } catch (error) {
      if (!unsupportedOperationError(error)) {
        throw error
      }

      updateAgentPhase('fallback', '当前模型不支持 Chat，回退 Responses')
      state.transportMode = 'responses'
      state.messages.push({ role: 'user', content: prompt })
      const reply = await runResponsesTurn({ client, model, userInput: prompt, timeoutSec, traces })
      setAgentDone('已完成（Fallback 到 Responses）')
      return { reply, traces, provider, model, transportMode: 'responses' }
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    setAgentError(errMessage)
    throw error
  }
}

export { getAgentStatus }
