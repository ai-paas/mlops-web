import { useDeletePrompt } from '@/hooks/service/prompts';
import { getServerErrorMessage } from '@/lib/api';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export const DeletePromptButton = ({
  promptId,
  redirect,
}: {
  promptId?: number;
  redirect?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { deletePrompt } = useDeletePrompt();
  const navigate = useNavigate();
  const toast = useToast();

  const handleConfirm = () => {
    if (!promptId) return;
    deletePrompt(promptId, {
      onSuccess: () => {
        toast.open({
          status: 'positive',
          title: '프롬프트 삭제 성공',
          children: '프롬프트가 성공적으로 삭제되었습니다.',
        });
        setIsOpen(false);
        if (redirect) {
          navigate(redirect, { replace: true });
        }
      },
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '프롬프트 삭제 실패',
          children: getServerErrorMessage(error, '프롬프트 삭제 중 오류가 발생했습니다.'),
        });
      },
    });
  };

  return (
    <>
      <Button disabled={!promptId} onClick={() => setIsOpen(true)} size="medium" color="negative">
        삭제
      </Button>
      <AlertDialog
        isOpen={isOpen}
        confirmButtonText="확인"
        cancelButtonText="취소"
        onClickConfirm={handleConfirm}
        onClickClose={() => setIsOpen(false)}
      >
        <span>프롬프트를 삭제하시겠습니까?</span>
      </AlertDialog>
    </>
  );
};
