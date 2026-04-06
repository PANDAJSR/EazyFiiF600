# 编程约束

## 积木约束

- 禁止使用 `Goertek_MoveToCoord`
- 默认使用 `EazyFii_MoveToCoordAutoDelay`
- `Goertek_MoveToCoord2` 仅在明确要求"异步平移"时使用

## PatchDroneProgram 约束

- 所有索引使用 **1-based**
- 新增积木必须提供 `type` 和 `fields`
- 支持的操作：`append_block`, `insert_after`, `insert`, `insert_blocks_at`, `replace_range`, `update_fields`, `delete_block`, `move_block`

## 复检约束

- 每次 `PatchDroneProgram` 后必须调用 `GetTrajectoryIssuesDetailed` 复检
- 禁止只改一次就结束
