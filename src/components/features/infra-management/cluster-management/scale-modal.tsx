import { useEffect, useState } from 'react';
import { Button, Modal } from '@innogrid/ui';

interface ScaleModalProps {
  isOpen: boolean;
  resourceLabel: string;
  resourceName: string;
  namespace?: string;
  currentReplicas?: number;
  isProcessing?: boolean;
  onConfirm: (replicas: number) => void;
  onClose: () => void;
}

export const ScaleModal = ({
  isOpen,
  resourceLabel,
  resourceName,
  namespace,
  currentReplicas,
  isProcessing,
  onConfirm,
  onClose,
}: ScaleModalProps) => {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때마다 현재 replicas 로 초기화 (재오픈 시 stale 입력 방지).
  useEffect(() => {
    if (isOpen) {
      setValue(String(currentReplicas ?? ''));
      setError(null);
    }
  }, [isOpen, currentReplicas]);

  const handleConfirm = () => {
    const n = Number(value);
    if (!value || !Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      setError('0 이상의 정수만 입력 가능합니다.');
      return;
    }
    if (n > 1000) {
      setError('replicas 최대값은 1000 입니다.');
      return;
    }
    setError(null);
    onConfirm(n);
  };

  return (
    <Modal
      isOpen={isOpen}
      size="small"
      title={`${resourceLabel} 스케일`}
      buttonTitle={isProcessing ? '적용 중...' : '적용'}
      action={handleConfirm}
      onRequestClose={() => !isProcessing && onClose()}
      buttonDisabled={isProcessing || !value}
      isButtonLoading={isProcessing}
      subButton={
        <Button size="large" color="secondary" onClick={onClose} disabled={isProcessing}>
          취소
        </Button>
      }
    >
      <div className="flex flex-col gap-3 text-[13px] text-[#1f2937]">
        <div>
          <strong>{resourceName}</strong>
          {namespace && <span className="text-[#6b7280]"> ({namespace})</span>}
          {' '}
          의 replicas 를 변경합니다.
        </div>
        {currentReplicas !== undefined && (
          <div className="text-[12px] text-[#6b7280]">
            현재 replicas: <strong className="text-[#1f2937]">{currentReplicas}</strong>
          </div>
        )}
        <label className="flex items-center gap-2">
          <span className="min-w-[80px] text-[12px] text-[#6b7280]">목표 replicas</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isProcessing) handleConfirm();
            }}
            disabled={isProcessing}
            className="w-[120px] rounded border border-[#d1d5db] bg-white px-2 py-1 font-mono text-[13px] disabled:opacity-60"
            autoFocus
          />
        </label>
        {error && <div className="text-[12px] text-[#b91c1c]">{error}</div>}
      </div>
    </Modal>
  );
};