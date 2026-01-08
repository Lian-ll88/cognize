# Cognize | Knowledge Distiller (知识蒸馏器)

🚀 **Cognize** 是一款专为“超级个体”打造的 AI 驱动个人知识操作系统。它不仅能记录信息，更能通过“蒸馏-关联-触发”三步闭环，将海量碎片化信息转化为可复用的智慧资产。

## ✨ 核心功能

- **🔍 知识蒸馏 (Distill)**：利用 Gemini AI 将长文、笔记、网页等原始信息提炼为“一句话结论”、“关键判断”和“可复用表述”。
- **🔗 智能关联 (Relate)**：基于向量嵌入 (Embeddings) 自动发现新旧知识间的相似、冲突或补充关系，构建动态知识网络。
- **💡 决策支持 (Decision Support)**：在面临决策时，AI 会根据你过往积累的相关洞察，提供基于历史经验的分析建议。
- **🧠 语义搜索 (Semantic Search)**：超越关键词匹配，通过理解语义寻找你真正需要的知识。

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Vite
- **UI 组件**：Tailwind CSS + Lucide React
- **AI 模型**：Google Gemini 1.5 Flash (蒸馏与分析) + Text Embedding 004 (向量化)
- **存储**：本地存储 (LocalStorage) 配合向量检索逻辑

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone [你的仓库地址]
cd cognize
```

### 2. 安装依赖
```bash
pnpm install
# 或者使用 npm install / yarn
```

### 3. 配置环境变量
在项目根目录创建 `.env` 文件，并填入你的 Google AI API Key：
```env
VITE_GEMINI_API_KEY=你的API_KEY
```

### 4. 启动开发服务器
```bash
pnpm dev
```
访问 `http://localhost:5173` 即可开始使用。

## 📂 项目结构

```text
cognize/
├── src/
│   ├── services/      # AI 服务与逻辑处理
│   ├── App.tsx        # 主界面逻辑
│   ├── types.ts       # 类型定义
│   └── index.tsx      # 入口文件
├── docs/              # 比赛相关文档
├── public/            # 静态资源
├── LICENSE            # MIT 协议
└── package.json       # 依赖配置
```

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。
