import { useDeleteLearning } from '@/hooks/service/learning';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';

export const DeleteLearningButton = ({
  experimentId,
  redirect,
}: {
  experimentId?: number;
  redirect?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { deleteLearning } = useDeleteLearning();
  const toast = useToast();
  const navigate = useNavigate();

  const handleClickConfirm = () => {
    if (!experimentId) return;

    deleteLearning(experimentId, {
      onSuccess: () => {
        toast.open({
          status: 'positive',
          title: '학습 삭제 성공',
          children: '학습이 성공적으로 삭제되었습니다.',
        });
        setIsOpen(false);
        if (redirect) {
          navigate(redirect, { replace: true });
        }
      },
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '학습 삭제 실패',
          children: getServerErrorMessage(error, '학습 삭제 중 오류가 발생했습니다.'),
        });
      },
    });
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="medium"
        color="negative"
        disabled={!experimentId}
      >
        삭제
      </Button>
      <AlertDialog
        isOpen={isOpen}
        confirmButtonText="확인"
        cancelButtonText="취소"
        onClickConfirm={handleClickConfirm}
        onClickClose={() => setIsOpen(false)}
      >
        <span>학습을 삭제하시겠습니까?</span>
      </AlertDialog>
    </>
  );
};
