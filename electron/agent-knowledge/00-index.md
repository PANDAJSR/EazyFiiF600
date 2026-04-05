# Agent 知识库索引

本目录用于存放无人机编程 Agent 的可检索知识。

## 使用约定
- 回答前先按用户意图提取关键词，调用 `SearchAgentKnowledge` 检索。
- 若信息不确定、记忆冲突、或规则可能变化，必须再次调用检索工具确认。
- 禁止凭空捏造规则、参数、积木字段、判定条件。

## 文件清单
- `10-coding-constraints.md`：编码与工具调用硬约束。
- `20-subject-completion-rules.md`：完成科目相关判定与复检流程。
- `30-programming-patterns.md`：编程策略与常用写法。
- `40-drone-domain-basics.md`：飞机/道具/赛制基础知识。
- `50-subject1-example.md`：科目1（绕竖杆）示例流程与积木字段示意。
- `60-subject-obstacles-3d.md`：各科目杆件/圈件在 3D 空间中的结构描述。

## 推荐关键词
- 编码：`PatchDroneProgram`、`op`、`fields`、`EazyFii_MoveToCoordAutoDelay`
- 完成科目：`复检`、`GetTrajectoryIssuesDetailed`、`机头朝向`、`闭合`
- 编程：`绕竖杆`、`TurnTo`、`atan2`、`安全距离`
- 飞机知识：`科目`、`绕杆`、`穿圈`、`8字`、`灯光`
