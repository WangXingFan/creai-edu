# Startup Arena - 创业BP答辩模拟器

## 项目简介

多Agent辩论式创业想法评估系统。用户输入一句话创业idea，5个不同角色的AI Agent展开多轮辩论，最终输出结构化评估报告。

## 技术栈

- **前端**: Next.js 14 + React + TailwindCSS + Framer Motion
- **后端**: Python FastAPI + SQLite
- **Agent**: LangGraph + GPT-4o + Claude
- **部署**: Docker Compose

## 快速启动

### Docker方式（推荐）
```bash
cp .env.example .env
# 编辑 .env 填入 API Keys
docker compose up
```

### 手动启动

**后端：**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
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
| 天使投资人 | GPT-4o | 商业模式、市场规模、盈利路径 |
| 技术CTO | Claude | 技术可行性、技术壁垒、开发成本 |
| 目标用户 | GPT-4o | 痛点真实性、使用意愿 |
| 竞品分析师 | Claude | 竞争格局、差异化、护城河 |
| 主持人 | GPT-4o-mini | 辩论节奏、话题引导 |

## 项目状态

- [x] 项目初始化
- [ ] 后端基础框架
- [ ] Agent编排层
- [ ] 前端页面
- [ ] Docker部署
- [ ] 演示准备
