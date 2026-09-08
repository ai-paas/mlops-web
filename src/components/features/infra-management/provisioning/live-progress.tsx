import { EngineLogPanel } from '@/components/features/infra-management/engine-log-panel';
import { useOperationEvents } from '@/hooks/service/operation-events';
import { useActiveClusterOperation } from '@/hooks/service/operations';

interface LiveProgressProps {
  clusterName?: string;
  /** 진행 중 operation 이 없을 때 쓸 마지막 기록값. */
  fallbackPercent?: number;
  fallbackStep?: string;
}

export const LiveProgress = ({ clusterName, fallbackPercent, fallbackStep }: LiveProgressProps) => {
  const { operationId } = useActiveClusterOperation(clusterName);
  const { operation, events, connected } = useOperationEvents(operationId);

  const percent = operation?.progress?.percent ?? fallbackPercent ?? 0;
  const step = operation?.progress?.currentStep ?? fallbackStep;
  const state = operation?.state;

  if (!operationId && fallbackPercent === undefined) return null;

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        padding: '12px 14px',
        marginBottom: 16,
        background: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{step ?? '진행 상황'}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{percent}%</span>
        {state && <span style={{ fontSize: 11, color: '#6b7280' }}>· {state}</span>}
        {operationId && (
          <span
            style={{ marginLeft: 'auto', fontSize: 11, color: connected ? '#059669' : '#9ca3af' }}
            title={connected ? '실시간 연결됨' : '연결 대기 중 — 값은 마지막 수신 기준'}
          >
            {connected ? '실시간' : '연결 대기'}
          </span>
        )}
      </div>

      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(Math.max(percent, 0), 100)}%`,
            height: '100%',
            background: state === 'FAILED' ? '#dc2626' : '#3b82f6',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <EngineLogPanel events={events} />
    </div>
  );
};