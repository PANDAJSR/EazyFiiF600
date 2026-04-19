import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from 'antd'
import type { InputRef } from 'antd'
import type { InsertPickerItem } from './blockInsertPickerCatalog'

type Props = {
  items: InsertPickerItem[]
  onCancel: () => void
  onSubmit: (item: InsertPickerItem) => void
}

const normalize = (value: string) => value.trim().toLowerCase()

const getSearchScore = (item: InsertPickerItem, keyword: string) => {
  const label = item.label.toLowerCase()
  const meta = item.meta.toLowerCase()
  const keywords = item.keywords.map((value) => value.toLowerCase())
  let score = 0

  if (label === keyword) {
    score += 1000
  }
  if (label.startsWith(keyword)) {
    score += 300
  } else if (label.includes(keyword)) {
    score += 200
  }

  if (keywords.some((value) => value === keyword)) {
    score += 220
  }
  if (keywords.some((value) => value.startsWith(keyword))) {
    score += 180
  } else if (keywords.some((value) => value.includes(keyword))) {
    score += 120
  }

  if (meta.includes(keyword)) {
    score += 80
  }

  return score
}

function BlockInsertPicker({ items, onCancel, onSubmit }: Props) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<InputRef | null>(null)

  const filteredItems = useMemo(() => {
    const keyword = normalize(query)
    if (!keyword) {
      return items
    }
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const haystack = [item.label, item.meta, ...item.keywords].join(' ').toLowerCase()
        return haystack.includes(keyword)
      })
      .sort((left, right) => {
        const scoreDiff = getSearchScore(right.item, keyword) - getSearchScore(left.item, keyword)
        if (scoreDiff !== 0) {
          return scoreDiff
        }
        return left.index - right.index
      })
      .map(({ item }) => item)
  }, [items, query])

  const safeActiveIndex = filteredItems.length ? Math.min(activeIndex, filteredItems.length - 1) : 0

  const handleConfirm = () => {
    const target = filteredItems[safeActiveIndex]
    if (!target) {
      return
    }
    onSubmit(target)
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (wrapRef.current?.contains(target)) {
        return
      }
      onCancel()
    }
    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [onCancel])

  return (
    <div className="block-insert-picker" ref={wrapRef}>
      <Input
        ref={inputRef}
        placeholder="搜索积木或模板（↑ ↓ 选择，Enter 插入）"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((prev) => Math.min(prev + 1, Math.max(filteredItems.length - 1, 0)))
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((prev) => Math.max(prev - 1, 0))
            return
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            handleConfirm()
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
      />
      <div className="block-insert-picker-list" role="listbox" aria-label="可插入积木">
        {filteredItems.map((item, index) => {
          const active = index === safeActiveIndex
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={active}
              className={`block-insert-picker-item ${active ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSubmit(item)}
            >
              <span className="block-insert-picker-item-label">{item.label}</span>
              <span className="block-insert-picker-item-type">{item.kind === 'template' ? `模板 · ${item.meta}` : item.meta}</span>
            </button>
          )
        })}
        {!filteredItems.length && <div className="block-insert-picker-empty">未找到匹配项</div>}
      </div>
    </div>
  )
}

export default BlockInsertPicker
