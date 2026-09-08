import { AlertDialog, Button } from '@innogrid/ui';
import { useRef, useState } from 'react';
import { useDeleteCluster } from '@/hooks/service/clusters';

interface DeleteClusterButtonProps {
  // 단일 모드는 string, 다중 모드는 배열. 둘 다 받아 호환성 유지.
  clusterId?: string | null;
  clusterIds?: string[];
  onDeleteSuccess?: () => void;
}

export const DeleteClusterButton = ({
  clusterId,
  clusterIds,
  onDeleteSuccess,
}: DeleteClusterButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  // onDeleteSuccess는 navigate 등 비멱등 콜백일 수 있어 setState 업데이터 밖에서 호출한다.
  // (StrictMode는 업데이터를 두 번 실행한다)
  const remainingRef = useRef(0);

  const ids: string[] = clusterIds && clusterIds.length > 0 ? clusterIds : clusterId ? [clusterId] : [];

  const { deleteCluster } = useDeleteCluster({
    onSuccess: () => {
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      setPendingCount(remainingRef.current);
      if (remainingRef.current === 0) {
        setIsOpen(false);
        onDeleteSuccess?.();
      }
    },
    onError: () => {
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      setPendingCount(remainingRef.current);
    },
  });

  const isPending = pendingCount > 0;

  const handleClickConfirm = () => {
    if (ids.length === 0) return;
    remainingRef.current = ids.length;
    setPendingCount(ids.length);
    ids.forEach((id) => deleteCluster(id));
  };

  const label = isPending ? `삭제 중... (${pendingCount})` : ids.length > 1 ? `삭제 (${ids.length})` : '삭제';

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="medium"
        color="negative"
        disabled={ids.length === 0 || isPending}
      >
        {label}
      </Button>
      <AlertDialog
        isOpen={isOpen}
        confirmButtonText="확인"
        cancelButtonText="취소"
        onClickConfirm={handleClickConfirm}
        onClickClose={() => setIsOpen(false)}
      >
        <span>
          {ids.length > 1
            ? `선택된 ${ids.length}개 클러스터를 삭제하시겠습니까?`
            : '클러스터를 삭제하시겠습니까?'}
        </span>
      </AlertDialog>
    </>
  );
};