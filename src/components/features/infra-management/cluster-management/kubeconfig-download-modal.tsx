import { useEffect, useState } from 'react';
import { Button, Modal, useToast } from '@innogrid/ui';
import {
  downloadClusterKubeconfig,
  type KubeconfigDownloadOptions,
} from '@/hooks/service/clusters';

interface KubeconfigDownloadModalProps {
  isOpen: boolean;
  clusterName?: string;
  /** VM provisioned cluster 면 SA/namespace 미지정 가능 (backend 가 admin SA 자동 발급). */
  vmProvisioned?: boolean;
  onClose: () => void;
}

export const KubeconfigDownloadModal = ({
  isOpen,
  clusterName,
  vmProvisioned,
  onClose,
}: KubeconfigDownloadModalProps) => {
  const toast = useToast();
  const [serviceAccount, setServiceAccount] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [ttlMinutes, setTtlMinutes] = useState<number>(60);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setServiceAccount('');
      setNamespace('default');
      setTtlMinutes(60);
    }
  }, [isOpen]);

  const handleDownload = async () => {
    if (!clusterName) return;
    if (!vmProvisioned && !serviceAccount.trim()) {
      toast.open({
        status: 'negative',
        title: '등록된 클러스터는 ServiceAccount 이름이 필요합니다.',
      });
      return;
    }
    setIsProcessing(true);
    try {
      const options: KubeconfigDownloadOptions = {};
      if (serviceAccount.trim()) options.serviceAccount = serviceAccount.trim();
      if (namespace.trim()) options.namespace = namespace.trim();
      if (ttlMinutes > 0) options.ttlSeconds = ttlMinutes * 60;
      await downloadClusterKubeconfig(clusterName, options);
      toast.open({ status: 'positive', title: 'kubeconfig 다운로드 완료' });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'kubeconfig 다운로드 실패';
      toast.open({ status: 'negative', title: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      size="small"
      title="kubeconfig 다운로드"
      buttonTitle={isProcessing ? '발급 중...' : '다운로드'}
      action={handleDownload}
      onRequestClose={() => !isProcessing && onClose()}
      buttonDisabled={isProcessing || !clusterName}
      isButtonLoading={isProcessing}
      subButton={
        <Button size="large" color="secondary" onClick={onClose} disabled={isProcessing}>
          취소
        </Button>
      }
    >
      <div className="flex flex-col gap-3 text-[13px] text-[#1f2937]">
        <div>
          <strong>{clusterName ?? '-'}</strong> 의 단기 token kubeconfig 를 발급합니다.
        </div>
        {vmProvisioned ? (
          <div className="rounded bg-[#eef6ff] p-2 text-[12px] text-[#1d4ed8]">
            VM 프로비저닝 클러스터 — ServiceAccount 미지정 시 admin SA 자동 발급.
          </div>
        ) : (
          <div className="rounded bg-[#fff5e0] p-2 text-[12px] text-[#b45309]">
            등록된 클러스터 — 사용할 ServiceAccount 이름이 필요합니다.
          </div>
        )}
        <label className="flex items-center gap-2">
          <span className="min-w-[120px] text-[12px] text-[#6b7280]">
            ServiceAccount{!vmProvisioned && <span className="text-[#dc2626]"> *</span>}
          </span>
          <input
            type="text"
            value={serviceAccount}
            onChange={(e) => setServiceAccount(e.target.value)}
            placeholder={vmProvisioned ? '미입력 시 admin SA' : '예: my-admin-sa'}
            disabled={isProcessing}
            className="flex-1 rounded border border-[#d1d5db] bg-white px-2 py-1 font-mono text-[12px] disabled:opacity-60"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="min-w-[120px] text-[12px] text-[#6b7280]">Namespace</span>
          <input
            type="text"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            placeholder="default"
            disabled={isProcessing}
            className="flex-1 rounded border border-[#d1d5db] bg-white px-2 py-1 font-mono text-[12px] disabled:opacity-60"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="min-w-[120px] text-[12px] text-[#6b7280]">TTL (분)</span>
          <input
            type="number"
            min={1}
            max={1440}
            value={ttlMinutes}
            onChange={(e) => setTtlMinutes(Number(e.target.value) || 60)}
            disabled={isProcessing}
            className="w-[100px] rounded border border-[#d1d5db] bg-white px-2 py-1 font-mono text-[12px] disabled:opacity-60"
          />
          <span className="text-[11px] text-[#9ca3af]">기본 60분 (max 24h)</span>
        </label>
      </div>
    </Modal>
  );
};