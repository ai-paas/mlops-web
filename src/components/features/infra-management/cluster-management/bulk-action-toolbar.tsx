import { useState } from 'react';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import {
  useDeleteKubernetesResource,
  useRestartKubernetesResource,
} from '@/hooks/service/clusters';
import { stripVolatile } from './strip-volatile';

const BULK_RESTARTABLE = new Set(['pods', 'deployments', 'statefulsets', 'daemonsets']);

interface BulkActionToolbarProps<T> {
  /** rowSelection 으로부터 펼친 raw 리소스 객체 배열. */
  selected: T[];
  resourceType: string;
  resourceLabel: string;
  clusterName?: string;
  getName: (item: T) => string;
  /** namespace 미지정 시 cluster-scoped 로 호출. */
  getNamespace?: (item: T) => string | undefined;
  /** 작업 완료 후 부모의 rowSelection 해제 콜백. */
  onClear: () => void;
}

export function BulkActionToolbar<T>({
  selected,
  resourceType,
  resourceLabel,
  clusterName,
  getName,
  getNamespace,
  onClear,
}: BulkActionToolbarProps<T>) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const count = selected.length;

  const { deleteResourceAsync } = useDeleteKubernetesResource();
  const { restartResourceAsync } = useRestartKubernetesResource();

  if (count === 0) return null;

  const handleCopyYaml = async () => {
    try {
      const yaml = selected
        .map((item) =>
          JSON.stringify(stripVolatile(item as Record<string, unknown>), null, 2)
        )
        .join('\n---\n');
      await navigator.clipboard.writeText(yaml);
      toast.open({
        status: 'positive',
        title: `${count}개 ${resourceLabel} 의 YAML(JSON) 이 복사되었습니다.`,
      });
    } catch {
      toast.open({ status: 'negative', title: 'YAML 복사에 실패했습니다.' });
    }
  };

  const handleBulkDelete = async () => {
    if (!clusterName) {
      toast.open({ status: 'negative', title: '클러스터가 선택되지 않았습니다.' });
      return;
    }
    setIsProcessing(true);
    try {
      const results = await Promise.allSettled(
        selected.map((item) =>
          deleteResourceAsync({
            resourceType,
            resourceName: getName(item),
            clusterName,
            namespace: getNamespace?.(item),
          })
        )
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast.open({
          status: 'positive',
          title: `${ok}개 ${resourceLabel} 삭제 요청 완료`,
        });
      } else if (ok === 0) {
        toast.open({
          status: 'negative',
          title: `${count}개 ${resourceLabel} 삭제 모두 실패`,
        });
      } else {
        toast.open({
          status: 'negative',
          title: `${ok}개 성공 / ${fail}개 실패 — 실패한 항목은 다시 시도해 주세요.`,
        });
      }
      setConfirmOpen(false);
      onClear();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkRestart = async () => {
    if (!clusterName) {
      toast.open({ status: 'negative', title: '클러스터가 선택되지 않았습니다.' });
      return;
    }
    setIsProcessing(true);
    try {
      const results = await Promise.allSettled(
        selected.map((item) =>
          restartResourceAsync({
            resourceType,
            resourceName: getName(item),
            clusterName,
            namespace: getNamespace?.(item),
          })
        )
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast.open({ status: 'positive', title: `${ok}개 ${resourceLabel} 재시작 요청 완료` });
      } else if (ok === 0) {
        toast.open({ status: 'negative', title: `${count}개 ${resourceLabel} 재시작 모두 실패` });
      } else {
        toast.open({
          status: 'negative',
          title: `${ok}개 성공 / ${fail}개 실패 — 실패한 항목은 다시 시도해 주세요.`,
        });
      }
      onClear();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="mb-2 flex items-center gap-3 rounded-md border border-[#268eff] bg-[#eef6ff] px-3 py-2">
        <span className="text-[13px] font-semibold text-[#1d4ed8]">
          {count} selected
        </span>
        <span className="flex-1" />
        {BULK_RESTARTABLE.has(resourceType) && (
          <Button
            size="small"
            color="secondary"
            onClick={handleBulkRestart}
            disabled={isProcessing}
          >
            재시작
          </Button>
        )}
        <Button size="small" color="secondary" onClick={handleCopyYaml}>
          YAML 복사
        </Button>
        <Button
          size="small"
          color="negative"
          onClick={() => setConfirmOpen(true)}
          disabled={isProcessing}
        >
          일괄 삭제
        </Button>
        <Button
          size="small"
          color="secondary"
          onClick={onClear}
          disabled={isProcessing}
        >
          선택 해제
        </Button>
      </div>

      <AlertDialog
        isOpen={confirmOpen}
        title={`${count}개 ${resourceLabel} 일괄 삭제`}
        confirmButtonText={isProcessing ? '삭제 중...' : '삭제'}
        cancelButtonText="취소"
        onClickConfirm={handleBulkDelete}
        onClickClose={() => !isProcessing && setConfirmOpen(false)}
      >
        <span className="block text-[13px] leading-relaxed text-[#1f2937]">
          아래 {count}개 {resourceLabel} 를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          <ul className="mt-2 max-h-[200px] list-disc overflow-y-auto pl-5 text-[12px]">
            {selected.map((item, i) => {
              const ns = getNamespace?.(item);
              return (
                <li key={i}>
                  <strong>{getName(item)}</strong>
                  {ns && <span className="text-[#6b7280]"> ({ns})</span>}
                </li>
              );
            })}
          </ul>
        </span>
      </AlertDialog>
    </>
  );
}