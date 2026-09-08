import { useDeleteWorkflow, useFinalizeWorkflowDeletion } from '@/hooks/service/workflows';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';

interface DeleteWorkflowButtonProps {
  workflowId?: string;
  workflowName?: string;
  redirect?: string;
  onDeleted?: () => void;
}

export const DeleteWorkflowButton = ({
  workflowId,
  workflowName,
  redirect,
  onDeleted,
}: DeleteWorkflowButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { deleteWorkflow, isPending } = useDeleteWorkflow();
  const { finalizeWorkflowDeletion, isPending: isFinalizePending } = useFinalizeWorkflowDeletion();
  const navigate = useNavigate();
  const toast = useToast();

  const hasWorkflow = workflowId !== undefined && workflowId !== null && `${workflowId}` !== '';
  const isDeleting = isPending || isFinalizePending;

  const handleOpen = () => {
    if (!hasWorkflow) return;
    setIsOpen(true);
  };

  const handleClickConfirm = () => {
    if (!hasWorkflow) return;

    deleteWorkflow(workflowId, {
      onSuccess: () => {
        finalizeWorkflowDeletion(
          {
            surro_workflow_id: workflowId,
          },
          {
            onSuccess: () => {
              toast.open({
                status: 'positive',
                title: '워크플로우 삭제 성공',
                children: '워크플로우 리소스 정리와 삭제 완료 처리가 요청되었습니다.',
              });
              setIsOpen(false);
              onDeleted?.();
              if (redirect) {
                navigate(redirect);
              }
            },
            onError: () => {
              toast.open({
                status: 'positive',
                title: '워크플로우 정리 시작',
                children:
                  '리소스 정리가 시작되었습니다. 잠시 후 삭제 완료 처리를 다시 시도해주세요.',
              });
              setIsOpen(false);
              onDeleted?.();
            },
          }
        );
      },
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '워크플로우 삭제 실패',
          children: getServerErrorMessage(error, '워크플로우 삭제 중 오류가 발생했습니다.'),
        });
      },
    });
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        size="medium"
        color="negative"
        disabled={!hasWorkflow || isDeleting}
      >
        삭제
      </Button>
      <AlertDialog
        isOpen={isOpen}
        confirmButtonText={isDeleting ? '삭제 중...' : '확인'}
        cancelButtonText="취소"
        onClickConfirm={handleClickConfirm}
        onClickClose={() => !isDeleting && setIsOpen(false)}
      >
        <span>
          {workflowName
            ? `${workflowName} 워크플로우를 삭제하시겠습니까?`
            : '워크플로우를 삭제하시겠습니까?'}
        </span>
      </AlertDialog>
    </>
  );
};
