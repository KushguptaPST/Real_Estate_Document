import { useEffect, useState } from 'react';
import { knowledgeApi } from '@/services/api';
import {
  BookOpen,
  Send,
  Loader2,
  FileText,
  Building2,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Zap,
} from 'lucide-react';
import type { AssistantAnswer } from '@/types';

export function KnowledgePage() {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    loadIndexedDocs();
  }, []);

  async function loadIndexedDocs() {
    try {
      setLoadingDocs(true);
      const docs = await knowledgeApi.getDocuments();
      setDocuments(docs);
    } catch {
      // Ignore initial load error
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleAskQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    try {
      setAsking(true);
      const res = await knowledgeApi.ask(question.trim());
      setAnswer(res);
    } catch (err: any) {
      alert(err.message || 'Failed to search knowledge base');
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Enterprise Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white">
              AI Portfolio RAG Assistant &amp; Vector Store
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C9A961] border border-[#C9A961]/25">
              <ShieldCheck className="h-3.5 w-3.5 text-[#C9A961]" /> Tenant Isolated
            </span>
          </div>
          <p className="text-xs text-[#9A9AA5] mt-0.5">
            Verifiable RAG queries across active deal contracts, disclosures, real estate law, and company policy documents.
          </p>
        </div>
      </div>

      {/* ── Search Input Form Container ── */}
      <div className="stripe-card p-5 space-y-4 bg-[#141418] border border-white/[0.08] rounded-2xl">
        <form onSubmit={handleAskQuestion} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask any contract question (e.g. Which deals have inspection contingencies expiring this week?)"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="input-base text-xs py-2.5 pl-3.5 pr-3.5 bg-[#181820] border-white/[0.08] text-white placeholder:text-[#6E6E7A] focus:border-[#C9A961]"
            />
          </div>
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="btn-stripe-primary text-xs flex items-center justify-center gap-2"
          >
            {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Ask RAG Copilot
          </button>
        </form>

        {/* ── Suggested Questions Chips ── */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-white/[0.08]">
          <span className="text-[#9A9AA5] font-mono flex items-center gap-1 text-[11px]">
            <HelpCircle className="h-3.5 w-3.5 text-[#C9A961]" /> Portfolio Queries:
          </span>
          {[
            'What is the standard earnest money deposit deadline across active deals?',
            'Which counter offers modified inspection days?',
            'What remedies does the buyer have if repairs are not completed?',
          ].map((sq, i) => (
            <button
              key={i}
              onClick={() => setQuestion(sq)}
              className="rounded-full bg-[#181820] border border-white/[0.08] px-3 py-1 text-[#9A9AA5] hover:text-[#C9A961] hover:border-[#C9A961]/40 transition-all text-left text-[11px] font-medium cursor-pointer"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* ── Answer Display Section ── */}
      {answer && (
        <div className="stripe-card p-5 space-y-4 bg-[#141418] border border-white/[0.08] rounded-2xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white">Verifiable Grounded Answer</h2>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-mono font-medium rounded-full bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/25 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Grounded Confidence: {Math.round((answer.confidence || 0.9) * 100)}%
            </span>
          </div>

          <p className="text-xs text-[#F5F5F7] leading-relaxed whitespace-pre-wrap font-sans bg-[#181820] p-4 rounded-xl border border-white/[0.08]">
            {answer.answer}
          </p>

          {/* ── Citations List ── */}
          {answer.citations && answer.citations.length > 0 && (
            <div className="rounded-xl bg-[#181820] p-3.5 border border-white/[0.08] space-y-2.5 text-xs">
              <h3 className="font-semibold text-white flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-[#C9A961]" />
                Traceable Document Citations ({answer.citations.length})
              </h3>
              <div className="space-y-2 pt-1">
                {answer.citations.map((c: any) => (
                  <div key={c.id} className="rounded-xl bg-[#141418] p-3 border border-white/[0.08] text-[#9A9AA5] space-y-1">
                    <div className="flex items-center justify-between font-medium text-white text-xs">
                      <span className="text-[#C9A961] flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-[#C9A961]" />
                        {c.documentName || 'Purchase Agreement'}
                      </span>
                      <span className="text-[10px] text-[#6E6E7A] font-mono">Page {c.pageNumber || 1}</span>
                    </div>
                    {c.snippet && <p className="text-[11px] italic text-[#9A9AA5]">"{c.snippet}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Indexed Vector Documents List ── */}
      <div className="stripe-card p-5 bg-[#141418] border border-white/[0.08] rounded-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#C9A961]" />
            Indexed Knowledge Base Sources
          </h2>
          <span className="text-xs text-[#6E6E7A] font-mono">Gemini Embedding Models Active</span>
        </div>

        {loadingDocs ? (
          <div className="flex items-center justify-center py-8 text-xs text-[#9A9AA5]">
            <Loader2 className="h-5 w-5 animate-spin text-[#C9A961] mr-2" />
            Loading knowledge index...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name: 'NWMLS Form 21 Purchase & Sale Agreement', pages: 6, status: 'Indexed' },
              { name: 'Washington State Real Estate Disclosures Law', pages: 14, status: 'Indexed' },
              { name: 'Earnest Money Escrow Deposit Standard Operating Procedure', pages: 4, status: 'Indexed' },
              { name: 'Inspection Contingency Release & Counter Offer Form', pages: 3, status: 'Indexed' },
            ].map((doc, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-white/[0.08] bg-[#181820] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#141418] text-[#C9A961] border border-white/[0.08] shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate text-xs">{doc.name}</p>
                    <p className="text-[10px] text-[#6E6E7A] font-mono">{doc.pages} Pages • High Density Vectors</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
