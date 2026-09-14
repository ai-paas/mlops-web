import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { subscribeSse } from '@/lib/sse';
import type { Operation, ProvisionEvent } from '@/types/cluster';

/** 백엔드가 terminal state 를 이벤트 이름으로 내려준다 (OperationState 소문자). */
const TERMINAL_EVENTS = new Set(['succeeded', 'failed', 'cancelled']);

/** 무한 누적은 20~30분짜리 프로비저닝에서 탭을 죽인다. */
const DEFAULT_MAX_LOGS = 500;

export interface UseOperationEventsOptions {
  enabled?: boolean;
  maxLogs?: number;
}

const parse = <T>(data: string): T | null => {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

/** 한 스트림에 `progress` (Operation 스냅샷) 와 `pulumi` (엔진 원시 이벤트) 가 섞여 온다. */
export const useOperationEvents = (operationId?: string, options?: UseOperationEventsOptions) => {
  const { enabled = true, maxLogs = DEFAULT_MAX_LOGS } = options ?? {};
  const queryClient = useQueryClient();

  const [operation, setOperation] = useState<Operation | undefined>();
  const [events, setEvents] = useState<ProvisionEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<unknown>();

  // deps 에 넣으면 이벤트마다 재구독한다
  const maxLogsRef = useRef(maxLogs);
  maxLogsRef.current = maxLogs;

  const reset = useCallback(() => {
    setOperation(undefined);
    setEvents([]);
    setError(undefined);
  }, []);

  useEffect(() => {
    if (!enabled || !operationId) return;

    const controller = new AbortController();
    reset();

    void subscribeSse(`any-cloud/operations/${operationId}/events`, {
      signal: controller.signal,
      onOpen: () => {
        setConnected(true);
        setError(undefined);
      },
      onClose: () => setConnected(false),
      onError: (err) => {
        setConnected(false);
        setError(err);
      },
      onMessage: ({ event, data }) => {
        if (event === 'not-found') {
          controller.abort();
          return;
        }

        if (event === 'pulumi') {
          const provisionEvent = parse<ProvisionEvent>(data);
          if (!provisionEvent) return;
          setEvents((prev) => {
            const next = [...prev, provisionEvent];
            return next.length > maxLogsRef.current ? next.slice(-maxLogsRef.current) : next;
          });
          return;
        }

        const snapshot = parse<Operation>(data);
        if (!snapshot) return;
        setOperation(snapshot);
        queryClient.setQueryData(queryKeys.operations.detail(operationId), snapshot);

        if (TERMINAL_EVENTS.has(event)) {
          queryClient.invalidateQueries({ queryKey: queryKeys.operations.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.clusters.all });
        }
      },
    });

    return () => {
      controller.abort();
      setConnected(false);
    };
  }, [enabled, operationId, queryClient, reset]);

  return { operation, events, connected, error };
};
