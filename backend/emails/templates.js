/**
 * Email copy per language.
 *
 * Both messages used to be hardcoded Portuguese, so someone whose browser put
 * the app in English — which it does automatically — still got a Portuguese
 * mail asking them to confirm an address. Since confirming is what unlocks
 * publishing, that is a dead end for anyone who does not read Portuguese.
 *
 * The set matches the languages the interface itself offers; anything else
 * falls back to English, which a visitor at an international event is far more
 * likely to read than Portuguese.
 */
const SUPPORTED = ['pt', 'en', 'es', 'fr'];
const FALLBACK = 'en';

function pick(language) {
  const lang = String(language || '').split('-')[0].toLowerCase();
  return SUPPORTED.includes(lang) ? lang : FALLBACK;
}

function shell(bodyHtml) {
  return `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#111827;color:#f9fafb;border-radius:16px;">
${bodyHtml}
      </div>
    `;
}

function button(href, label) {
  return `<a href="${href}" style="background:#0891b2;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:600;margin-bottom:24px;">
          ${label}
        </a>`;
}

const VERIFY = {
  pt: {
    subject: 'Confirme seu email — ContAR',
    heading: 'Bem-vindo ao ContAR!',
    lead: 'Confirme seu email para ativar sua conta e ter acesso completo à plataforma.',
    cta: 'Confirmar meu email',
    footer: 'Se você não criou uma conta no ContAR, ignore este email.',
  },
  en: {
    subject: 'Confirm your email — ContAR',
    heading: 'Welcome to ContAR!',
    lead: 'Confirm your email to activate your account and unlock the full platform.',
    cta: 'Confirm my email',
    footer: "If you didn't create a ContAR account, you can ignore this email.",
  },
  es: {
    subject: 'Confirma tu correo — ContAR',
    heading: '¡Bienvenido a ContAR!',
    lead: 'Confirma tu correo para activar tu cuenta y acceder a toda la plataforma.',
    cta: 'Confirmar mi correo',
    footer: 'Si no creaste una cuenta en ContAR, ignora este correo.',
  },
  fr: {
    subject: 'Confirmez votre e-mail — ContAR',
    heading: 'Bienvenue sur ContAR !',
    lead: 'Confirmez votre e-mail pour activer votre compte et accéder à toute la plateforme.',
    cta: 'Confirmer mon e-mail',
    footer: "Si vous n'avez pas créé de compte ContAR, ignorez cet e-mail.",
  },
};

const RESET = {
  pt: {
    subject: 'Redefinir senha — ContAR',
    heading: 'Redefinir senha',
    lead: 'Você solicitou a redefinição de senha da sua conta ContAR.',
    cta: 'Redefinir minha senha',
    footer: 'Se você não solicitou a redefinição, ignore este email — sua senha não será alterada.',
  },
  en: {
    subject: 'Reset your password — ContAR',
    heading: 'Reset your password',
    lead: 'You asked to reset the password on your ContAR account.',
    cta: 'Reset my password',
    footer: "If you didn't request this, ignore this email — your password stays as it is.",
  },
  es: {
    subject: 'Restablecer contraseña — ContAR',
    heading: 'Restablecer contraseña',
    lead: 'Solicitaste restablecer la contraseña de tu cuenta de ContAR.',
    cta: 'Restablecer mi contraseña',
    footer: 'Si no lo solicitaste, ignora este correo — tu contraseña no cambiará.',
  },
  fr: {
    subject: 'Réinitialiser le mot de passe — ContAR',
    heading: 'Réinitialiser le mot de passe',
    lead: 'Vous avez demandé à réinitialiser le mot de passe de votre compte ContAR.',
    cta: 'Réinitialiser mon mot de passe',
    footer: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe reste inchangé.",
  },
};

function render(copy, link) {
  return {
    subject: copy.subject,
    html: shell(`        <h2 style="margin:0 0 8px;color:#22d3ee;">${copy.heading}</h2>
        <p style="color:#9ca3af;margin:0 0 24px;">${copy.lead}</p>
        ${button(link, copy.cta)}
        <p style="color:#6b7280;font-size:13px;margin:0;">${copy.footer}</p>`),
  };
}

const verificationEmail = (language, link) => render(VERIFY[pick(language)], link);
const passwordResetEmail = (language, link) => render(RESET[pick(language)], link);

module.exports = { verificationEmail, passwordResetEmail, SUPPORTED, FALLBACK };
