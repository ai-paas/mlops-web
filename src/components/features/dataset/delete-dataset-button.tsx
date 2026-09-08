import { useDeleteDataset } from '@/hooks/service/datasets';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';

export const DeleteDatasetButton = ({
  datasetId,
  redirect,
}: {
  datasetId?: number;
  redirect?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { deleteDataset } = useDeleteDataset();
  const toast = useToast();
  const navigate = useNavigate();

  const handleClickConfirm = () => {
    if (!datasetId) return;

    deleteDataset(datasetId, {
      onSuccess: () => {
        toast.open({
          status: 'positive',
          title: '데이터셋 삭제 성공',
          children: '데이터셋이 성공적으로 삭제되었습니다.',
        });
        setIsOpen(false);
        if (redirect) {
          navigate(redirect);
        }
      },
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '데이터셋 삭제 실패',
          children: getServerErrorMessage(error, '데이터셋 삭제 중 오류가 발생했습니다.'),
        });
      },
    });
  };

  return (
    <>
      <Button disabled={!datasetId} size="medium" color="negative" onClick={() => setIsOpen(true)}>
        삭제
      </Button>
      <AlertDialog
        isOpen={isOpen}
        confirmButtonText="확인"
        cancelButtonText="취소"
        onClickConfirm={handleClickConfirm}
        onClickClose={() => setIsOpen(false)}
      >
        <span>데이터셋을 삭제하시겠습니까?</span>
      </AlertDialog>
    </>
  );
};
