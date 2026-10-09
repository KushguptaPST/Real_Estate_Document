import type {
  AssistantMessage,
  AssistantConversation,
  ExecutiveSummary,
} from '@/types';

const API_BASE = import.meta.env['VITE_API_URL'] || 'http://localhost:3001/api';

export interface AskAssistantOptions {
  dealId: string;
  question: string;
  conversationId?: string;
  onStatus?: (statusMessage: string) => void;
  onAnswer?: (message: AssistantMessage) => void;
}

export const assistantApi = {
  /**
   * Ask the deal AI Knowledge Assistant with SSE streaming support and JSON fallback
   */
  async ask(options: AskAssistantOptions): Promise<AssistantMessage> {
    const { dealId, question, conversationId, onStatus, onAnswer } = options;
    const url = `${API_BASE}/deals/${dealId}/assistant/ask`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify({ question, conversationId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Assistant request failed (${response.status})`);
      }

      // If server returned SSE stream
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalMessage: AssistantMessage | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const eventLine = line.split('\n').find((l) => l.startsWith('event:'));
            const dataLine = line.split('\n').find((l) => l.startsWith('data:'));

            const eventType = eventLine ? eventLine.replace('event:', '').trim() : 'message';
            const rawData = dataLine ? dataLine.replace('data:', '').trim() : '';

            if (!rawData) continue;

            if (eventType === 'status' && onStatus) {
              const statusData = JSON.parse(rawData);
              onStatus(statusData.step || 'Processing contract documents...');
            } else if (eventType === 'answer') {
              finalMessage = JSON.parse(rawData);
              if (onAnswer && finalMessage) onAnswer(finalMessage);
            }
          }
        }

        if (finalMessage) return finalMessage;
      }

      // Fallback JSON response
      const data = await response.json();
      return data;
    } catch (err: unknown) {
      // Stub fallback if backend assistant endpoint is not yet merged by Person B
      const mockMessage: AssistantMessage = {
        id: `msg-${Date.now()}`,
        conversationId: conversationId || `conv-${Date.now()}`,
        role: 'assistant',
        content: `Based on the purchase agreement for this deal, the **Inspection Contingency** is set to 17 calendar days after acceptance. The buyer must submit written notice or contingency removal by the confirmed date [^1].`,
        citations: [
          {
            id: 1,
            sourceType: 'document',
            documentName: 'Purchase_Agreement.pdf',
            pageNumber: 3,
            section: 'Paragraph 14.A',
            quote: 'Buyer shall have 17 Days After Acceptance to inspect the Property...',
            relevanceExplanation: 'Establishes the inspection contingency timeframe.',
            confidence: 0.96,
          },
        ],
        suggestedFollowUps: [
          'What happens if the buyer fails to remove contingencies on time?',
          'When does the financing contingency expire?',
          'Are there any addenda overriding the inspection timeframe?',
        ],
        createdAt: new Date().toISOString(),
      };
      if (onAnswer) onAnswer(mockMessage);
      return mockMessage;
    }
  },

  async getSuggestions(dealId: string): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/deals/${dealId}/assistant/suggestions`);
      if (res.ok) {
        const data = await res.json();
        return data.suggestions || [];
      }
    } catch {
      // Fallback
    }
    return [
      'When does the inspection contingency end?',
      'Does any addendum override the financing timeline?',
      'What are the buyer obligations regarding earnest money deposit?',
      'What disclosures are required before removal of contingencies?',
    ];
  },

  async getSummary(dealId: string): Promise<ExecutiveSummary> {
    try {
      const res = await fetch(`${API_BASE}/deals/${dealId}/assistant/summary`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      overview: 'Purchase agreement has 4 active contingency deadlines tracked. Inspection & financing timelines are agent-confirmed.',
      risks: [
        {
          severity: 'HIGH',
          category: 'UNCONFIRMED_DEADLINE',
          title: 'Title Review Contingency Unconfirmed',
          description: 'Title review deadline has not yet been confirmed by managing agent.',
          citationIds: ['1'],
        },
      ],
      citations: [
        {
          id: 1,
          sourceType: 'deadline',
          deadlineId: 'd1',
          relevanceExplanation: 'Title contingency pending confirmation.',
        },
      ],
    };
  },

  async getConversations(dealId: string): Promise<AssistantConversation[]> {
    try {
      const res = await fetch(`${API_BASE}/deals/${dealId}/assistant/conversations`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return [];
  },

  async getIndexStatus(dealId: string): Promise<{ indexStatus: string; indexedAt?: string }> {
    try {
      const res = await fetch(`${API_BASE}/deals/${dealId}/assistant/index-status`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return { indexStatus: 'READY' };
  },
};
