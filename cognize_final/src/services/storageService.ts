import { KnowledgeRecord } from "../types";

const DB_KEY = 'cognize_db_v1';

export const saveRecord = (record: KnowledgeRecord): void => {
  const existing = getRecords();
  const updated = [record, ...existing];
  localStorage.setItem(DB_KEY, JSON.stringify(updated));
};

export const getRecords = (): KnowledgeRecord[] => {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse DB", e);
    return [];
  }
};

export const searchRecordsLocally = (query: string, records: KnowledgeRecord[]): KnowledgeRecord[] => {
  const lowerQ = query.toLowerCase();
  return records.filter(r => 
    r.originalText.toLowerCase().includes(lowerQ) ||
    r.analysis.conclusion.toLowerCase().includes(lowerQ) ||
    r.analysis.keyJudgments.some(j => j.toLowerCase().includes(lowerQ))
  );
};
