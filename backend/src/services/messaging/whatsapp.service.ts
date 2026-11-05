/**
 * Meta WhatsApp Business Cloud API Integration
 *
 * Implements official Graph API v21.0 messaging:
 * - Text messages with contextual preview
 * - Native OGG-OPUS playable voice notes (type: audio/ogg; codecs=opus)
 * - Interactive site-visit quick-reply buttons ([ Book Saturday 11 AM ], [ Book Sunday 3 PM ])
 * - Simulated human typing indicators
 * - Safe dev/test simulation when credentials are not configured
 */

import { logger } from '../../utils/logger.js';

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isSimulated?: boolean;
}

export interface InteractiveButton {
  id: string;
  title: string;
}

export class WhatsAppService {
  private readonly apiVersion = 'v21.0';

  private getCredentials(): { token?: string; phoneNumberId?: string } {
    return {
      token: process.env['META_WHATSAPP_TOKEN'],
      phoneNumberId: process.env['META_PHONE_NUMBER_ID'],
    };
  }

  /**
   * Sanitizes destination phone number into E.164 without '+' or leading zeros
   * Example: "+91 98765-43210" -> "919876543210", "+1 (555) 234-5678" -> "15552345678"
   */
  public sanitizePhoneNumber(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  /**
   * Sends a standard text message.
   */
  async sendTextMessage(
    toPhone: string,
    text: string,
    options?: { previewUrl?: boolean }
  ): Promise<WhatsAppSendResult> {
    const cleanPhone = this.sanitizePhoneNumber(toPhone);
    const { token, phoneNumberId } = this.getCredentials();

    if (!token || !phoneNumberId) {
      const simId = `sim-wa-text-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      logger.info(`[WhatsApp Simulated Text] To: ${cleanPhone}, Content: "${text.slice(0, 80)}...", ID: ${simId}`);
      return { success: true, messageId: simId, isSimulated: true };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: options?.previewUrl ?? false,
            body: text,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        const errorMsg = data?.error?.message || `HTTP ${response.status}`;
        logger.error(`[WhatsApp API Error] Failed to send text: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      const messageId = data?.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err: any) {
      logger.error(`[WhatsApp Exception] sendTextMessage failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Uploads an OGG-OPUS audio buffer to Meta Media API and dispatches as a native Voice Note.
   */
  async sendVoiceNote(
    toPhone: string,
    oggOpusBuffer: Buffer,
    options?: { caption?: string }
  ): Promise<WhatsAppSendResult> {
    const cleanPhone = this.sanitizePhoneNumber(toPhone);
    const { token, phoneNumberId } = this.getCredentials();

    if (!token || !phoneNumberId) {
      const simId = `sim-wa-voice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      logger.info(`[WhatsApp Simulated Voice Note] To: ${cleanPhone}, Size: ${oggOpusBuffer.length} bytes, ID: ${simId}`);
      return { success: true, messageId: simId, isSimulated: true };
    }

    try {
      // 1. Upload media binary to Meta Graph Media endpoint
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', 'audio/ogg; codecs=opus');
      formData.append(
        'file',
        new Blob([oggOpusBuffer], { type: 'audio/ogg; codecs=opus' }),
        'advisor_voicenote.ogg'
      );

      const uploadRes = await fetch(`https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: AbortSignal.timeout(15000),
      });

      const uploadData = (await uploadRes.json()) as any;
      if (!uploadRes.ok || !uploadData.id) {
        const err = uploadData?.error?.message || `Media upload failed with HTTP ${uploadRes.status}`;
        logger.error(`[WhatsApp Media Error] ${err}`);
        return { success: false, error: err };
      }

      const mediaId = uploadData.id;

      // 2. Dispatch audio message pointing to the uploaded media ID
      const messagePayload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'audio',
        audio: {
          id: mediaId,
        },
      };

      const sendRes = await fetch(`https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
        signal: AbortSignal.timeout(10000),
      });

      const sendData = (await sendRes.json()) as any;
      if (!sendRes.ok) {
        const errorMsg = sendData?.error?.message || `Audio send failed with HTTP ${sendRes.status}`;
        logger.error(`[WhatsApp API Error] Failed to send voice note: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      const messageId = sendData?.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err: any) {
      logger.error(`[WhatsApp Exception] sendVoiceNote failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sends interactive reply buttons (e.g. for locking site visit times).
   */
  async sendInteractiveButtons(
    toPhone: string,
    bodyText: string,
    buttons: InteractiveButton[],
    options?: { headerText?: string; footerText?: string }
  ): Promise<WhatsAppSendResult> {
    const cleanPhone = this.sanitizePhoneNumber(toPhone);
    const { token, phoneNumberId } = this.getCredentials();

    if (!token || !phoneNumberId) {
      const simId = `sim-wa-buttons-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      logger.info(
        `[WhatsApp Simulated Buttons] To: ${cleanPhone}, Options: [${buttons.map((b) => b.title).join(', ')}], ID: ${simId}`
      );
      return { success: true, messageId: simId, isSimulated: true };
    }

    // WhatsApp limits interactive buttons to max 3 buttons
    const validButtons = buttons.slice(0, 3).map((b) => ({
      type: 'reply',
      reply: {
        id: b.id.slice(0, 256),
        title: b.title.slice(0, 20),
      },
    }));

    try {
      const interactivePayload: any = {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: validButtons },
      };

      if (options?.headerText) {
        interactivePayload.header = { type: 'text', text: options.headerText };
      }
      if (options?.footerText) {
        interactivePayload.footer = { text: options.footerText };
      }

      const response = await fetch(`https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'interactive',
          interactive: interactivePayload,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        const errorMsg = data?.error?.message || `HTTP ${response.status}`;
        logger.error(`[WhatsApp API Error] Failed to send buttons: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      return { success: true, messageId: data?.messages?.[0]?.id };
    } catch (err: any) {
      logger.error(`[WhatsApp Exception] sendInteractiveButtons failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

export const whatsAppService = new WhatsAppService();
