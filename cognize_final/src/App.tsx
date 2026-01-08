import React, { useState, useEffect } from 'react';
import { distillContent, generateEmbedding, analyzeRelationships, getDecisionSupport } from './services/geminiService';
import { findRelatedRecords } from './services/vectorService';
import { getRecords, saveRecord } from './services/storageService';
import { DistillResult, KnowledgeRecord, RelatedItem, RelationType } from './types';
import { Brain, Search, Sparkles, Clock, Share2, Layers, AlertCircle, Repeat, ArrowRight, Compass, CheckCircle2 } from 'lucide-react';

// --- Components ---

const Badge = ({ type }: { type: RelationType }) => {
  const colors = {
    [RelationType.SIMILAR]: 'bg-blue-50 text-blue-700 border-blue-200',
    [RelationType.CONFLICTING]: 'bg-rose-50 text-rose-700 border-rose-200',
    [RelationType.SUPPLEMENTARY]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    [RelationType.UNKNOWN]: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  
  const labels = {
    [RelationType.SIMILAR]: '相似观点',
    [RelationType.CONFLICTING]: '冲突观点',
    [RelationType.SUPPLEMENTARY]: '补充信息',
    [RelationType.UNKNOWN]: '相关',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[type] || colors[RelationType.UNKNOWN]}`}>
      {labels[type] || type}
    </span>
  );
};

const LoadingPulse = ({ text = "正在思考..." }) => (
  <div className="animate-pulse flex flex-col items-center justify-center p-8 space-y-4 bg-white/50 rounded-xl border border-slate-100">
    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-slate-500 text-sm font-medium">{text}</p>
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'distill' | 'search' | 'review' | 'decision'>('distill');
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Distill State
  const [currentResult, setCurrentResult] = useState<DistillResult | null>(null);
  const [relatedInsights, setRelatedInsights] = useState<RelatedItem[]>([]);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Decision State
  const [decisionQuery, setDecisionQuery] = useState('');
  const [decisionResult, setDecisionResult] = useState<string | null>(null);
  const [decisionContext, setDecisionContext] = useState<KnowledgeRecord[]>([]);
  const [isDeciding, setIsDeciding] = useState(false);

  // Review State
  const [reviewCard, setReviewCard] = useState<KnowledgeRecord | null>(null);

  // DB Cache
  const [db, setDb] = useState<KnowledgeRecord[]>([]);

  useEffect(() => {
    setDb(getRecords());
  }, []);

  // Scenario 3: Knowledge Review (Random Pick)
  const handleRandomReview = () => {
    if (db.length === 0) return;
    const randomIdx = Math.floor(Math.random() * db.length);
    setReviewCard(db[randomIdx]);
  };

  useEffect(() => {
    if (activeTab === 'review' && !reviewCard) {
      handleRandomReview();
    }
  }, [activeTab, db]);

  // Scenario 1 & 2: Search (Semantic)
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(db);
      return;
    }
    
    setIsSearching(true);
    try {
      // 1. Vector Search for Semantic Relevance
      const queryEmbedding = await generateEmbedding(searchQuery);
      const related = findRelatedRecords(queryEmbedding, db, undefined, 20); // Top 20 relevant
      
      // Map back to full records
      const results = related
        .map(r => db.find(item => item.id === r.recordId))
        .filter((item): item is KnowledgeRecord => !!item);

      setSearchResults(results);
    } catch (e) {
      console.error("Search failed", e);
      // Fallback to local text search
      const lowerQ = searchQuery.toLowerCase();
      const textResults = db.filter(r => 
        r.originalText.toLowerCase().includes(lowerQ) ||
        r.analysis.conclusion.toLowerCase().includes(lowerQ)
      );
      setSearchResults(textResults);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDecisionSupport = async () => {
    if (!decisionQuery.trim()) return;
    setIsDeciding(true);
    setDecisionResult(null);
    setDecisionContext([]);
    
    try {
      // 1. Find related records for context
      const queryEmbedding = await generateEmbedding(decisionQuery);
      // Get top 8 relevant insights to provide sufficient context
      const related = findRelatedRecords(queryEmbedding, db, undefined, 8);
      
      const contextRecords = related
        .map(r => db.find(item => item.id === r.recordId))
        .filter((item): item is KnowledgeRecord => !!item);

      setDecisionContext(contextRecords);

      // 2. Call Decision Support Agent
      const analysis = await getDecisionSupport(decisionQuery, contextRecords);
      setDecisionResult(analysis);

    } catch (e: any) {
      console.error(e);
      alert("分析失败，请稍后重试。");
    } finally {
      setIsDeciding(false);
    }
  };

  const handleDistill = async () => {
    if (!input.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    setCurrentResult(null);
    setRelatedInsights([]);

    try {
      // 1. Parallel: Distill & Embedding
      const [distilled, embedding] = await Promise.all([
        distillContent(input),
        generateEmbedding(input)
      ]);

      setCurrentResult(distilled);

      // 2. Relate: Find Similar
      const candidates = findRelatedRecords(embedding, db, undefined, 4);

      // 3. Relate: Analyze Type
      let analyzedRelations: RelatedItem[] = [];
      if (candidates.length > 0) {
        analyzedRelations = await analyzeRelationships(distilled.conclusion, candidates);
      }
      setRelatedInsights(analyzedRelations);

      // 4. Save
      const newRecord: KnowledgeRecord = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        originalText: input,
        analysis: distilled,
        embedding: embedding
      };

      saveRecord(newRecord);
      setDb(prev => [newRecord, ...prev]);
      setInput(''); // Clear input on success

    } catch (err: any) {
      console.error(err);
      setError(err.message || "蒸馏过程中发生了错误，请重试。");
    } finally {
      setIsProcessing(false);
    }
  };

  const ResultCard = ({ result, isHistory = false, date }: { result: DistillResult, isHistory?: boolean, date?: number }) => (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-200 ${isHistory ? 'hover:shadow-md transition-shadow' : ''}`}>
      {isHistory && date && (
        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1">
          <Clock size={12} /> {new Date(date).toLocaleDateString()}
        </div>
      )}
      
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2 flex items-center gap-1.5">
          <Brain size={14} /> 一句话结论 (Insight)
        </h3>
        <p className="text-lg font-semibold text-slate-900 leading-relaxed">
          {result.conclusion}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
             <AlertCircle size={14} /> 关键判断 (Principles)
          </h3>
          <ul className="space-y-2">
            {result.keyJudgments.map((item, i) => (
              <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-indigo-100 py-0.5">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Share2 size={14} /> 可复用表述 (Phrases)
          </h3>
          <ul className="space-y-2">
            {result.reusableExpressions.map((item, i) => (
              <li key={i} className="text-sm text-slate-600 italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                "{item}"
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-12 bg-[#F8FAFC]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-indigo-200 shadow-md">
              <Layers size={18} />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">Cognize <span className="text-slate-400 font-normal hidden sm:inline text-sm ml-1">| 知识蒸馏器</span></h1>
          </div>
          
          <nav className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
            <button
              onClick={() => setActiveTab('distill')}
              className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                activeTab === 'distill' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              蒸馏
            </button>
            <button
              onClick={() => setActiveTab('decision')}
              className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                activeTab === 'decision' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              决策
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                activeTab === 'search' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              搜索
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                activeTab === 'review' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              复习
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-8">
        
        {/* TAB 1: DISTILL */}
        {activeTab === 'distill' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Input Section */}
            <div className="space-y-4">
              <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入任何文本、笔记或想法，AI 将为您蒸馏出核心洞察..."
                  className="w-full h-40 p-5 rounded-xl focus:outline-none resize-none text-slate-700 text-base leading-relaxed placeholder:text-slate-300"
                />
                <div className="flex justify-between items-center px-2 pb-2">
                   <div className="text-xs text-slate-400 pl-2">支持笔记、文章、会议记录</div>
                   <button
                    onClick={handleDistill}
                    disabled={isProcessing || !input.trim()}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition-all shadow-md ${
                      isProcessing || !input.trim() 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                        : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-95'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Sparkles className="animate-spin" size={16} /> 蒸馏中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> 开始蒸馏
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
            </div>

            {/* Results Section */}
            {isProcessing && <LoadingPulse text="正在深度分析内容并建立关联..." />}
            
            {!isProcessing && currentResult && (
              <div className="space-y-8">
                {/* Main Result */}
                <ResultCard result={currentResult} />

                {/* Relate Section */}
                <div className="border-t border-slate-200 pt-8">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Brain className="text-indigo-500" size={20} /> 知识关联 (Related Context)
                  </h2>

                  {relatedInsights.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm">
                      暂无相关历史记录。随着记录增加，AI 将自动发现更多关联。
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {relatedInsights.map((item) => (
                        <div key={item.recordId} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <Badge type={item.relationType} />
                            <span className="text-xs font-mono text-slate-300">
                              匹配度: {(item.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          
                          <p className="text-slate-800 font-medium mb-2 leading-snug">
                            {item.conclusion}
                          </p>
                          
                          {item.reasoning && (
                            <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg mt-3 flex gap-2">
                              <Sparkles size={14} className="mt-0.5 text-indigo-400 shrink-0" />
                              <span>{item.reasoning}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DECISION SUPPORT */}
        {activeTab === 'decision' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold">
                 <Compass className="text-indigo-600" size={20} />
                 <h2>AI 决策咨询</h2>
               </div>
               <p className="text-sm text-slate-500 mb-4">
                 输入您当前面临的问题或决策，AI 将检索您过去的洞察，帮您分析决策盲点，而非直接替您做决定。
               </p>
               <textarea
                  value={decisionQuery}
                  onChange={(e) => setDecisionQuery(e.target.value)}
                  placeholder="例如：我是否应该接受这个新的工作机会？..."
                  className="w-full h-32 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 resize-none mb-4"
                />
                <div className="flex justify-end">
                   <button
                    onClick={handleDecisionSupport}
                    disabled={isDeciding || !decisionQuery.trim()}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all ${
                      isDeciding || !decisionQuery.trim()
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
                    }`}
                  >
                    {isDeciding ? '分析中...' : '生成决策透镜'}
                  </button>
                </div>
            </div>

            {isDeciding && <LoadingPulse text="正在检索历史记忆并构建决策模型..." />}

            {!isDeciding && decisionResult && (
              <div className="space-y-6">
                 {/* Main Analysis */}
                 <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                   <div className="prose prose-slate prose-headings:font-bold prose-h2:text-lg prose-h2:text-indigo-700 prose-p:text-slate-600 max-w-none whitespace-pre-wrap">
                     {decisionResult}
                   </div>
                 </div>

                 {/* References */}
                 {decisionContext.length > 0 && (
                   <div className="border-t border-slate-200 pt-6">
                     <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                       <Brain size={14} /> 参考的历史记忆
                     </h3>
                     <div className="grid gap-3 sm:grid-cols-2">
                       {decisionContext.map(r => (
                         <div key={r.id} className="text-xs p-3 bg-slate-50 border border-slate-100 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                            <div className="font-semibold mb-1 truncate">{r.analysis.conclusion}</div>
                            <div className="opacity-70 truncate">{r.originalText}</div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SEARCH */}
        {activeTab === 'search' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="搜索关键词，或输入问题..."
                value={searchQuery}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-28 py-4 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg bg-white"
              />
              <button 
                onClick={handleSearch}
                disabled={isSearching}
                className="absolute right-2 top-2 bottom-2 bg-indigo-50 text-indigo-600 px-4 rounded-lg font-medium hover:bg-indigo-100 disabled:opacity-50"
              >
                {isSearching ? '...' : '搜索'}
              </button>
            </div>
            
            <div className="text-xs text-slate-400 text-center px-4">
              支持语义搜索：例如输入“如何做决策”，系统会返回相关性最高的历史洞察。
            </div>

            <div className="space-y-6">
              {isSearching ? (
                 <LoadingPulse text="正在进行语义检索..." />
              ) : searchResults.length === 0 ? (
                db.length > 0 && searchQuery ? (
                   <div className="text-center py-12">
                     <p className="text-slate-500">没有找到相关内容。</p>
                   </div>
                ) : (
                  <div className="text-center py-12">
                     <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                        <Search className="text-slate-300" size={32} />
                     </div>
                     <p className="text-slate-400">输入关键词开始检索您的第二大脑</p>
                  </div>
                )
              ) : (
                searchResults.map(record => (
                  <ResultCard 
                    key={record.id} 
                    result={record.analysis} 
                    isHistory={true} 
                    date={record.timestamp} 
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: REVIEW */}
        {activeTab === 'review' && (
           <div className="animate-in fade-in zoom-in-95 duration-500 py-8">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Repeat size={20} className="text-emerald-500" /> 知识复习
                </h2>
                <button 
                  onClick={handleRandomReview}
                  className="text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 flex items-center gap-1 text-slate-600"
                >
                  <Repeat size={14} /> 换一张
                </button>
             </div>

             {reviewCard ? (
               <div className="relative">
                 <div className="absolute -top-2 -left-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-md z-10 shadow-sm transform -rotate-2">
                   Daily Recall
                 </div>
                 <ResultCard result={reviewCard.analysis} isHistory={true} date={reviewCard.timestamp} />
                 
                 <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-900 mb-2">原文回顾</h3>
                   <div className="text-slate-600 leading-relaxed text-sm bg-slate-50 p-4 rounded-xl">
                     {reviewCard.originalText}
                   </div>
                 </div>
               </div>
             ) : (
               <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-400">暂无记录可复习。先去蒸馏一些知识吧！</p>
                  <button 
                    onClick={() => setActiveTab('distill')}
                    className="mt-4 text-indigo-600 font-medium hover:underline"
                  >
                    去蒸馏
                  </button>
               </div>
             )}
           </div>
        )}

      </main>
    </div>
  );
}
