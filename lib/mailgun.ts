import formData from 'form-data';
import Mailgun from 'mailgun.js';

interface SendSearchNotificationParams {
  tenantName: string;
  channelName: string | null;
  ipAddress: string;
  searchQuery: string;
}

// Lazy initialization of Mailgun client to avoid build-time errors
let mgClient: ReturnType<Mailgun['client']> | null = null;

function getMailgunClient() {
  if (!mgClient) {
    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY is not configured');
    }

    const mailgun = new Mailgun(formData);
    mgClient = mailgun.client({
      username: 'api',
      key: apiKey,
      url: 'https://api.mailgun.net', // Use EU endpoint if needed: https://api.eu.mailgun.net
    });
  }
  return mgClient;
}

export async function sendSearchNotification({
  tenantName,
  channelName,
  ipAddress,
  searchQuery,
}: SendSearchNotificationParams): Promise<void> {
  try {
    // Skip if no API key is configured (e.g., in development)
    if (!process.env.MAILGUN_API_KEY) {
      console.log('[MAILGUN] Skipping email - MAILGUN_API_KEY not configured');
      return;
    }

    const fromEmail = 'notifications@mail.thought.app';
    const toEmail = '5u62z12hv6@pomail.net';
    const senderName = 'FV Notifications';
    const replyToEmail = 'notifications@mail.thought.app';

    // Build subject line: FV: [tenant]/[channel_name]/[ip address] search: [search query]
    const channelPart = channelName || 'all-channels';
    const emailSubject = `FV: ${tenantName}/${channelPart}/${ipAddress} search: ${searchQuery}`;

    const domain = process.env.MAILGUN_DOMAIN || 'mail.thought.app';
    const mg = getMailgunClient();

    await mg.messages.create(domain, {
      from: `${senderName} <${fromEmail}>`,
      to: [toEmail],
      subject: emailSubject,
      text: '', // Empty body as requested
      'h:Reply-To': replyToEmail,
    });

    console.log('[MAILGUN] Search notification sent successfully');
  } catch (error) {
    console.error('[MAILGUN] Error sending search notification:', error);
    // Don't throw - we don't want email failures to break the search
  }
}
