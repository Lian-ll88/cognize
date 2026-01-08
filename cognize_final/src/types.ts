export interface DistillResult {
  conclusion: string;
  keyJudgments: string[];
  reusableExpressions: string[];
}

export enum RelationType {
  SIMILAR = 'Similar',
  CONFLICTING = 'Conflicting',
  SUPPLEMENTARY = 'Supplementary',
  UNKNOWN = 'Related'
}

export interface RelatedItem {
  recordId: string;
  originalText: string;
  conclusion: string;
  score: number;
  relationType: RelationType;
  reasoning?: string;
}

export interface KnowledgeRecord {
  id: string;
  timestamp: number;
  originalText: string;
  analysis: DistillResult;
  embedding: number[]; // Vector for similarity search
}
