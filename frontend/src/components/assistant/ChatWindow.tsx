import { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { StatusStream } from './StatusStream';
import { SuggestedQuestions } from './SuggestedQuestions';
import {
  Sparkles,
  Send,
  Loader2,
  RotateCcw,
  AlertTriangle,
  Mic,
  ShieldCheck,
  Scale,
  Building,
  DollarSign,
} from 'lucide-react';
import type {
  AssistantMessage,
  Citation,
  DealSummaryResponse,
  IndexStatusResponse,
} from '@/types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface Props {
  messages: AssistantMessage[];
  loading: boolean;
  streamingStage: 'retrieving' | 'reasoning' | 'verifying' | null;
  streamingMessage: string;
  error: string | null;
  suggestions: string[];
  summary: DealSummaryResponse | null;
  indexStatus: IndexStatusResponse | null;
  activeCitationId?: number | null;
  onAsk: (question: string) => void;
  onCitationClick: (citation: Citation) => void;
  onClear: () => void;
}

export function ChatWindow({
  messages,
  loading,
  streamingStage,
  streamingMessage,
  error,
  suggestions,
  summary,
  indexStatus,
  activeCitationId,
  onAsk,
  onCitationClick,
  onClear,
}: Props) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingStage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');
    onAsk(q);
  };

  const handleToggleVoice = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice dictation is not supported on this browser. Please use Chrome, Safari, or Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const isIndexing = indexStatus && indexStatus.status !== 'READY';

  const categorizedStarters = [
    {
      category: 'Deadlines & Timing',
      icon: Sparkles,
      prompt: 'Summarize all binding contractual deadlines and notice cure periods.',
    },
    {
      category: 'Inspection & Access',
      icon: Building,
      prompt: 'What are the buyer inspection rights, access limitations, and repair notice obligations?',
    },
    {
      category: 'Financing & Deposit',
      icon: DollarSign,
      prompt: 'What happens to the earnest money deposit if loan approval fails?',
    },
    {
      category: 'Remedies & Default',
      icon: Scale,
      prompt: 'What specific remedies apply to both parties in the event of contractual default?',
    },
  ];

  const quickPrompts = [
    'What is the acceptance date?',
    'What are the inspection terms?',
    'When is loan commitment due?',
    'What happens if appraisal is low?',
  ];

  return (
    <div className="flex flex-col h-full bg-[#121217] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 select-none bg-[#16161E]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#C9A961]/25 to-[#C9A961]/5 text-[#C9A961] border border-[#C9A961]/35 shadow-[0_0_12px_rgba(201,169,97,0.2)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[#F5F5F7] tracking-tight">
                AI Legal Copilot
              </h3>
              <span className="inline-flex items-center gap-1 bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                <ShieldCheck className="h-3 w-3 text-[#34D399]" />
                VERIFIED
              </span>
            </div>
            <p className="text-[11px] text-[#8E8E9E]">
              {isIndexing ? (
                <span className="text-[#C9A961] flex items-center gap-1 font-medium">
                  <Loader2 className="h-3 w-3 animate-spin" /> Indexing documents&hellip;
                </span>
              ) : (
                'Contract-verified Q&A with exact PDF source citations'
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 rounded-xl border border-white/10 bg-[#1A1A24] text-[#9A9AA5] hover:text-[#F5F5F7] hover:border-[#C9A961]/40 transition-all cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Empty State */}
        {messages.length === 0 && (
          <div className="py-2 px-1 space-y-4">
            <div className="text-center space-y-1.5 max-w-sm mx-auto">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30 mx-auto shadow-[0_0_20px_rgba(201,169,97,0.15)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-[#F5F5F7] tracking-tight">
                Transaction Intelligence Assistant
              </h4>
              <p className="text-xs text-[#9A9AA5] leading-relaxed">
                Ask questions with full traceability to clauses, deadlines, remedies, and addenda.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {categorizedStarters.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={loading}
                    onClick={() => onAsk(item.prompt)}
                    className="group relative p-3.5 rounded-2xl bg-[#181822]/90 hover:bg-[#1E1E2C] border border-white/10 hover:border-[#C9A961]/50 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_-5px_rgba(201,169,97,0.12)] cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25 group-hover:bg-[#C9A961] group-hover:text-[#0A0A0B] transition-colors shrink-0">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[10px] font-bold tracking-wider text-[#C9A961] uppercase">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-[#A0A0B0] group-hover:text-[#F5F5F7] font-medium leading-snug">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {suggestions.length > 0 && (
              <SuggestedQuestions
                suggestions={suggestions}
                onSelect={onAsk}
                loading={loading}
              />
            )}
          </div>
        )}

        {/* Message History */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onCitationClick={onCitationClick}
            onFollowUpClick={onAsk}
            activeCitationId={activeCitationId}
          />
        ))}

        {/* Live Streaming Stage Indicator */}
        {loading && (
          <StatusStream
            stage={streamingStage}
            message={streamingMessage}
          />
        )}

        {/* Error Banner */}
        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="border-t border-white/10 p-3.5 space-y-2 bg-[#0F0F14]/90 backdrop-blur-md">
        {/* Quick Prompt Pill Strip */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onAsk(qp)}
                disabled={loading}
                className="shrink-0 rounded-full border border-white/10 bg-[#181822] hover:border-[#C9A961]/40 px-3 py-1 text-[11px] text-[#A0A0B0] hover:text-[#F5F5F7] transition-all disabled:opacity-40 cursor-pointer shadow-xs"
              >
                {qp}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`p-2.5 rounded-xl border border-white/10 transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-400 animate-pulse'
                : 'bg-[#181822] text-[#9A9AA5] hover:text-[#F5F5F7] hover:border-[#C9A961]/40'
            }`}
            title={isListening ? 'Listening... click to stop' : 'Voice dictation'}
          >
            <Mic className="h-4 w-4" />
          </button>

          <input
            type="text"
            placeholder="Ask about inspection period, earnest money, loan contingency, remedies..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-[#181822] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-[#F5F5F7] placeholder-[#6E6E7A] focus:border-[#C9A961] focus:ring-1 focus:ring-[#C9A961]/40 focus:outline-none transition-all shadow-inner"
          />

          <Button
            type="submit"
            disabled={loading || !input.trim()}
            size="sm"
            variant="default"
            className="shrink-0 h-9 px-4 rounded-xl bg-[#C9A961] hover:bg-[#DFBF77] text-[#0A0A0B] font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
