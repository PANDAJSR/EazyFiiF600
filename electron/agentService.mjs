import OpenAI, { AzureOpenAI } from 'openai'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const challengeKnowledgeFile = path.resolve(__dirname, 'agent-challenge-knowledge.md')

const BASE_SYSTEM_PROMPT = `你是 EazyFii 里的无人机积木编程 Agent，运行在 Electron 主进程里。
你可以使用 Bash、ListProjectDrones、GetDroneBlocks、GetRodConfig、GetBlockCatalog、PatchDroneProgram 六个工具。
当用户问题和当前工程的无人机/积木有关时，优先调用项目工具读取 JSON 数据后再回答，不要臆造工程内容。
生成或修改飞行动作时，禁止使用 Goertek_MoveToCoord（该积木当前无法被本项目正确识别）。
默认请使用我们定义的“智能平移”积木 EazyFii_MoveToCoordAutoDelay。
Goertek_MoveToCoord2（平移到/异步）仅在用户明确要求“异步平移”时才允许使用；如果用户没有特别说明，必须优先使用 EazyFii_MoveToCoordAutoDelay。
当你通过 PatchDroneProgram 写入 EazyFii_MoveToCoordAutoDelay 时，block.fields 必须包含且只使用大写键名: X、Y、Z、time（不要用 x/y/z/TIME 等变体）。
X、Y、Z、time 的值必须是非空字符串数字（例如 "120"、"0"、"100"、"800"），禁止写空串、null、undefined、对象或缺字段。
在发起 PatchDroneProgram 之前，你必须先自检 operations 中每个 block 的 type 与 fields 是否满足上面的约束，不满足就先修正再调用。
PatchDroneProgram 的 op 只能使用: append_block、insert_after、insert、insert_blocks_at、replace_range、update_fields、delete_block、move_block；不要发明其它 op 名称。
修改连续片段时，优先使用 replace_range；插入连续片段时，优先使用 insert_blocks_at。不要把一长段改动拆成很多同索引 insert。
如果你不确定积木类型，先调用 GetDroneBlocks 参考当前工程已有类型，再调用 PatchDroneProgram 写入。
当规划与科目道具相关的路径时，先调用 GetRodConfig 获取杆子坐标与高度参数，再生成或修改程序。
当要生成或修改积木程序时，先调用 GetBlockCatalog 获取“可用积木类型与参数键名”，禁止使用目录外或参数名不匹配的积木。
当用户任务是“科目1/绕竖杆”时，转向是硬约束：在每一段平移（EazyFii_MoveToCoordAutoDelay）之前，必须先插入 Goertek_Turn，使机头先对准“下一段将要飞行的朝向”；禁止只给连续平移而不转向的方案。
当用户任务是“科目1/绕竖杆”时，输出前必须自检：若本次写入片段中存在平移段但不存在 Goertek_Turn，视为不合格，必须先补齐转动积木再调用 PatchDroneProgram。
当用户明确要求“直接修改/写入”时，你必须真正调用 PatchDroneProgram 执行修改，不要只给口头方案。
如果 PatchDroneProgram 返回 ok=false，你必须继续补全参数并再次调用，直到 ok=true 或达到工具轮次上限，再向用户汇报结果。
任意工具调用失败后，不允许停在失败说明上；你必须基于错误信息调整参数并继续尝试调用工具，直到成功或达到工具轮次上限。
若需要执行危险 Bash 命令，请先解释风险。`

const loadChallengeKnowledge = async () => {
  try {
    const text = await fs.readFile(challengeKnowledgeFile, 'utf8')
    return text.trim()
  } catch {
    return ''
  }
}

const buildSystemPrompt = async () => {
  const knowledge = await loadChallengeKnowledge()
  const challengeSection = [
    '以下是“编程挑战赛知识库”（Markdown）：',
    knowledge || '(当前为空，可由项目维护者后续补充)',
  ].join('\n')
  return `${BASE_SYSTEM_PROMPT}\n\n${challengeSection}`
}

const state = {
  messages: [{ role: 'system', content: BASE_SYSTEM_PROMPT }],
  transportMode: undefined,
  previousResponseId: undefined,
  projectContext: null,
  pendingMutation: false,
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

const shouldRequireMutationTool = (prompt, projectContext) => {
  if (!projectContext || typeof projectContext !== 'object') {
    return false
  }
  const text = String(prompt ?? '')
  if (!text.trim()) {
    return false
  }
  const hitWriteIntent = /(直接改|帮我改|修改|写入|写一个|生成.*程序|别问|立刻改|马上改)/.test(text)
  return hitWriteIntent
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
  resetAgentStatus()
}

export const chatWithAgent = async ({
  message,
  reset = false,
  requestId,
  envOverrides,
  projectContext,
  rodConfigContext,
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
    const systemPrompt = await buildSystemPrompt()
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

    const { client, model, provider } = createClientBundle(envOverrides)
    console.info('[agent][service] client ready', { requestId, provider, model })
    const traces = []
    const timeoutSec = Number(readEnv('NANO_BASH_TIMEOUT_SEC', envOverrides) ?? 30)
    const permissionMode = readEnv('NANO_PERMISSION_MODE', envOverrides) ?? 'manual'
    const requireToolForMutation = state.pendingMutation || shouldRequireMutationTool(prompt, state.projectContext)
    if (requireToolForMutation) {
      state.pendingMutation = true
    }
    console.info('[agent][service] mutation tool required', {
      requestId,
      requireToolForMutation,
      pendingMutation: state.pendingMutation,
    })

    if (state.transportMode === 'responses') {
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
        requireToolForMutation,
        onPhase: updateAgentPhase,
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
        requireToolForMutation,
        onPhase: updateAgentPhase,
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
        requireToolForMutation,
        onPhase: updateAgentPhase,
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
}

export { getAgentStatus }
