import { useState } from 'react';
import {
  IconBot,
  IconX,
  IconSparkles,
  IconDocumentText,
  IconClock,
  IconShieldCheck,
  IconDollar,
  IconArrowRight,
} from './icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dealAddress?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  clauseRef?: string;
}

export function CopilotDrawer({ isOpen, onClose, dealAddress }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'assistant',
      text: `Hello! I am your Real Estate Document Copilot. I've analyzed the purchase agreement for ${
        dealAddress || 'your deal'
      }. How can I assist you with contingency clauses or risk analysis?`,
      timestamp: 'Just now',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  if (!isOpen) return null;

  const PRESETS = [
    { label: 'Summarize Contingency Deadlines', query: 'What are all the active contingency deadlines in this contract?' },
    { label: 'Check Earnest Money Risk', query: 'What is the total earnest deposit at risk if buyer backs out?' },
    { label: 'Inspection Rights', query: 'What are the exact inspection contingency terms and repair request window?' },
    { label: 'Financing & Loan Approval', query: 'Is there a loan approval contingency and how many days does buyer have?' },
  ];

  function handleSend(queryText?: string) {
    const textToSend = queryText || input;
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setIsTyping(true);

    // Simulate AI Copilot Response
    setTimeout(() => {
      let replyText = 'Based on the uploaded Purchase Agreement PDF: ';
      let refText: string | undefined;

      const q = textToSend.toLowerCase();
      if (q.includes('contingency') || q.includes('deadline')) {
        replyText += 'The contract contains 3 core contingencies: 1) Inspection (17 calendar days), 2) Financing Approval (21 calendar days), and 3) Title Review (10 business days). All relative dates start from the Acceptance Date.';
        refText = 'Clause Section 14.B (Page 4)';
      } else if (q.includes('earnest') || q.includes('risk') || q.includes('deposit')) {
        replyText += 'The Initial Earnest Deposit is $50,000 held in Escrow. If contingencies are unconfirmed after expiration, deposit may be subject to forfeiture per Section 22 (Liquidated Damages clause).';
        refText = 'Clause Section 3.A (Page 1)';
      } else if (q.includes('inspection') || q.includes('repair')) {
        replyText += 'Buyer has 17 calendar days from Acceptance to conduct physical property inspections, pest inspections, and deliver a Request for Repairs (CR Form) to Seller.';
        refText = 'Clause Section 14.A (Page 3)';
      } else if (q.includes('financing') || q.includes('loan')) {
        replyText += 'Buyer must obtain written loan pre-approval and deliver loan contingency removal within 21 calendar days from Acceptance Date.';
        refText = 'Clause Section 8.C (Page 2)';
      } else {
        replyText += 'I have analyzed all clauses in this agreement. The contract follows standard California Association of Realtors (CAR) Purchase Agreement structure. All key milestones are tracked on your Deal Dashboard.';
        refText = 'General Contract Analysis';
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        clauseRef: refText,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md border-l border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/40">
                <IconBot className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  Document Copilot AI
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                    Live
                  </span>
                </h3>
                <p className="text-xs text-slate-400 truncate max-w-[220px]">
                  {dealAddress || 'Real Estate Analysis'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Preset Prompts */}
          <div className="border-b border-slate-800/80 bg-slate-950/30 p-3">
            <p className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Instant Document Prompts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p.query)}
                  className="rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300 hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-300 transition-all text-left"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  m.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.sender === 'assistant' && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600/30 text-brand-400 border border-brand-500/30">
                    <IconSparkles className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-br-none'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  <p>{m.text}</p>
                  {m.clauseRef && (
                    <div className="mt-2 flex items-center gap-1.5 rounded bg-slate-950/60 px-2 py-1 text-[11px] font-medium text-brand-300 border border-brand-500/20">
                      <IconDocumentText className="h-3 w-3" />
                      <span>{m.clauseRef}</span>
                    </div>
                  )}
                  <span className="mt-1 block text-[10px] text-slate-400 opacity-75">
                    {m.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <IconSparkles className="h-4 w-4 animate-spin text-brand-400" />
                <span>AI is scanning document clauses...</span>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div className="border-t border-slate-800 bg-slate-950 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about inspection, earnest deposit, financing..."
                className="input text-xs py-2"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="btn-primary shrink-0 py-2 px-3 text-xs"
              >
                <IconArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
