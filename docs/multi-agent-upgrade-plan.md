# 实质多 Agent 升级计划

## 1. 目标

当前系统本质上是一个多角色 LLM 辩论工作流：

- 角色固定
- 发言顺序固定
- 每个角色主要输出文本和分数
- 主持人负责每轮总结和最终报告

本计划的目标，是将其升级为一个更接近“实质多 agent”的系统，使每个角色具备以下能力：

- 有自己的目标与约束
- 有私有状态与行动预算
- 能执行结构化动作，而不是只输出长文本
- 能调用工具获取证据
- 能基于共享黑板中的证据继续行动
- 能被调度器分配任务，并由裁决器判断是否继续

## 2. 非目标

第一阶段不追求以下能力：

- 完全去中心化的 swarm 架构
- 长期跨会话记忆
- 复杂的外部网络搜索编排
- 多 agent 并发写共享状态
- 自动自我修改提示词或角色定义

本项目第一版建议采用 `supervisor + blackboard` 架构，而不是完全自治的无中心协作。

## 3. 现状差距

当前实现已经具备基础骨架，但还不是强自治 multi-agent：

- `backend/app/graph/debate_graph.py`
  - 使用固定 `investor -> cto -> user_rep -> competitor -> orchestrator` 流程
  - agent 只有提示词、模型映射和文本输出
- `backend/app/models/debate.py`
  - 仅持久化 `transcript / final_scores / report`
  - 没有 `agent_states / action_trace / evidence_board`
- `backend/app/api/ws.py`
  - 当前仅广播发言类事件
- `frontend/hooks/useDebateSocket.ts`
  - 当前仅维护消息流、轮次、评分和总结
- `frontend/components/DebateStream.tsx`
  - 当前只适合展示“谁说了什么”，不适合展示“谁做了什么”

## 4. 目标架构

### 4.1 核心角色

- `scheduler`
  - 负责分配任务
  - 决定下一步由哪个 agent 行动
- `judge`
  - 负责判断是否收敛、是否继续、是否提前停止
- `reporter`
  - 只负责最终报告生成
- `investor`
  - 负责商业模式、市场空间、融资合理性
- `cto`
  - 负责技术可行性、实现复杂度、工程风险
- `user_rep`
  - 负责需求真实性、使用意愿、场景频率
- `competitor`
  - 负责竞品格局、差异化、替代风险

### 4.2 共享状态

系统围绕一个共享状态对象运行，建议至少包含：

- `idea`
- `step_count`
- `current_round`
- `shared_blackboard`
- `open_questions`
- `evidence_items`
- `scoreboard`
- `agent_states`
- `action_trace`
- `halt_reason`

### 4.3 Agent 私有状态

每个 agent 建议维护：

- `goal`
- `stance`
- `memory`
- `remaining_budget`
- `tool_permissions`
- `confidence`
- `last_action`

### 4.4 结构化动作

agent 不再直接输出长文，而是先输出结构化动作。第一版建议支持：

- `speak`
- `call_tool`
- `post_evidence`
- `challenge`
- `update_score`
- `finish`

### 4.5 工具层

第一版只做 3 个工具即可：

- `market_search`
  - 查找市场、行业、竞品相关信息
- `tam_estimator`
  - 估算市场空间与增长逻辑
- `unit_economics`
  - 校验收入、成本、毛利和回本逻辑

### 4.6 运行流程

建议的运行闭环如下：

1. 初始化 `DebateState`
2. `scheduler` 分配当前任务
3. 目标 agent 输出结构化动作
4. 若动作是 `call_tool`，执行工具并返回观察结果
5. 将动作和观察结果写入 `shared_blackboard` 与 `action_trace`
6. 广播实时事件给前端
7. `judge` 判断继续、收敛或停止
8. 循环直到达到停止条件
9. `reporter` 生成最终报告

## 5. 实施阶段

### Phase 1: 建立多 Agent 运行骨架

目标：

- 从固定发言流程切到状态驱动的 action loop
- 引入基础 agent 类型与动作类型

主要工作：

- 新增 `BaseAgent`
- 新增 `DebateState / AgentState / AgentAction / Task / Evidence`
- 将 `run_debate()` 改造成调度循环
- 引入 `scheduler / judge / reporter`

交付标准：

- 系统不再依赖固定发言顺序
- 任一轮可以由调度器动态决定谁先行动
- agent 输出动作对象而不是纯文本段落

### Phase 2: 引入工具与证据板

目标：

- agent 可以基于工具结果行动
- 系统能区分“观点”和“证据”

主要工作：

- 新增工具注册与执行器
- 实现 `market_search / tam_estimator / unit_economics`
- 将工具结果写入共享黑板
- 广播 `tool_call / tool_result / evidence_posted` 事件

交付标准：

- agent 至少能完成一次真实的工具调用
- 证据能被其他 agent 读取并引用

### Phase 3: 持久化状态与轨迹

目标：

- 支持调试、回放和历史复盘

主要工作：

- 为 `Debate` 模型新增状态字段
- 保存 `agent_states / action_trace / evidence_board / halt_reason / step_count`
- 更新 REST schema 和 report 数据结构

交付标准：

- 一场 debate 结束后，可以完整回放 agent 行动链
- 报告页和历史页能读取关键证据和动作轨迹

### Phase 4: 前端升级为行动时间线

目标：

- 前端不只展示“发言流”，还展示“行动流”

主要工作：

- WebSocket hook 接入新的事件类型
- 为行动、工具调用、证据、裁决新增 UI 展示
- 在右侧面板中增加 active task、step 进度、停止原因

交付标准：

- 页面能清晰区分发言、查证、质疑、裁决
- 用户能理解系统为何得出当前结论

### Phase 5: 稳定性与约束

目标：

- 避免 agent 无限循环和低价值动作

主要工作：

- 增加最大步数限制
- 增加每个 agent 的工具预算
- 增加无新证据停止规则
- 增加异常处理和 fallback 输出

交付标准：

- 系统在异常、空结果、模型输出不规范时仍能收敛
- 单次评估的耗时和 token 成本可控

## 6. 需要修改的现有文件

### 后端

- `backend/app/graph/debate_graph.py`
  - 核心重构点
  - 从固定串行发言改为状态驱动 action loop
- `backend/app/api/ws.py`
  - 新增 action/tool/evidence/judge 相关事件广播
- `backend/app/models/debate.py`
  - 新增共享状态与轨迹持久化字段
- `backend/app/models/schemas.py`
  - 新增 action trace、evidence、agent state 等 schema
- `backend/app/api/debate.py`
  - 暴露新的报告与回放字段
- `backend/app/main.py`
  - 若新增工具依赖、启动配置或路由，可能需要小改
- `backend/app/prompts/investor.txt`
- `backend/app/prompts/cto.txt`
- `backend/app/prompts/user_rep.txt`
- `backend/app/prompts/competitor.txt`
- `backend/app/prompts/orchestrator.txt`
  - 全部改为结构化动作提示

### 前端

- `frontend/hooks/useDebateSocket.ts`
  - 接入更多事件和状态
- `frontend/components/DebateStream.tsx`
  - 支持多种 action card
- `frontend/app/debate/[id]/page.tsx`
  - 页面布局新增任务/证据/状态展示
- `frontend/components/ScorePanel.tsx`
  - 增加 step、活跃 agent、停止原因等信息
- `frontend/app/report/[id]/page.tsx`
  - 补充证据链和行动轨迹
- `frontend/app/history/page.tsx`
  - 允许历史查看 action trace

## 7. 建议新增文件

### Agent 层

- `backend/app/agents/base.py`
- `backend/app/agents/types.py`
- `backend/app/agents/registry.py`
- `backend/app/agents/scheduler.py`
- `backend/app/agents/judge.py`
- `backend/app/agents/reporter.py`
- `backend/app/agents/investor.py`
- `backend/app/agents/cto.py`
- `backend/app/agents/user_rep.py`
- `backend/app/agents/competitor.py`

### Tool 层

- `backend/app/tools/base.py`
- `backend/app/tools/runner.py`
- `backend/app/tools/market_search.py`
- `backend/app/tools/tam_estimator.py`
- `backend/app/tools/unit_economics.py`

## 8. 数据模型建议

`Debate` 模型建议新增以下字段：

- `step_count`
- `halt_reason`
- `agent_states`
- `shared_blackboard`
- `action_trace`
- `evidence_board`

注意事项：

- 当前项目使用 `create_all()` 初始化数据库
- 这只能创建缺失表，不能安全迁移已有表结构
- 如果直接修改 SQLite 表结构，需要补 migration 方案，或在开发阶段重建数据库

## 9. 事件协议建议

建议新增以下 WebSocket 事件：

- `task_assigned`
- `agent_action`
- `tool_call`
- `tool_result`
- `evidence_posted`
- `judge_decision`
- `state_update`
- `halted`

保留现有事件时，建议逐步兼容以下旧事件：

- `agent_start`
- `agent_token`
- `agent_complete`
- `score_update`
- `round_summary`
- `debate_complete`

## 10. 推荐实施顺序

建议按以下顺序推进：

1. 先改 `debate_graph.py`，打通状态循环
2. 再新增 agent 类型和 scheduler/judge
3. 然后加入工具层和共享黑板
4. 再补数据库模型与 schema
5. 最后升级 WebSocket 协议和前端展示

这样可以保证每一步都能运行，而不是一次性重写整个系统。

## 11. 最小可行版本定义

如果先做 MVP，建议以下功能必须具备：

- 动态任务分配，而非固定发言顺序
- agent 输出结构化动作
- 至少 1 个真实工具调用
- 共享证据板
- 前端能展示 action timeline
- 报告里能引用证据链

只要这 6 点完成，这个项目就已经可以合理地称为“实质多 agent 版本”。

## 12. 验收标准

完成后应满足以下判断标准：

- agent 不再只是被动输出文本
- agent 能根据任务和证据改变下一步动作
- 系统能追踪 agent 做了什么，而不仅是说了什么
- 工具输出能影响后续讨论和评分
- 报告结论能追溯到具体行动与证据
- 前端可以完整展示从任务分配到最终报告的链路

## 13. 后续扩展方向

当第一版稳定后，可以继续扩展：

- 动态增删 agent
- 并发 agent 协作
- 更细粒度工具权限
- 外部检索/RAG
- 长期记忆
- 人类插话和人工裁决
- 可配置 agent 策略模板

---

本文档用于指导当前“多角色辩论工作流”向“实质多 agent 系统”的升级实施。第一阶段优先保证结构正确、状态可追踪、动作可解释，不追求一步到位的自治复杂度。
