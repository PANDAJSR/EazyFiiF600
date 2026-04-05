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
import { PROJECT_TOOLS_CHAT, PROJECT_TOOLS_RESPONSES } from './agentProjectTools.mjs'

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

const BASE_SYSTEM_PROMPT = `你是 EazyFii 里的无人机积木编程 Agent，运行在 Electron 主进程里。
你可以使用 Bash、SearchAgentKnowledge、ListProjectDrones、GetDroneBlocks、GetRodConfig、GetBlockCatalog、GetTrajectoryIssuesDetailed、GetTrajectoryDebugSnapshot、PatchDroneProgram 九个工具。
涉及“编码/完成科目/编程/飞机知识”的问题，不要靠记忆直接回答。你必须先调用 SearchAgentKnowledge，按关键词检索后再回答或再修改程序。
关键词要覆盖用户目标与关键约束（例如：科目名、绕杆/穿圈、机头朝向、灯光、闭合、TurnTo、Patch、复检等）。
当你不知道、拿不准、知识冲突、或用户追问“为什么/依据”时，必须再次调用 SearchAgentKnowledge 重新检索，不允许猜测。
当用户问题和当前工程的无人机/积木有关时，优先调用项目工具读取 JSON 数据后再回答，不要臆造工程内容。
当用户明确要求“直接修改/写入”时，你必须真正调用 PatchDroneProgram 执行修改，不要只给口头方案。
如果 PatchDroneProgram 返回 ok=false，你必须继续补全参数并再次调用，直到 ok=true 或达到工具轮次上限，再向用户汇报结果。
任意工具调用失败后，不允许停在失败说明上；你必须基于错误信息调整参数并继续尝试调用工具，直到成功或达到工具轮次上限。
若需要执行危险 Bash 命令，请先解释风险。`

const state = {
  messages: [{ role: 'system', content: BASE_SYSTEM_PROMPT }],
  transportMode: undefined,
  previousResponseId: undefined,
  projectContext: null,
  pendingMutation: false,
}
const cancelledRequestIds = new Set()
const isRequestCancelled = (requestId) => Boolean(requestId && cancelledRequestIds.has(requestId))
const throwIfCancelled = (requestId) => {
  if (isRequestCancelled(requestId)) {
    throw new Error('请求已停止')
  }
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

const CHAT_TOOLS = [BASH_TOOL_CHAT, ...PROJECT_TOOLS_CHAT]
const RESPONSES_TOOLS = [BASH_TOOL_RESPONSES, ...PROJECT_TOOLS_RESPONSES]

const CONTINUE_REPAIR_PROMPT = /^(修|改|继续|继续修|继续改|接着修|接着改|再修|再改|继续处理|继续执行)$/
const CONTINUE_PROMISE_TEXT = /(我将|我会|继续|下一轮|下一步|然后再|接下来).*(修|改|处理|执行|调用|检查|复检|重试)/

const hasOutstandingTrajectoryIssues = (projectContext) => {
  const totalIssues = projectContext?.trajectoryIssueContext?.summary?.totalIssues
  return Number.isFinite(totalIssues) && Number(totalIssues) > 0
}

const getLastAssistantText = (messages) => {
  if (!Array.isArray(messages)) {
    return ''
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index]
    if (item?.role === 'assistant' && typeof item.content === 'string') {
      return item.content
    }
  }
  return ''
}

const shouldRequireMutationTool = (prompt, projectContext, messages) => {
  if (!projectContext || typeof projectContext !== 'object') {
    return false
  }
  const text = String(prompt ?? '')
  if (!text.trim()) {
    return false
  }
  const hitWriteIntent = /(直接改|帮我改|修改|写入|写一个|生成.*程序|别问|立刻改|马上改)/.test(text)
  if (hitWriteIntent) {
    return true
  }
  const compact = text.replace(/\s+/g, '')
  if (!CONTINUE_REPAIR_PROMPT.test(compact)) {
    return false
  }
  if (hasOutstandingTrajectoryIssues(projectContext)) {
    return true
  }
  const lastAssistantText = getLastAssistantText(messages)
  return CONTINUE_PROMISE_TEXT.test(lastAssistantText)
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
  state.messages = [{ role: 'system', content: BASE_SYSTEM_PROMPT }]
  state.transportMode = undefined
  state.previousResponseId = undefined
  state.projectContext = null
  state.pendingMutation = false
  cancelledRequestIds.clear()
  resetAgentStatus()
}

export const stopAgentRequest = (requestId) => {
  if (requestId) {
    cancelledRequestIds.add(requestId)
    return
  }
  cancelledRequestIds.add('__all__')
}

export const chatWithAgent = async ({
  message,
  reset = false,
  requestId,
  envOverrides,
  projectContext,
  rodConfigContext,
  trajectoryIssueContext,
  requestTrajectoryIssueContext,
  onEvent,
}) => {
  if (cancelledRequestIds.has('__all__') && requestId) {
    cancelledRequestIds.add(requestId)
  }
  throwIfCancelled(requestId)
  if (reset) {
    resetAgentSession()
  }

  const prompt = String(message ?? '').trim()
  if (!prompt) {
    throw new Error('消息不能为空')
  }

  setAgentBusy('请求已接收，准备调用模型')
  try {
    throwIfCancelled(requestId)
    const systemPrompt = BASE_SYSTEM_PROMPT
    state.messages[0] = { role: 'system', content: systemPrompt }
    console.info('[agent][service] start', {
      requestId,
      transportMode: state.transportMode ?? 'auto',
      reset: Boolean(reset),
      hasProjectContext: Boolean(projectContext),
      systemPromptLength: systemPrompt.length,
    })
    if (projectContext && typeof projectContext === 'object') {
      state.projectContext = projectContext
    }
    if (rodConfigContext && typeof rodConfigContext === 'object') {
      const base =
        state.projectContext && typeof state.projectContext === 'object'
          ? state.projectContext
          : { sourceName: '', warnings: [], programs: [] }
      state.projectContext = {
        ...base,
        rodConfig: rodConfigContext,
      }
    }
    if (trajectoryIssueContext && typeof trajectoryIssueContext === 'object') {
      const base =
        state.projectContext && typeof state.projectContext === 'object'
          ? state.projectContext
          : { sourceName: '', warnings: [], programs: [] }
      state.projectContext = {
        ...base,
        trajectoryIssueContext,
      }
    }

    const { client, model, provider } = createClientBundle(envOverrides)
    console.info('[agent][service] client ready', { requestId, provider, model })
    const traces = []
    const timeoutSec = Number(readEnv('NANO_BASH_TIMEOUT_SEC', envOverrides) ?? 30)
    const permissionMode = readEnv('NANO_PERMISSION_MODE', envOverrides) ?? 'manual'
    const requireToolForMutation = state.pendingMutation || shouldRequireMutationTool(
      prompt,
      state.projectContext,
      state.messages,
    )
    if (requireToolForMutation) {
      state.pendingMutation = true
    }
    console.info('[agent][service] mutation tool required', {
      requestId,
      requireToolForMutation,
      pendingMutation: state.pendingMutation,
    })

    if (state.transportMode === 'responses') {
      throwIfCancelled(requestId)
      state.messages.push({ role: 'user', content: prompt })
      const reply = await runResponsesTurn({
        client,
        model,
        userInput: prompt,
        requestId,
        timeoutSec,
        traces,
        permissionMode,
        onEvent,
        state,
        systemPrompt,
        tools: RESPONSES_TOOLS,
        projectContext: state.projectContext,
        requestTrajectoryIssueContext,
        requireToolForMutation,
        onPhase: updateAgentPhase,
        shouldAbort: () => isRequestCancelled(requestId),
      })
      setAgentDone('已完成（Responses）')
      console.info('[agent][service] done responses', {
        requestId,
        replyLength: reply.length,
        traces: traces.length,
        pendingMutation: state.pendingMutation,
      })
      return {
        reply,
        traces,
        provider,
        model,
        transportMode: 'responses',
        projectContext: state.projectContext ?? undefined,
      }
    }

    try {
      throwIfCancelled(requestId)
      const reply = await runChatTurn({
        client,
        model,
        userInput: prompt,
        requestId,
        timeoutSec,
        traces,
        permissionMode,
        onEvent,
        state,
        tools: CHAT_TOOLS,
        projectContext: state.projectContext,
        requestTrajectoryIssueContext,
        requireToolForMutation,
        onPhase: updateAgentPhase,
        shouldAbort: () => isRequestCancelled(requestId),
      })
      setAgentDone('已完成（Chat）')
      console.info('[agent][service] done chat', {
        requestId,
        replyLength: reply.length,
        traces: traces.length,
        pendingMutation: state.pendingMutation,
      })
      return {
        reply,
        traces,
        provider,
        model,
        transportMode: 'chat',
        projectContext: state.projectContext ?? undefined,
      }
    } catch (error) {
      if (!unsupportedOperationError(error)) {
        throw error
      }

      updateAgentPhase('fallback', '当前模型不支持 Chat，回退 Responses')
      console.warn('[agent][service] fallback to responses', {
        requestId,
        reason: error instanceof Error ? error.message : String(error),
      })
      state.transportMode = 'responses'
      state.messages.push({ role: 'user', content: prompt })
      const reply = await runResponsesTurn({
        client,
        model,
        userInput: prompt,
        requestId,
        timeoutSec,
        traces,
        permissionMode,
        onEvent,
        state,
        systemPrompt,
        tools: RESPONSES_TOOLS,
        projectContext: state.projectContext,
        requestTrajectoryIssueContext,
        requireToolForMutation,
        onPhase: updateAgentPhase,
        shouldAbort: () => isRequestCancelled(requestId),
      })
      setAgentDone('已完成（Fallback 到 Responses）')
      console.info('[agent][service] done fallback responses', {
        requestId,
        replyLength: reply.length,
        traces: traces.length,
        pendingMutation: state.pendingMutation,
      })
      return {
        reply,
        traces,
        provider,
        model,
        transportMode: 'responses',
        projectContext: state.projectContext ?? undefined,
      }
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    console.error('[agent][service] failed', { requestId, error: errMessage })
    setAgentError(errMessage)
    throw error
  }
  finally {
    if (requestId) {
      cancelledRequestIds.delete(requestId)
    }
    cancelledRequestIds.delete('__all__')
  }
}

export { getAgentStatus }
