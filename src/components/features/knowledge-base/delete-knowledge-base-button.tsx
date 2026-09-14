import { useDeleteKnowledgeBase } from '@/hooks/service/knowledgebase';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';

export const DeleteKnowledgeBaseButton = ({
  knowledgeBaseId,
  redirect,
}: {
  knowledgeBaseId?: number;
  redirect?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { deleteKnowledgeBase } = useDeleteKnowledgeBase();
  const navigate = useNavigate();
  const toast = useToast();

  const handleClickConfirm = () => {
    if (!knowledgeBaseId) return;
    deleteKnowledgeBase(knowledgeBaseId, {
      onSuccess: () => {
        if (redirect) {
          navigate(redirect, { replace: true });
        }
      },
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '지식 베이스 삭제 실패',
          children: getServerErrorMessage(error, '지식 베이스 삭제 중 오류가 발생했습니다.'),
        });
      },
    });
  };

  return (
    <>
      <Button
        disabled={!knowledgeBaseId}
        size="medium"
        color="negative"
        onClick={() => setIsOpen(true)}
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
        <span>지식 베이스를 삭제하시겠습니까?</span>
      </AlertDialog>
    </>
  );
};
