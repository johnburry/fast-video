import formData from 'form-data';
import Mailgun from 'mailgun.js';

interface SendSearchNotificationParams {
  tenantName: string;
  channelHandle: string | null;
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
  channelHandle,
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

    // Build subject line: FV: [tenant]/[channel_handle]/[ip address] search: [search query]
    const channelPart = channelHandle || 'all-channels';
    const emailSubject = `FV: ${tenantName}/${channelPart}/${ipAddress} search: ${searchQuery}`;

    const domain = process.env.MAILGUN_DOMAIN || 'mail.thought.app';
    const mg = getMailgunClient();

    await mg.messages.create(domain, {
      from: `${senderName} <${fromEmail}>`,
      to: [toEmail],
      subject: emailSubject,
      text: ' ', // Mailgun requires at least one content field (text/html/template)
      'h:Reply-To': replyToEmail,
    });

    console.log('[MAILGUN] Search notification sent successfully');
  } catch (error) {
    console.error('[MAILGUN] Error sending search notification:', error);
    // Don't throw - we don't want email failures to break the search
  }
}

interface CronJobMetrics {
  channels: Array<{
    channelName: string;
    videosImported: number;
  }>;
  errors: string[];
  elapsedTimeMs: number;
}

export async function sendCronJobStartedEmail(): Promise<void> {
  try {
    if (!process.env.MAILGUN_API_KEY) {
      console.log('[MAILGUN] Skipping email - MAILGUN_API_KEY not configured');
      return;
    }

    const fromEmail = 'cron@mail.thought.app';
    const toEmail = 'systems@reorbit.com';
    const senderName = 'FV Cron Jobs';
    const replyToEmail = 'noreply@mail.thought.app';
    const emailSubject = 'Video Import Cron Job Started';

    const domain = process.env.MAILGUN_DOMAIN || 'mail.thought.app';
    const mg = getMailgunClient();

    const startTime = new Date().toISOString();
    const emailBody = `Video import cron job has started at ${startTime}.

This job will import new videos from the last 4 weeks for all channels.`;

    await mg.messages.create(domain, {
      from: `${senderName} <${fromEmail}>`,
      to: [toEmail],
      subject: emailSubject,
      text: emailBody,
      'h:Reply-To': replyToEmail,
    });

    console.log('[MAILGUN] Cron job started email sent successfully');
  } catch (error) {
    console.error('[MAILGUN] Error sending cron job started email:', error);
  }
}

export async function sendCronJobCompletedEmail(metrics: CronJobMetrics): Promise<void> {
  try {
    if (!process.env.MAILGUN_API_KEY) {
      console.log('[MAILGUN] Skipping email - MAILGUN_API_KEY not configured');
      return;
    }

    const fromEmail = 'cron@mail.thought.app';
    const toEmail = 'systems@reorbit.com';
    const senderName = 'FV Cron Jobs';
    const replyToEmail = 'noreply@mail.thought.app';

    const totalVideos = metrics.channels.reduce((sum, ch) => sum + ch.videosImported, 0);
    const elapsedSeconds = (metrics.elapsedTimeMs / 1000).toFixed(2);
    const elapsedMinutes = (metrics.elapsedTimeMs / 1000 / 60).toFixed(2);

    const emailSubject = `Video Import Cron Job Completed - ${totalVideos} videos imported`;

    const domain = process.env.MAILGUN_DOMAIN || 'mail.thought.app';
    const mg = getMailgunClient();

    // Build email body with metrics
    let emailBody = `Video import cron job has completed successfully.

SUMMARY:
- Total videos imported: ${totalVideos}
- Channels processed: ${metrics.channels.length}
- Elapsed time: ${elapsedSeconds}s (${elapsedMinutes} minutes)
- Errors: ${metrics.errors.length}

CHANNELS WITH IMPORTED VIDEOS:
`;

    if (metrics.channels.length === 0) {
      emailBody += '  (No videos imported)\n';
    } else {
      metrics.channels.forEach(ch => {
        emailBody += `  - ${ch.channelName}: ${ch.videosImported} video(s)\n`;
      });
    }

    if (metrics.errors.length > 0) {
      emailBody += '\nERRORS:\n';
      metrics.errors.forEach(error => {
        emailBody += `  - ${error}\n`;
      });
    }

    await mg.messages.create(domain, {
      from: `${senderName} <${fromEmail}>`,
      to: [toEmail],
      subject: emailSubject,
      text: emailBody,
      'h:Reply-To': replyToEmail,
    });

    console.log('[MAILGUN] Cron job completed email sent successfully');
  } catch (error) {
    console.error('[MAILGUN] Error sending cron job completed email:', error);
  }
}
