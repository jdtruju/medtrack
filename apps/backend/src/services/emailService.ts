import { env } from '../config/env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ provider: string; id?: string }>;
}

export function createEmailSender(): EmailSender {
  if (env.emailProvider === 'resend') {
    return new ResendEmailSender();
  }

  return new MockEmailSender();
}

class MockEmailSender implements EmailSender {
  async send(message: EmailMessage) {
    console.info('[correo-mock]', {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { provider: 'mock' };
  }
}

class ResendEmailSender implements EmailSender {
  async send(message: EmailMessage) {
    if (!env.resendApiKey) {
      throw new Error('RESEND_API_KEY es obligatorio cuando EMAIL_PROVIDER=resend.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.resendFrom,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html ?? `<p>${escapeHtml(message.text).replaceAll('\n', '<br />')}</p>`,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
    if (!response.ok) {
      throw new Error(data.message ?? data.error ?? 'No se pudo enviar el correo con Resend.');
    }

    return { provider: 'resend', id: data.id };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
