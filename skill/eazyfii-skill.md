# EazyFii Skill - 无人机积木编程 Agent 接口

## 概述

EazyFii 是一个基于 Electron 的无人机积木编程应用。本 Skill 用于让 Open Code、Cloud Code、ClaudeCode 等外部 Agent 能够通过标准输入输出（STDIN/STDOUT）与 EazyFii Electron 主进程通信，从而操作应用。

## 通信架构

```
外部 Agent (ClaudeCode/OpenCode)
         |
         | STDIN (JSON-RPC like)
         v
   Node 脚本 (eazyfii-tool.mjs)
         |
         | HTTP POST (读取端口文件后连接)
         v
   Electron 主进程 HTTP 服务器
         |
         | 内部 IPC
         v
   EazyFii 应用逻辑
```

## 端口文件

Electron 主进程启动 HTTP 服务器后，会将端口号写入用户 Home 目录下的 `.eazyfii-agent-port` 文件。

- Linux/macOS: `~/.eazyfii-agent-port`
- Windows: `C:\Users\<username>\.eazyfii-agent-port`

## 使用方法

### 启动 EazyFii 应用

确保 EazyFii 应用已启动，并且应用界面上已经打开了要操作的无人机项目。

### 执行 Node 脚本

```bash
node eazyfii-tool.mjs <command> [arguments]
```

或通过管道传递参数：

```bash
echo '{"method":"chat","params":{"message":"列出所有无人机"}}' | node eazyfii-tool.mjs
```

## API 协议

脚本通过 HTTP 与 Electron 主进程通信，使用 JSON 格式。

### 请求格式

```json
{
  "method": "方法名",
  "params": {
    // 方法参数
  },
  "id": "请求ID（可选）"
}
```

### 响应格式

```json
{
  "ok": true,
  "result": {
    // 返回结果
  },
  "id": "请求ID"
}
```

或错误格式：

```json
{
  "ok": false,
  "error": "错误信息",
  "id": "请求ID"
}
```

## 可用方法

### 1. chat - 与 Agent 对话

发送消息给内置 Agent 进行无人机编程。

**参数：**
```json
{
  "message": "绕竖杆一圈",
  "reset": false,
  "enableReasoning": false
}
```

**返回：**
```json
{
  "ok": true,
  "result": {
    "reply": "我已经为您规划了科目1的绕杆轨迹...",
    "traces": [
      {
        "phase": "start",
        "tool": "Bash",
        "command": "...",
        "timeoutSec": 30
      }
    ],
    "provider": "openai",
    "model": "gpt-4o-mini",
    "transportMode": "chat"
  }
}
```

### 2. getStatus - 获取 Agent 状态

查询内置 Agent 的当前运行状态。

**返回：**
```json
{
  "ok": true,
  "result": {
    "busy": false,
    "phase": "idle",
    "detail": "空闲",
    "startedAt": null,
    "updatedAt": 1743993600000,
    "requestCount": 5,
    "lastError": null
  }
}
```

### 3. stop - 停止当前请求

停止正在进行的 Agent 请求。

**参数：**
```json
{
  "requestId": "可选的请求ID"
}
```

### 4. getEnv - 获取环境变量

获取 Agent 可用的环境变量。

**返回：**
```json
{
  "ok": true,
  "result": {
    "values": {
      "OPENAI_API_KEY": "sk-...",
      "NANO_MODEL": "gpt-4o-mini"
    },
    "allowedKeys": ["OPENAI_API_KEY", "NANO_MODEL", ...],
    "storagePath": "/path/to/.agent-env.json"
  }
}
```

### 5. setEnv - 设置环境变量

修改 Agent 环境变量。

**参数：**
```json
{
  "values": {
    "NANO_MODEL": "gpt-4o"
  }
}
```

### 6. listDrones - 列出无人机

获取当前工程中的所有无人机。

**返回：**
```json
{
  "ok": true,
  "result": {
    "drones": [
      {
        "droneId": "drone_1",
        "droneName": "无人机1",
        "actionGroup": "",
        "startPos": { "x": "0", "y": "0", "z": "0" },
        "blockCount": 15
      }
    ]
  }
}
```

### 7. getDroneBlocks - 获取无人机积木

获取特定无人机的所有积木。

**参数：**
```json
{
  "droneId": "drone_1"
}
```

或：
```json
{
  "droneName": "无人机1"
}
```

### 8. patchDrone - 修改无人机程序

对无人机程序进行差量修改。

**参数：**
```json
{
  "droneId": "drone_1",
  "operations": [
    {
      "op": "append_block",
      "block": {
        "type": "EazyFii_MoveToCoordAutoDelay",
        "fields": { "X": "120", "Y": "120", "Z": "100", "time": "800" }
      }
    }
  ]
}
```

**支持的操作类型：**
- `append_block` - 追加积木
- `insert_after` - 在指定积木后插入
- `insert` - 在指定位置插入
- `insert_blocks_at` - 在指定位置插入多个连续积木
- `replace_range` - 替换范围内的积木
- `update_fields` - 更新积木字段
- `delete_block` - 删除积木
- `move_block` - 移动积木位置

### 9. getRodConfig - 获取杆子配置

获取当前工程的杆子配置信息。

**返回：**
```json
{
  "ok": true,
  "result": {
    "rodConfig": {
      "takeoffZone": [{ "x": 0, "y": 0 }, ...],
      "subject3Ring": { "centerHeight": 150 },
      "subject9Config": { "secondCrossbarHeight": 200 },
      "subject1": [{ "x": 160, "y": 160 }, ...],
      ...
    }
  }
}
```

### 10. getBlockCatalog - 获取积木目录

获取当前工程支持的所有积木类型。

**返回：**
```json
{
  "ok": true,
  "result": {
    "blocks": [
      {
        "type": "EazyFii_MoveToCoordAutoDelay",
        "label": "智能平移",
        "fields": { "X": "0", "Y": "0", "Z": "100", "time": "800" },
        "keywords": ["平移", "自动延时", "move", "auto", "delay"]
      },
      ...
    ],
    "constraints": [
      "默认优先使用 EazyFii_MoveToCoordAutoDelay",
      "禁止使用 Goertek_MoveToCoord"
    ]
  }
}
```

### 11. getTrajectoryIssues - 获取轨迹问题

获取当前工程所有无人机的轨迹问题详情。

### 12. getTrajectoryDebug - 获取轨迹调试快照

获取逐段轨迹调试信息。

**参数：**
```json
{
  "droneId": "drone_1"
}
```

## 工具（Tools）

EazyFii 内置 Agent 支持以下工具，外部 Agent 可以通过 `chat` 方法让内置 Agent 调用：

### Bash

执行 shell 命令。

```json
{
  "command": "ls -la",
  "timeout": 30
}
```

### SearchAgentKnowledge

检索无人机编程知识库。

```json
{
  "query": "科目1 绕竖杆",
  "keywords": ["科目1", "绕竖杆", "TurnTo"],
  "maxResults": 6
}
```

### ListProjectDrones

读取当前工程中的无人机列表。

### GetDroneBlocks

按无人机 ID 或名称读取积木。

### GetRodConfig

读取杆子配置。

### GetBlockCatalog

读取支持的积木类型。

### GetTrajectoryIssuesDetailed

读取轨迹问题详情。

### GetTrajectoryDebugSnapshot

读取轨迹调试快照。

### PatchDroneProgram

编辑无人机程序。

## 编程约束

### 积木约束
- 禁止使用 `Goertek_MoveToCoord`
- 默认使用 `EazyFii_MoveToCoordAutoDelay`
- `Goertek_MoveToCoord2` 仅在明确要求"异步平移"时使用

### PatchDroneProgram 约束
- 所有索引使用 **1-based**
- 新增积木必须提供 `type` 和 `fields`
- 支持的操作：`append_block`, `insert_after`, `insert`, `insert_blocks_at`, `replace_range`, `update_fields`, `delete_block`, `move_block`

### 复检约束
- 每次 `PatchDroneProgram` 后必须调用 `GetTrajectoryIssuesDetailed` 复检
- 禁止只改一次就结束

## 积木类型参考

| 类型 | 说明 | 字段 |
|------|------|------|
| `block_inittime` | 时间开始 | `time` |
| `Goertek_HorizontalSpeed` | 水平速度 | `VH`, `AH` |
| `Goertek_VerticalSpeed` | 垂直速度 | `VV`, `AV` |
| `Goertek_UnLock` | 解锁 | - |
| `block_delay` | 延时 | `time` |
| `Goertek_TakeOff2` | 起飞 | `alt` |
| `EazyFii_MoveToCoordAutoDelay` | 智能平移 | `X`, `Y`, `Z`, `time` |
| `Goertek_MoveToCoord2` | 平移到（异步） | `X`, `Y`, `Z` |
| `Goertek_Move` | 相对平移（异步） | `X`, `Y`, `Z` |
| `Goertek_TurnTo` | 转向（绝对） | `turnDirection`, `angle` |
| `Goertek_Turn` | 转动（相对） | `turnDirection`, `angle` |
| `Goertek_LEDTurnOnAllSingleColor4` | 设置电机灯光 | `motor`, `color1` |
| `Goertek_LEDTurnOnAllSingleColor2` | 设置全部灯光 | `color1` |
| `Goertek_Land` | 降落 | - |

## 科目说明

### 科目1：绕竖杆
- 目标：绕竖杆一圈并闭合
- 机头朝向强约束仅适用于封闭绕行段
- 优先使用 `Goertek_TurnTo`

### 科目2：绕横杆
- 目标：绕横杆一圈并闭合
- 默认不要求灯光和机头朝向

### 科目3-10
- 科目3：穿竖圈
- 科目4：穿横圈
- 科目5：绕横8字
- 科目6：绕竖8字
- 科目7：变色穿圈
- 科目8：穿高低圈
- 科目9：垂直8字
- 科目10：连环穿圈

## 完整使用示例

### 示例1：对话式编程

```bash
echo '{"method":"chat","params":{"message":"为 drone_1 添加科目1绕竖杆程序"}}' | node eazyfii-tool.mjs
```

### 示例2：直接修改

```bash
echo '{"method":"patchDrone","params":{"droneId":"drone_1","operations":[{"op":"append_block","block":{"type":"EazyFii_MoveToCoordAutoDelay","fields":{"X":"120","Y":"120","Z":"100","time":"800"}}}]}}' | node eazyfii-tool.mjs
```

### 示例3：查询状态

```bash
echo '{"method":"getStatus"}' | node eazyfii-tool.mjs
```

## 注意事项

1. **先打开项目**：调用项目相关工具前，请确保 EazyFii 应用已打开目标项目
2. **复检很重要**：修改程序后必须复检，不能只改一次就结束
3. **索引从1开始**：PatchDroneProgram 的索引是 1-based
4. **字段必须是字符串**：所有积木字段值必须是字符串类型，如 `"120"` 而不是 `120`
5. **等待端口文件**：脚本会等待最多 10 秒让 Electron 主进程创建端口文件