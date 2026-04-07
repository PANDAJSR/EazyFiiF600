# 工具（Tools）

EazyFii 内置 Agent 支持以下工具，外部 Agent 可以通过 `chat` 方法让内置 Agent 调用：

## Bash

执行 shell 命令。

```json
{
  "command": "ls -la",
  "timeout": 30
}
```

## SearchAgentKnowledge

检索无人机编程知识库。

```json
{
  "query": "科目1 绕竖杆",
  "keywords": ["科目1", "绕竖杆", "TurnTo"],
  "maxResults": 6
}
```

## ListProjectDrones

读取当前工程中的无人机列表。

## GetDroneBlocks

按无人机 ID 或名称读取积木。

## GetRodConfig

读取杆子配置。

## GetBlockCatalog

读取支持的积木类型。

## GetTrajectoryIssuesDetailed

读取轨迹问题详情。

## GetTrajectoryDebugSnapshot

读取轨迹调试快照。

## PatchDroneProgram

编辑无人机程序。
