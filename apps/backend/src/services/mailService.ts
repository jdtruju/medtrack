export interface PasswordResetEmail {
  to: string;
  resetLink: string;
  token: string;
  sentAt: Date;
}

export interface MailService {
  sentPasswordResetEmails: PasswordResetEmail[];
  sendPasswordResetEmail(to: string, resetLink: string, token: string): Promise<void>;
}

export class MockMailService implements MailService {
  sentPasswordResetEmails: PasswordResetEmail[] = [];

  async sendPasswordResetEmail(to: string, resetLink: string, token: string): Promise<void> {
    const email = { to, resetLink, token, sentAt: new Date() };
    this.sentPasswordResetEmails.push(email);
    console.info(`Mock email de recuperacion enviado a ${to}: ${resetLink}`);
  }
}
