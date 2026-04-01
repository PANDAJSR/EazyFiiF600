import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from 'antd'
import type { InputRef } from 'antd'
import type { InsertableBlockDefinition } from './blockInsertCatalog'

type Props = {
  items: InsertableBlockDefinition[]
  onCancel: () => void
  onSubmit: (item: InsertableBlockDefinition) => void
}

const normalize = (value: string) => value.trim().toLowerCase()

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
    return items.filter((item) => {
      const haystack = [item.label, item.type, ...item.keywords].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
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
        placeholder="搜索积木名称或类型（↑ ↓ 选择，Enter 插入）"
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
              key={item.type}
              type="button"
              role="option"
              aria-selected={active}
              className={`block-insert-picker-item ${active ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSubmit(item)}
            >
              <span className="block-insert-picker-item-label">{item.label}</span>
              <span className="block-insert-picker-item-type">{item.type}</span>
            </button>
          )
        })}
        {!filteredItems.length && <div className="block-insert-picker-empty">未找到匹配积木</div>}
      </div>
    </div>
  )
}

export default BlockInsertPicker
