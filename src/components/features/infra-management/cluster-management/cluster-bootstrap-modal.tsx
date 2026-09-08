import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, useToast } from '@innogrid/ui';
import type { BootstrapInfo } from '@/types/cluster';

interface ClusterBootstrapModalProps {
  isOpen: boolean;
  clusterName: string;
  bootstrap?: BootstrapInfo;
  onClose: () => void;
  /**
   * 등록 직후 (create flow) 에만 전달 — 주 버튼이 "클러스터 목록으로" + 보조 "닫기".
   * 미전달 (재발급 flow) 시 주 버튼 = "닫기" 만 표시.
   */
  onGoToList?: () => void;
}

type InstallMode = 'helm' | 'kubectl';

const formatRemaining = (expiresAt?: string): string => {
  if (!expiresAt) return '';
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return '';
  const remaining = expiresMs - Date.now();
  if (remaining <= 0) return '만료됨';
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
};

export const ClusterBootstrapModal = ({
  isOpen,
  clusterName,
  bootstrap,
  onClose,
  onGoToList,
}: ClusterBootstrapModalProps) => {
  const toast = useToast();
  const [mode, setMode] = useState<InstallMode>('helm');
  const [remaining, setRemaining] = useState<string>(() => formatRemaining(bootstrap?.expiresAt));

  // token 만료 시간 1초마다 갱신 — 사용자가 "지금 실행 vs 재발급" 판단
  useEffect(() => {
    if (!isOpen || !bootstrap?.expiresAt) return;
    setRemaining(formatRemaining(bootstrap.expiresAt));
    const id = setInterval(() => setRemaining(formatRemaining(bootstrap.expiresAt)), 1000);
    return () => clearInterval(id);
  }, [isOpen, bootstrap?.expiresAt]);

  const command = useMemo(() => {
    if (!bootstrap) return '';
    return mode === 'helm'
      ? (bootstrap.helmInstallCommand ?? '')
      : (bootstrap.kubectlApplyCommand ?? '');
  }, [bootstrap, mode]);

  const handleCopy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      toast.open({
        status: 'positive',
        title: '복사 완료',
        children: '명령이 클립보드에 복사되었습니다.',
      });
    } catch {
      toast.open({
        status: 'negative',
        title: '복사 실패',
        children: '코드 영역을 직접 선택해 복사해주세요.',
      });
    }
  };

  const expired = remaining === '만료됨';

  return (
    <Modal
      allowOutsideInteraction
      isOpen={isOpen}
      size="medium"
      title={onGoToList ? '클러스터 등록 완료' : 'cluster-agent 설치 명령'}
      buttonTitle={onGoToList ? '클러스터 목록으로' : '닫기'}
      action={onGoToList ?? onClose}
      onRequestClose={onClose}
      subButton={
        onGoToList ? (
          <Button size="large" color="secondary" onClick={onClose}>
            닫기
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {/* 안내 메시지 */}
        <div className="text-[13px] leading-relaxed text-[#1f2937]">
          {onGoToList ? (
            <>
              <strong>{clusterName}</strong> 클러스터가 등록되었습니다. 본인의{' '}
              <code className="rounded bg-[#f3f4f6] px-1 py-0.5 font-mono text-[12px]">
                kubectl
              </code>{' '}
              context 에서 아래 명령을 실행하면 <strong>cluster-agent</strong> 가 설치되고 상태가{' '}
              <strong>ACTIVE</strong> 로 전환됩니다.
            </>
          ) : (
            <>
              <strong>{clusterName}</strong> 클러스터의 cluster-agent 설치 명령을 재발급했습니다.
              본인의{' '}
              <code className="rounded bg-[#f3f4f6] px-1 py-0.5 font-mono text-[12px]">
                kubectl
              </code>{' '}
              context 에서 아래 명령을 실행해 agent 를 (재)설치하세요.
            </>
          )}
        </div>

        {/* 설치 방식 토글 */}
        <div className="flex flex-col gap-2.5">
          <div className="page-input_item-name">설치 방식</div>
          <div className="page-input_item-data">
            <div className="inline-flex rounded-md border border-[#d1d5db] bg-[#f9fafb] p-0.5">
              {(['helm', 'kubectl'] as InstallMode[]).map((m) => {
                const selected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={selected}
                    className={[
                      'cursor-pointer rounded px-4 py-1.5 font-mono text-[12px] font-semibold transition-colors',
                      selected
                        ? 'bg-white text-[#1d4ed8] shadow-sm'
                        : 'bg-transparent text-[#6b7280] hover:text-[#1f2937]',
                    ].join(' ')}
                  >
                    {m === 'helm' ? 'helm install' : 'kubectl apply'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 명령 코드 박스 + 복사 */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="page-input_item-name">설치 명령</div>
            <Button size="small" color="secondary" onClick={handleCopy} disabled={!command}>
              복사
            </Button>
          </div>
          <div className="page-input_item-data">
            <pre
              className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-[#1f2937] p-4 font-mono text-[12px] leading-relaxed text-[#e5e7eb]"
              onClick={(e) => {
                // 사용자가 코드 영역 클릭 시 자동 선택 — keyboard copy fallback UX
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }}
            >
              {command || '명령을 불러올 수 없습니다.'}
            </pre>
          </div>
        </div>

        {/* token 만료 안내 — 다른 페이지의 hint 톤과 일치하는 inline notice */}
        {bootstrap?.expiresAt && (
          <div
            className={[
              'rounded border px-3 py-2 text-[12px] leading-relaxed',
              expired
                ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                : 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
            ].join(' ')}
          >
            토큰 만료까지 <strong>{remaining}</strong> 남음.{' '}
            {expired
              ? '만료되었습니다 — 클러스터 상세에서 agent manifest 를 재발급하세요.'
              : '만료 후엔 클러스터 상세에서 agent manifest 를 재발급할 수 있습니다.'}
          </div>
        )}
      </div>
    </Modal>
  );
};