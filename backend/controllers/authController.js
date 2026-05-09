const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Resend } = require('resend');
const User = require('../models/User');

function getAuthSecret() {
  const secret = (process.env.AUTH_JWT_SECRET || 'dev_only_change_me').trim();
  if (secret === 'dev_only_change_me') {
    console.warn('[AUTH] WARNING: AUTH_JWT_SECRET is using the insecure default. Set a strong secret in production.');
  }
  return secret;
}

function signToken(user) {
  return jwt.sign(
    { userId: String(user._id), email: user.email },
    getAuthSecret(),
    { expiresIn: '7d' }
  );
}

function sanitizeUser(user) {
  return { id: String(user._id), name: user.name || '', email: user.email, createdAt: user.createdAt };
}

function ensureDatabaseReady(res) {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({ error: 'Database unavailable. Try again in a few seconds.' });
  return false;
}

async function register(req, res) {
  try {
    if (!ensureDatabaseReady(res)) return;
    const name     = String(req.body?.name     || '').trim();
    const email    = String(req.body?.email    || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    if (password.length < 6)  return res.status(400).json({ error: 'password must be at least 6 characters' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user  = await User.create({ name, email, passwordHash });
    const token = signToken(user);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Failed to register user' });
  }
}

async function login(req, res) {
  try {
    if (!ensureDatabaseReady(res)) return;
    const email    = String(req.body?.email    || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email });
    if (!user || typeof user.passwordHash !== 'string' || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Failed to login' });
  }
}

async function me(req, res) {
  try {
    if (!ensureDatabaseReady(res)) return;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ error: 'Failed to load user' });
  }
}

async function forgotPassword(req, res) {
  try {
    if (!ensureDatabaseReady(res)) return;
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });

    // Always return the same message to prevent email enumeration
    const SUCCESS_MSG = 'Se esse email estiver cadastrado, você receberá as instruções em breve.';

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: SUCCESS_MSG });

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    user.resetToken       = token;
    user.resetTokenExpiry = expiry;
    await user.save();

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl    = `${frontendUrl}/reset-password?token=${token}`;
    const fromEmail   = process.env.RESEND_FROM_EMAIL || 'ContAR <onboarding@resend.dev>';

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from:    fromEmail,
      to:      email,
      subject: 'Redefinir senha — ContAR',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#111827;color:#f9fafb;border-radius:16px;">
          <h2 style="margin:0 0 8px;color:#22d3ee;">Redefinir senha</h2>
          <p style="color:#9ca3af;margin:0 0 24px;">Você solicitou a redefinição de senha da sua conta ContAR.</p>
          <a href="${resetUrl}"
             style="background:#0891b2;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:600;margin-bottom:24px;">
            Redefinir minha senha
          </a>
          <p style="color:#6b7280;font-size:13px;margin:0;">
            Este link expira em <strong>1 hora</strong>.<br>
            Se você não solicitou a redefinição, ignore este email — sua senha não será alterada.
          </p>
        </div>
      `,
    });

    return res.json({ message: SUCCESS_MSG });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ error: 'Não foi possível enviar o email. Tente novamente.' });
  }
}

async function resetPassword(req, res) {
  try {
    if (!ensureDatabaseReady(res)) return;
    const token    = String(req.body?.token    || '').trim();
    const password = String(req.body?.password || '');

    if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
    if (password.length < 6)  return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres' });

    const user = await User.findOne({
      resetToken:       token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });

    user.passwordHash      = await bcrypt.hash(password, 10);
    user.resetToken        = null;
    user.resetTokenExpiry  = null;
    await user.save();

    return res.json({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Não foi possível redefinir a senha.' });
  }
}

module.exports = { register, login, me, forgotPassword, resetPassword };
