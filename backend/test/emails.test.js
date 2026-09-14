const { verificationEmail, passwordResetEmail, SUPPORTED, FALLBACK } = require('../emails/templates');

// Both mails were hardcoded Portuguese. Since confirming the address is what
// unlocks publishing, an English-speaking visitor at the conference received a
// Portuguese dead end. These pin the language choice, including the cases that
// actually reach the server: a region tag ("pt-BR"), a language the interface
// does not carry ("de"), and no hint at all.
describe('email language', () => {
  for (const send of [verificationEmail, passwordResetEmail]) {
    const kind = send === verificationEmail ? 'verification' : 'password reset';

    it(`${kind}: writes in each language the interface offers`, () => {
      const subjects = SUPPORTED.map((lang) => send(lang, 'https://x').subject);
      expect(new Set(subjects).size, 'every language needs its own copy').toBe(SUPPORTED.length);
    });

    it(`${kind}: ignores the region tag`, () => {
      expect(send('pt-BR', 'https://x').subject).toBe(send('pt', 'https://x').subject);
      expect(send('EN-gb', 'https://x').subject).toBe(send('en', 'https://x').subject);
    });

    it(`${kind}: falls back to English, not Portuguese, for anything else`, () => {
      const english = send(FALLBACK, 'https://x').subject;
      for (const unknown of ['de', 'ja', 'it', '', null, undefined]) {
        expect(send(unknown, 'https://x').subject, `${unknown} should fall back`).toBe(english);
      }
    });

    it(`${kind}: carries the link through`, () => {
      for (const lang of [...SUPPORTED, 'de']) {
        expect(send(lang, 'https://contar.app/verify?token=abc').html)
          .toContain('https://contar.app/verify?token=abc');
      }
    });
  }
});
