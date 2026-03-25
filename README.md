# Startup Arena - 创业BP答辩模拟器

## 项目简介

多 Agent 辩论式创业想法评估系统。用户输入一句话创业 idea，4 位评审 Agent 与 1 位主持人会围绕市场、商业模式、技术、用户与竞争展开多轮讨论，最终输出结构化评估报告。系统支持工具化市场搜索、TAM/单位经济测算、历史缓存回放和公开分享链接，既能做真实评估，也能用于快速 Demo 演示。

## 技术栈

- **前端**: Next.js 14 + React + TailwindCSS + Framer Motion
- **后端**: Python FastAPI + SQLite
- **Agent**: LangGraph + DeepSeek + GLM + Qwen + Kimi + ERNIE
- **工具链**: 市场搜索、TAM 估算、单位经济模型测算
- **搜索**: 可配置联网搜索，默认使用百度千帆智能搜索，也支持复用 OpenAI 兼容网关
- **部署**: Docker Compose + GitHub Actions CI/CD

## 功能特性

- **多 Agent 辩论**: 4 位 AI 评审官 + 1 位 AI 主持人，多轮深度辩论
- **工具增强评估**: 市场搜索、TAM 估算、单位经济模型工具会以卡片形式插入流程，方便追踪每一步证据来源
- **联网市场调研**: 辩论前自动调研市场规模、竞品信息、行业动态，并在超时场景下回退到已有上下文
- **实时流式输出**: 市场调研与评审发言逐字显示；轮次小结显示“总结中”提示，完成后一次性落地
- **结构化报告**: 最终输出综合结论、六维评分、核心风险、改进建议、评审观点与证据链
- **历史记录与缓存回放**: 已完成记录可一键“存为缓存”，下次同题评估时自动回放历史事件流
- **公开分享与导出**: 支持生成公开分享链接，以及导出 PNG 分享图或 PDF 完整报告
- **暗色模式**: 一键切换亮/暗主题，全站适配
- **移动端适配**: 响应式布局 + 底部抽屉评分面板
- **骨架屏加载**: 页面加载时显示内容占位动画
- **断线重连**: WebSocket 指数退避自动重连，最多 10 次

## 快速启动

### Docker方式（推荐）
```bash
cp .env.example .env
# 编辑 .env 填入 API Keys
docker compose up
```

如果要启用百度千帆搜索，在 `.env` 中设置：
```bash
MARKET_SEARCH_PROVIDER=baidu_qianfan
BAIDU_QIANFAN_API_KEY=your-qianfan-api-key
```

如果要让 `ernie` 角色模型直连百度千帆，在 `.env` 中补充：
```bash
BAIDU_QIANFAN_BASE_URL=https://qianfan.baidubce.com/v2
MODEL_ERNIE=ernie-x1-turbo-32k
ROLE_COMPETITOR=ernie
```

如果要给不同评审角色切换模型别名，可在 `.env` 中设置：
```bash
MODEL_DEEPSEEK=deepseek-chat
MODEL_GLM=glm-5
MODEL_QWEN=qwen3.5-flash
MODEL_KIMI=kimi-latest
MODEL_ERNIE=ernie-x1-turbo-32k

ROLE_INVESTOR=qwen
ROLE_CTO=deepseek
ROLE_USER_REP=kimi
ROLE_COMPETITOR=ernie
ROLE_ORCHESTRATOR=glm
```

当前 `.env.example` 模型别名：
`deepseek / glm / qwen / kimi / ernie`

如果要开启快速 Demo 模式，在 `.env` 中补充：
```bash
DEMO_MODE=true
```

该模式会让市场搜索改为由当前主持人模型直接生成市场分析，减少外部搜索往返时间，更适合现场演示。


### 手动启动

**后端：**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**前端：**
```bash
cd frontend
npm install
npm run dev
```

## 访问地址

- 前端: http://localhost:3000
- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs

## Agent角色

| 角色 | LLM | 关注维度 |
|------|-----|---------|
| 天使投资人 | Qwen | 商业模式、市场规模、盈利路径 |
| 技术CTO | DeepSeek Chat | 技术可行性、技术壁垒、开发成本 |
| 目标用户 | Kimi | 痛点真实性、使用意愿 |
| 竞品分析师 | ERNIE | 竞争格局、差异化、护城河 |
| 主持人 | GLM | 辩论节奏、话题引导 |
| 搜索/工具 | 百度千帆智能搜索 / OpenAI兼容搜索 / 内置估算工具 | 市场证据、TAM、单位经济模型 |

## 当前交互说明

- 市场调研卡片：流式 Markdown 渲染
- 工具执行卡片：展示当前工具名称、目标、理由和回填结果
- 评审发言：流式追加内容，结束后按 Markdown 渲染完整正文
- 轮次小结：先显示“主持人正在汇总…”提示，完成后一次性展示结构化小结
- 最终报告：主持人完成生成后一次性进入报告页
- 历史缓存回放：命中缓存时，会模拟实时流式事件而不是瞬间返回整份报告

## 导出说明

- **PNG 图片**: 导出为精简后的分享长图，突出标题、综合评分、雷达图、核心风险、改进建议和评审金句
- **PDF 文件**: 导出为完整评估报告，按 A4 多页分页，避免在卡片中间硬切页

## 缓存回放说明

- 在历史记录页，已完成且带事件流的记录会显示“存为缓存”按钮
- 开启缓存后，再次提交相同 idea 时，后端会优先回放最近一条已启用缓存的历史记录
- 当前匹配规则是对 idea 执行 `trim + lower()` 后做文本相等匹配，不是模糊搜索
- `DEMO_MODE=true` 更适合展示，但新辩论默认不会写入新的 `event_cache`

## 项目状态

- [x] 项目初始化
- [x] 后端基础框架
- [x] Agent编排层
- [x] 前端页面（SaaS Boutique 设计风格）
- [x] Docker部署
- [x] CI/CD (GitHub Actions 自动构建镜像)
- [x] 暗色模式
- [x] 移动端响应式适配
- [x] 报告导出 PDF/图片
- [x] 报告分享链接
- [x] 骨架屏加载
- [x] WebSocket 断线自动重连
- [x] 可切换联网市场数据搜索
- [x] 工具化市场/财务分析
- [x] 历史缓存回放
