const request = require('supertest');
const app = require('../app');
const { createAuthedUser } = require('./helpers');
const User = require('../models/User');

describe('POST /api/auth/register', () => {
  it('rejects missing email or password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('rejects passwords under 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('creates a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('ada@example.com');
    // Never leak the password hash to the client.
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('sends the verification email when SMTP is configured', async () => {
    // The send used to be gated on RESEND_API_KEY, which nothing reads — the
    // transport is nodemailer over SMTP. On a server with working SMTP (proven
    // by password resets going out) no verification mail was ever sent.
    const nodemailer = require('nodemailer');
    const sent = [];
    const spy = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: async (msg) => { sent.push(msg); return { messageId: 'x' }; },
    });
    const prev = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    process.env.SMTP_USER = 'sender@example.com';
    process.env.SMTP_PASS = 'secret';

    try {
      const email = `verify-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'V', email, password: 'password123' });
      expect(res.status).toBe(201);

      // Sending is fire-and-forget so the response does not wait on it.
      await new Promise((r) => setTimeout(r, 50));
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(email);
      expect(sent[0].html).toContain('/verify-email?token=');
    } finally {
      spy.mockRestore();
      process.env.SMTP_USER = prev.user;
      process.env.SMTP_PASS = prev.pass;
    }
  });

  it('still registers when the server cannot send mail', async () => {
    const prev = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'N', email: `nomail-${Date.now()}@example.com`, password: 'password123' });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
    } finally {
      process.env.SMTP_USER = prev.user;
      process.env.SMTP_PASS = prev.pass;
    }
  });

  it('rejects a duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects wrong credentials', async () => {
    await createAuthedUser({ email: 'login1@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login1@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('rejects an email that was never registered', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials', async () => {
    await createAuthedUser({ email: 'login2@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login2@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});

describe('GET /api/auth/me', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const user = await createAuthedUser({ email: 'me@example.com' });
    const res = await request(app).get('/api/auth/me').set('Authorization', user.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns the same generic message for an unregistered email (no enumeration)', async () => {
    // Deliberately an email with no account — the controller returns early
    // before attempting to send mail, so this never touches SMTP.
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unregistered@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/instruções/i);
  });
});

// ── Resend verification, and the password reset round trip ───────────────────
// Neither flow had any coverage: the reset only had the no-enumeration check,
// which returns before it ever touches SMTP, and resend had none at all. What
// follows drives both the whole way, token included.

/** Runs fn with SMTP configured and a stubbed transport; returns what was sent. */
async function withMail(fn) {
  const nodemailer = require('nodemailer');
  const sent = [];
  const spy = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
    sendMail: async (msg) => { sent.push(msg); return { messageId: 'x' }; },
  });
  const prev = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  process.env.SMTP_USER = 'sender@example.com';
  process.env.SMTP_PASS = 'secret';
  try {
    await fn(sent);
  } finally {
    spy.mockRestore();
    process.env.SMTP_USER = prev.user;
    process.env.SMTP_PASS = prev.pass;
  }
}

const tokenFrom = (html, path) => {
  const at = String(html || '').indexOf(`${path}?token=`);
  if (at === -1) return '';
  const m = /^[a-f0-9]+/.exec(String(html).slice(at + `${path}?token=`.length));
  return m ? m[0] : '';
};

describe('POST /api/auth/resend-verification', () => {
  it('sends a fresh link that actually verifies the account', async () => {
    const user = await createAuthedUser({ emailVerified: false });

    await withMail(async (sent) => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', user.authHeader)
        .send({ language: 'en' });

      expect(res.status).toBe(200);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(user.email);
      expect(sent[0].subject).toMatch(/confirm your email/i);

      const token = tokenFrom(sent[0].html, '/verify-email');
      expect(token).toBeTruthy();

      const verified = await request(app).post('/api/auth/verify-email').send({ token });
      expect(verified.status).toBe(200);
      expect(verified.body.user.emailVerified).toBe(true);
    });
  });

  it('does not send again to an already verified account', async () => {
    const user = await createAuthedUser();
    await withMail(async (sent) => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', user.authHeader)
        .send({});
      expect(res.status).toBe(200);
      expect(sent).toHaveLength(0);
    });
  });

  it('requires a signed-in account', async () => {
    const res = await request(app).post('/api/auth/resend-verification').send({});
    expect(res.status).toBe(401);
  });
});

describe('password reset round trip', () => {
  it('emails a link that sets a new password, in the requested language', async () => {
    const user = await createAuthedUser();

    await withMail(async (sent) => {
      const forgot = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email, language: 'es' });
      expect(forgot.status).toBe(200);
      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toMatch(/restablecer contraseña/i);

      const token = tokenFrom(sent[0].html, '/reset-password');
      expect(token).toBeTruthy();

      const reset = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'brandnew456' });
      expect(reset.status).toBe(200);

      const oldPw = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expect(oldPw.status).toBe(401);

      const newPw = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'brandnew456' });
      expect(newPw.status).toBe(200);
    });
  });

  it('burns the token — the same link cannot be used twice', async () => {
    const user = await createAuthedUser();
    await withMail(async (sent) => {
      await request(app).post('/api/auth/forgot-password').send({ email: user.email });
      const token = tokenFrom(sent[0].html, '/reset-password');

      const first = await request(app).post('/api/auth/reset-password').send({ token, password: 'firstone123' });
      expect(first.status).toBe(200);

      const second = await request(app).post('/api/auth/reset-password').send({ token, password: 'secondone123' });
      expect(second.status).toBe(400);
    });
  });

  it('rejects an expired token', async () => {
    const user = await createAuthedUser();
    await withMail(async (sent) => {
      await request(app).post('/api/auth/forgot-password').send({ email: user.email });
      const token = tokenFrom(sent[0].html, '/reset-password');

      await User.updateOne({ email: user.email }, { resetTokenExpiry: new Date(Date.now() - 1000) });

      const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'toolate123' });
      expect(res.status).toBe(400);
    });
  });

  it('rejects a made-up token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'deadbeef'.repeat(8), password: 'whatever123' });
    expect(res.status).toBe(400);
  });
});

describe('rate limiting on the sensitive endpoints', () => {
  it('does not spend one endpoint\'s budget on another', async () => {
    // All four sensitive routes shared a single limiter instance, so a single
    // counter of ten per IP per fifteen minutes covered them together. Behind a
    // conference venue's NAT that was ten for the whole room, and clicking the
    // confirmation link in your own inbox used up the budget for resetting a
    // password. Fifteen verify-email attempts — past the old shared ceiling —
    // must leave the password reset working.
    for (let i = 0; i < 15; i += 1) {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: `0000${i}`.padEnd(64, '0') });
      expect(res.status, `verify-email attempt ${i} was throttled`).toBe(400);
    }

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody-at-all@example.com' });
    expect(forgot.status).toBe(200);
  });

  it('counts resend per account, so one person cannot lock out another', async () => {
    const heavy = await createAuthedUser({ emailVerified: false });
    const quiet = await createAuthedUser({ emailVerified: false });

    await withMail(async () => {
      let throttled = false;
      for (let i = 0; i < 12; i += 1) {
        const res = await request(app)
          .post('/api/auth/resend-verification')
          .set('Authorization', heavy.authHeader)
          .send({});
        if (res.status === 429) { throttled = true; break; }
      }
      expect(throttled, 'the heavy user should hit their own ceiling').toBe(true);

      // Same IP, different account — untouched.
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', quiet.authHeader)
        .send({});
      expect(res.status).toBe(200);
    });
  });
});

// The endpoint that 502'd in production. register hands the send to a dangling
// promise and answers straight away; resend and the password reset wait on it
// so they can report what happened — which means an SMTP port that hangs
// rather than refusing holds the HTTP request until the platform's proxy gives
// up, and the caller sees a gateway error with nothing in the app logs.
describe('the endpoints that wait on the mail server', () => {
  const clearSmtp = () => {
    const prev = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    return () => { process.env.SMTP_USER = prev.user; process.env.SMTP_PASS = prev.pass; };
  };

  it('says so when the server cannot send at all, instead of trying anyway', async () => {
    const user = await createAuthedUser({ emailVerified: false });
    const restore = clearSmtp();
    try {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', user.authHeader)
        .send({});
      expect(res.status).toBe(503);
    } finally { restore(); }
  });

  it('reports a failed send as an error rather than hanging', async () => {
    const nodemailer = require('nodemailer');
    const spy = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: async () => { throw new Error('ETIMEDOUT'); },
    });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    void quiet;
    const prev = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    process.env.SMTP_USER = 'sender@example.com';
    process.env.SMTP_PASS = 'secret';
    const user = await createAuthedUser({ emailVerified: false });
    try {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', user.authHeader)
        .send({});
      expect(res.status).toBe(502);
      expect(res.body.error).toBeTruthy();
    } finally {
      spy.mockRestore();
      process.env.SMTP_USER = prev.user;
      process.env.SMTP_PASS = prev.pass;
    }
  });

  it('carries timeouts that fit between a slow handshake and the gateway', async () => {
    // Bounded at the top because the platform answers 502 at about 100s, and
    // nodemailer's defaults (greeting 30s, connect 2min, socket 10min) run
    // past that. Bounded at the bottom because this SMTP path has been
    // measured taking 22.5s to shake hands — a ceiling under that would fail
    // sends that were about to work.
    const nodemailer = require('nodemailer');
    let opts = null;
    const spy = vi.spyOn(nodemailer, 'createTransport').mockImplementation((o) => {
      opts = o;
      return { sendMail: async () => ({ messageId: 'x' }) };
    });
    const prev = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    process.env.SMTP_USER = 'sender@example.com';
    process.env.SMTP_PASS = 'secret';
    const user = await createAuthedUser({ emailVerified: false });
    try {
      await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', user.authHeader)
        .send({});
      for (const key of ['connectionTimeout', 'greetingTimeout', 'socketTimeout']) {
        expect(opts[key], `${key} must clear the slowest handshake observed`).toBeGreaterThanOrEqual(25000);
        expect(opts[key], `${key} must answer before the gateway does`).toBeLessThanOrEqual(60000);
      }
    } finally {
      spy.mockRestore();
      process.env.SMTP_USER = prev.user;
      process.env.SMTP_PASS = prev.pass;
    }
  });

  it('the password reset also refuses rather than stalling with no mail server', async () => {
    const user = await createAuthedUser();
    const restore = clearSmtp();
    try {
      const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
      expect(res.status).toBe(503);
    } finally { restore(); }
  });
});

// One 502 and a sentence telling the user to try again looked identical
// whether the port was blocked, the handshake was slow, or the password was
// wrong — so diagnosing it meant guessing. Nodemailer knows which; this is
// about writing it down where it can be read.
describe('a failed send says which failure it was', () => {
  const withBrokenMail = async (error, run) => {
    const nodemailer = require('nodemailer');
    const spy = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: async () => { throw error; },
    });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const prev = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    process.env.SMTP_USER = 'sender@example.com';
    process.env.SMTP_PASS = 'secret';
    try {
      await run();
    } finally {
      spy.mockRestore();
      quiet.mockRestore();
      process.env.SMTP_USER = prev.user;
      process.env.SMTP_PASS = prev.pass;
    }
  };

  const cases = [
    ['ECONNREFUSED', 'a blocked outbound port'],
    ['ETIMEDOUT', 'a handshake slower than the timeout'],
    ['EAUTH', 'credentials the server refused'],
  ];

  for (const [code, what] of cases) {
    it(`surfaces ${code} — ${what}`, async () => {
      const user = await createAuthedUser({ emailVerified: false });
      const err = new Error('mail failed');
      err.code = code;

      await withBrokenMail(err, async () => {
        const res = await request(app)
          .post('/api/auth/resend-verification')
          .set('Authorization', user.authHeader)
          .send({});
        expect(res.status).toBe(502);
        // Readable from a browser's network tab, which is the difference
        // between knowing and redeploying to find out.
        expect(res.body.code).toBe(code);
      });
    });
  }

  it('says UNKNOWN rather than nothing when the error carries no code', async () => {
    const user = await createAuthedUser({ emailVerified: false });
    await withBrokenMail(new Error('something odd'), async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', user.authHeader)
        .send({});
      expect(res.body.code).toBe('UNKNOWN');
    });
  });
});
