export const unsupportedOperationError = (error) => {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return message.includes('unsupported') || message.includes('requested operation is unsupported')
}

export const extractResponseText = (response) => {
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

export const safeCommandPreview = (rawArgs) => {
  if (typeof rawArgs !== 'string' || !rawArgs.trim()) {
    return ''
  }
  try {
    const parsed = JSON.parse(rawArgs)
    if (typeof parsed?.command === 'string') {
      return parsed.command.trim()
    }
  } catch {
    return ''
  }
  return ''
}

export const safeToolArgsPreview = (rawArgs) => {
  if (typeof rawArgs !== 'string') {
    return ''
  }
  const trimmed = rawArgs.trim()
  if (!trimmed) {
    return ''
  }
  try {
    const parsed = JSON.parse(trimmed)
    return JSON.stringify(parsed, null, 2)
  } catch {
    const command = safeCommandPreview(trimmed)
    if (command) {
      return command
    }
    return trimmed
  }
}
