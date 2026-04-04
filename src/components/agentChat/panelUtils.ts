import type { AgentEnvValues, AgentToolTrace } from '../../types/agent'

export const newMessageId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const traceSummary = (trace: AgentToolTrace) => {
  if (trace.phase === 'start') {
    return `开始: ${trace.command}`
  }
  const status = trace.granted ? '已执行' : '已拒绝'
  return `结束(${status}): ${trace.resultPreview ?? ''}`
}

export const formatElapsed = (startedAt: number | null) => {
  if (!startedAt) {
    return '0s'
  }
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  return `${sec}s`
}

export const serializeEnvValues = (values: AgentEnvValues) => {
  return Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

const normalizeEnvValue = (value: string) => {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export const parseEnvText = (text: string): AgentEnvValues => {
  const next: AgentEnvValues = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const normalizedLine = line.replace(/^export\s+/i, '')
    const eqIndex = normalizedLine.indexOf('=')
    if (eqIndex <= 0) {
      continue
    }
    const key = normalizedLine.slice(0, eqIndex).trim()
    const value = normalizeEnvValue(normalizedLine.slice(eqIndex + 1))
    if (!key) {
      continue
    }
    next[key] = value
  }
  return next
}
