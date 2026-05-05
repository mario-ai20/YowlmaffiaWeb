import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getInfoState, subscribeToInfoState } from '../utils/infoNotice';
import RichTextContent from './RichTextContent';

const visibleStatuses = new Set(['available']);

export default function InfoNoticeCard({ className = '', compact = false, eyebrow = 'Info' } = {}) {
  const [state, setState] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const initial = await getInfoState();
      if (!cancelled && initial) {
        setState(initial);
      }
    }

    bootstrap();

    const unsubscribe = subscribeToInfoState((nextState) => {
      if (!cancelled) {
        setState(nextState);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const isVisible = visibleStatuses.has(state?.status || 'idle');

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      className={`update-banner panel ${compact ? 'update-banner--compact' : ''} info-banner ${className}`.trim()}
      aria-live="polite"
      style={state?.textColor ? { color: state.textColor } : undefined}
    >
      <div className="panel__header update-banner__header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{state.title}</h2>
        </div>
        <Info size={18} />
      </div>

      <RichTextContent text={state.body} className="update-banner__copy info-banner__copy" />
    </aside>
  );
}
