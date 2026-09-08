import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Button } from '@innogrid/ui';
import { api } from '@/lib/api';
import { useGetKubernetesPodsBySelector } from '@/hooks/service/clusters';

interface WorkloadLogsViewerProps {
  clusterName?: string;
  namespace?: string;
  /** drawer 가 fetch 한 workload resource (spec.selector.matchLabels 로 매칭 pod 검색). */
  workload?: Record<string, unknown>;
  resourceLabel: string;
}

// spec.selector.matchLabels → "k1=v1,k2=v2" K8s labelSelector 형태로 변환.
// matchExpressions 는 본 라운드 미지원 (matchLabels 만).
const buildSelector = (workload: Record<string, unknown> | undefined): string => {
  if (!workload) return '';
  const spec = (workload as { spec?: unknown }).spec;
  if (!spec || typeof spec !== 'object') return '';
  const selector = (spec as { selector?: unknown }).selector;
  if (!selector || typeof selector !== 'object') return '';
  const matchLabels = (selector as { matchLabels?: unknown }).matchLabels;
  if (!matchLabels || typeof matchLabels !== 'object') return '';
  return Object.entries(matchLabels as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
};

export const WorkloadLogsViewer = ({
  clusterName,
  namespace,
  workload,
  resourceLabel,
}: WorkloadLogsViewerProps) => {
  const [tailLines, setTailLines] = useState<number>(100);
  const labelSelector = useMemo(() => buildSelector(workload), [workload]);

  const {
    pods,
    isPending: isPodsPending,
    isError: isPodsError,
    refetch: refetchPods,
  } = useGetKubernetesPodsBySelector(clusterName, namespace, labelSelector, !!labelSelector);

  // 각 pod 의 로그 — useQueries 로 병렬 fetch. pod 추가/삭제 시 자동 sync.
  const logQueries = useQueries({
    queries: pods.map((pod) => {
      const podName = pod.metadata?.name;
      const podNs = pod.metadata?.namespace;
      return {
        queryKey: ['workload-pod-logs', clusterName, podNs, podName, tailLines],
        queryFn: async () => {
          const searchParams: Record<string, string> = {
            clusterName: clusterName ?? '',
            tailLines: String(tailLines),
          };
          if (podNs) searchParams.namespace = podNs;
          const text = await api
            .get(`any-cloud/kubernetes/pods/${encodeURIComponent(podName ?? '')}/logs`, {
              searchParams,
            })
            .text();
          return text;
        },
        enabled: !!clusterName && !!podName,
        retry: 1,
        refetchOnWindowFocus: false,
      };
    }),
  });

  // useQueries 결과는 렌더마다 새 참조라 useMemo 의존성으로 캐시가 되지 않는다
  // (@tanstack/query/no-unstable-deps) — 매 렌더 직접 계산 (pods 수가 적어 비용 무시 가능).
  const merged = (() => {
    const parts: string[] = [];
    for (let i = 0; i < pods.length; i += 1) {
      const podName = pods[i]?.metadata?.name ?? `pod-${i}`;
      const q = logQueries[i];
      if (q?.isPending) {
        parts.push(`[${podName}] (로딩 중...)\n`);
        continue;
      }
      if (q?.isError) {
        parts.push(`[${podName}] (로그 조회 실패)\n`);
        continue;
      }
      const text = (q?.data ?? '') as string;
      if (!text) {
        parts.push(`[${podName}] (로그 없음)\n`);
        continue;
      }
      // 라인별 [pod] prefix. trailing newline 처리.
      const lines = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
      parts.push(lines.map((line) => `[${podName}] ${line}`).join('\n') + '\n');
    }
    return parts.join('');
  })();

  const isAnyFetching = logQueries.some((q) => q.isFetching);
  const isAnyError = logQueries.some((q) => q.isError);

  const refreshAll = () => {
    refetchPods();
    logQueries.forEach((q) => q.refetch());
  };

  if (!workload) {
    return (
      <div style={{ padding: 12, color: '#666' }}>
        리소스 정보를 먼저 불러오는 중입니다...
      </div>
    );
  }

  if (!labelSelector) {
    return (
      <div style={{ padding: 12, color: '#666' }}>
        이 {resourceLabel} 에 <code>spec.selector.matchLabels</code> 가 없어 집계 로그를 표시할 수 없습니다.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <strong>
          {resourceLabel} 집계 로그 — {pods.length}개 pod
        </strong>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>selector: {labelSelector}</span>
        <label style={{ fontSize: 12, color: '#666' }}>
          마지막 N 줄/pod
          <input
            type="number"
            min={10}
            max={5000}
            value={tailLines}
            onChange={(e) => setTailLines(Number(e.target.value) || 100)}
            style={{
              marginLeft: 6,
              width: 70,
              padding: '2px 6px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
            }}
          />
        </label>
        <Button
          size="small"
          color="secondary"
          onClick={refreshAll}
          disabled={isPodsPending || isAnyFetching}
        >
          {isPodsPending || isAnyFetching ? '불러오는 중...' : '새로고침'}
        </Button>
        {isPodsError && (
          <span style={{ fontSize: 12, color: '#dc2626' }}>pod 목록 조회 실패</span>
        )}
        {isAnyError && (
          <span style={{ fontSize: 12, color: '#dc2626' }}>일부 pod 로그 실패</span>
        )}
      </div>
      {!isPodsPending && pods.length === 0 && (
        <div style={{ padding: 12, color: '#666' }}>
          이 selector 로 매칭되는 pod 가 없습니다.
        </div>
      )}
      {pods.length > 0 && (
        <textarea
          readOnly
          value={merged}
          style={{
            width: '100%',
            height: 420,
            padding: 12,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            lineHeight: 1.5,
            background: '#1e1e1e',
            color: '#d4d4d4',
            border: 'none',
            borderRadius: 4,
            resize: 'vertical',
            whiteSpace: 'pre',
          }}
        />
      )}
    </div>
  );
};