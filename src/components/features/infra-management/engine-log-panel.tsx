import { useMemo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ProvisionEvent } from '@/types/cluster';

const SEVERITY_COLOR: Record<string, string> = {
  error: '#dc2626',
  warning: '#b45309',
  info: '#d1d5db',
};

const LOG_MAX_HEIGHT = 240;

const formatTime = (timestamp?: string): string => {
  if (!timestamp) return '';
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleTimeString();
};

const describe = (event: ProvisionEvent): string =>
  event.message?.trim() || event.resourceUrn || event.type || '';

interface EngineLogPanelProps {
  events: ProvisionEvent[];
}

export const EngineLogPanel = ({ events }: EngineLogPanelProps) => {
  const [open, setOpen] = useState(false);

  const visible = useMemo(() => events.filter((event) => describe(event).length > 0), [events]);

  if (visible.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        style={{
          marginTop: 10,
          fontSize: 12,
          color: '#4b5563',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {open ? '▾' : '▸'} 엔진 로그 {visible.length}건
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          style={{
            marginTop: 8,
            maxHeight: LOG_MAX_HEIGHT,
            overflowY: 'auto',
            background: '#111827',
            borderRadius: 4,
            padding: 10,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          {visible.map((event, index) => (
            <div
              // 안정적인 식별자 없음 — append-only 라 index 가 안전
              key={index}
              style={{ color: SEVERITY_COLOR[event.severity ?? 'info'] ?? '#d1d5db' }}
            >
              <span style={{ color: '#6b7280', marginRight: 8 }}>
                {formatTime(event.timestamp)}
              </span>
              {describe(event)}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};