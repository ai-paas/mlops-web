import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@innogrid/ui';
import { useGetPodLogs } from '@/hooks/service/clusters';

interface ContainerOption {
  name: string;
}

interface PodLogsViewerProps {
  clusterName?: string;
  namespace?: string;
  podName?: string;
  /** 다중 컨테이너 pod 에서 사용자 선택용. 1 개면 selector 숨김. */
  containers?: ContainerOption[];
}

export const PodLogsViewer = ({ clusterName, namespace, podName, containers }: PodLogsViewerProps) => {
  const [tailLines, setTailLines] = useState<number>(200);
  const [container, setContainer] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [matchIndex, setMatchIndex] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setContainer(containers && containers.length > 0 ? containers[0].name : '');
  }, [containers, podName]);

  const { logs, isPending, isError, refetch } = useGetPodLogs(
    clusterName,
    namespace,
    podName,
    { tailLines, container: container || undefined }
  );

  // 검색 매칭 위치 (case-insensitive substring). 정규식 미지원 — 단순 표시.
  const matches = useMemo<number[]>(() => {
    if (!search) return [];
    const term = search.toLowerCase();
    const haystack = logs.toLowerCase();
    const out: number[] = [];
    let i = 0;
    while (true) {
      const next = haystack.indexOf(term, i);
      if (next < 0) break;
      out.push(next);
      i = next + term.length;
    }
    return out;
  }, [logs, search]);

  // 검색어 / 로그 변경 시 첫 매칭으로 reset.
  useEffect(() => {
    setMatchIndex(0);
  }, [search, logs]);

  // 매칭 위치를 textarea 선택으로 하이라이트 + scroll.
  useEffect(() => {
    if (!textareaRef.current || matches.length === 0 || !search) return;
    const pos = matches[matchIndex];
    if (pos === undefined) return;
    const el = textareaRef.current;
    el.focus({ preventScroll: true });
    el.setSelectionRange(pos, pos + search.length);
    // match 위치까지 스크롤 — line 단위 계산 후 scrollTop 조정.
    const before = logs.slice(0, pos);
    const lineNumber = before.split('\n').length - 1;
    const lineHeight = el.scrollHeight / Math.max(1, logs.split('\n').length);
    el.scrollTop = Math.max(0, lineHeight * lineNumber - el.clientHeight / 2);
  }, [matchIndex, matches, logs, search]);

  if (!podName) {
    return <div className="p-3 text-[13px] text-[#666]">파드를 선택하면 로그가 표시됩니다.</div>;
  }

  const multiContainer = containers && containers.length > 1;
  const matchInfo = search ? `${matches.length === 0 ? 0 : matchIndex + 1}/${matches.length}` : '';

  const goPrev = () => {
    if (matches.length === 0) return;
    setMatchIndex((i) => (i - 1 + matches.length) % matches.length);
  };
  const goNext = () => {
    if (matches.length === 0) return;
    setMatchIndex((i) => (i + 1) % matches.length);
  };

  return (
    <div className="rounded-lg border border-[#e5e7eb] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <strong className="text-[13px]">{namespace ? `${namespace}/${podName}` : podName} 로그</strong>
        {multiContainer && (
          <label className="inline-flex items-center gap-1.5 text-[12px] text-[#666]">
            컨테이너
            <select
              value={container}
              onChange={(e) => setContainer(e.target.value)}
              className="rounded border border-[#d1d5db] bg-white px-1.5 py-0.5 text-[12px]"
            >
              {containers?.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-[12px] text-[#666]">
          마지막 N 줄
          <input
            type="number"
            min={10}
            max={5000}
            value={tailLines}
            onChange={(e) => setTailLines(Number(e.target.value) || 200)}
            className="ml-1.5 w-[70px] rounded border border-[#d1d5db] px-1.5 py-0.5"
          />
        </label>
        <Button size="small" color="secondary" onClick={() => refetch()} disabled={isPending}>
          {isPending ? '불러오는 중...' : '새로고침'}
        </Button>
        {isError && <span className="text-[12px] text-[#dc2626]">로그를 불러오지 못했습니다.</span>}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="검색 (substring, 대소문자 무시)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.shiftKey) goPrev();
              else goNext();
            }
          }}
          className="min-w-[200px] flex-1 rounded border border-[#d1d5db] px-2 py-1 text-[12px]"
        />
        <span className="min-w-[48px] text-right text-[11px] text-[#6b7280]">{matchInfo}</span>
        <Button size="small" color="secondary" onClick={goPrev} disabled={matches.length === 0}>
          이전
        </Button>
        <Button size="small" color="secondary" onClick={goNext} disabled={matches.length === 0}>
          다음
        </Button>
      </div>

      <textarea
        ref={textareaRef}
        readOnly
        value={logs}
        className="block h-[420px] w-full resize-y whitespace-pre rounded border-0 bg-[#1e1e1e] p-3 font-mono text-[12px] leading-[1.5] text-[#d4d4d4]"
      />
    </div>
  );
};