export const streamChatCompletion = async ({
  client,
  model,
  messages,
  tools,
  maxTokens,
  onTextDelta,
}) => {
  const stream = await client.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: 'auto',
    max_tokens: maxTokens,
    stream: true,
  })

  let content = ''
  const toolBuf = {}

  for await (const chunk of stream) {
    const choice = chunk?.choices?.[0]
    if (!choice) {
      continue
    }

    const delta = choice.delta
    if (!delta) {
      continue
    }

    if (delta.content) {
      content += delta.content
      if (onTextDelta) {
        onTextDelta(delta.content)
      }
    }

    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const index = toolCall.index
        if (typeof index !== 'number') {
          continue
        }
        if (!toolBuf[index]) {
          toolBuf[index] = { id: '', name: '', arguments: '' }
        }
        if (toolCall.id) {
          toolBuf[index].id = toolCall.id
        }
        if (toolCall.function?.name) {
          toolBuf[index].name += toolCall.function.name
        }
        if (toolCall.function?.arguments) {
          toolBuf[index].arguments += toolCall.function.arguments
        }
      }
    }
  }

  const toolCalls = Object.values(toolBuf)
    .filter((item) => item.name)
    .map((item, idx) => ({
      id: item.id || `call_${idx}`,
      type: 'function',
      function: {
        name: item.name,
        arguments: item.arguments || '{}',
      },
    }))

  return {
    content,
    toolCalls,
  }
}
