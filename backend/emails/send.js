/**
 * Getting a message out of a host that blocks SMTP.
 *
 * The deployment cannot open port 587 at all: the connection times out on CONN
 * rather than being refused, which is a dropped packet — a firewall, not a
 * server saying no. No timeout is long enough to fix that, so there has to be
 * another way out.
 *
 * Two, in order:
 *
 *  1. An HTTP email API, when RESEND_API_KEY is set. This goes out over 443,
 *     which no host blocks, and is the reliable answer on a platform that
 *     filters mail ports.
 *  2. SMTP through nodemailer, which is what runs locally and anywhere the
 *     port is open.
 *
 * Whichever is used, the message is identical — the templates and the language
 * choice sit above this and do not know or care.
 */
const nodemailer = require('nodemailer');

// Two ceilings to sit between. Above: a managed host answers 502 at about 100
// seconds. Below: this SMTP path has been measured taking 22.5s just to shake
// hands, and an earlier 10s cap would have killed sends that were about to
// work. A timeout has to clear the worst case actually observed.
const SMTP_TIMEOUTS = {
  connectionTimeout: 30_000,
  greetingTimeout: 30_000,
  socketTimeout: 45_000,
};

function smtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function httpConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Whether this server can send at all, by any route. */
function emailConfigured() {
  return httpConfigured() || smtpConfigured();
}

function emailFrom() {
  return process.env.EMAIL_FROM || `ContAR <${process.env.SMTP_USER || 'no-reply@contar.app'}>`;
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    // 465 speaks TLS from the first byte; 587 starts plain and upgrades with
    // STARTTLS. Getting this wrong hangs rather than failing, so it follows
    // the port instead of being pinned — which also makes trying 465 a change
    // of one environment variable when 587 turns out to be filtered.
    secure: port === 465,
    // smtp.gmail.com publishes A and AAAA records. Left to choose, Node took
    // the AAAA in a container with no IPv6 route and every send died
    // unreachable after burning the whole connection timeout.
    family: 4,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    ...SMTP_TIMEOUTS,
  });
}

async function sendOverHttp({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: emailFrom(), to: [to], subject, html }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
    // Same shape the SMTP path throws, so callers do not branch on transport.
    err.code = res.status === 401 || res.status === 403 ? 'EAUTH' : 'EHTTP';
    throw err;
  }
  return res.json().catch(() => ({}));
}

/**
 * @returns {Promise<{transport: 'http'|'smtp'}>} which route carried it, for
 *   the log — "it worked" is much less useful than "it worked over HTTP".
 */
async function sendMail({ to, subject, html }) {
  if (httpConfigured()) {
    await sendOverHttp({ to, subject, html });
    return { transport: 'http' };
  }
  await createTransporter().sendMail({ from: emailFrom(), to, subject, html });
  return { transport: 'smtp' };
}

module.exports = { sendMail, emailConfigured, emailFrom, createTransporter, SMTP_TIMEOUTS };
