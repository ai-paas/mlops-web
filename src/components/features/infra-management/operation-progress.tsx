import { useEffect, useState } from 'react';
import { EngineLogPanel } from '@/components/features/infra-management/engine-log-panel';
import { useOperationEvents } from '@/hooks/service/operation-events';
import { useGetOperation, useCancelOperation } from '@/hooks/service/operations';
import type { Operation, OperationState } from '@/types/cluster';

const TERMINAL_STATES: OperationState[] = ['SUCCEEDED', 'FAILED', 'CANCELLED'];

const stateColor = (state?: OperationState): 'run' | 'negative' | 'wait' => {
  if (!state) return 'wait';
  if (state === 'SUCCEEDED') return 'run';
  if (state === 'FAILED' || state === 'CANCELLED') return 'negative';
  return 'wait';
};

interface OperationProgressProps {
  operationId?: string | null;
  /** terminal state 도달 시 호출 */
  onComplete?: (operation: Operation) => void;
  /** SSE 가 끊겼을 때만 쓰는 polling 주기 (ms). 기본 3000 */
  intervalMs?: number;
  /** 취소 버튼 노출 (기본 true) */
  cancellable?: boolean;
}

export const OperationProgress = ({
  operationId,
  onComplete,
  intervalMs = 3000,
  cancellable = true,
}: OperationProgressProps) => {
  // terminal state 에 도달하면 polling 중단
  const [polling, setPolling] = useState(true);
  const { operation: streamed, events, connected } = useOperationEvents(operationId ?? undefined);
  const { operation: polled, isPending } = useGetOperation(operationId ?? undefined, {
    refetchInterval: polling && !connected ? intervalMs : false,
  });
  const operation = streamed ?? polled;
  const { cancelOperation, isPending: isCancelling } = useCancelOperation();

  useEffect(() => {
    if (operation?.state && TERMINAL_STATES.includes(operation.state)) {
      setPolling(false);
      onComplete?.(operation);
    }
  }, [operation, onComplete]);

  if (!operationId) return null;
  if (isPending && !operation) {
    return <div style={{ padding: 12, color: '#666' }}>작업 정보를 불러오는 중입니다...</div>;
  }
  if (!operation) return null;

  const percent = operation.progress?.percent ?? 0;
  const isRunning = operation.state === 'RUNNING' || operation.state === 'PENDING';

  return (
    <div
      style={{
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span className={`table-td-state table-td-state-${stateColor(operation.state)}`}>
          {operation.state ?? '-'}
        </span>
        <span style={{ fontSize: 13, color: '#666' }}>
          {operation.type ?? '-'} · {operation.resourceType} · {operation.resourceId}
        </span>
        {cancellable && isRunning && (
          <button
            type="button"
            onClick={() => operation.id && cancelOperation(operation.id)}
            disabled={isCancelling}
            style={{
              marginLeft: 'auto',
              padding: '4px 12px',
              fontSize: 12,
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {isCancelling ? '취소 중...' : '취소'}
          </button>
        )}
      </div>
      {operation.progress && (
        <>
          <div
            style={{
              height: 8,
              background: '#e5e7eb',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: '100%',
                background: '#3b82f6',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {operation.progress.currentStep ?? '-'}{' '}
            {operation.progress.stepIndex !== undefined &&
              operation.progress.totalSteps !== undefined && (
                <>
                  ({operation.progress.stepIndex}/{operation.progress.totalSteps})
                </>
              )}{' '}
            · {percent}%
          </div>
        </>
      )}
      {operation.errorMessage && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>
          {operation.errorMessage}
        </div>
      )}
      <EngineLogPanel events={events} />
    </div>
  );
};