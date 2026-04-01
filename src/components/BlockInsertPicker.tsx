import { useMemo, useState } from 'react'
import { Input, Modal } from 'antd'
import type { InsertableBlockDefinition } from './blockInsertCatalog'

type Props = {
  open: boolean
  items: InsertableBlockDefinition[]
  onCancel: () => void
  onSubmit: (item: InsertableBlockDefinition) => void
}

const normalize = (value: string) => value.trim().toLowerCase()

function BlockInsertPicker({ open, items, onCancel, onSubmit }: Props) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

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

  return (
    <Modal
      title="插入积木"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={520}
      destroyOnClose
      className="block-insert-picker"
      afterOpenChange={(nextOpen) => {
        if (nextOpen) {
          setQuery('')
          setActiveIndex(0)
        }
      }}
    >
      <Input
        autoFocus
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
    </Modal>
  )
}

export default BlockInsertPicker
