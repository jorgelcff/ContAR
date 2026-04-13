import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AvaturnSDK } from '@avaturn/sdk';
import {
  AVATURN_LAST_SESSION_TOKEN_KEY,
  AVATURN_LAST_SESSION_URL_KEY,
  createAvaturnSession,
} from '../../api/sceneApi';

const AVATURN_USER_ID_KEY = 'avaturn:userId';

function getConfiguredAvaturnUserId() {
  return String(import.meta.env.VITE_AVATURN_USER_ID || '').trim();
}

function getDirectAvaturnUrl() {
  const directUrl = String(import.meta.env.VITE_AVATURN_DIRECT_URL || '').trim();
  if (isHttpUrl(directUrl)) {
    return directUrl.replace(/\/+$/, '');
  }

  const subdomainRaw = String(import.meta.env.VITE_AVATURN_SUBDOMAIN || '').trim();
  if (!subdomainRaw) return '';

  const subdomain = subdomainRaw
    .replace(/^https?:\/\//i, '')
    .replace(/\.avaturn\.dev.*$/i, '')
    .trim();

  if (!subdomain) return '';
  return `https://${subdomain}.avaturn.dev`;
}

function extractSessionToken(sessionUrl) {
  if (!isHttpUrl(sessionUrl)) return '';

  try {
    const url = new URL(sessionUrl);
    return (
      url.searchParams.get('token') ||
      url.searchParams.get('session_token') ||
      url.searchParams.get('sessionToken') ||
      ''
    );
  } catch {
    return '';
  }
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function extractAvatarUrl(payload) {
  if (!payload) return '';

  if (typeof payload === 'string') {
    return isHttpUrl(payload) ? payload.trim() : '';
  }

  const direct = [
    payload.url,
    payload.modelUrl,
    payload.glbUrl,
    payload.glb,
    payload.avatarUrl,
    payload.model,
  ].find((candidate) => isHttpUrl(candidate));

  if (direct) return direct.trim();

  const nested = [
    payload.data,
    payload.payload,
    payload.result,
    payload.avatar,
    payload.export,
    payload.detail,
  ];

  for (const item of nested) {
    const found = extractAvatarUrl(item);
    if (found) return found;
  }

  return '';
}

function extractAvaturnUserId(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const direct = [
    payload.userId,
    payload.user_id,
    payload.avaturnUserId,
    payload.id,
  ].find((candidate) => typeof candidate === 'string' && candidate.trim());

  if (direct) return direct.trim();

  const nested = [
    payload.data,
    payload.payload,
    payload.result,
    payload.user,
    payload.avatar,
    payload.detail,
  ];

  for (const item of nested) {
    const found = extractAvaturnUserId(item);
    if (found) return found;
  }

  return '';
}

/**
 * AvaturnEmbed — inline iframe that lets users build their avatar
 * on demo.avaturn.dev and captures the exported GLB URL.
 *
 * Props:
 *   onExport(url) – called when Avaturn exports a GLB
 *   onClose()     – called when the user dismisses the panel
 */
export default function AvaturnEmbed({ onExport, onClose }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const sdkRef = useRef(null);
  const onExportRef = useRef(onExport);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    onExportRef.current = onExport;
  }, [onExport]);

  React.useEffect(() => {
    let active = true;
    const containerEl = containerRef.current;

    const handleExport = (data) => {
      const maybeUserId = extractAvaturnUserId(data);
      if (maybeUserId) {
        localStorage.setItem(AVATURN_USER_ID_KEY, maybeUserId);
      }

      const avatarUrl = extractAvatarUrl(data);
      if (avatarUrl) {
        setError('');
        onExportRef.current?.(avatarUrl);
        return;
      }

      console.warn('Avaturn export event without a valid GLB URL:', data);
      setError('Avatar export completed, but no valid GLB URL was found in payload.');
    };

    const handleWindowMessage = (event) => {
      if (!String(event?.origin || '').includes('avaturn.dev')) return;

      const message = event?.data;
      const maybeUserId = extractAvaturnUserId(message);
      if (maybeUserId) {
        localStorage.setItem(AVATURN_USER_ID_KEY, maybeUserId);
      }

      const eventType = String(message?.event || message?.type || '').toLowerCase();
      const seemsExportEvent = eventType.includes('export') || Boolean(extractAvatarUrl(message));

      if (seemsExportEvent) {
        handleExport(message);
      }
    };

    window.addEventListener('message', handleWindowMessage);

    async function initSdk() {
      if (!containerEl) return;

      try {
        const directUrl = getDirectAvaturnUrl();
        const disableBackendFallback =
          String(import.meta.env.VITE_AVATURN_DISABLE_BACKEND_FALLBACK || '').toLowerCase() === 'true';
        const configuredUserId = getConfiguredAvaturnUserId();
        if (configuredUserId) {
          localStorage.setItem(AVATURN_USER_ID_KEY, configuredUserId);
        }
        const initWithUrl = async (url, mode) => {
          localStorage.setItem(AVATURN_LAST_SESSION_URL_KEY, url);
          const sessionToken = extractSessionToken(url);
          if (sessionToken) {
            localStorage.setItem(AVATURN_LAST_SESSION_TOKEN_KEY, sessionToken);
          } else {
            localStorage.removeItem(AVATURN_LAST_SESSION_TOKEN_KEY);
          }

          const sdk = new AvaturnSDK();
          sdkRef.current = sdk;
          await sdk.init(containerEl, { url });
          if (!active) return;

          console.info('[Avaturn] SDK initialized successfully.', { mode });
          sdk.on('export', handleExport);
          setReady(true);
        };

        if (directUrl) {
          console.info('[Avaturn] Trying direct Web SDK mode with frontend URL/subdomain.', {
            directUrl,
          });
          try {
            await initWithUrl(directUrl, 'direct');
            return;
          } catch (directErr) {
            console.error('[Avaturn] Direct mode failed on first attempt. Falling back to backend session endpoint.', directErr);
            if (disableBackendFallback) {
              throw new Error('Direct mode failed and backend fallback is disabled by VITE_AVATURN_DISABLE_BACKEND_FALLBACK=true.');
            }
          }
        } else {
          console.info('[Avaturn] Direct mode not configured. Falling back to backend session endpoint.');
          if (disableBackendFallback) {
            throw new Error('Direct mode is not configured and backend fallback is disabled by VITE_AVATURN_DISABLE_BACKEND_FALLBACK=true.');
          }
        }

        const storedUserId = localStorage.getItem(AVATURN_USER_ID_KEY) || '';
        const session = await createAvaturnSession({
          avaturnUserId: storedUserId,
          sessionType: 'create_or_edit_existing',
        });

        const sessionUrl = session?.sessionUrl;
        const responseUserId = session?.avaturnUserId;

        if (responseUserId) {
          localStorage.setItem(AVATURN_USER_ID_KEY, responseUserId);
        }

        if (!sessionUrl) {
          throw new Error('Backend did not return Avaturn session URL.');
        }

        console.info('[Avaturn] Backend fallback succeeded and returned a session URL.');
        await initWithUrl(sessionUrl, 'backend-fallback');
      } catch (err) {
        console.error('[Avaturn] SDK init error. First attempt failed; if fallback is configured, check logs above.', err);
        if (active) {
          const backendError = err?.response?.data?.error;
          setError(backendError || err?.message || 'Failed to initialize Avaturn SDK.');
        }
      }
    }

    initSdk();

    return () => {
      active = false;
      window.removeEventListener('message', handleWindowMessage);
      sdkRef.current = null;
      if (containerEl) {
        containerEl.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-xl overflow-hidden border border-gray-600" style={{ height: 480 }}>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-400 text-sm">
            Loading Avaturn…
          </div>
        )}
        {error && (
          <div className="absolute bottom-2 left-2 right-2 rounded-md border border-red-600 bg-red-950/90 px-2 py-1 text-xs text-red-200 z-10">
            {error}
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
      <button
        onClick={onClose}
        className="text-sm text-gray-400 hover:text-white transition-colors text-center"
      >
        {t('closeAvaturn')}
      </button>
    </div>
  );
}
