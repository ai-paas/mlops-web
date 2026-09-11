import { useDeleteWorkflow, useFinalizeWorkflowDeletion } from '@/hooks/service/workflows';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

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
  const [isDeletionStarted, setIsDeletionStarted] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const { deleteWorkflow, isPending } = useDeleteWorkflow();
  // DELETE는 정리 시작(202)일 뿐이라, 실제 삭제 완료는 finalize-deletion 폴링의 종결 상태로만 판정한다.
  const { status, result, isSucceeded, isFailed, isPolling, isTimedOut, isError, error } =
    useFinalizeWorkflowDeletion({
      surro_workflow_id: workflowId,
      enabled: isDeletionStarted,
    });

  const hasWorkflow = workflowId !== undefined && workflowId !== null && `${workflowId}` !== '';
  const isDeleting = isPending || (isDeletionStarted && isPolling);

  const handleOpen = () => {
    if (!hasWorkflow) return;
    setIsOpen(true);
  };

  const handleClickConfirm = () => {
    if (!hasWorkflow) return;

    deleteWorkflow(workflowId, {
      onSuccess: () => {
        setIsDeletionStarted(true);
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

  useEffect(() => {
    if (!isDeletionStarted) return;

    // 404(이미 삭제됨)도 훅이 completed로 정규화해 여기로 온다.
    if (isSucceeded) {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      toast.open({
        status: 'positive',
        title: '워크플로우 삭제 성공',
        children: '워크플로우가 삭제되었습니다.',
      });
      setIsDeletionStarted(false);
      setIsOpen(false);
      onDeleted?.();
      if (redirect) navigate(redirect);
      return;
    }

    // 10분을 넘겨도 하드 실패로 처리하지 않는다.
    // 서버 정리는 계속 진행되므로 안내만 하고 목록을 갱신한다(리다이렉트·onDeleted는 없다).
    if (isTimedOut) {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      toast.open({
        status: 'issue',
        title: '워크플로우 삭제 진행 중',
        children: '정리가 계속 진행 중입니다. 잠시 후 목록에서 다시 확인해주세요.',
      });
      setIsDeletionStarted(false);
      setIsOpen(false);
      return;
    }

    if (isFailed || isError) {
      toast.open({
        status: 'negative',
        title: '워크플로우 삭제 실패',
        // status가 'failed'면 서버가 준 error_message/message를, HTTP 오류(403·502 등)면
        // 서버 detail을 쓴다. 에러 응답에는 본문(result)이 없어 getServerErrorMessage로
        // 떨어뜨려야 detail이 살아난다.
        children:
          result?.error_message ??
          result?.message ??
          getServerErrorMessage(error, '워크플로우 삭제 완료 처리에 실패했습니다.'),
      });
      setIsDeletionStarted(false);
      return;
    }

    // 종결값도 진행 중도 아닌 상태 — 폴링이 멈췄으므로 결과를 단정하지 않는다.
    // 성공으로 넘기면 이 이슈(삭제되지 않았는데 삭제된 것처럼 보임)가 재발한다.
    if (status && !isPolling) {
      toast.open({
        status: 'issue',
        title: '워크플로우 삭제 확인 필요',
        children:
          result?.message ?? '삭제 완료 여부를 확인할 수 없습니다. 목록에서 다시 확인해주세요.',
      });
      setIsDeletionStarted(false);
    }
  }, [
    isDeletionStarted,
    isSucceeded,
    isFailed,
    isTimedOut,
    isError,
    isPolling,
    status,
    result?.message,
    result?.error_message,
    error,
    queryClient,
    toast,
    onDeleted,
    redirect,
    navigate,
  ]);

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
