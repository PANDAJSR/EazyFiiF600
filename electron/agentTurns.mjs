import { executeBashWithPolicy, parseToolArgs } from './agentBashTool.mjs'
import { streamChatCompletion } from './openaiChatStream.mjs'
import { extractResponseText, safeToolArgsPreview } from './agentResponseUtils.mjs'
import { executeProjectToolCall } from './agentProjectTools.mjs'

const MAX_TOOL_ROUNDS = 100
const PROJECT_TOOL_NAMES = new Set([
  'SearchAgentKnowledge',
  'ListProjectDrones',
  'GetDroneBlocks',
  'GetRodConfig',
  'GetBlockCatalog',
  'GetTrajectoryIssuesDetailed',
  'GetTrajectoryDebugSnapshot',
  'PatchDroneProgram',
])
const parsePatchOk = (output) => {
  try {
    const parsed = JSON.parse(output)
    return parsed?.schema === 'eazyfii.project.dronePatch.v1' && parsed?.ok === true
  } catch {
    return false
  }
}

const hasContinuationPromise = (text) => {
  const raw = String(text ?? '').trim()
  if (!raw) {
    return false
  }
  return (
    /(我将|我会|继续|下一轮|下一步|然后再|接下来).*(调用|修改|修复|重试|检查|执行|处理)/.test(raw)
    || /(继续修|继续改|继续处理|接着修|接着改|收到[,，]?我继续修)/.test(raw)
  )
}

const emitProjectContextPatched = ({ onEvent, nextProjectContext }) => {
  if (!onEvent || !nextProjectContext) {
    return
  }
  onEvent({
    type: 'project-context-patched',
    projectContext: nextProjectContext,
  })
}

const readReasoningDelta = (event) => {
  if (!event || typeof event !== 'object') {
    return null
  }
  const eventType = typeof event.type === 'string' ? event.type : ''
  const hasReasoningType = eventType.includes('reasoning')
  if (hasReasoningType && typeof event.delta === 'string' && event.delta) {
    return event.delta
  }
  if (hasReasoningType && typeof event.text === 'string' && event.text) {
    return event.text
  }
  if (hasReasoningType && typeof event.summary === 'string' && event.summary) {
    return event.summary
  }
  const item = event.item
  if (item?.type === 'reasoning' && Array.isArray(item.summary)) {
    const summaryTexts = item.summary
      .map((entry) => (typeof entry?.text === 'string' ? entry.text : ''))
      .filter(Boolean)
    if (summaryTexts.length > 0) {
      return summaryTexts.join('\n')
    }
  }
  const outputs = Array.isArray(event.response?.output) ? event.response.output : []
  for (const output of outputs) {
    if (output?.type !== 'reasoning' || !Array.isArray(output.summary)) {
      continue
    }
    const summaryTexts = output.summary
      .map((entry) => (typeof entry?.text === 'string' ? entry.text : ''))
      .filter(Boolean)
    if (summaryTexts.length > 0) {
      return summaryTexts.join('\n')
    }
  }
  return null
}

const readReasoningBlockId = (event) => {
  if (!event || typeof event !== 'object') {
    return 'reasoning'
  }
  const raw = event.item_id ?? event.output_item_id ?? event.id
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'reasoning'
  }
  return raw
}

export const runResponsesTurn = async ({
  client,
  model,
  userInput,
  requestId,
  timeoutSec,
  traces,
  permissionMode,
  onEvent,
  state,
  systemPrompt,
  tools,
  projectContext,
  requestTrajectoryIssueContext,
  requireToolForMutation,
  enableReasoning,
  onPhase,
  shouldAbort,
}) => {
  const ensureNotAborted = () => {
    if (shouldAbort?.()) {
      throw new Error('请求已停止')
    }
  }
  ensureNotAborted()
  onPhase('llm-responses', '使用 Responses API 推理')
  let lastAnswer = ''
  let input = userInput
  let didPatchDroneProgram = false
  let forcedMutationRetryCount = 0
  let forcedContinuationRetryCount = 0

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    ensureNotAborted()
    console.info('[agent][turns][responses] round start', { requestId, round: round + 1 })
    const stream = await client.responses.create({
      model,
      previous_response_id: state.previousResponseId,
      input,
      instructions: systemPrompt,
      tools,
      reasoning: enableReasoning
        ? {
            summary: 'detailed',
          }
        : undefined,
      tool_choice: requireToolForMutation && !didPatchDroneProgram ? 'required' : 'auto',
      max_output_tokens: 4096,
      stream: true,
    })

    let response = null
    let reasoningEventCount = 0
    for await (const event of stream) {
      ensureNotAborted()
      if (enableReasoning && typeof event?.type === 'string' && event.type.includes('reasoning')) {
        reasoningEventCount += 1
        console.info('[agent][turns][responses] reasoning stream event', {
          requestId,
          round: round + 1,
          type: event.type,
        })
      }
      if (event.type === 'response.output_text.delta' && event.delta) {
        lastAnswer += event.delta
        onEvent?.({ type: 'text-delta', delta: event.delta })
      }
      const reasoningDelta = readReasoningDelta(event)
      if (enableReasoning && reasoningDelta) {
        reasoningEventCount += 1
        onEvent?.({
          type: 'reasoning-delta',
          blockId: readReasoningBlockId(event),
          delta: reasoningDelta,
          textOffset: lastAnswer.length,
        })
      }
      if (event.type === 'response.completed') {
        response = event.response
      }
    }
    if (enableReasoning && reasoningEventCount === 0) {
      console.warn('[agent][turns][responses] no reasoning events in this round', {
        requestId,
        round: round + 1,
        model,
      })
    }

    if (!response) {
      throw new Error('Responses 流式返回异常：缺少 completed 事件')
    }

    state.previousResponseId = response.id
    if (!lastAnswer) {
      const answer = extractResponseText(response)
      if (answer) {
        lastAnswer = answer
      }
    }

    const calls = []
    for (const item of response.output ?? []) {
      if (item?.type === 'function_call' && typeof item.call_id === 'string' && item.name) {
        onEvent?.({
          type: 'tool-call',
          phase: 'model',
          tool: item.name,
          toolCallId: item.call_id,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(item.arguments),
        })
        calls.push({
          callId: item.call_id,
          name: item.name,
          arguments: item.arguments ?? '{}',
        })
      }
    }
    console.info('[agent][turns][responses] round completed', {
      requestId,
      round: round + 1,
      responseId: response.id,
      toolCalls: calls.length,
      answerChars: lastAnswer.length,
    })

    if (calls.length === 0) {
      const promisedContinuation = hasContinuationPromise(lastAnswer)
      if (promisedContinuation && forcedContinuationRetryCount < 2) {
        forcedContinuationRetryCount += 1
        input = '你上一条回复承诺会继续执行，但还没有发起工具调用。请不要结束，立即调用下一步所需工具并继续。'
        continue
      }
      if (promisedContinuation) {
        state.pendingMutation = true
      }
      if (requireToolForMutation && !didPatchDroneProgram && forcedMutationRetryCount < MAX_TOOL_ROUNDS - 1) {
        forcedMutationRetryCount += 1
        console.warn('[agent][turns][responses] no tool call for mutation request, forcing retry', {
          requestId,
          round: round + 1,
          forcedMutationRetryCount,
        })
        input = '这是写入请求。你必须调用 PatchDroneProgram 执行真实修改，不要只回答方案。先调用工具，再汇报结果。'
        continue
      }
      console.info('[agent][turns][responses] end with no tool calls', { requestId, round: round + 1 })
      state.messages.push({ role: 'assistant', content: lastAnswer || '' })
      return lastAnswer
    }

    const outputs = []
    for (const call of calls) {
      ensureNotAborted()
      console.info('[agent][turns][responses] tool dispatch', {
        requestId,
        round: round + 1,
        tool: call.name,
        callId: call.callId,
      })
      if (call.name === 'Bash') {
        const args = parseToolArgs(call.arguments)
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-start',
          tool: 'Bash',
          toolCallId: call.callId,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(call.arguments),
        })

        const { output, granted } = await executeBashWithPolicy({
          command: args.command,
          timeoutSec: args.timeout ?? timeoutSec,
          traces,
          permissionMode,
          onPhase,
        })
        ensureNotAborted()

        onEvent?.({
          type: 'tool-call',
          phase: 'exec-end',
          tool: 'Bash',
          toolCallId: call.callId,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(call.arguments),
          granted,
          resultPreview: output,
        })

        outputs.push({
          type: 'function_call_output',
          call_id: call.callId,
          output,
        })
        continue
      }

      if (PROJECT_TOOL_NAMES.has(call.name)) {
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-start',
          tool: call.name,
          toolCallId: call.callId,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(call.arguments),
        })
        const { output, nextProjectContext } = await executeProjectToolCall({
          name: call.name,
          rawArguments: call.arguments,
          projectContext,
          requestTrajectoryIssueContext,
        })
        ensureNotAborted()
        if (call.name === 'PatchDroneProgram') {
          didPatchDroneProgram = true
          if (parsePatchOk(output)) {
            state.pendingMutation = false
            console.info('[agent][turns][responses] patch success, clear pending mutation', { requestId })
          }
        }
        if (nextProjectContext) {
          state.projectContext = nextProjectContext
          projectContext = nextProjectContext
          if (call.name === 'PatchDroneProgram') {
            emitProjectContextPatched({ onEvent, nextProjectContext })
          }
        }
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-end',
          tool: call.name,
          toolCallId: call.callId,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(call.arguments),
          granted: true,
          resultPreview: output,
        })
        outputs.push({
          type: 'function_call_output',
          call_id: call.callId,
          output,
        })
        console.info('[agent][turns][responses] project tool done', {
          requestId,
          round: round + 1,
          tool: call.name,
          callId: call.callId,
          outputPreview: output.slice(0, 120),
        })
        continue
      }

      outputs.push({
        type: 'function_call_output',
        call_id: call.callId,
        output: `不支持的工具: ${call.name}`,
      })
    }

    input = outputs
  }

  throw new Error('工具调用轮次过多，已中断')
}

export const runChatTurn = async ({
  client,
  model,
  userInput,
  requestId,
  timeoutSec,
  traces,
  permissionMode,
  onEvent,
  state,
  tools,
  projectContext,
  requestTrajectoryIssueContext,
  enableReasoning,
  requireToolForMutation,
  onPhase,
  shouldAbort,
}) => {
  void enableReasoning
  const ensureNotAborted = () => {
    if (shouldAbort?.()) {
      throw new Error('请求已停止')
    }
  }
  ensureNotAborted()
  onPhase('llm-chat', '使用 Chat Completions 推理')
  state.messages.push({ role: 'user', content: userInput })

  let lastAnswer = ''
  let didPatchDroneProgram = false
  let forcedMutationRetryCount = 0
  let forcedContinuationRetryCount = 0

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    ensureNotAborted()
    console.info('[agent][turns][chat] round start', { requestId, round: round + 1 })
    const completion = await streamChatCompletion({
      client,
      model,
      messages: state.messages,
      tools,
      toolChoice: requireToolForMutation && !didPatchDroneProgram ? 'required' : 'auto',
      maxTokens: 4096,
      onTextDelta: (delta) => onEvent?.({ type: 'text-delta', delta }),
      onToolCallDelta: ({ toolIndex, callId, name, arguments: rawArgs, textOffset }) => {
        onEvent?.({
          type: 'tool-call',
          phase: 'model',
          tool: name || 'Bash',
          toolCallId: callId,
          toolIndex,
          textOffset,
          commandPreview: safeToolArgsPreview(rawArgs),
        })
      },
    })
    ensureNotAborted()

    state.messages.push({
      role: 'assistant',
      content: completion.content || null,
      tool_calls: completion.toolCalls,
    })

    if (completion.content && completion.content.trim()) {
      lastAnswer = completion.content
    }

    const toolCalls = completion.toolCalls ?? []
    console.info('[agent][turns][chat] round completed', {
      requestId,
      round: round + 1,
      toolCalls: toolCalls.length,
      answerChars: lastAnswer.length,
    })
    if (toolCalls.length === 0) {
      const promisedContinuation = hasContinuationPromise(lastAnswer)
      if (promisedContinuation && forcedContinuationRetryCount < 2) {
        forcedContinuationRetryCount += 1
        state.messages.push({
          role: 'user',
          content: '你上一条回复承诺会继续执行，但还没有发起工具调用。请不要结束，立即调用下一步所需工具并继续。',
        })
        continue
      }
      if (promisedContinuation) {
        state.pendingMutation = true
      }
      if (requireToolForMutation && !didPatchDroneProgram && forcedMutationRetryCount < MAX_TOOL_ROUNDS - 1) {
        forcedMutationRetryCount += 1
        console.warn('[agent][turns][chat] no tool call for mutation request, forcing retry', {
          requestId,
          round: round + 1,
          forcedMutationRetryCount,
        })
        state.messages.push({
          role: 'user',
          content: '这是写入请求。你必须调用 PatchDroneProgram 执行真实修改，不要只回答方案。先调用工具，再汇报结果。',
        })
        continue
      }
      console.info('[agent][turns][chat] end with no tool calls', { requestId, round: round + 1 })
      return lastAnswer
    }

    for (const toolCall of toolCalls) {
      ensureNotAborted()
      if (toolCall.type !== 'function' || !('function' in toolCall)) {
        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `不支持的工具: ${'function' in toolCall ? toolCall.function.name : toolCall.type}`,
        })
        continue
      }

      if (toolCall.function.name === 'Bash') {
        console.info('[agent][turns][chat] bash tool dispatch', {
          requestId,
          round: round + 1,
          callId: toolCall.id,
        })
        const args = parseToolArgs(toolCall.function.arguments)
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-start',
          tool: 'Bash',
          toolCallId: toolCall.id,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(toolCall.function.arguments),
        })

        const { output, granted } = await executeBashWithPolicy({
          command: args.command,
          timeoutSec: args.timeout ?? timeoutSec,
          traces,
          permissionMode,
          onPhase,
        })
        ensureNotAborted()

        onEvent?.({
          type: 'tool-call',
          phase: 'exec-end',
          tool: 'Bash',
          toolCallId: toolCall.id,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(toolCall.function.arguments),
          granted,
          resultPreview: output,
        })

        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: output,
        })
        continue
      }

      if (PROJECT_TOOL_NAMES.has(toolCall.function.name)) {
        console.info('[agent][turns][chat] project tool dispatch', {
          requestId,
          round: round + 1,
          tool: toolCall.function.name,
          callId: toolCall.id,
        })
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-start',
          tool: toolCall.function.name,
          toolCallId: toolCall.id,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(toolCall.function.arguments),
        })
        const { output, nextProjectContext } = await executeProjectToolCall({
          name: toolCall.function.name,
          rawArguments: toolCall.function.arguments,
          projectContext,
          requestTrajectoryIssueContext,
        })
        ensureNotAborted()
        if (toolCall.function.name === 'PatchDroneProgram') {
          didPatchDroneProgram = true
          if (parsePatchOk(output)) {
            state.pendingMutation = false
            console.info('[agent][turns][chat] patch success, clear pending mutation', { requestId })
          }
        }
        if (nextProjectContext) {
          state.projectContext = nextProjectContext
          projectContext = nextProjectContext
          if (toolCall.function.name === 'PatchDroneProgram') {
            emitProjectContextPatched({ onEvent, nextProjectContext })
          }
        }
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-end',
          tool: toolCall.function.name,
          toolCallId: toolCall.id,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(toolCall.function.arguments),
          granted: true,
          resultPreview: output,
        })
        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: output,
        })
        console.info('[agent][turns][chat] project tool done', {
          requestId,
          round: round + 1,
          tool: toolCall.function.name,
          callId: toolCall.id,
          outputPreview: output.slice(0, 120),
        })
        continue
      }

      state.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: `不支持的工具: ${toolCall.function.name}`,
      })
    }
  }

  throw new Error('工具调用轮次过多，已中断')
}
