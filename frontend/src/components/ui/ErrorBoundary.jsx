import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

/**
 * Stops one broken thing from taking the whole page with it.
 *
 * There was no boundary anywhere, so any exception thrown while rendering
 * unmounted the entire tree and left a white page — no message, no way back
 * short of the browser's reload button. That is a bad outcome generally and a
 * particularly bad one here: people arrive with avatars nobody has tested, and
 * a malformed rig throwing inside the canvas used to take the editor with it.
 *
 * Two levels are in use. One around the routes catches anything at all; one
 * around the 3D canvas keeps a bad model local to the canvas, so the panels,
 * the text and the save button all survive and the scene can be fixed.
 */
function Fallback({ compact, onRetry, error }) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 p-6 text-center ${
        compact ? 'h-full bg-gray-900' : 'min-h-dvh bg-gray-900'
      }`}
    >
      <Icon name="warning" className="h-8 w-8 text-amber-400" />
      <div>
        <p className="text-sm font-semibold text-white">
          {compact ? t('errorBoundaryCanvasTitle') : t('errorBoundaryTitle')}
        </p>
        <p className="mt-1 max-w-sm text-xs text-gray-400">
          {compact ? t('errorBoundaryCanvasBody') : t('errorBoundaryBody')}
        </p>
      </div>

      {/* The message itself, for the person who can act on it — kept small and
          out of the way rather than hidden, since "something went wrong" with
          no detail is the least useful thing an error screen can say. */}
      {error?.message && (
        <code className="max-w-full overflow-x-auto rounded bg-gray-950 px-2 py-1 text-[11px] text-gray-500">
          {String(error.message).slice(0, 200)}
        </code>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={onRetry}
          className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-600"
        >
          {t('errorBoundaryRetry')}
        </button>
        {!compact && (
          <a
            href="/"
            className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-800"
          >
            {t('errorBoundaryHome')}
          </a>
        )}
      </div>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // The console is where this is diagnosed — a boundary that swallows the
    // stack trades a white page for a silent one.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // A boundary that latches would keep showing the old failure after the
    // thing that failed has been replaced — load a different avatar and the
    // canvas should get another chance without a reload.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Fallback
          compact={this.props.compact}
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
