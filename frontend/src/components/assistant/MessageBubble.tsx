import { useState } from 'react';
import type { AssistantMessage, Citation } from '@/types';
import { CitationChip } from './CitationChip';
import {
  Sparkles,
  Check,
  Copy,
  Volume2,
  VolumeX,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '../ui/badge';

interface Props {
  message: AssistantMessage;
  onCitationClick?: (citation: Citation) => void;
  onFollowUpClick?: (question: string) => void;
  activeCitationId?: number | null;
}

function FormattedContent({
  content,
  onFootnoteClick,
}: {
  content: string;
  onFootnoteClick?: (num: number) => void;
}) {
  const paragraphs = content.split(/\n\n+/);

  return (
    <div className="text-xs leading-relaxed text-[#F5F5F7] space-y-2.5">
      {paragraphs.map((paragraph, pIdx) => {
        const lines = paragraph.split('\n');
        const isList = lines.length > 1 && lines.every((l) => /^\s*[-*•\d+.]\s+/.test(l));

        if (isList) {
          return (
            <ul key={pIdx} className="space-y-1.5 pl-2 list-none">
              {lines.map((line, lIdx) => {
                const cleanedLine = line.replace(/^\s*[-*•\d+.]\s+/, '');
                return (
                  <li key={lIdx} className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C9A961] mt-1.5 shrink-0" />
                    <span>
                      <InlineFormattedText
                        text={cleanedLine}
                        onFootnoteClick={onFootnoteClick}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={pIdx} className="leading-relaxed">
            <InlineFormattedText text={paragraph} onFootnoteClick={onFootnoteClick} />
          </p>
        );
      })}
    </div>
  );
}

function InlineFormattedText({
  text,
  onFootnoteClick,
}: {
  text: string;
  onFootnoteClick?: (num: number) => void;
}) {
  const parts = text.split(/(\[\^\d+\])/g);

  return (
    <>
      {parts.map((part, idx) => {
        const match = part.match(/^\[\^(\d+)\]$/);
        if (match) {
          const num = parseInt(match[1], 10);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onFootnoteClick?.(num)}
              className="inline-flex items-center justify-center -translate-y-0.5 mx-0.5 h-4 min-w-[18px] px-1 rounded bg-[#0D0D11] hover:border-[#C9A961] border border-white/[0.08] text-[#C9A961] font-mono text-[10px] font-bold transition-all cursor-pointer"
              title={`View Citation [${num}]`}
            >
              {num}
            </button>
          );
        }

        const subParts = part.split(/(\*\*.*?\*\*)/g);
        return (
          <span key={idx}>
            {subParts.map((sub, sIdx) => {
              if (sub.startsWith('**') && sub.endsWith('**')) {
                return (
                  <strong key={sIdx} className="font-semibold text-[#F5F5F7]">
                    {sub.slice(2, -2)}
                  </strong>
                );
              }
              return sub;
            })}
          </span>
        );
      })}
    </>
  );
}

export function MessageBubble({
  message,
  onCitationClick,
  onFollowUpClick,
  activeCitationId,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const isUser = message.role === 'user';
  const citations = message.citations || [];
  const followUps = message.suggestedFollowUps || [];

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-md rounded-2xl bg-[#C9A961] px-4 py-2.5 text-xs text-[#0A0A0B] font-medium shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  const handleFootnoteClick = (citationId: number) => {
    const found = citations.find((c) => c.id === citationId);
    if (found && onCitationClick) {
      onCitationClick(found);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const plainText = message.content.replace(/\[\^\d+\]/g, '');
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1.05;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex items-start gap-2.5">
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25">
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1 space-y-2.5 min-w-0">
        <div className="rounded-xl border border-white/[0.08] bg-[#141418] p-3.5 shadow-lg space-y-3 relative">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <div className="flex items-center gap-1.5">
              <Badge variant="neutral" className="text-[10px] px-1.5 py-0 bg-[#34D399]/15 text-[#34D399] border-[#34D399]/25">
                <ShieldCheck className="h-2.5 w-2.5 text-[#34D399] mr-0.5" />
                Contract Grounded
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSpeak}
                className={`p-1 rounded text-[#9A9AA5] hover:text-[#F5F5F7] hover:bg-white/[0.06] transition-colors ${
                  speaking ? 'text-[#C9A961] bg-[#C9A961]/10' : ''
                }`}
                title={speaking ? 'Stop speech' : 'Read aloud'}
              >
                {speaking ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded text-[#9A9AA5] hover:text-[#F5F5F7] hover:bg-white/[0.06] transition-colors"
                title="Copy text"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#34D399]" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Formatted Content */}
          <FormattedContent content={message.content} onFootnoteClick={handleFootnoteClick} />

          {/* Citations */}
          {citations.length > 0 && (
            <div className="border-t border-white/[0.06] pt-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#9A9AA5] uppercase tracking-wider">
                  Contract Citations ({citations.length})
                </span>
                <span className="text-[10px] text-[#6E6E7A]">Click to jump in PDF</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                {citations.map((citation) => (
                  <CitationChip
                    key={citation.id}
                    citation={citation}
                    onClick={onCitationClick}
                    isActive={activeCitationId === citation.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Legal Footer */}
          <div className="border-t border-white/[0.06] pt-1.5 text-[10px] text-[#6E6E7A] italic">
            Automated legal AI assistance. Confirm terms with broker or transaction coordinator.
          </div>
        </div>

        {/* Suggested Follow-Ups */}
        {followUps.length > 0 && (
          <div className="space-y-1 pl-1">
            <span className="text-[10px] font-semibold text-[#6E6E7A] uppercase tracking-wider">
              Suggested Follow-ups
            </span>
            <div className="flex flex-wrap gap-1.5">
              {followUps.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onFollowUpClick?.(q)}
                  className="rounded-lg border border-white/[0.08] bg-[#0D0D11] px-2.5 py-1 text-xs text-[#9A9AA5] hover:text-[#F5F5F7] hover:border-[#C9A961]/40 transition-all flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <span>{q}</span>
                  <ArrowRight className="h-3 w-3 text-[#6E6E7A]" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
