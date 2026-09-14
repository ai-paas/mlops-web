import { Button, Modal, useToast } from '@innogrid/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useCleanupWorkflow, useFinalizeWorkflowCleanup } from '@/hooks/service/workflows';
import { queryKeys } from '@/lib/query-keys';
import { getServerErrorMessage } from '@/lib/api';

interface StopWorkflowDeploymentButtonProps {
  workflowId?: string;
}

export const StopWorkflowDeploymentButton = ({ workflowId }: StopWorkflowDeploymentButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCleanupStarted, setIsCleanupStarted] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { cleanupWorkflow, isPending } = useCleanupWorkflow();
  const { status, result, isPolling, isTimedOut, isError, error } = useFinalizeWorkflowCleanup({
    surro_workflow_id: workflowId,
    enabled: isCleanupStarted,
  });

  const isWorking = isPending || (isCleanupStarted && isPolling);

  const handleStop = () => {
    if (!workflowId) return;

    cleanupWorkflow(
      { surro_workflow_id: workflowId },
      {
        onSuccess: () => {
          setIsCleanupStarted(true);
        },
        onError: (error) => {
          toast.open({
            status: 'negative',
            title: '배포 중지 실패',
            children: getServerErrorMessage(error, '워크플로우 배포 중지 중 오류가 발생했습니다.'),
          });
        },
      }
    );
  };

  useEffect(() => {
    if (!isCleanupStarted) return;

    if (status === 'completed') {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      toast.open({
        status: 'positive',
        title: '배포 중지 성공',
        children: '워크플로우 리소스 정리가 완료되었습니다.',
      });
      setIsCleanupStarted(false);
      setIsOpen(false);
      return;
    }

    // 10분을 넘겨도 하드 실패로 처리하지 않는다 — 서버 정리는 계속 진행되므로 안내만 한다.
    if (isTimedOut) {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      toast.open({
        status: 'issue',
        title: '배포 중지 진행 중',
        children: '리소스 정리가 계속 진행 중입니다. 잠시 후 다시 확인해주세요.',
      });
      setIsCleanupStarted(false);
      setIsOpen(false);
      return;
    }

    if (status === 'failed' || isError) {
      toast.open({
        status: 'negative',
        title: '배포 중지 실패',
        // HTTP 오류(403·502 등)에는 본문(result)이 없어 getServerErrorMessage로 떨어뜨려야
        // 서버 detail이 살아난다.
        children:
          result?.error_message ??
          result?.message ??
          getServerErrorMessage(error, '워크플로우 리소스 정리에 실패했습니다.'),
      });
      setIsCleanupStarted(false);
    }
  }, [
    status,
    isTimedOut,
    isError,
    error,
    isCleanupStarted,
    result?.message,
    result?.error_message,
    queryClient,
    toast,
  ]);

  const handleClose = () => {
    if (isWorking) return;
    setIsOpen(false);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="medium"
        color="negative"
        disabled={!workflowId || isWorking}
      >
        배포 중지
      </Button>
      <Modal
        allowOutsideInteraction
        isOpen={isOpen}
        isButtonLoading={isWorking}
        buttonDisabled={isWorking}
        title="배포 중지"
        size="small"
        onRequestClose={handleClose}
        action={handleStop}
        buttonTitle="확인"
        subButton={
          <Button size="large" color="secondary" onClick={handleClose}>
            취소
          </Button>
        }
      >
        <div>워크플로우 배포를 중지하시겠습니까?</div>
      </Modal>
    </>
  );
};
