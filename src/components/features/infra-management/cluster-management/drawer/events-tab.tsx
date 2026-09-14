import { useMemo } from 'react';
import { Button } from '@innogrid/ui';
import { useGetKubernetesEvents } from '@/hooks/service/clusters';

interface EventsTabProps {
  clusterName?: string;
  resourceType: string;
  resourceName?: string;
  namespace?: string;
  enabled: boolean;
}

interface K8sEvent {
  type?: string;
  reason?: string;
  message?: string;
  count?: number;
  lastTimestamp?: string;
  eventTime?: string;
  firstTimestamp?: string;
  source?: { component?: string; host?: string };
  reportingComponent?: string;
}

const TYPE_COLOR: Record<string, string> = {
  Normal: 'bg-[#dcfce7] text-[#166534]',
  Warning: 'bg-[#fef3c7] text-[#92400e]',
};

const pickTimestamp = (e: K8sEvent): string => e.lastTimestamp || e.eventTime || e.firstTimestamp || '';

export const EventsTab = ({ clusterName, resourceType, resourceName, namespace, enabled }: EventsTabProps) => {
  const { events, isPending, isError, isFetching, refetch } = useGetKubernetesEvents(
    resourceType,
    resourceName,
    clusterName,
    namespace,
    enabled
  );

  const sorted = useMemo(() => {
    const safe = Array.isArray(events) ? (events as K8sEvent[]) : [];
    const list = safe.slice();
    list.sort((a, b) => {
      const ta = pickTimestamp(a);
      const tb = pickTimestamp(b);
      return tb.localeCompare(ta);
    });
    return list;
  }, [events]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button
          size="small"
          color="secondary"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? '조회 중...' : '새로고침'}
        </Button>
      </div>
      {isPending && (
        <div className="py-6 text-center text-[13px] text-[#6b7280]">이벤트를 불러오는 중입니다...</div>
      )}
      {isError && (
        <div className="py-6 text-center text-[13px] text-[#b91c1c]">이벤트를 불러올 수 없습니다.</div>
      )}
      {!isPending && !isError && sorted.length === 0 && (
        <div className="py-6 text-center text-[13px] text-[#6b7280]">
          <div>이 리소스에 대한 최근 이벤트가 없습니다.</div>
          <div className="mt-1 text-[12px] text-[#9ca3af]">
            K8s 기본 event TTL 은 1시간 — 최근 발생한 이벤트만 표시됩니다.
          </div>
        </div>
      )}
      {!isPending && !isError && sorted.length > 0 && (
        <div className="overflow-hidden rounded-md border border-[#e5e7eb]">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-[#fafafa] text-[#6b7280]">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">시각</th>
                <th className="px-2 py-1.5 text-left font-medium">타입</th>
                <th className="px-2 py-1.5 text-left font-medium">이유</th>
                <th className="px-2 py-1.5 text-left font-medium">메시지</th>
                <th className="px-2 py-1.5 text-right font-medium">횟수</th>
                <th className="px-2 py-1.5 text-left font-medium">출처</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const t = e.type ?? '';
                const colorClass = TYPE_COLOR[t] ?? 'bg-[#f3f4f6] text-[#374151]';
                const src = e.source?.component || e.reportingComponent || '-';
                return (
                  <tr key={i} className="border-t border-[#f0f0f0] align-top">
                    <td className="px-2 py-1.5 font-mono text-[11px] text-[#1f2937]">
                      {pickTimestamp(e) || '-'}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${colorClass}`}>
                        {t || '-'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[#1f2937]">{e.reason ?? '-'}</td>
                    <td className="px-2 py-1.5 whitespace-pre-wrap text-[#1f2937]">{e.message ?? '-'}</td>
                    <td className="px-2 py-1.5 text-right text-[#374151]">{e.count ?? 1}</td>
                    <td className="px-2 py-1.5 text-[#6b7280]">{src}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};