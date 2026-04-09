---
name: eazyfii-skill
description: EazyFii 无人机积木编程 Agent 接口，通过 HTTP API 直接操作无人机项目
---

# EazyFii Skill - 无人机积木编程 Agent 接口

## 概述

EazyFii 是一个基于 Electron 的无人机积木编程应用。本 Skill 用于让 Open Code、ClaudeCode 等外部 Agent 能够通过 HTTP API 直接操作 EazyFii 项目中的无人机。

## 通信架构

```
外部 Agent (ClaudeCode/OpenCode)
         |
         | HTTP POST
         v
   eazyfii-tool.mjs 脚本
         |
         | 读取端口文件后 HTTP 连接
         v
   EazyFii HTTP 服务器
         |
         | 内部 IPC
         v
   EazyFii 应用逻辑
```

## 端口文件

EazyFii 启动 HTTP 服务器后，会将端口号写入用户 Home 目录下的 `.eazyfii-agent-port` 文件。

- Linux/macOS: `~/.eazyfii-agent-port`
- Windows: `C:\Users\<username>\.eazyfii-agent-port`

## 使用方法

### 启动 EazyFii 应用

确保 EazyFii 应用已启动，并且应用界面上已经打开了要操作的无人机项目。

### 执行命令

```bash
# 列出所有无人机
echo '{"method":"listDrones","params":{}}' | node eazyfii-tool.mjs

# 获取无人机积木
echo '{"method":"getDroneBlocks","params":{"droneId":"drone_1"}}' | node eazyfii-tool.mjs

# 修改无人机程序
echo '{"method":"patchDrone","params":{"droneId":"drone_1","operations":[{"op":"append_block","block":{"type":"EazyFii_MoveToCoordAutoDelay","fields":{"X":"120","Y":"120","Z":"100","time":"800"}}}]}}' | node eazyfii-tool.mjs
```

## 文档目录

### API 协议
- [API 方法](./eazyfii-api.md) - 所有 API 方法详细说明

### 编程约束
- [编程约束](./eazyfii-constraints.md) - 积木约束、PatchDroneProgram 约束、复检约束

### 积木参考
- [积木类型参考](./eazyfii-blocks.md) - 所有积木类型及其字段说明

### 科目说明
- [科目说明](./eazyfii-subjects.md) - 科目规则、完成条件、编程策略
- [科目3D结构](./eazyfii-subjects-3d.md) - 科目道具在3D空间的结构描述

### 使用示例
- [完整示例](./eazyfii-examples.md) - 常用场景的完整代码示例
- [科目1示例](./subject1-example.md) - 绕竖杆科目的详细示例（含坐标、转向、延时参考）

## 注意事项

1. **先打开项目**：调用项目相关工具前，请确保 EazyFii 应用已打开目标项目
2. **先参考科目示例**：涉及到科目完成时，务必先参考对应科目的示例文档（如 [subject1-example.md](./subject1-example.md)），了解坐标设置、转向逻辑、延时要求等关键细节。注意示例仅供参考，实际坐标需根据现场情况调整
3. **复检很重要**：修改程序后必须复检，不能只改一次就结束
4. **索引从1开始**：PatchDroneProgram 的索引是 1-based
5. **字段必须是字符串**：所有积木字段值必须是字符串类型，如 `"120"` 而不是 `120`
6. **等待端口文件**：脚本会等待最多 10 秒让 Electron 主进程创建端口文件
