// ─────────────────────────────────────────────────────────────────────────────
// Agent Runtime — Multi-Agent Bounded Execution Loop, Guardrails & Traceability
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';
import {
  type AgentSpecialist,
  type LeadLifecycleStage,
  type MessageChannel,
  type UserRole,
} from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { requireOrgId } from '../../utils/tenant.js';
import { getPlatformConfig } from '../platformConfig.service.js';
import { recordGeminiCost } from '../costTracker.service.js';
import { generateEmbedding, cosineSimilarity } from '../embedding.service.js';
import {
  AGENT_FUNCTION_DECLARATIONS,
  executeAgentTool,
  type TrustedAgentContext,
} from './agentTools.js';
import {
  computeNextStage,
  isExplicitHumanRequest,
  isOptOutOrDnd,
  recordAgentRunTrace,
  routeToSpecialist,
  verifyAgentOutput,
} from './orchestrator.js';

export const MAX_AGENT_ROUNDS = 5;

export { isExplicitHumanRequest };

export interface RunSalesAgentParams {
  leadId: string;
  organizationId: string;
  threadId: string;
  userId?: string;
  callerRole?: UserRole;
  callerEmail?: string;
  customerMessage: string;
  recentMessages?: Array<{ senderType: string; content: string }>;
  aiClient?: any;
  customerName?: string;
  channel?: MessageChannel;
}

export interface ExecutedToolRecord {
  toolName: string;
  status: 'SUCCESS' | 'ERROR';
  durationMs: number;
}

export interface SalesAgentResult {
  response: string;
  suggestedFollowUps: string[];
  reasoning: string;
  executedTools: ExecutedToolRecord[];
  taskProposal?: unknown;
  requirementProposal?: unknown;
  qualificationResult?: unknown;
  siteVisitProposal?: unknown;
  siteVisitBooking?: unknown;
  escalation?: unknown;
  followUpProposal?: unknown;
  collateralSent?: unknown;
  matchedProperties?: Array<{
    id: string;
    title: string;
    city: string;
    price: number;
    bedrooms: number;
    brochureUrl?: string | null;
    mapsUrl?: string | null;
  }>;
  specialist?: AgentSpecialist;
  stage?: LeadLifecycleStage;
  guardrailFlags?: string[];
  exhaustedLimit: boolean;
  suppressed?: boolean;
  suppressedReason?: string;
}

const BASE_SYSTEM_INSTRUCTION = `You are a Senior Real Estate Advisory Partner representing the specific brokerage/organization listed in ORGANIZATION PROFILE below.
You speak warmly, concisely, and authentically like an experienced human property consultant for THAT organization ONLY—never refer to "Eigen Estate" or any underlying software platform as your own company.
NEVER invent properties, prices, RERA IDs, possession dates, or amenities that were not returned by a tool or listed in ORGANIZATION PROFILE.

CORE OPERATING RULES:
1. QUALIFICATION FIRST:
   - Discover the buyer's preferred micro-market/location, budget ceiling, configuration (e.g., 2BHK/3BHK/villa), and move-in timeline.
   - Call "propose_buyer_requirements" whenever the buyer states preferences.
   - Call "evaluate_buyer_qualification" once preferences are known.
2. VERIFIED INVENTORY & ELASTIC MATCHING:
   - Always call "search_properties" before recommending any property.
   - Pitch at most 1 or 2 verified properties by exact title and price. If exact matches are empty, suggest the nearby/stretch options returned by "search_properties".
3. COLLATERAL & KNOWLEDGE:
   - If the buyer asks for a brochure, floor plan, or location pin, call "send_property_collateral" with the verified propertyId.
   - If the buyer asks about RERA, approvals, payment plans, or specs, call "query_project_knowledge".
4. SITE VISIT LOCK & ADVISOR HANDOFF:
   - Offer 2 specific slots using "check_site_visit_availability".
   - ONLY call "book_site_visit" after the buyer explicitly agrees to a date and time.
   - Call "escalate_to_human" when the buyer asks for a human advisor, requests binding price cuts/discounts, or raises legal/financing disputes.
5. NO BULLET ESSAYS:
   - Keep replies conversational, plain text, and end with strictly ONE clear follow-up question.`;

function formatCurrencyShort(amount: number, currency = 'INR'): string {
  if (currency === 'USD') {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
    if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
    return `$${amount.toLocaleString('en-US')}`;
  }
  if (amount >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1')} Cr`;
  }
  if (amount >= 100_000) {
    return `₹${(amount / 100_000).toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1')} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Strictly DB-grounded fallback when the cloud LLM is unavailable or API key is unset.
 * Never invents hardcoded project names—only references verified properties in the org's DB.
 */
async function generateConsultativeFallback(params: {
  customerMessage: string;
  leadId: string;
  organizationId: string;
  organizationName?: string;
  organizationJurisdiction?: string | null;
  advisors?: Array<{ name: string | null; role: string; phone: string | null }>;
  properties?: Array<{
    id: string;
    title: string;
    address: string;
    city: string;
    microMarket: string | null;
    price: number;
    bedrooms: number;
    bathrooms: number;
    propertyType: string;
    builderName: string | null;
    reraNumber: string | null;
    possessionStatus: string | null;
    features?: string[];
    description?: string | null;
    brochureUrl?: string | null;
    mapsUrl?: string | null;
  }>;
  executedTools: ExecutedToolRecord[];
  trustedContext?: TrustedAgentContext;
  recentMessages?: Array<{ senderType: string; content: string }>;
  reason: string;
  customerName?: string;
  currency?: string;
}): Promise<SalesAgentResult> {
  const {
    customerMessage,
    organizationId,
    organizationName,
    organizationJurisdiction,
    advisors = [],
    executedTools,
    reason,
    customerName,
    currency = 'INR',
  } = params;
  const lower = customerMessage.toLowerCase().trim();
  const firstName = customerName ? customerName.split(' ')[0] : '';
  const greeting = firstName ? `Hey ${firstName}` : 'Hey';
  const orgLabel = organizationName || 'our brokerage';

  const bedroomsMatch = customerMessage.match(/(\d+)\s*(?:bhk|bed|bedroom)/i);
  const requestedBedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]!, 10) : undefined;

  const crMatch = customerMessage.match(/(?:under|below|max|upto|up to|budget)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore)/i);
  const lMatch = customerMessage.match(/(?:under|below|max|upto|up to|budget)?\s*(\d+(?:\.\d+)?)\s*(?:l|lac|lakh|lakhs)/i);
  const maxPrice = crMatch
    ? Math.round(parseFloat(crMatch[1]!) * 10_000_000)
    : lMatch
    ? Math.round(parseFloat(lMatch[1]!) * 100_000)
    : undefined;

  const allOrgProps =
    params.properties ??
    (await prisma.property.findMany({
      where: { organizationId, status: 'AVAILABLE' },
      take: 25,
      orderBy: { createdAt: 'desc' },
    }));

  const filteredProps = allOrgProps.filter((p) => {
    if (requestedBedrooms && p.bedrooms < requestedBedrooms) return false;
    if (maxPrice && p.price > maxPrice) return false;
    return true;
  });

  // Extract requested location tokens (ignoring filler, BHK, and budget words)
  const stopWords = new Set([
    'in', 'at', 'near', 'around', 'for', 'the', 'and', 'or', 'under', 'below', 'above', 'over', 'upto', 'max',
    'budget', 'bhk', 'bed', 'beds', 'bedroom', 'bedrooms', 'cr', 'crore', 'crores', 'l', 'lac', 'lacs', 'lakh', 'lakhs',
    'home', 'homes', 'house', 'houses', 'flat', 'flats', 'apartment', 'apartments', 'villa', 'villas', 'property',
    'properties', 'listing', 'listings', 'available', 'show', 'give', 'want', 'need', 'looking', 'find', 'search',
    'any', 'some', 'please', 'with', 'within', 'from', 'have', 'you', 'got', 'there', 'only', 'one', 'all', 'road',
  ]);
  const locationPhraseMatch = customerMessage.match(/\b(?:in|at|near|around)\s+([a-zA-Z0-9\s]{2,40}?)(?:,|\.|under|below|above|\d+\s*bhk|$)/i);
  const rawLocationTokens = customerMessage
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !stopWords.has(w));

  const propMatchesLocation = (p: (typeof allOrgProps)[number], tokens: string[]) => {
    const hay = `${p.title} ${p.address} ${p.microMarket ?? ''} ${p.city}`.toLowerCase();
    return tokens.some((t) => hay.includes(t));
  };

  const hasLocationQuery = Boolean(locationPhraseMatch) || rawLocationTokens.length > 0;
  const locationMatchedProps = hasLocationQuery
    ? filteredProps.filter((p) => propMatchesLocation(p, rawLocationTokens))
    : filteredProps;
  const requestedLocationLabel =
    locationPhraseMatch?.[1]?.trim() ||
    (rawLocationTokens.length > 0 ? rawLocationTokens.join(' ') : '');

  // Check if user mentioned a specific property title or micro-market/city (or in recent history)
  const recentHistoryText = (params.recentMessages ?? []).map((m) => m.content.toLowerCase()).join(' ');
  const lastAiMessage =
    [...(params.recentMessages ?? [])]
      .reverse()
      .find((m) => m.senderType === 'AI' || m.senderType === 'AGENT')
      ?.content.toLowerCase() ?? '';

  const mentionedProp =
    allOrgProps.find(
      (p) =>
        lower.includes(p.title.toLowerCase()) ||
        (p.microMarket && lower.includes(p.microMarket.toLowerCase())) ||
        lower.includes(p.city.toLowerCase()),
    ) ??
    allOrgProps.find((p) => recentHistoryText.includes(p.title.toLowerCase()));
  const primaryProp = mentionedProp ?? filteredProps[0] ?? allOrgProps[0];

  const isGreeting = /^(hi+|hii+|hello+|hey+|good\s*(morning|afternoon|evening)|namaste)[\s!.,?]*$/i.test(lower);
  const isThanks = /^(thanks?|thank\s*you|ty|ok\s*thanks?|great\s*thanks?|bye|goodbye)[\s!.,?]*$/i.test(lower);
  const isAffirmative = /^(yes+|yeah|yep|sure|ok+|okay|please|go\s*ahead|do\s*it|send\s*it|sounds\s*good)[\s!.,?]*$/i.test(lower);
  const givesTimeSlot = /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|\d{1,2}\s*(?:am|pm)|morning|afternoon|evening)\b/i.test(lower);

  const asksOrg = /\b(org|organisation|organization|company|brokerage|agency|who are you)\b/i.test(lower);
  const asksCountOrAll = /\b(only\s*one|how\s*many|all\s*propert|all\s*listing|list\s*all|every\s*propert|total\s*propert|show\s*all|what\s*all|available\s*propert)\b/i.test(lower);
  const asksLocation = /\b(where|location|address|map|direction|situated|located|area)\b/i.test(lower);
  const asksPrice = /\b(price|cost|how\s*much|rate|amount|crore|lakh)\b/i.test(lower);
  const asksDetails = /\b(detail|info|about|rera|builder|amenit|feature|spec|bath|bedroom|bhk|possession|ready|status|description)\b/i.test(lower);
  const asksBrochure =
    /\b(brochure|pdf|floor\s*plan|document)\b/i.test(lower) ||
    (isAffirmative && lastAiMessage.includes('brochure'));
  const asksVisit =
    /\b(visit|tour|schedule|book|see\s*it|walkthrough|slot|when\s*can\s*i)\b/i.test(lower) ||
    (isAffirmative && (lastAiMessage.includes('site visit') || lastAiMessage.includes('book a visit')));
  const asksAdvisor =
    /\b(advisor|agent|human|call|phone|contact|number|speak|talk)\b/i.test(lower) ||
    (isAffirmative && lastAiMessage.includes('advisor'));

  const formatPropFull = (p: (typeof allOrgProps)[number]) => {
    const parts = [
      `${p.title} (${p.bedrooms}BHK ${p.propertyType.toLowerCase()}, ${p.bathrooms} baths) at ${formatCurrencyShort(p.price, currency)}`,
      `Location: ${p.address}${p.microMarket ? `, ${p.microMarket}` : ''}, ${p.city}`,
    ];
    if (p.builderName) parts.push(`Builder: ${p.builderName}`);
    if (p.reraNumber) parts.push(`RERA: ${p.reraNumber}`);
    if (p.possessionStatus) parts.push(`Possession: ${p.possessionStatus}`);
    if (p.features && p.features.length > 0) parts.push(`Highlights: ${p.features.slice(0, 5).join(', ')}`);
    return parts.join(' | ');
  };

  let response = '';
  const suggestedFollowUps: string[] = [];

  if (isThanks) {
    response = `You're very welcome, ${firstName || 'there'}! Feel free to reach out anytime if you'd like to revisit ${primaryProp ? primaryProp.title : `${orgLabel}'s listings`} or schedule a site visit.`;
    suggestedFollowUps.push('Show all properties', 'Schedule a site visit');
  } else if (givesTimeSlot && primaryProp && (lastAiMessage.includes('visit') || lastAiMessage.includes('slot') || asksVisit)) {
    response = `${greeting}, got it! I've noted your preferred time ("${customerMessage.trim()}") for a site visit at ${primaryProp.title} (${primaryProp.microMarket || primaryProp.city}). Our ${orgLabel} advisor will confirm the appointment with you shortly!`;
    suggestedFollowUps.push('Send brochure', 'Connect with an advisor');
  } else if (asksOrg) {
    const advisorCount = advisors.length;
    const regionText = organizationJurisdiction ? ` (${organizationJurisdiction})` : '';
    const invNote =
      allOrgProps.length > 0
        ? ` We currently have ${allOrgProps.length} verified listing${allOrgProps.length === 1 ? '' : 's'} available, including ${allOrgProps
            .slice(0, 2)
            .map((p) => `${p.title} at ${formatCurrencyShort(p.price, currency)}`)
            .join(' and ')}.`
        : ' We are currently updating our active listings.';
    response = `${greeting}! You're chatting with ${orgLabel}${regionText}, with ${advisorCount || 1} advisor${advisorCount === 1 ? '' : 's'} on our team.${invNote} What kind of property are you looking for?`;
    suggestedFollowUps.push('Show all properties', 'Connect with an advisor');
  } else if (isGreeting) {
    if (allOrgProps.length === 1 && primaryProp) {
      response = `${greeting}! Welcome to ${orgLabel}. Right now we have ${primaryProp.title} (${primaryProp.bedrooms}BHK in ${primaryProp.microMarket || primaryProp.city} at ${formatCurrencyShort(primaryProp.price, currency)}) available. Would you like full details, the brochure, or a site visit?`;
    } else if (allOrgProps.length > 1) {
      response = `${greeting}! Welcome to ${orgLabel}. We have ${allOrgProps.length} verified properties available right now. What location, configuration (2BHK/3BHK), or budget are you looking for?`;
    } else {
      response = `${greeting}! Welcome to ${orgLabel}. How can I help you with your property search today?`;
    }
    suggestedFollowUps.push('Show all properties', 'Schedule a site visit');
  } else if (asksCountOrAll) {
    if (allOrgProps.length === 0) {
      response = `${greeting}, we don't have any active listings added at ${orgLabel} yet. Would you like me to connect you with one of our advisors for upcoming inventory?`;
    } else if (allOrgProps.length === 1 && primaryProp) {
      response = `Yes, ${greeting}—right now ${orgLabel} has 1 active verified listing:\n\n• ${formatPropFull(primaryProp)}\n\nWould you like me to share the brochure or schedule a site visit for ${primaryProp.title}?`;
    } else {
      const list = allOrgProps
        .slice(0, 5)
        .map((p, idx) => `${idx + 1}. ${formatPropFull(p)}`)
        .join('\n');
      response = `${greeting}, ${orgLabel} currently has ${allOrgProps.length} active verified listings:\n\n${list}\n\nWhich of these would you like more details or a site visit for?`;
    }
    suggestedFollowUps.push('Send brochure', 'Schedule a site visit');
  } else if (asksAdvisor) {
    const advisorWithPhone = advisors.find((a) => a.phone);
    if (advisorWithPhone) {
      response = `${greeting}, you can reach our ${advisorWithPhone.role.toLowerCase()} ${advisorWithPhone.name || 'advisor'} at ${orgLabel} directly on ${advisorWithPhone.phone}. Would you also like me to note a preferred callback time for you?`;
    } else {
      const advisorNames = advisors.map((a) => a.name).filter(Boolean).join(', ');
      response = `${greeting}, our advisory team${advisorNames ? ` (${advisorNames})` : ''} at ${orgLabel} would be happy to assist you directly. Share your phone number or preferred time and I'll arrange a callback!`;
    }
    suggestedFollowUps.push('Request callback', 'Schedule a site visit');
  } else if (asksVisit && primaryProp) {
    response = `${greeting}, I'd be glad to arrange a site visit for ${primaryProp.title} (${primaryProp.microMarket || primaryProp.city}). We have slots open tomorrow at 11:00 AM or 4:00 PM—which time works better for you?`;
    suggestedFollowUps.push('Tomorrow 11:00 AM', 'Tomorrow 4:00 PM');
  } else if (asksBrochure && primaryProp) {
    if (primaryProp.brochureUrl && params.trustedContext) {
      const colRes = await executeAgentTool(
        'send_property_collateral',
        {
          leadId: params.leadId,
          propertyId: primaryProp.id,
          includeBrochure: true,
          includeLocationPin: false,
        },
        params.trustedContext,
      );
      executedTools.push({
        toolName: 'send_property_collateral',
        status: colRes.status,
        durationMs: colRes.durationMs,
      });
      const dispatched = ((colRes.data as any)?.dispatchedItems as string[] | undefined) ?? [];
      if (dispatched.includes('telegram_brochure_pdf') || dispatched.includes('brochure_pdf')) {
        response = `${greeting}, I've sent the ${primaryProp.title} brochure PDF directly in chat! Would you like to schedule a site visit as well?`;
      } else {
        response = `${greeting}, the ${primaryProp.title} brochure PDF couldn't be delivered right now (the file may need to be re-uploaded). Would you like me to connect you with our advisor at ${orgLabel} to share it?`;
      }
    } else if (primaryProp.brochureUrl) {
      response = `${greeting}, here are the details for ${primaryProp.title} (${formatCurrencyShort(primaryProp.price, currency)}). Brochure: ${primaryProp.brochureUrl}\n\nWould you like to schedule a site visit as well?`;
    } else {
      response = `${greeting}, ${primaryProp.title} (${formatPropFull(primaryProp)}) doesn't have a PDF brochure uploaded yet, but I can connect you with our advisor at ${orgLabel} to share the floor plan. Would you like a callback?`;
    }
    suggestedFollowUps.push('Schedule a site visit', 'Connect with an advisor');
  } else if (asksLocation && primaryProp) {
    const mapNote = primaryProp.mapsUrl ? ` Google Maps: ${primaryProp.mapsUrl}` : '';
    response = `${greeting}, ${primaryProp.title} is located at ${primaryProp.address}${primaryProp.microMarket ? `, ${primaryProp.microMarket}` : ''}, ${primaryProp.city}.${mapNote} Would you like to book a visit to see it in person?`;
    suggestedFollowUps.push('Schedule a site visit', 'Send brochure');
  } else if ((asksPrice || asksDetails) && primaryProp) {
    const descNote = primaryProp.description ? `\n\n${primaryProp.description}` : '';
    response = `${greeting}, here are the full details for ${primaryProp.title} at ${orgLabel}:\n${formatPropFull(primaryProp)}${descNote}\n\nWould you like to schedule a site visit or check anything else?`;
    suggestedFollowUps.push('Schedule a site visit', 'Send brochure');
  } else {
    const exactBhkProps = requestedBedrooms
      ? locationMatchedProps.filter((p) => p.bedrooms === requestedBedrooms)
      : locationMatchedProps;
    const bestMatches = exactBhkProps.length > 0 ? exactBhkProps : locationMatchedProps;
    const matchedProps = (bestMatches.length > 0 ? bestMatches : filteredProps.length > 0 ? filteredProps : allOrgProps).slice(0, 3);

    if (hasLocationQuery && locationMatchedProps.length === 0 && allOrgProps.length > 0) {
      // Try semantic search across uploaded organization DocumentChunks before saying no match
      let semanticSnippet = '';
      try {
        const orgChunks = await prisma.documentChunk.findMany({
          where: { organizationId },
          select: { content: true, sectionTitle: true, embedding: true },
          take: 30,
        });
        if (orgChunks.length > 0) {
          const qEmb = await generateEmbedding(customerMessage);
          const scored = orgChunks
            .map((ch) => {
              const vec = Array.isArray(ch.embedding) ? (ch.embedding as number[]) : [];
              const semScore = vec.length > 0 ? cosineSimilarity(qEmb, vec) : 0;
              const kwHits = rawLocationTokens.filter((t) => ch.content.toLowerCase().includes(t)).length;
              return { content: ch.content, score: semScore * 0.7 + Math.min(1, kwHits * 0.3) * 0.3 };
            })
            .sort((a, b) => b.score - a.score);
          if (scored[0] && scored[0].score > 0.35) {
            semanticSnippet = scored[0].content.slice(0, 350).trim();
          }
        }
      } catch {
        // Non-critical semantic lookup
      }

      if (semanticSnippet) {
        response = `${greeting}, here's what I found in ${orgLabel}'s records:\n\n${semanticSnippet}\n\nWould you like me to connect you with an advisor for more details?`;
      } else {
        const availableAreas = Array.from(
          new Set(allOrgProps.map((p) => p.microMarket || p.city).filter(Boolean)),
        ).join(', ');
        const summaryList = matchedProps.map((p) => formatPropFull(p)).join('\n• ');
        response = `${greeting}, we don't currently have any verified listings in "${requestedLocationLabel}" at ${orgLabel}. Our active inventory is in ${availableAreas}:\n• ${summaryList}\n\nWould you like details on any of these, or should I connect you with an advisor to source options in ${requestedLocationLabel}?`;
      }
      suggestedFollowUps.push('Connect with an advisor', 'Schedule a site visit');
    } else if (matchedProps.length > 0) {
      const summaryList = matchedProps.map((p) => formatPropFull(p)).join('\n• ');
      if (filteredProps.length === 0 && (requestedBedrooms || maxPrice)) {
        response = `${greeting}, we don't have an exact match for that budget/configuration at ${orgLabel} right now, but here is what we have available:\n• ${summaryList}\n\nWould any of these work, or should I connect you with an advisor?`;
      } else {
        response = `${greeting}, at ${orgLabel} we currently have:\n• ${summaryList}\n\nWould you like the brochure, location details, or a site visit?`;
      }
      for (const p of matchedProps) {
        suggestedFollowUps.push(`Send brochure for ${p.title}`);
      }
      suggestedFollowUps.push('Schedule a site visit');
    } else {
      response = `${greeting}, thanks for reaching out to ${orgLabel}! We don't have active listings matching that right now—would you like me to connect you with one of our property advisors?`;
      suggestedFollowUps.push('Connect with an advisor');
    }
  }

  const matchedProps = (filteredProps.length > 0 ? filteredProps : allOrgProps).slice(0, 3);

  return {
    response,
    suggestedFollowUps: suggestedFollowUps.slice(0, 3),
    reasoning: `DB-grounded fallback response: ${reason}`,
    executedTools,
    matchedProperties: matchedProps.map((p) => ({
      id: p.id,
      title: p.title,
      city: p.city,
      price: p.price,
      bedrooms: p.bedrooms,
      brochureUrl: p.brochureUrl,
      mapsUrl: p.mapsUrl,
    })),
    exhaustedLimit: false,
  };
}

/**
 * Executes the bounded multi-agent execution loop with specialist routing,
 * takeover & DND guards, verifiable tools, and persistent trace logging.
 */
export async function runSalesAgentLoop(params: RunSalesAgentParams): Promise<SalesAgentResult> {
  const startTime = Date.now();
  const { leadId, threadId, customerMessage, recentMessages = [] } = params;
  const orgId = requireOrgId(params.organizationId);

  const trustedContext: TrustedAgentContext = {
    organizationId: orgId,
    userId: params.userId,
    callerRole: params.callerRole,
    callerEmail: params.callerEmail,
    leadId,
    threadId,
  };

  // 1. Mandatory Thread, Lead & Full Organization Context Verification
  const [thread, leadRecord, orgChannel, organization, orgProperties, orgAdvisors, orgKbDocs] = await Promise.all([
    prisma.conversationThread.findFirst({
      where: { id: threadId, organizationId: orgId },
    }),
    prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
      include: { requirements: true, _count: { select: { matches: true } } },
    }),
    prisma.organizationChannel.findUnique({
      where: { organizationId: orgId },
      select: { defaultCurrency: true, defaultTimezone: true },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, stateJurisdiction: true },
    }),
    prisma.property.findMany({
      where: { organizationId: orgId, status: 'AVAILABLE' },
      select: {
        id: true,
        title: true,
        address: true,
        city: true,
        microMarket: true,
        price: true,
        bedrooms: true,
        bathrooms: true,
        propertyType: true,
        builderName: true,
        reraNumber: true,
        possessionStatus: true,
        features: true,
        description: true,
        brochureUrl: true,
        mapsUrl: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { name: true, role: true, phone: true, email: true },
      take: 10,
    }),
    prisma.kBDocument.findMany({
      where: { organizationId: orgId },
      select: { title: true, category: true },
      take: 10,
    }),
  ]);

  if (!thread) {
    throw new Error(`Conversation thread ${threadId} not found in organization ${orgId}`);
  }
  if (!leadRecord) {
    throw new Error(`Lead ${leadId} not found in organization ${orgId}`);
  }

  const effectiveChannel: MessageChannel = params.channel ?? thread.channel;
  const stageBefore: LeadLifecycleStage = leadRecord.stage ?? 'NEW_INBOUND';
  const currency = orgChannel?.defaultCurrency ?? 'INR';

  if (
    thread.state === 'HUMAN_TAKEOVER' ||
    thread.isHumanTakeover ||
    thread.state === 'PAUSED' ||
    thread.state === 'CLOSED'
  ) {
    logger.info(`[Agent Runtime] Suppressed for thread ${threadId}: state is ${thread.state}`);
    return {
      response: '',
      suggestedFollowUps: [],
      reasoning: 'Suppressed due to active human takeover or paused state',
      executedTools: [],
      stage: stageBefore,
      exhaustedLimit: false,
      suppressed: true,
      suppressedReason: 'Human takeover is active. Automated agent execution is disabled.',
    };
  }

  // 1b. Deterministic DND / Opt-Out Safeguard
  if (isOptOutOrDnd(customerMessage)) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { doNotCall: true, stage: 'DISQUALIFIED', status: 'LOST' },
    });
    await prisma.conversationThread.update({
      where: { id: threadId },
      data: { state: 'CLOSED', autoReplyEnabled: false },
    });

    await recordAgentRunTrace({
      organizationId: orgId,
      leadId,
      threadId,
      channel: effectiveChannel,
      specialist: 'ESCALATION',
      intent: 'OPTOUT_DND',
      stageBefore,
      stageAfter: 'DISQUALIFIED',
      toolsExecuted: [],
      guardrailFlags: ['DND_OPT_OUT_ENFORCED'],
      latencyMs: Date.now() - startTime,
    });

    return {
      response: "Understood—I have marked your number as do-not-contact and won't message or call you further. Wishing you all the best!",
      suggestedFollowUps: [],
      reasoning: 'Deterministic opt-out / DND compliance safeguard triggered.',
      executedTools: [],
      specialist: 'ESCALATION',
      stage: 'DISQUALIFIED',
      guardrailFlags: ['DND_OPT_OUT_ENFORCED'],
      exhaustedLimit: false,
    };
  }

  // 1c. Fast-Path Deterministic Safeguard: Explicit request for a human advisor
  if (isExplicitHumanRequest(customerMessage)) {
    logger.info(`[Agent Runtime] Fast-path explicit human request detected for lead ${leadId}`);
    const escalationResult = await executeAgentTool(
      'escalate_to_human',
      {
        leadId,
        reason: 'BUYER_REQUESTED_HUMAN',
        explanation: `Buyer explicitly requested to speak with a human advisor: "${customerMessage.slice(0, 150)}"`,
        urgency: 'HIGH',
        recommendedAdvisorAction: 'Contact buyer directly to address their inquiry and take over communication.',
      },
      trustedContext,
    );

    const executed = [
      {
        toolName: 'escalate_to_human',
        status: escalationResult.status,
        durationMs: escalationResult.durationMs,
      },
    ];

    await recordAgentRunTrace({
      organizationId: orgId,
      leadId,
      threadId,
      channel: effectiveChannel,
      specialist: 'ESCALATION',
      intent: 'HUMAN_REQUEST',
      stageBefore,
      stageAfter: 'ADVISOR_HANDOFF',
      toolsExecuted: executed,
      guardrailFlags: ['FAST_PATH_HUMAN_HANDOFF'],
      latencyMs: Date.now() - startTime,
    });

    return {
      response:
        effectiveChannel === 'VOICE_CALL'
          ? 'Sure thing, let me connect you directly with our senior property advisor now.'
          : 'I understand and have alerted our senior advisor team with your details. A human advisor will reach out to you directly.',
      suggestedFollowUps: ['A dedicated advisor will follow up with you shortly.'],
      reasoning: 'Fast-path escalation: buyer explicitly requested a human advisor.',
      executedTools: executed,
      escalation: escalationResult.data,
      specialist: 'ESCALATION',
      stage: 'ADVISOR_HANDOFF',
      guardrailFlags: ['FAST_PATH_HUMAN_HANDOFF'],
      exhaustedLimit: false,
    };
  }

  // 2. Supervisor Routing to Specialist Role
  const directive = routeToSpecialist({
    organizationId: orgId,
    leadId,
    threadId,
    channel: effectiveChannel,
    currentStage: stageBefore,
    customerMessage,
    hasRequirements: Boolean(leadRecord.requirements),
    matchedCount: leadRecord._count.matches,
  });

  // 3. Verified Model Configuration & API Key Fallback Contract
  const apiKey = process.env['GEMINI_API_KEY'];
  const platformCfg = await getPlatformConfig().catch(() => null);
  const configuredModel = platformCfg?.primaryLlmModel || process.env['GEMINI_MODEL'] || 'gemini-2.5-flash';
  const ai = params.aiClient ?? (apiKey ? new GoogleGenAI({ apiKey }) : null);
  const clientFullName = params.customerName || leadRecord.fullName || '';
  const clientFirstName = clientFullName.split(' ')[0] || '';

  const orgName = organization?.name || 'our Real Estate Advisory';
  const orgInventorySummary =
    orgProperties.length > 0
      ? orgProperties
          .map(
            (p) =>
              `  * [${p.id}] ${p.title} — ${p.bedrooms}BHK ${p.propertyType} (${p.bathrooms} baths) in ${p.microMarket || p.city} (${p.address}) | ${formatCurrencyShort(p.price, currency)}${p.builderName ? ` | Builder: ${p.builderName}` : ''}${p.reraNumber ? ` | RERA: ${p.reraNumber}` : ''}${p.possessionStatus ? ` | ${p.possessionStatus}` : ''}${p.features?.length ? ` | Features: ${p.features.join(', ')}` : ''}${p.brochureUrl ? ` | Brochure: ${p.brochureUrl}` : ''}${p.mapsUrl ? ` | Map: ${p.mapsUrl}` : ''}`,
          )
          .join('\n')
      : '  * No active available listings currently in this organization.';
  const advisorNames =
    orgAdvisors
      .map((a) => `${a.name || a.email || 'Advisor'} (${a.role}${a.phone ? `, ${a.phone}` : ''})`)
      .join(', ') || 'Advisory Team';
  const kbSummary =
    orgKbDocs.length > 0
      ? orgKbDocs.map((d) => `${d.title} (${d.category})`).join(', ')
      : 'None uploaded';

  if (!ai) {
    logger.warn('[Agent Runtime] GEMINI_API_KEY not set. Using DB-grounded consultative fallback.');
    const fallback = await generateConsultativeFallback({
      customerMessage,
      leadId,
      organizationId: orgId,
      organizationName: orgName,
      organizationJurisdiction: organization?.stateJurisdiction,
      advisors: orgAdvisors,
      properties: orgProperties,
      executedTools: [],
      trustedContext,
      recentMessages,
      reason: 'API key missing from environment',
      customerName: clientFullName,
      currency,
    });
    await recordAgentRunTrace({
      organizationId: orgId,
      leadId,
      threadId,
      channel: effectiveChannel,
      specialist: directive.specialist,
      intent: directive.intent,
      stageBefore,
      stageAfter: stageBefore,
      toolsExecuted: [],
      guardrailFlags: ['NO_API_KEY_DB_FALLBACK'],
      latencyMs: Date.now() - startTime,
      modelUsed: 'db-fallback',
    });
    return {
      ...fallback,
      specialist: directive.specialist,
      stage: stageBefore,
      guardrailFlags: ['NO_API_KEY_DB_FALLBACK'],
    };
  }

  // 4. Prepare Multi-turn Conversation Contents with Untrusted-Data Delimiters
  const historyContents: any[] = recentMessages.slice(-10).map((m) => ({
    role: m.senderType === 'CUSTOMER' ? 'user' : 'model',
    parts: [
      {
        text:
          m.senderType === 'CUSTOMER'
            ? `<UNTRUSTED_CONTENT source="customer_history">\n${m.content}\n</UNTRUSTED_CONTENT>`
            : m.content,
      },
    ],
  }));

  const contents: any[] = [
    ...historyContents,
    {
      role: 'user',
      parts: [
        {
          text: `<UNTRUSTED_CONTENT source="customer_message">\n${customerMessage}\n</UNTRUSTED_CONTENT>`,
        },
      ],
    },
  ];

  const executedTools: ExecutedToolRecord[] = [];
  let capturedTaskProposal: unknown = null;
  let capturedRequirementProposal: unknown = null;
  let capturedQualificationResult: unknown = null;
  let capturedSiteVisitProposal: unknown = null;
  let capturedSiteVisitBooking: unknown = null;
  let capturedEscalation: unknown = null;
  let capturedFollowUpProposal: unknown = null;
  let capturedCollateral: unknown = null;
  const verifiedPropertiesMap = new Map<
    string,
    { id: string; title: string; city: string; price: number; bedrooms: number; brochureUrl?: string | null; mapsUrl?: string | null }
  >();

  let finalResponseText = '';
  let exhaustedLimit = false;
  let modelUsed = configuredModel;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // 5. Bounded Agent Loop (hard maximum 5 rounds)
  for (let round = 1; round <= MAX_AGENT_ROUNDS; round++) {
    logger.info(`[Agent Runtime] [${directive.specialist}] Round ${round}/${MAX_AGENT_ROUNDS} for Lead ${leadId}`);

    // Re-verify takeover guard before every model invocation
    const currentThread = await prisma.conversationThread.findUnique({
      where: { id: threadId },
      select: { isHumanTakeover: true, state: true },
    });
    if (currentThread?.isHumanTakeover || currentThread?.state === 'HUMAN_TAKEOVER') {
      logger.info(`[Agent Runtime] Takeover activated mid-loop during round ${round}. Halting.`);
      return {
        response: '',
        suggestedFollowUps: [],
        reasoning: 'Human takeover engaged during execution',
        executedTools,
        specialist: directive.specialist,
        stage: stageBefore,
        exhaustedLimit: false,
        suppressed: true,
        suppressedReason: 'Human takeover activated mid-execution',
      };
    }

    const candidateModels = Array.from(
      new Set([configuredModel, 'gemini-2.5-flash-lite', 'gemini-2.5-flash']),
    );

    const forceMatcherToolOnRound1 =
      round === 1 &&
      executedTools.length === 0 &&
      (directive.specialist === 'MATCHER' || directive.intent === 'COLLATERAL_REQUEST');

    let response: any;
    let lastModelErr: any = null;

    for (const modelCandidate of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after 20000ms on ${modelCandidate}`)), 20000),
          );
          response = await Promise.race([
            ai.models.generateContent({
              model: modelCandidate,
              contents,
              config: {
                systemInstruction: `${BASE_SYSTEM_INSTRUCTION}

${directive.systemAddendum}

ACTIVE CONVERSATION CONTEXT:
- Client Name: "${clientFirstName || 'Client'}"
- Current Date: "${new Date().toISOString().slice(0, 10)}"
- Lead Lifecycle Stage: "${stageBefore}"
- Currency: "${currency}"
- Authorized Lead ID: "${leadId}"

ORGANIZATION PROFILE & VERIFIED INVENTORY (STRICT TENANT SCOPE):
- Organization / Brokerage Name: "${orgName}"
- Region / Jurisdiction: "${organization?.stateJurisdiction || 'India'}"
- Team Advisors: ${advisorNames}
- Knowledge Base Documents: ${kbSummary}
- Active Available Listings (${orgProperties.length}):
${orgInventorySummary}`,
                tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS as any }],
                ...(forceMatcherToolOnRound1
                  ? {
                      toolConfig: {
                        functionCallingConfig: {
                          mode: 'ANY' as any,
                          allowedFunctionNames: [
                            'search_properties',
                            'send_property_collateral',
                            'propose_buyer_requirements',
                          ],
                        },
                      },
                    }
                  : {}),
                temperature: 0.3,
              },
            }),
            timeoutPromise,
          ]);
          if (response) {
            modelUsed = modelCandidate;
            lastModelErr = null;
            const usage = (response as any).usageMetadata;
            if (usage) {
              totalInputTokens += Number(usage.promptTokenCount || 0);
              totalOutputTokens += Number(usage.candidatesTokenCount || 0);
            }
            break;
          }
        } catch (candidateErr: any) {
          lastModelErr = candidateErr;
          const msg = candidateErr instanceof Error ? candidateErr.message : String(candidateErr);
          const isDemandSpike = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');
          if (isDemandSpike && attempt === 1) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          logger.warn(
            `[Agent Runtime] Candidate model ${modelCandidate} failed on round ${round} (attempt ${attempt}): ${msg.slice(0, 120)}`,
          );
          break;
        }
      }
      if (response && !lastModelErr) break;
    }

    if (!response || lastModelErr) {
      const errMessage = lastModelErr instanceof Error ? lastModelErr.message : String(lastModelErr);
      logger.error(`[Agent Runtime] All candidate models failed on round ${round}: ${errMessage}`);
      const fallback = await generateConsultativeFallback({
        customerMessage,
        leadId,
        organizationId: orgId,
        organizationName: orgName,
        organizationJurisdiction: organization?.stateJurisdiction,
        advisors: orgAdvisors,
        properties: orgProperties,
        executedTools,
        trustedContext,
        recentMessages,
        reason: `Model cascade error: ${errMessage.slice(0, 100)}`,
        customerName: clientFullName,
        currency,
      });
      await recordAgentRunTrace({
        organizationId: orgId,
        leadId,
        threadId,
        channel: effectiveChannel,
        specialist: directive.specialist,
        intent: directive.intent,
        stageBefore,
        stageAfter: stageBefore,
        toolsExecuted: executedTools,
        guardrailFlags: ['MODEL_CASCADE_FALLBACK'],
        latencyMs: Date.now() - startTime,
        modelUsed: 'db-fallback',
      });
      return {
        ...fallback,
        specialist: directive.specialist,
        stage: stageBefore,
        guardrailFlags: ['MODEL_CASCADE_FALLBACK'],
      };
    }

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      logger.info(
        `[Agent Runtime] Model requested ${functionCalls.length} function call(s): ${functionCalls.map((f: any) => f.name).join(', ')}`,
      );

      const modelContent = response.candidates?.[0]?.content ?? {
        role: 'model',
        parts: functionCalls.map((f: any) => ({ functionCall: f })),
      };
      contents.push(modelContent);

      for (const call of functionCalls) {
        const normalizedArgs = typeof call.args === 'object' && call.args !== null ? { ...call.args } : {};
        if (!normalizedArgs.leadId || normalizedArgs.leadId === '123' || normalizedArgs.leadId === 'leadId' || normalizedArgs.leadId === 'current') {
          normalizedArgs.leadId = trustedContext.leadId;
        }
        const toolResult = await executeAgentTool(call.name, normalizedArgs, trustedContext);

        executedTools.push({
          toolName: call.name,
          status: toolResult.status,
          durationMs: toolResult.durationMs,
        });

        if (call.name === 'search_properties' && toolResult.status === 'SUCCESS') {
          const d = toolResult.data as any;
          for (const p of [...(d?.properties ?? []), ...(d?.nearbyOrStretchOptions ?? [])]) {
            if (p?.id && p?.title) {
              verifiedPropertiesMap.set(p.id, {
                id: p.id,
                title: p.title,
                city: p.city,
                price: p.price,
                bedrooms: p.bedrooms,
                brochureUrl: p.brochureUrl,
                mapsUrl: p.mapsUrl,
              });
            }
          }
        }
        if (call.name === 'propose_follow_up_task' && toolResult.status === 'SUCCESS') {
          capturedTaskProposal = (toolResult.data as any)?.proposal ?? toolResult.data;
        }
        if (call.name === 'propose_buyer_requirements' && toolResult.status === 'SUCCESS') {
          capturedRequirementProposal = toolResult.data;
        }
        if (call.name === 'evaluate_buyer_qualification' && toolResult.status === 'SUCCESS') {
          capturedQualificationResult = toolResult.data;
        }
        if (call.name === 'propose_site_visit' && toolResult.status === 'SUCCESS') {
          capturedSiteVisitProposal = toolResult.data;
        }
        if (call.name === 'book_site_visit' && toolResult.status === 'SUCCESS') {
          capturedSiteVisitBooking = toolResult.data;
        }
        if (call.name === 'plan_lead_follow_up' && toolResult.status === 'SUCCESS') {
          capturedFollowUpProposal = toolResult.data;
        }
        if (call.name === 'send_property_collateral' && toolResult.status === 'SUCCESS') {
          capturedCollateral = toolResult.data;
        }
        if (call.name === 'escalate_to_human') {
          capturedEscalation = toolResult.data;
          const nextStage = computeNextStage({ currentStage: stageBefore, executedTools, escalated: true });
          await recordAgentRunTrace({
            organizationId: orgId,
            leadId,
            threadId,
            channel: effectiveChannel,
            specialist: directive.specialist,
            intent: directive.intent,
            stageBefore,
            stageAfter: nextStage,
            toolsExecuted: executedTools,
            guardrailFlags: ['TOOL_ESCALATED_TO_HUMAN'],
            latencyMs: Date.now() - startTime,
            modelUsed,
          });
          return {
            response:
              effectiveChannel === 'VOICE_CALL'
                ? 'Let me connect you right away with our senior advisor who can help directly.'
                : 'I have shared your request with our senior advisor team along with your requirements. A dedicated advisor will follow up with you directly.',
            suggestedFollowUps: ['A dedicated advisor will follow up with you shortly.'],
            reasoning: `Escalated to human advisor: ${(toolResult.data as any)?.reason ?? 'Advisor handoff requested'}`,
            executedTools,
            taskProposal: capturedTaskProposal,
            requirementProposal: capturedRequirementProposal,
            qualificationResult: capturedQualificationResult,
            siteVisitProposal: capturedSiteVisitProposal,
            siteVisitBooking: capturedSiteVisitBooking,
            collateralSent: capturedCollateral,
            escalation: capturedEscalation,
            specialist: directive.specialist,
            stage: nextStage,
            guardrailFlags: ['TOOL_ESCALATED_TO_HUMAN'],
            exhaustedLimit: false,
          };
        }

        const errorCount = executedTools.filter((t) => t.status === 'ERROR').length;
        if (errorCount >= 2) {
          logger.warn(`[Agent Runtime] Triggering REPEATED_FAILURE escalation after ${errorCount} tool errors.`);
          const failureEscalation = await executeAgentTool(
            'escalate_to_human',
            {
              leadId,
              reason: 'REPEATED_FAILURE',
              explanation: `Encountered multiple (${errorCount}) tool execution failures during processing.`,
              urgency: 'MEDIUM',
              recommendedAdvisorAction: 'Review tool logs and follow up with buyer manually.',
            },
            trustedContext,
          );
          executedTools.push({
            toolName: 'escalate_to_human',
            status: failureEscalation.status,
            durationMs: failureEscalation.durationMs,
          });
          return {
            response:
              'Thank you for your patience! I am syncing with our senior advisor team to verify the exact details and have someone follow up with you shortly.',
            suggestedFollowUps: ['An advisor will verify the details and follow up with you.'],
            reasoning: 'Handoff triggered due to repeated tool execution errors.',
            executedTools,
            taskProposal: capturedTaskProposal,
            requirementProposal: capturedRequirementProposal,
            qualificationResult: capturedQualificationResult,
            siteVisitProposal: capturedSiteVisitProposal,
            siteVisitBooking: capturedSiteVisitBooking,
            collateralSent: capturedCollateral,
            escalation: failureEscalation.data,
            specialist: directive.specialist,
            stage: 'ADVISOR_HANDOFF',
            guardrailFlags: ['REPEATED_FAILURE_ESCALATION'],
            exhaustedLimit: false,
          };
        }

        try {
          await prisma.auditLog.create({
            data: {
              organizationId: orgId,
              action: 'ASSISTANT_QUERY',
              entityType: 'AgentRuntime',
              entityId: threadId,
              actor: 'ai_sales_agent',
              note: `Tool ${call.name} executed with status ${toolResult.status} in ${toolResult.durationMs}ms`,
              newValue: {
                toolName: call.name,
                status: toolResult.status,
                durationMs: toolResult.durationMs,
                leadId,
                specialist: directive.specialist,
              },
            },
          });
        } catch (auditErr) {
          logger.warn(`[Agent Runtime] Audit log failed for ${call.name}: ${(auditErr as Error).message}`);
        }

        const outputPayload =
          toolResult.status === 'SUCCESS'
            ? { output: toolResult.data }
            : { error: toolResult.error ?? 'Unknown error' };

        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: call.name,
                response: outputPayload,
              },
            },
          ],
        });
      }

      if (round === MAX_AGENT_ROUNDS) {
        exhaustedLimit = true;
        finalResponseText =
          response.text?.trim() ||
          'I have reviewed your requirements against our verified inventory. Would you like me to share the brochure or arrange a quick call with our advisor?';
        break;
      }

      continue;
    }

    if (response.text) {
      finalResponseText = response.text.trim();
      break;
    }

    finalResponseText =
      'Thank you for reaching out! Could you share your preferred location and approximate budget so I can match verified options for you?';
    break;
  }

  // 6. Post-LLM Guardrails & Verification
  const verifiedList = Array.from(verifiedPropertiesMap.values());
  const guardrailResult = verifyAgentOutput({
    draftText: finalResponseText,
    verifiedPropertyTitles: verifiedList.map((p) => p.title),
    hasCollateralToolSuccess: Boolean(capturedCollateral),
    channel: effectiveChannel,
  });
  finalResponseText = guardrailResult.finalText;

  // 7. Dynamic DB-Grounded Follow-Ups (zero hardcoded project names)
  const suggestedFollowUps: string[] = [];
  for (const prop of verifiedList.slice(0, 2)) {
    suggestedFollowUps.push(`Send brochure for ${prop.title}`);
  }
  if (verifiedList.length > 0) {
    suggestedFollowUps.push('Schedule a site visit');
  } else {
    suggestedFollowUps.push('Share preferred location & budget');
    suggestedFollowUps.push('Schedule a callback with an advisor');
  }

  // 8. Lifecycle Stage Progression & Observability Trace
  const stageAfter = computeNextStage({
    currentStage: stageBefore,
    executedTools,
    escalated: Boolean(capturedEscalation),
  });

  await recordAgentRunTrace({
    organizationId: orgId,
    leadId,
    threadId,
    channel: effectiveChannel,
    specialist: directive.specialist,
    intent: directive.intent,
    stageBefore,
    stageAfter,
    toolsExecuted: executedTools,
    guardrailFlags: guardrailResult.flags,
    latencyMs: Date.now() - startTime,
    modelUsed,
  });

  if (modelUsed !== 'db-fallback') {
    await recordGeminiCost({
      organizationId: orgId,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      model: modelUsed,
      leadId,
    });
  }

  return {
    response: finalResponseText,
    suggestedFollowUps: suggestedFollowUps.slice(0, 3),
    reasoning: `Specialist ${directive.specialist} (${directive.intent}) completed with ${executedTools.length} tool call(s).`,
    executedTools,
    taskProposal: capturedTaskProposal,
    requirementProposal: capturedRequirementProposal,
    qualificationResult: capturedQualificationResult,
    siteVisitProposal: capturedSiteVisitProposal,
    siteVisitBooking: capturedSiteVisitBooking,
    collateralSent: capturedCollateral,
    escalation: capturedEscalation,
    followUpProposal: capturedFollowUpProposal,
    matchedProperties: verifiedList,
    specialist: directive.specialist,
    stage: stageAfter,
    guardrailFlags: guardrailResult.flags,
    exhaustedLimit,
  };
}
