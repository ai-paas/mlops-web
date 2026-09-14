import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Operation, OperationState } from '../../types/cluster';

interface ListOperationsParams {
  state?: OperationState;
  type?: string;
  resourceType?: string;
  resourceId?: string;
  pageSize?: number;
}

// backend 응답 envelope 다중 형태:
//   1) {data: [...]} — flat array
//   2) {data: {items: [...], nextPageToken}} — PagedData wrapper (현재 backend)
//   3) {items: [...]} — 일부 legacy
//   4) [...] — raw array
const unwrapOperations = (payload: unknown): Operation[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Operation[];
  if (typeof payload !== 'object') return [];

  const envelope = payload as { data?: unknown; items?: unknown };
  if (Array.isArray(envelope.data)) return envelope.data as Operation[];
  if (envelope.data && typeof envelope.data === 'object' && 'items' in envelope.data) {
    const items = (envelope.data as { items?: Operation[] }).items;
    return items ?? [];
  }
  if (Array.isArray(envelope.items)) return envelope.items as Operation[];
  return [];
};

// 작업 목록 조회
export const useGetOperations = (params: ListOperationsParams = {}) => {
  const searchParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );

  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.operations.list(searchParams),
    queryFn: () => api.get('any-cloud/operations', { searchParams }).json<unknown>(),
  });

  return { operations: unwrapOperations(data), isPending, isError, error };
};

// 작업 단건 조회 (polling 시 refetchInterval 활용)
export const useGetOperation = (
  operationId?: string,
  options?: { refetchInterval?: number | false; enabled?: boolean }
) => {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.operations.detail(operationId),
    queryFn: () => api.get(`any-cloud/operations/${operationId}`).json<Operation>(),
    enabled: (options?.enabled ?? true) && !!operationId,
    refetchInterval: options?.refetchInterval,
  });

  return { operation: data, isPending, isError, error, refetch };
};

/** 백엔드가 VM 클러스터 operation 을 이 resourceType 으로 기록한다. */
const CLUSTER_RESOURCE_TYPE = 'cluster';

/** SSE 구독 대상 id 조회 — 진행률 자체는 SSE 가 나른다. */
export const useActiveClusterOperation = (
  clusterName?: string,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) => {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.operations.list({
      resourceType: CLUSTER_RESOURCE_TYPE,
      resourceId: clusterName,
      active: true,
    }),
    queryFn: () =>
      api
        .get('any-cloud/operations', {
          searchParams: {
            resourceType: CLUSTER_RESOURCE_TYPE,
            resourceId: clusterName ?? '',
            pageSize: 5,
          },
        })
        .json<unknown>(),
    enabled: (options?.enabled ?? true) && !!clusterName,
    refetchInterval: options?.refetchInterval ?? 10_000,
  });

  const active = unwrapOperations(data).find(
    (op) => op.state === 'PENDING' || op.state === 'RUNNING'
  );

  return { operation: active, operationId: active?.id, isPending };
};

// 진행 중 작업 취소
export const useCancelOperation = (options?: {
  onSuccess?: (op: Operation) => void;
  onError?: (error: unknown) => void;
}) => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, isSuccess, error } = useMutation({
    mutationKey: ['cancelOperation'],
    mutationFn: (operationId: string) =>
      api.post(`any-cloud/operations/${operationId}/cancel`).json<Operation>(),
    onSuccess: (op) => {
      // all 무효화가 list/detail 을 모두 커버 (detail 은 all 하위 prefix)
      queryClient.invalidateQueries({ queryKey: queryKeys.operations.all });
      options?.onSuccess?.(op);
    },
    onError: (err) => options?.onError?.(err),
  });

  return { cancelOperation: mutate, isPending, isError, isSuccess, error };
};
