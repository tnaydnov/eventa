import nodemailer from 'nodemailer';

/**
 * Lazily-initialized singleton nodemailer transporter.
 * Avoids module-scope env-var reads that can break on serverless cold-start
 * when SMTP_* vars are not yet available.
 */
let _transporter: nodemailer.Transporter | null = null;

export function getMailTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

/** Standard "From" header for Eventa emails. */
export function getSmtpFrom(): string {
  return `"Eventa" <${process.env.SMTP_USER}>`;
}
