import OpenAI from "openai";
import { pipeline } from "@xenova/transformers";
import { DistillResult, KnowledgeRecord, RelatedItem, RelationType } from "../types";

// 1. 初始化 DeepSeek (用于对话/生成)
const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
if (!deepseekApiKey) console.error("DeepSeek API Key 缺失！");

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: deepseekApiKey,
  dangerouslyAllowBrowser: true // 允许在前端直接调用
});

const CHAT_MODEL = 'deepseek-chat';

// 2. 初始化本地 Embedding 模型 (Transformers.js)
// 使用轻量级的 BGE-Small 模型，适合浏览器运行
let embeddingPipeline: any = null;

const getEmbeddingPipeline = async () => {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/bge-small-zh-v1.5');
  }
  return embeddingPipeline;
};

// 1. Distill Function (使用 DeepSeek)
export const distillContent = async (text: string): Promise<DistillResult> => {
  const prompt = `
    作为各领域的资深专家，请分析以下文本。
    请将其核心知识"蒸馏"为以下三个层次（请务必使用与输入文本相同的语言进行输出）：

    1. **一句话结论 (Insight)**: 最核心的洞察或观点，直击本质。
    2. **关键判断 (Principles)**: 3个具体的判断逻辑、原则或核心论据。
    3. **可复用表述 (Reusable Phrases)**: 3个原文中或总结出的金句、隐喻或精炼表达，便于引用。
    
    待分析文本: "${text}"

    **重要格式要求**：
    请直接返回标准的 JSON 格式，不要包含 \`\`\`json 代码块标记。
    JSON 结构必须包含以下字段：
    {
      "conclusion": "string",
      "keyJudgments": ["string", "string", "string"],
      "reusableExpressions": ["string", "string", "string"]
    }
  `;

  const completion = await deepseek.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: CHAT_MODEL,
    response_format: { type: "json_object" }, // 强制 JSON 模式
  });

  const content = completion.choices[0].message.content || "{}";
  return JSON.parse(content) as DistillResult;
};

// 2. Embedding Function (使用本地 Transformers.js)
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const extractor = await getEmbeddingPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    
    // 转换为普通的 number 数组
    return Array.from(output.data) as number[];
  } catch (e) {
    console.error("Local Embedding failed", e);
    throw e;
  }
};

// 3. Relate Analysis Function (使用 DeepSeek)
export const analyzeRelationships = async (
  targetText: string,
  relatedCandidates: RelatedItem[]
): Promise<RelatedItem[]> => {
  if (relatedCandidates.length === 0) return [];

  const candidatesPrompt = relatedCandidates.map((c, i) => 
    `候选 ${i}: ID=${c.recordId} 内容="${c.conclusion}"`
  ).join('\n');

  const prompt = `
    我有一个新的核心观点 (Target) 和几个历史观点 (Candidates)。
    请判断每个历史观点与新观点的关系类型：
    - Similar (相似观点): 观点一致，或属于同一思维模型。
    - Conflicting (冲突观点): 观点相反，或提供了不同的视角/反例。
    - Supplementary (补充信息): 提供了额外的背景、细节或延伸。
    
    Target: "${targetText}"
    
    ${candidatesPrompt}
    
    **格式要求**：
    返回一个 JSON 数组，包含 recordId, relationType (Similar/Conflicting/Supplementary) 和简短的 reasoning。
    不要使用 Markdown 代码块，直接返回 JSON。
  `;

  try {
    const completion = await deepseek.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: CHAT_MODEL,
      response_format: { type: "json_object" }, // 开启 JSON 模式
    });

    const rawContent = completion.choices[0].message.content || "[]";
    let analysis;
    try {
      const parsed = JSON.parse(rawContent);
      analysis = Array.isArray(parsed) ? parsed : (parsed.items || parsed.result || []);
    } catch {
      analysis = [];
    }
    
    return relatedCandidates.map(item => {
      const found = analysis.find((a: any) => a.recordId === item.recordId);
      if (found) {
        return {
          ...item,
          relationType: found.relationType as RelationType,
          reasoning: found.reasoning
        };
      }
      return item;
    });

  } catch (e) {
    console.error("Relation analysis failed", e);
    return relatedCandidates;
  }
};

// 4. Decision Support Function (使用 DeepSeek)
export const getDecisionSupport = async (
  query: string, 
  contextRecords: KnowledgeRecord[]
): Promise<string> => {
  
  const contextStr = contextRecords.map((r, i) => 
    `Insight ${i+1} (${new Date(r.timestamp).toLocaleDateString()}):
     Conclusion: ${r.analysis.conclusion}
     Principles: ${r.analysis.keyJudgments.join('; ')}`
  ).join('\n\n');

  const prompt = `
    Role
    You are an AI decision-support assistant.
    // ... (保留你原来的 Prompt 内容，不需要变) ...
    Output structure
    Use the following format exactly:
    // ...
    ---
    User's Question: "${query}"
    Related Personal Insights:
    ${contextStr}
  `;

  const completion = await deepseek.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: CHAT_MODEL,
  });

  return completion.choices[0].message.content || "无法生成决策支持建议。";
};
