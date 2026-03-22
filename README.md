# Startup Arena - 创业BP答辩模拟器

## 项目简介

多Agent辩论式创业想法评估系统。用户输入一句话创业idea，5个不同角色的AI Agent展开多轮辩论，最终输出结构化评估报告。

## 技术栈

- **前端**: Next.js 14 + React + TailwindCSS + Framer Motion
- **后端**: Python FastAPI + SQLite
- **Agent**: LangGraph + GPT-5.4 + Claude Sonnet 4.6 + DeepSeek + Gemini + GLM
- **搜索**: （开发中）Grok 实时搜索市场数据
- **部署**: Docker Compose + GitHub Actions CI/CD

## 功能特性

- **多Agent辩论**: 4位AI评审官 + 1位AI主持人，多轮深度辩论
- **实时流式输出**: WebSocket推送，逐字显示Agent发言
- **六维雷达图**: 市场需求、商业模式、技术可行性、竞争优势、用户体验、团队契合
- **暗色模式**: 一键切换亮/暗主题，全站适配
- **移动端适配**: 响应式布局 + 底部抽屉评分面板
- **报告导出**: 支持导出为 PNG 图片或 PDF 文件
- **报告分享**: 生成公开分享链接，复制即可发送
- **骨架屏加载**: 页面加载时显示内容占位动画
- **断线重连**: WebSocket 指数退避自动重连，最多10次

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
| 天使投资人 | GPT-5.4 | 商业模式、市场规模、盈利路径 |
| 技术CTO | DeepSeek Chat | 技术可行性、技术壁垒、开发成本 |
| 目标用户 | GLM-5 | 痛点真实性、使用意愿 |
| 竞品分析师 | Gemini 3 Flash | 竞争格局、差异化、护城河 |
| 主持人 | Claude Sonnet 4.6 | 辩论节奏、话题引导 |

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
- [ ] Grok 实时市场数据搜索（开发中）
