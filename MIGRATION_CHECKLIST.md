# Gemini 到 DeepSeek 迁移检查清单 (本地 Embedding 版)

## ✅ 已完成的修改

### 1. 核心服务文件 (`src/services/AIService.ts`)
- ✅ 移除了 `@google/genai` 依赖。
- ✅ 将对话模型从 Gemini 1.5 Flash 改为 **DeepSeek Chat**。
- ✅ 将 Embedding 替换为 **Transformers.js (Xenova/bge-small-zh-v1.5)**。
- ✅ **优势**：Embedding 现在完全在浏览器本地运行，**不需要 OpenAI API Key**，且完全免费。
- ✅ 保持了所有功能函数的接口不变。

### 2. 依赖管理 (`package.json`)
- ✅ 移除：`@google/genai`
- ✅ 添加：`openai` (用于 DeepSeek)
- ✅ 添加：`@xenova/transformers` (用于本地 Embedding)

### 3. 环境变量配置
- ✅ 仅需 `VITE_DEEPSEEK_API_KEY`。
- ✅ 彻底移除了对 OpenAI 或 Gemini 的 Key 需求。

### 4. 构建配置 (`vite.config.ts`)
- ✅ 仅保留 `DEEPSEEK_API_KEY` 的定义。

### 5. 文档更新 (`README.md`)
- ✅ 更新技术栈说明，强调本地 Embedding 的使用。
- ✅ 简化了 API Key 获取指引。

## 📋 使用前需要完成的步骤

### 1. 安装依赖
```bash
cd cognize_final
pnpm install
```

### 2. 配置环境变量
在项目根目录创建 `.env` 文件：
```env
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 3. 启动开发服务器
```bash
pnpm dev
```

## ⚠️ 注意事项

### 1. 首次加载延迟
首次使用“蒸馏”或“搜索”功能时，浏览器会下载 Embedding 模型（约 30MB）。下载完成后会缓存，后续使用将非常迅速。

### 2. Embedding 维度变化
- **原 Gemini**: 768 维
- **新 BGE-Small**: 512 维

**影响**：由于维度不同，旧的知识记录（如果有）将无法与新生成的向量进行匹配。
**建议**：清空浏览器的 LocalStorage 重新开始，以确保向量检索的准确性。

### 3. 浏览器兼容性
Transformers.js 支持大多数现代浏览器。如果遇到 WebAssembly 相关报错，请确保浏览器版本较新。

## 📝 总结

现在的方案是**最纯净**的：
- **对话/生成** → DeepSeek (性价比最高)
- **向量嵌入** → 本地运行 (完全免费、隐私安全)

你现在只需要一个 DeepSeek 的 Key 就能跑通全流程了！
