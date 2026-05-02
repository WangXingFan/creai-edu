# 双创智辩 · CreAI Edu — 高校双创课堂多智能体答辩教练

> Startup Arena · CreAI Edu

## 项目定位

面向**高校创新创业教育（双创课）**的多智能体答辩与评估教学工具。教师在课堂上让学生提交一句话 BP 创业想法，**4 位 AI 评审 Agent + 1 位 AI 主持人**会围绕市场、商业模式、技术、用户与竞争维度展开多轮辩论，最终输出结构化教学反馈报告，用于：

- 学生 BP 答辩**演练**：学生在面对真实创业大赛/答辩前进行 AI 模拟答辩
- 教师**多视角教练**：解决双创课「教师评审视角单一、班级反馈不一致、批量评估效率低」的真实痛点
- 课堂**沉浸式案例教学**：把市场调研、TAM 估算、竞品分析等抽象概念以可视化卡片形式呈现

## AI 合规声明

本工具的所有评审发言、轮次小结、最终报告、市场调研均由**生成式人工智能（AI）**生成，全部内容均按《生成式人工智能服务管理暂行办法》在前端、PDF 与 PNG 导出物中显著标记 **「AI 生成」**。教师在用于课堂评价前请进行人工核验。

## 技术栈

- **前端**: Next.js 14 + React + TailwindCSS + Framer Motion
- **后端**: Python FastAPI + SQLite
- **Agent**: LangGraph + DeepSeek + GLM + Qwen + Kimi + ERNIE（**全链路国产大模型**）
- **工具链**: 市场搜索、TAM 估算、单位经济模型测算
- **搜索**: 默认百度千帆智能搜索（国产）；可选 OpenAI 兼容网关
- **部署**: Docker Compose + GitHub Actions CI/CD

## 教学功能特性

- **多 Agent 答辩**: 4 位 AI 评审官（投资人 / CTO / 用户 / 竞品）+ 1 位主持人，多轮深度辩论
- **教练式反馈**: 不仅给分，还给出可执行的改进建议、风险清单与评审金句，便于学生迭代 BP
- **联网市场调研**: 辩论前自动调研市场规模、竞品信息、行业动态
- **实时流式输出**: 市场调研与评审发言逐字显示，提升课堂演示张力
- **结构化报告**: 综合结论、六维评分、核心风险、改进建议、评审观点与证据链
- **历史缓存回放**: 已完成记录可一键"存为缓存"，下次同题评估时自动回放历史事件流（便于课堂复用）
- **公开分享与导出**: 支持生成公开分享链接，导出 PNG 分享图或 PDF 完整报告（**均带 AI 生成标识**）
- **暗色模式 / 移动端适配**: 适应不同教学场景

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

如果要开启快速 Demo 模式（适合课堂演示），在 `.env` 中补充：
```bash
DEMO_MODE=true
```

该模式会让市场搜索改为由当前主持人模型直接生成市场分析，减少外部搜索往返时间，更适合现场课堂演示。


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

## Agent角色（教学情境角色扮演）

| 角色 | LLM | 关注维度 | 教学意义 |
|------|-----|---------|---------|
| 天使投资人 | Qwen | 商业模式、市场规模、盈利路径 | 训练学生商业敏感度 |
| 技术CTO | DeepSeek Chat | 技术可行性、技术壁垒、开发成本 | 训练学生技术现实感 |
| 目标用户 | Kimi | 痛点真实性、使用意愿 | 训练学生用户洞察 |
| 竞品分析师 | ERNIE | 竞争格局、差异化、护城河 | 训练学生竞争分析 |
| 主持人 | GLM | 辩论节奏、话题引导、最终报告 | 引导多视角整合 |
| 搜索/工具 | 百度千帆智能搜索 / 内置估算工具 | 市场证据、TAM、单位经济模型 | 训练学生证据意识 |

## 当前交互说明

- **市场调研卡片**：流式 Markdown 渲染，结束后底部带「AI 生成」标识
- **工具执行卡片**：展示当前工具名称、目标、理由和回填结果
- **评审发言**：流式追加内容，结束后按 Markdown 渲染完整正文，每段角落带「AI 生成」标识
- **轮次小结**：先显示「主持人正在汇总…」提示，完成后展示结构化小结，附「AI 生成」标识
- **最终报告**：屏幕显示版顶部带醒目「AI 生成」声明栏；PDF / PNG 导出版头部品牌带 + 底部完整合规声明
- **历史缓存回放**：命中缓存时，会模拟实时流式事件而不是瞬间返回整份报告

## 导出说明

- **PNG 图片**: 导出为精简后的分享长图，突出标题、综合评分、雷达图、核心风险、改进建议和评审金句；底部含 AI 生成合规声明
- **PDF 文件**: 导出为完整评估报告，按 A4 多页分页；含「双创智辩 · CreAI Edu」品牌头与 AI 生成合规尾页

## 项目状态

- [x] 项目初始化
- [x] 后端基础框架
- [x] Agent编排层
- [x] 前端页面（SaaS Boutique 设计风格）
- [x] Docker部署
- [x] CI/CD (GitHub Actions 自动构建镜像)
- [x] 暗色模式
- [x] 移动端响应式适配
- [x] 报告导出 PDF/图片（含 AI 生成水印）
- [x] 报告分享链接
- [x] 骨架屏加载
- [x] WebSocket 断线自动重连
- [x] 可切换联网市场数据搜索
- [x] 工具化市场/财务分析
- [x] 历史缓存回放
- [x] 双创教育场景定位与 AI 生成内容合规标识
- [ ] 教师后台（班级/学生管理、批量评估、班级评估汇总）— 计划中
- [ ] 真实课堂使用证据收集（学生反馈、教学效益对比）— 计划中
