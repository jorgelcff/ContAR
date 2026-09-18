import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import Header from '../components/ui/Header';

/**
 * What is collected and how to be rid of it.
 *
 * The app asks strangers at an event for a name and an email, and had nothing
 * anywhere saying what happens to either. Short and specific on purpose: a
 * page nobody finishes reading protects nobody.
 */
export default function PrivacyPage() {
  const { t } = useTranslation();

  const sections = [
    { title: t('privacyWhatTitle'), body: t('privacyWhatBody') },
    { title: t('privacyWhyTitle'), body: t('privacyWhyBody') },
    { title: t('privacyThirdPartyTitle'), body: t('privacyThirdPartyBody') },
    { title: t('privacyKeepTitle'), body: t('privacyKeepBody') },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-gray-900 text-white">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6">
        <h1 className="text-xl font-bold">{t('privacyTitle')}</h1>
        <p className="mt-2 text-sm text-gray-400">{t('privacyIntro')}</p>

        <div className="mt-6 flex flex-col gap-5">
          {sections.map(({ title, body }) => (
            <section key={title}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-300">{body}</p>
            </section>
          ))}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
              {t('privacyDeleteTitle')}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
              <Trans
                i18nKey="privacyDeleteBody"
                components={{
                  account: <Link to="/account" className="font-medium text-cyan-300 underline-offset-4 hover:underline" />,
                }}
              />
            </p>
          </section>
        </div>

        <p className="mt-8 border-t border-gray-800 pt-4 text-xs text-gray-500">{t('privacyContact')}</p>
      </main>
    </div>
  );
}
