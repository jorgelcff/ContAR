const nodemailer = require('nodemailer');
const { sendMail, emailConfigured, createTransporter } = require('../emails/send');

// The deployment cannot open port 587: the connection times out on CONN rather
// than being refused, which is a dropped packet — a firewall, not a server
// saying no. No timeout fixes that, so there has to be a second way out.
describe('how a message actually leaves', () => {
  const keys = ['RESEND_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'EMAIL_FROM'];
  let saved;

  beforeEach(() => {
    saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    for (const k of keys) delete process.env[k];
  });
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
  });

  const message = { to: 'alguem@example.com', subject: 'Olá', html: '<p>oi</p>' };

  it('reports itself unconfigured when there is no way out at all', () => {
    expect(emailConfigured()).toBe(false);
  });

  it('counts an HTTP key on its own as configured — no SMTP needed', () => {
    process.env.RESEND_API_KEY = 'key';
    expect(emailConfigured()).toBe(true);
  });

  it('goes over HTTP when a key is present, without touching SMTP', async () => {
    process.env.RESEND_API_KEY = 'key';
    process.env.SMTP_USER = 'sender@example.com';
    process.env.SMTP_PASS = 'secret';
    const smtp = vi.spyOn(nodemailer, 'createTransport');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: '1' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendMail(message);

    expect(result.transport).toBe('http');
    // Port 443 is never filtered, which is the whole reason this path exists.
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:/);
    expect(smtp, 'SMTP must not be attempted when HTTP is available').not.toHaveBeenCalled();
  });

  it('falls to SMTP when there is no key', async () => {
    process.env.SMTP_USER = 'sender@example.com';
    process.env.SMTP_PASS = 'secret';
    const sendMailSpy = vi.fn().mockResolvedValue({ messageId: 'x' });
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailSpy });

    const result = await sendMail(message);

    expect(result.transport).toBe('smtp');
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
  });

  it('reports a refused API key the same way a refused password is reported', async () => {
    // Callers branch on the code, not on which transport produced it.
    process.env.RESEND_API_KEY = 'wrong';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => 'unauthorized',
    }));

    await expect(sendMail(message)).rejects.toMatchObject({ code: 'EAUTH' });
  });

  it('marks any other API failure as an HTTP problem', async () => {
    process.env.RESEND_API_KEY = 'key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => 'boom',
    }));

    await expect(sendMail(message)).rejects.toMatchObject({ code: 'EHTTP' });
  });
});

describe('the SMTP transport', () => {
  const keys = ['SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  let saved;
  beforeEach(() => { saved = Object.fromEntries(keys.map((k) => [k, process.env[k]])); });
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('speaks TLS from the first byte on 465 and upgrades on 587', () => {
    // Getting this backwards hangs rather than failing, which is why the port
    // decides it — and why trying 465 against a host that filters 587 is a
    // change of one environment variable.
    process.env.SMTP_PORT = '465';
    expect(createTransporter().options.secure).toBe(true);

    process.env.SMTP_PORT = '587';
    expect(createTransporter().options.secure).toBe(false);

    delete process.env.SMTP_PORT;
    expect(createTransporter().options.secure).toBe(false);
  });

  it('never leaves the address family to chance', () => {
    // smtp.gmail.com publishes A and AAAA records; a container with no IPv6
    // route died unreachable on every send until this was pinned.
    expect(createTransporter().options.family).toBe(4);
  });
});
