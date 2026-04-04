import OpenAI, { AzureOpenAI } from 'openai'
import {
  getAgentStatus,
  resetAgentStatus,
  setAgentBusy,
  setAgentDone,
  setAgentError,
  updateAgentPhase,
} from './agentStatus.mjs'
import {
  unsupportedOperationError,
} from './agentResponseUtils.mjs'
import { runChatTurn, runResponsesTurn } from './agentTurns.mjs'

const normalizeEnvValue = (value) => {
  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const readEnv = (key, overrides) => {
  const override = overrides?.[key]
  if (typeof override === 'string') {
    return normalizeEnvValue(override)
  }
  return normalizeEnvValue(process.env[key])
}

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

const createClientBundle = (envOverrides) => {
  updateAgentPhase('init', '初始化模型客户端')
  const providerEnv = readEnv('NANO_PROVIDER', envOverrides)
  const provider = providerEnv === 'azure' || providerEnv === 'openai'
    ? providerEnv
    : (readEnv('AZURE_OPENAI_ENDPOINT', envOverrides) ? 'azure' : 'openai')

  if (provider === 'azure') {
    const endpoint = readEnv('AZURE_OPENAI_ENDPOINT', envOverrides) ?? ''
    const apiKey = readEnv('AZURE_OPENAI_API_KEY', envOverrides) ?? ''
    const apiVersion = readEnv('AZURE_OPENAI_API_VERSION', envOverrides)
      ?? readEnv('OPENAI_API_VERSION', envOverrides)
      ?? '2024-10-21'
    const deployment = readEnv('AZURE_OPENAI_DEPLOYMENT', envOverrides)
    const model = deployment || readEnv('NANO_MODEL', envOverrides) || 'gpt-4o-mini'

    if (!endpoint || !apiKey) {
      throw new Error('缺少 AZURE_OPENAI_ENDPOINT 或 AZURE_OPENAI_API_KEY')
    }

    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
      deployment,
      timeout: Number(readEnv('NANO_OPENAI_TIMEOUT_MS', envOverrides) ?? 60000),
    })

    return { client, model, provider }
  }

  const apiKey = readEnv('OPENAI_API_KEY', envOverrides) ?? ''
  const baseURL = readEnv('OPENAI_BASE_URL', envOverrides)
  const model = readEnv('NANO_MODEL', envOverrides) || 'gpt-4o-mini'

  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY')
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: Number(readEnv('NANO_OPENAI_TIMEOUT_MS', envOverrides) ?? 60000),
  })
  return { client, model, provider }
}

export const resetAgentSession = () => {
  state.messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  state.transportMode = undefined
  state.previousResponseId = undefined
  resetAgentStatus()
}

export const chatWithAgent = async ({
  message,
  reset = false,
  envOverrides,
  onEvent,
}) => {
  if (reset) {
    resetAgentSession()
  }

  const prompt = String(message ?? '').trim()
  if (!prompt) {
    throw new Error('消息不能为空')
  }

  setAgentBusy('请求已接收，准备调用模型')
  try {
    const { client, model, provider } = createClientBundle(envOverrides)
    const traces = []
    const timeoutSec = Number(readEnv('NANO_BASH_TIMEOUT_SEC', envOverrides) ?? 30)
    const permissionMode = readEnv('NANO_PERMISSION_MODE', envOverrides) ?? 'manual'

    if (state.transportMode === 'responses') {
      state.messages.push({ role: 'user', content: prompt })
      const reply = await runResponsesTurn({
        client,
        model,
        userInput: prompt,
        timeoutSec,
        traces,
        permissionMode,
        onEvent,
        state,
        systemPrompt: SYSTEM_PROMPT,
        bashTool: BASH_TOOL_RESPONSES,
        onPhase: updateAgentPhase,
      })
      setAgentDone('已完成（Responses）')
      return { reply, traces, provider, model, transportMode: 'responses' }
    }

    try {
      const reply = await runChatTurn({
        client,
        model,
        userInput: prompt,
        timeoutSec,
        traces,
        permissionMode,
        onEvent,
        state,
        bashTool: BASH_TOOL_CHAT,
        onPhase: updateAgentPhase,
      })
      setAgentDone('已完成（Chat）')
      return { reply, traces, provider, model, transportMode: 'chat' }
    } catch (error) {
      if (!unsupportedOperationError(error)) {
        throw error
      }

      updateAgentPhase('fallback', '当前模型不支持 Chat，回退 Responses')
      state.transportMode = 'responses'
      state.messages.push({ role: 'user', content: prompt })
      const reply = await runResponsesTurn({
        client,
        model,
        userInput: prompt,
        timeoutSec,
        traces,
        permissionMode,
        onEvent,
        state,
        systemPrompt: SYSTEM_PROMPT,
        bashTool: BASH_TOOL_RESPONSES,
        onPhase: updateAgentPhase,
      })
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
