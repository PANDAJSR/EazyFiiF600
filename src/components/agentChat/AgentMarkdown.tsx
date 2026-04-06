import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type AgentMarkdownProps = {
  text: string
}

export default function AgentMarkdown({ text }: AgentMarkdownProps) {
  return (
    <div className="agent-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}
