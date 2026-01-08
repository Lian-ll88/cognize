import { KnowledgeRecord, RelatedItem, RelationType } from '../types';

// specific basic cosine similarity
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
};

export const findRelatedRecords = (
  targetEmbedding: number[], 
  allRecords: KnowledgeRecord[], 
  excludeId?: string,
  topK: number = 3
): RelatedItem[] => {
  const scored = allRecords
    .filter(r => r.id !== excludeId)
    .map(record => ({
      recordId: record.id,
      originalText: record.originalText,
      conclusion: record.analysis.conclusion,
      score: cosineSimilarity(targetEmbedding, record.embedding),
      relationType: RelationType.UNKNOWN // Placeholder, to be refined by AI or heuristic
    }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
};
