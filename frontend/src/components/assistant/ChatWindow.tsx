import { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { StatusStream } from './StatusStream';
import { SuggestedQuestions } from './SuggestedQuestions';
import { SummaryPanel } from './SummaryPanel';
import {
  Sparkles,
  Send,
  Loader2,
  RotateCcw,
  AlertTriangle,
  Mic,
  ShieldCheck,
  MessageSquare,
  BarChart3,
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
  const [activeTab, setActiveTab] = useState<'chat' | 'summary'>('chat');
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
    <div className="flex flex-col h-full bg-[#141418] border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] select-none bg-[#0D0D11]/70">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-[#F5F5F7]">
                AI Legal Copilot
              </h3>
              <Badge variant="neutral" className="bg-[#34D399]/15 text-[#34D399] border-[#34D399]/25 text-[10px] px-1.5 py-0">
                <ShieldCheck className="h-2.5 w-2.5 text-[#34D399] mr-0.5" />
                Verified
              </Badge>
            </div>
            <p className="text-[10px] text-[#9A9AA5]">
              {isIndexing ? (
                <span className="text-[#C9A961] flex items-center gap-1 font-medium">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Indexing documents&hellip;
                </span>
              ) : (
                'Contract-verified Q&A with exact PDF source citations'
              )}
            </p>
          </div>
        </div>

        {/* Tab switch & actions */}
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-full bg-[#0D0D11] border border-white/[0.08] p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-all text-[11px] ${
                activeTab === 'chat'
                  ? 'bg-[#C9A961] text-[#0A0A0B] font-semibold'
                  : 'text-[#9A9AA5] hover:text-[#F5F5F7]'
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              <span>Q&amp;A Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-all text-[11px] ${
                activeTab === 'summary'
                  ? 'bg-[#C9A961] text-[#0A0A0B] font-semibold'
                  : 'text-[#9A9AA5] hover:text-[#F5F5F7]'
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              <span>Deal Brief</span>
            </button>
          </div>

          {messages.length > 0 && activeTab === 'chat' && (
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 rounded-full border border-white/[0.08] bg-[#0D0D11] text-[#9A9AA5] hover:text-[#F5F5F7] transition-colors cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'summary' ? (
          <SummaryPanel summary={summary} loading={loading && !summary} />
        ) : (
          <>
            {/* Empty State */}
            {messages.length === 0 && (
              <div className="py-2 px-1 space-y-4">
                <div className="text-center space-y-1.5 max-w-sm mx-auto">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25 mx-auto">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <h4 className="text-xs font-semibold text-[#F5F5F7] tracking-tight">
                    Transaction Intelligence Assistant
                  </h4>
                  <p className="text-[11px] text-[#9A9AA5] leading-relaxed">
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
                        className="group p-3 rounded-xl bg-[#0D0D11] border border-white/[0.08] hover:border-[#C9A961]/40 text-left transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#C9A961] uppercase tracking-wide mb-1">
                          <Icon className="h-3.5 w-3.5" />
                          <span>{item.category}</span>
                        </div>
                        <p className="text-[11px] text-[#9A9AA5] font-medium group-hover:text-[#F5F5F7] leading-snug">
                          {item.prompt}
                        </p>
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
          </>
        )}
      </div>

      {/* Input Box (Chat Tab only) */}
      {activeTab === 'chat' && (
        <div className="border-t border-white/[0.08] p-3 space-y-2 bg-[#0D0D11]/80 backdrop-blur-md">
          {/* Quick Prompt Pill Strip */}
          {messages.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onAsk(qp)}
                  disabled={loading}
                  className="shrink-0 rounded-full border border-white/[0.08] bg-[#141418] hover:border-[#C9A961]/40 px-2.5 py-0.5 text-[10px] text-[#9A9AA5] hover:text-[#F5F5F7] transition-all disabled:opacity-40 cursor-pointer shadow-xs"
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
              className={`p-2 rounded-xl border border-white/[0.08] transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-400 animate-pulse'
                  : 'bg-[#141418] text-[#9A9AA5] hover:text-[#F5F5F7]'
              }`}
              title={isListening ? 'Listening... click to stop' : 'Voice dictation'}
            >
              <Mic className="h-3.5 w-3.5" />
            </button>

            <input
              type="text"
              placeholder="Ask about inspection period, earnest money, loan contingency, remedies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 bg-[#141418] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-[#F5F5F7] placeholder-[#6E6E7A] focus:border-[#C9A961] focus:outline-none transition-all"
            />

            <Button
              type="submit"
              disabled={loading || !input.trim()}
              size="sm"
              variant="default"
              className="shrink-0 h-8 px-3.5 rounded-full bg-[#C9A961] hover:bg-[#D4B774] text-[#0A0A0B] font-semibold"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
