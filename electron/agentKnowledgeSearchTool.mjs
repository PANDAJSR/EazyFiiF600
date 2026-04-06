import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SEARCH_AGENT_KNOWLEDGE_TOOL_NAME = 'SearchAgentKnowledge'
export const SEARCH_AGENT_KNOWLEDGE_TOOL_PROPERTIES = {
  query: {
    type: 'string',
    description: '本次要解决的问题或检索意图。',
  },
  keywords: {
    type: 'array',
    items: { type: 'string' },
    description: '关键词数组；建议 2~8 个，越具体越好。',
  },
  maxResults: {
    type: 'integer',
    description: '返回匹配片段数量，默认 6，最大 20。',
  },
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const KNOWLEDGE_DIR = path.resolve(__dirname, 'agent-knowledge')
const SEARCH_SCHEMA = 'eazyfii.agent.knowledgeSearch.v1'
const DEFAULT_MAX_RESULTS = 6
const MAX_RESULTS_LIMIT = 20

const stringify = (value) => JSON.stringify(value, null, 2)

const parseObjectArgs = (rawArguments) => {
  if (typeof rawArguments !== 'string' || rawArguments.trim() === '') {
    return {}
  }
  try {
    const parsed = JSON.parse(rawArguments)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
    return {}
  } catch {
    return {}
  }
}

const normalizeKeywords = (value) => {
  if (!value) {
    return []
  }
  const rawList = Array.isArray(value)
    ? value
    : [value]

  const parts = rawList
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .flatMap((item) => item.split(/[\s,，;；|、]+/g))
    .map((item) => item.trim())
    .filter(Boolean)

  const unique = []
  const seen = new Set()
  for (const part of parts) {
    const key = part.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(part)
    }
  }
  return unique.slice(0, 20)
}

const KEYWORD_ALIAS_GROUPS = [
  ['科目一', '科目1', 'subject1'],
  ['科目二', '科目2', 'subject2'],
  ['科目三', '科目3', 'subject3'],
  ['科目四', '科目4', 'subject4'],
  ['科目五', '科目5', 'subject5'],
  ['科目六', '科目6', 'subject6'],
  ['科目七', '科目7', 'subject7'],
  ['科目八', '科目8', 'subject8'],
  ['科目九', '科目9', 'subject9'],
  ['科目十', '科目10', 'subject10'],
  ['绕杆', '绕横杆', '绕竖杆'],
  ['积木编程', '积木写法', '字段示意', 'fields', 'op'],
  ['闭合轨迹', '闭合', '封闭', '闭环'],
  ['turnto', 'Goertek_TurnTo', 'TurnTo'],
  ['无人机', '飞机', '飞行器'],
]

const SUBJECT_INTENT_CONFIG = [
  {
    aliases: ['科目二', '科目2', 'subject2'],
    fullDocFile: '51-subject2-example.md',
  },
]

const detectSubjectIntent = (keywords) => {
  const keywordSet = new Set(keywords.map((keyword) => keyword.toLowerCase()))
  return SUBJECT_INTENT_CONFIG.find((config) => config.aliases.some((alias) => keywordSet.has(alias.toLowerCase()))) || null
}

const buildFullDocumentResult = (doc, keywords) => ({
  file: doc.file,
  title: `${doc.title}（全文）`,
  score: 1_000_000,
  snippet: buildSnippet(doc.content, keywords),
  fullContent: doc.content,
  isFullDocument: true,
})

const expandKeywordAliases = (keywords) => {
  const expanded = [...keywords]
  const seen = new Set(expanded.map((item) => item.toLowerCase()))

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase()
    const group = KEYWORD_ALIAS_GROUPS.find((aliases) => aliases.some((alias) => alias.toLowerCase() === lowerKeyword))
    if (!group) {
      continue
    }
    for (const alias of group) {
      const aliasKey = alias.toLowerCase()
      if (seen.has(aliasKey)) {
        continue
      }
      seen.add(aliasKey)
      expanded.push(alias)
      if (expanded.length >= 40) {
        return expanded
      }
    }
  }

  return expanded
}

const getMaxResults = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) {
    return DEFAULT_MAX_RESULTS
  }
  return Math.max(1, Math.min(MAX_RESULTS_LIMIT, Math.floor(num)))
}

const extractSections = (text, fallbackTitle) => {
  const lines = String(text ?? '').split(/\r?\n/)
  const sections = []
  let currentTitle = fallbackTitle
  let buffer = []

  const flush = () => {
    const content = buffer.join('\n').trim()
    if (!content) {
      return
    }
    sections.push({ title: currentTitle, content })
  }

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/)
    if (heading) {
      flush()
      currentTitle = heading[1].trim() || fallbackTitle
      buffer = []
      continue
    }
    buffer.push(line)
  }
  flush()

  return sections.length ? sections : [{ title: fallbackTitle, content: String(text ?? '') }]
}

const countOccurrences = (text, keyword) => {
  if (!keyword) {
    return 0
  }
  let from = 0
  let count = 0
  while (from < text.length) {
    const index = text.indexOf(keyword, from)
    if (index < 0) {
      break
    }
    count += 1
    from = index + keyword.length
  }
  return count
}

const buildSnippet = (text, keywords) => {
  const normalizedText = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalizedText) {
    return ''
  }

  const lower = normalizedText.toLowerCase()
  let firstIndex = -1
  for (const keyword of keywords) {
    const idx = lower.indexOf(keyword.toLowerCase())
    if (idx >= 0 && (firstIndex < 0 || idx < firstIndex)) {
      firstIndex = idx
    }
  }

  if (firstIndex < 0) {
    return normalizedText.slice(0, 220)
  }

  const start = Math.max(0, firstIndex - 80)
  const end = Math.min(normalizedText.length, firstIndex + 180)
  return normalizedText.slice(start, end)
}

const scoreSection = (title, content, keywords, docTitle = '') => {
  const titleText = String(title ?? '')
  const bodyText = String(content ?? '')
  const docTitleText = String(docTitle ?? '')
  const lowerTitle = titleText.toLowerCase()
  const lowerBody = bodyText.toLowerCase()
  const lowerDocTitle = docTitleText.toLowerCase()

  let score = 0
  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase()
    score += countOccurrences(lowerBody, lowerKeyword)
    if (lowerTitle.includes(lowerKeyword)) {
      score += 2
    }
    if (lowerDocTitle.includes(lowerKeyword)) {
      score += 1
    }
  }
  return score
}

const searchInDoc = (doc, keywords) => {
  const sections = extractSections(doc.content, doc.title)
  const matches = []

  for (const section of sections) {
    const score = scoreSection(section.title, section.content, keywords, doc.title)
    if (score <= 0) {
      continue
    }
    matches.push({
      file: doc.file,
      title: section.title,
      score,
      snippet: buildSnippet(section.content, keywords),
    })
  }

  return matches
}

const listKnowledgeFiles = async () => {
  let entries = []
  try {
    entries = await fs.readdir(KNOWLEDGE_DIR, { withFileTypes: true })
  } catch {
    return []
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))

  const docs = await Promise.all(files.map(async (file) => {
    const fullPath = path.join(KNOWLEDGE_DIR, file)
    const content = await fs.readFile(fullPath, 'utf8')
    const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || file
    return {
      file,
      title: firstHeading,
      content,
    }
  }))

  return docs
}

export const searchAgentKnowledge = async (rawArguments) => {
  const args = parseObjectArgs(rawArguments)
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  const queryKeywords = normalizeKeywords(query)
  const explicitKeywords = normalizeKeywords(args.keywords)
  const keywords = expandKeywordAliases(normalizeKeywords([...explicitKeywords, ...queryKeywords]))
  const subjectIntent = detectSubjectIntent(keywords)
  const maxResults = getMaxResults(args.maxResults)

  const docs = await listKnowledgeFiles()
  if (!docs.length) {
    return {
      output: stringify({
        ok: false,
        schema: SEARCH_SCHEMA,
        error: '知识库目录为空或不可读。',
        knowledgeDir: KNOWLEDGE_DIR,
      }),
    }
  }

  if (!keywords.length) {
    return {
      output: stringify({
        ok: false,
        schema: SEARCH_SCHEMA,
        error: '缺少检索关键词。请传 query 或 keywords。',
        example: {
          query: '科目1 绕竖杆 机头朝向 复检',
          keywords: ['科目1', '绕竖杆', 'TurnTo', 'GetTrajectoryIssuesDetailed'],
        },
      }),
    }
  }

  const allMatches = docs
    .flatMap((doc) => searchInDoc(doc, keywords))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.file.localeCompare(right.file, 'zh-Hans-CN')
    })

  let rankedMatches = allMatches
  if (subjectIntent) {
    const targetDoc = docs.find((doc) => doc.file === subjectIntent.fullDocFile)
    if (targetDoc) {
      rankedMatches = [
        buildFullDocumentResult(targetDoc, keywords),
        ...allMatches.filter((item) => item.file !== targetDoc.file),
      ]
    }
  }

  if (!rankedMatches.length) {
    return {
      output: stringify({
        ok: true,
        schema: SEARCH_SCHEMA,
        query,
        keywords,
        totalMatches: 0,
        knowledgeFiles: docs.map((doc) => doc.file),
        results: [],
        hint: '没有匹配结果，请更换更具体或更短的关键词再检索一次。',
      }),
    }
  }

  return {
    output: stringify({
      ok: true,
      schema: SEARCH_SCHEMA,
      query,
      keywords,
      totalMatches: rankedMatches.length,
      results: rankedMatches.slice(0, maxResults),
    }),
  }
}
