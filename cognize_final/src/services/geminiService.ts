import { GoogleGenAI, Type } from "@google/genai";
import { DistillResult, KnowledgeRecord, RelatedItem, RelationType } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DISTILL_MODEL = 'gemini-3-flash-preview';
const EMBEDDING_MODEL = 'text-embedding-004';

// 1. Distill Function
export const distillContent = async (text: string): Promise<DistillResult> => {
  const prompt = `
    作为各领域的资深专家，请分析以下文本。
    请将其核心知识“蒸馏”为以下三个层次（请务必使用与输入文本相同的语言进行输出）：

    1. **一句话结论 (Insight)**: 最核心的洞察或观点，直击本质。
    2. **关键判断 (Principles)**: 3个具体的判断逻辑、原则或核心论据。
    3. **可复用表述 (Reusable Phrases)**: 3个原文中或总结出的金句、隐喻或精炼表达，便于引用。
    
    待分析文本: "${text}"
  `;

  const response = await ai.models.generateContent({
    model: DISTILL_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          conclusion: { type: Type.STRING, description: "一句话结论" },
          keyJudgments: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3个关键判断"
          },
          reusableExpressions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3个可复用表述"
          }
        },
        required: ["conclusion", "keyJudgments", "reusableExpressions"]
      }
    }
  });

  if (!response.text) throw new Error("No response from Gemini");
  return JSON.parse(response.text) as DistillResult;
};

// 2. Embedding Function
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });

  if (!response.embeddings?.[0]?.values) {
    throw new Error("Failed to generate embedding");
  }
  return response.embeddings[0].values;
};

// 3. Relate Analysis Function
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
    
    返回 JSON 数组，包含 recordId, relationType 和简短的 reasoning (请务必使用与 Target 相同的语言进行解释)。
  `;

  try {
    const response = await ai.models.generateContent({
      model: DISTILL_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              recordId: { type: Type.STRING },
              relationType: { type: Type.STRING, enum: [RelationType.SIMILAR, RelationType.CONFLICTING, RelationType.SUPPLEMENTARY] },
              reasoning: { type: Type.STRING }
            }
          }
        }
      }
    });

    const analysis = JSON.parse(response.text || "[]");
    
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

// 4. Decision Support Function
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
    Your task is not to make decisions for the user, but to help them think more clearly by organizing relevant past insights and highlighting decision factors.

    Context
    The user has a personal knowledge base consisting of distilled insights extracted from their past notes, meetings, and reflections.
    Each insight represents a past judgment, principle, or lesson learned by the user.

    Input
    1. A current question or situation the user is facing.
    2. A list of related distilled insights from the user's personal knowledge base.

    Your task
    Analyze the input and generate a Decision Lens output that:
    - Surfaces relevant past judgments.
    - Identifies recurring patterns in the user's thinking.
    - Highlights key decision factors and trade-offs.
    - Avoids giving a single prescriptive answer.

    Constraints
    - Do NOT tell the user what they should do.
    - Do NOT introduce external advice or general best practices unless they are explicitly reflected in the user's past insights.
    - Base all reasoning strictly on the provided content.
    - Use neutral, reflective language.
    - **IMPORTANT**: The output language MUST match the User's Question language. If the question is in Chinese, translate the Section Headers below to Chinese.

    Output structure
    Use the following format exactly (localize headers if needed):

    🧭 Decision Context
    Current goal: ...
    Key constraints: ...
    Uncertainties or risks: ...

    🔍 Relevant Past Judgments
    Pattern 1: ...
    Pattern 2: ...

    ⚖️ Trade-off Signals
    Option A tends to prioritize: ...
    Option B tends to prioritize: ...

    💡 Reflection Prompts
    In similar situations, you often value: ...
    A factor you sometimes underestimate is: ...
    A question you may want to ask yourself now is: ...

    ---
    User's Question: "${query}"
    
    Related Personal Insights:
    ${contextStr}
  `;

  const response = await ai.models.generateContent({
    model: DISTILL_MODEL,
    contents: prompt,
  });

  return response.text || "无法生成决策支持建议。";
};
