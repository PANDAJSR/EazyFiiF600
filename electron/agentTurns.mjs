import { executeBashWithPolicy, parseToolArgs } from './agentBashTool.mjs'
import { streamChatCompletion } from './openaiChatStream.mjs'
import { extractResponseText, safeToolArgsPreview } from './agentResponseUtils.mjs'
import { executeProjectToolCall } from './agentProjectTools.mjs'

const MAX_TOOL_ROUNDS = 8

export const runResponsesTurn = async ({
  client,
  model,
  userInput,
  timeoutSec,
  traces,
  permissionMode,
  onEvent,
  state,
  systemPrompt,
  tools,
  projectContext,
  onPhase,
}) => {
  onPhase('llm-responses', '使用 Responses API 推理')
  let lastAnswer = ''
  let input = userInput

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const stream = await client.responses.create({
      model,
      previous_response_id: state.previousResponseId,
      input,
      instructions: systemPrompt,
      tools,
      tool_choice: 'auto',
      max_output_tokens: 4096,
      stream: true,
    })

    let response = null
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta' && event.delta) {
        lastAnswer += event.delta
        onEvent?.({ type: 'text-delta', delta: event.delta })
      }
      if (event.type === 'response.completed') {
        response = event.response
      }
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

    if (calls.length === 0) {
      state.messages.push({ role: 'assistant', content: lastAnswer || '' })
      return lastAnswer
    }

    const outputs = []
    for (const call of calls) {
      if (call.name === 'Bash') {
        const args = parseToolArgs(call.arguments)
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-start',
          tool: 'Bash',
          toolCallId: call.callId,
          textOffset: lastAnswer.length,
          commandPreview: args.command,
        })

        const { output, granted } = await executeBashWithPolicy({
          command: args.command,
          timeoutSec: args.timeout ?? timeoutSec,
          traces,
          permissionMode,
          onPhase,
        })

        onEvent?.({
          type: 'tool-call',
          phase: 'exec-end',
          tool: 'Bash',
          toolCallId: call.callId,
          textOffset: lastAnswer.length,
          commandPreview: args.command,
          granted,
          resultPreview: output.slice(0, 160),
        })

        outputs.push({
          type: 'function_call_output',
          call_id: call.callId,
          output,
        })
        continue
      }

      if (call.name === 'ListProjectDrones' || call.name === 'GetDroneBlocks') {
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-start',
          tool: call.name,
          toolCallId: call.callId,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(call.arguments),
        })
        const output = executeProjectToolCall({
          name: call.name,
          rawArguments: call.arguments,
          projectContext,
        })
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-end',
          tool: call.name,
          toolCallId: call.callId,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(call.arguments),
          granted: true,
          resultPreview: output.slice(0, 160),
        })
        outputs.push({
          type: 'function_call_output',
          call_id: call.callId,
          output,
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
  timeoutSec,
  traces,
  permissionMode,
  onEvent,
  state,
  tools,
  projectContext,
  onPhase,
}) => {
  onPhase('llm-chat', '使用 Chat Completions 推理')
  state.messages.push({ role: 'user', content: userInput })

  let lastAnswer = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await streamChatCompletion({
      client,
      model,
      messages: state.messages,
      tools,
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

    state.messages.push({
      role: 'assistant',
      content: completion.content || null,
      tool_calls: completion.toolCalls,
    })

    if (completion.content && completion.content.trim()) {
      lastAnswer = completion.content
    }

    const toolCalls = completion.toolCalls ?? []
    if (toolCalls.length === 0) {
      return lastAnswer
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== 'function' || !('function' in toolCall)) {
        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `不支持的工具: ${'function' in toolCall ? toolCall.function.name : toolCall.type}`,
        })
        continue
      }

      if (toolCall.function.name === 'Bash') {
        const args = parseToolArgs(toolCall.function.arguments)
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-start',
          tool: 'Bash',
          toolCallId: toolCall.id,
          textOffset: lastAnswer.length,
          commandPreview: args.command,
        })

        const { output, granted } = await executeBashWithPolicy({
          command: args.command,
          timeoutSec: args.timeout ?? timeoutSec,
          traces,
          permissionMode,
          onPhase,
        })

        onEvent?.({
          type: 'tool-call',
          phase: 'exec-end',
          tool: 'Bash',
          toolCallId: toolCall.id,
          textOffset: lastAnswer.length,
          commandPreview: args.command,
          granted,
          resultPreview: output.slice(0, 160),
        })

        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: output,
        })
        continue
      }

      if (toolCall.function.name === 'ListProjectDrones' || toolCall.function.name === 'GetDroneBlocks') {
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-start',
          tool: toolCall.function.name,
          toolCallId: toolCall.id,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(toolCall.function.arguments),
        })
        const output = executeProjectToolCall({
          name: toolCall.function.name,
          rawArguments: toolCall.function.arguments,
          projectContext,
        })
        onEvent?.({
          type: 'tool-call',
          phase: 'exec-end',
          tool: toolCall.function.name,
          toolCallId: toolCall.id,
          textOffset: lastAnswer.length,
          commandPreview: safeToolArgsPreview(toolCall.function.arguments),
          granted: true,
          resultPreview: output.slice(0, 160),
        })
        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: output,
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
