import { useDeleteModel } from '@/hooks/service/models';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';

export const DeleteCustomModelButton = ({
  customModelId,
  redirect,
}: {
  customModelId?: number | null;
  redirect?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { deleteModel } = useDeleteModel();
  const navigate = useNavigate();
  const toast = useToast();

  const handleClickConfirm = () => {
    if (!customModelId) return;
    deleteModel(customModelId, {
      onSuccess: () => {
        if (redirect) {
          navigate(redirect, { replace: true });
        }
      },
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '커스텀 모델 삭제 실패',
          children: getServerErrorMessage(error, '커스텀 모델 삭제 중 오류가 발생했습니다.'),
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
        disabled={!customModelId}
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
        <span>커스텀 모델을 삭제하시겠습니까?</span>
      </AlertDialog>
    </>
  );
};
