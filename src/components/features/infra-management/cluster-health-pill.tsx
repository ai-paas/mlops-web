import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@innogrid/ui';
import { useGetClusterHealth } from '@/hooks/service/clusters';

interface ClusterHealthPillProps {
  clusterName?: string;
}

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | string;

const statusColor = (status?: HealthStatus): 'run' | 'negative' | 'wait' => {
  if (!status) return 'wait';
  const up = String(status).toUpperCase();
  if (up === 'HEALTHY' || up === 'OK' || up === 'READY' || up === 'UP' || up === 'ACTIVE') {
    return 'run';
  }
  if (up === 'UNHEALTHY' || up === 'FAILED' || up === 'CRITICAL' || up === 'DOWN') {
    return 'negative';
  }
  return 'wait';
};

// 상태 문자열 한글화 — backend 가 영문 상수로 내려보내므로 표시 단계에서만 매핑
const STATUS_KO: Record<string, string> = {
  HEALTHY: '정상',
  OK: '정상',
  READY: '정상',
  UP: '정상',
  ACTIVE: '활성',
  UNHEALTHY: '비정상',
  FAILED: '실패',
  CRITICAL: '심각',
  DOWN: '중단',
  DEGRADED: '저하',
  PENDING: '대기',
  INACTIVE: '비활성',
};

const localizeStatus = (status?: string): string => {
  if (!status) return '-';
  const up = String(status).toUpperCase();
  return STATUS_KO[up] ?? String(status);
};

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const isUp = (status?: string): boolean => {
  if (!status) return false;
  const up = status.toUpperCase();
  return up === 'HEALTHY' || up === 'OK' || up === 'READY' || up === 'UP' || up === 'ACTIVE';
};

export const ClusterHealthPill = ({ clusterName }: ClusterHealthPillProps) => {
  const { health, isPending, isError, refetch, isFetching } = useGetClusterHealth(clusterName);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 / ESC 로 닫기 — popover 일반 패턴
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const { status, entries, summary, factEntries } = useMemo(() => {
    const h = health as Record<string, unknown> | undefined;
    const explicitStatus = h?.status as HealthStatus | undefined;
    const healthy = h?.healthy as boolean | undefined;
    const agentStatus = h?.agentStatus as string | undefined;
    const summaryText = h?.summary as string | undefined;

    // backend 가 `status` 를 명시하면 우선, 없으면 `healthy` boolean 또는 `agentStatus` 로 파생
    const s: HealthStatus | undefined =
      explicitStatus ??
      (healthy === true ? 'HEALTHY' : healthy === false ? 'UNHEALTHY' : agentStatus);

    // per-check 응답인 경우 — 기존 표 표시
    const checks = h?.checks as Record<string, unknown> | undefined;
    const ents = checks && typeof checks === 'object' ? Object.entries(checks) : [];
    let passing = 0;
    let failing = 0;
    for (const [, v] of ents) {
      const cs =
        v && typeof v === 'object' ? ((v as Record<string, unknown>).status as string) : undefined;
      if (isUp(cs)) passing += 1;
      else failing += 1;
    }

    // pill 의 부가 텍스트 — summary 문자열 > check 카운트 > 없음
    let sum: string;
    if (summaryText) sum = String(summaryText);
    else if (ents.length === 0) sum = '';
    else if (failing === 0) sum = `${passing}/${ents.length}`;
    else sum = `${failing} failing`;

    // checks 가 없을 때 popover 본문에 깔끔하게 보여줄 fact 리스트
    // — health 응답에서 의미 있는 flat 필드 추출 (값이 있는 항목만), 한글 라벨/값
    const factOrder: Array<[label: string, key: string]> = [
      ['에이전트 상태', 'agentStatus'],
      ['스트림 연결', 'streamActive'],
      ['마지막 응답', 'lastSeenSecondsAgo'],
      ['K8s API 마지막 응답', 'lastK8sApiOkAt'],
      ['마지막 확인 시각', 'lastSeenAt'],
      ['요약', 'summary'],
      ['클러스터 ID', 'clusterId'],
    ];
    const facts: Array<[string, string]> = [];
    for (const [label, key] of factOrder) {
      const raw = h?.[key];
      if (raw === undefined || raw === null) continue;
      if (key === 'lastSeenSecondsAgo' && typeof raw === 'number') {
        facts.push([label, `${raw}초 전`]);
      } else if (key === 'agentStatus' && typeof raw === 'string') {
        facts.push([label, localizeStatus(raw)]);
      } else if (typeof raw === 'boolean') {
        facts.push([label, raw ? '예' : '아니오']);
      } else {
        facts.push([label, String(raw)]);
      }
    }

    return { status: s, entries: ents, summary: sum, factEntries: facts };
  }, [health]);

  if (!clusterName) return null;

  const color = statusColor(status);
  const pillColor =
    color === 'run'
      ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7]'
      : color === 'negative'
        ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2]'
        : 'border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280] hover:bg-[#f3f4f6]';
  const dotColor =
    color === 'run' ? 'bg-[#16a34a]' : color === 'negative' ? 'bg-[#dc2626]' : 'bg-[#9ca3af]';

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={summary ? `클러스터 Health — ${summary}` : '클러스터 Health 상세'}
        className={[
          'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
          pillColor,
        ].join(' ')}
      >
        <span className={['h-1.5 w-1.5 rounded-full', dotColor].join(' ')} aria-hidden />
        <span>Health · {isPending ? '...' : localizeStatus(status)}</span>
        <svg
          className={['ml-0.5 h-3 w-3 transition-transform', open ? 'rotate-180' : ''].join(' ')}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="클러스터 health 상세"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-[420px] rounded-lg border border-[#e5e7eb] bg-white shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-[#f0f0f0] px-4 py-3">
            <strong className="text-[13px] text-[#1f2937]">클러스터 Health</strong>
            {status && (
              <span className={`table-td-state table-td-state-${color}`}>
                {localizeStatus(status)}
              </span>
            )}
            <div className="ml-auto">
              <Button
                size="small"
                color="secondary"
                onClick={() => refetch()}
                disabled={isFetching}
                title="health 정보 다시 조회"
              >
                {isFetching ? '조회 중...' : '새로고침'}
              </Button>
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto px-4 py-3">
            {isPending && (
              <div className="py-2 text-[12px] text-[#6b7280]">
                Health 정보를 불러오는 중입니다...
              </div>
            )}
            {isError && (
              <div className="py-2 text-[12px] text-[#b91c1c]">
                Health 정보를 불러올 수 없습니다.
              </div>
            )}
            {!isPending && !isError && health && (
              <>
                {entries.length > 0 ? (
                  <ul className="m-0 list-none p-0">
                    {entries.map(([key, value]) => {
                      const v = value as
                        | Record<string, unknown>
                        | string
                        | number
                        | boolean
                        | null;
                      const itemStatus =
                        v && typeof v === 'object'
                          ? ((v as Record<string, unknown>).status as string | undefined)
                          : undefined;
                      return (
                        <li
                          key={key}
                          className="grid grid-cols-[1fr_90px] items-center gap-2 border-b border-[#f5f5f5] py-1.5 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-medium text-[#374151]">
                              {key}
                            </div>
                            <div className="truncate text-[11px] text-[#9ca3af]">
                              {renderValue(v)}
                            </div>
                          </div>
                          <div className="justify-self-end">
                            {itemStatus && (
                              <span
                                className={`table-td-state table-td-state-${statusColor(itemStatus)}`}
                              >
                                {localizeStatus(itemStatus)}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : factEntries.length > 0 ? (
                  <ul className="m-0 list-none p-0">
                    {factEntries.map(([label, value]) => (
                      <li
                        key={label}
                        className="grid grid-cols-[140px_1fr] items-center gap-2 border-b border-[#f5f5f5] py-1.5 last:border-b-0"
                      >
                        <span className="text-[12px] text-[#6b7280]">{label}</span>
                        <span className="break-all text-[12px] font-medium text-[#374151]">
                          {value}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <pre className="m-0 max-h-[260px] overflow-auto rounded bg-[#fafafa] p-2.5 font-mono text-[11px]">
                    {JSON.stringify(health, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};