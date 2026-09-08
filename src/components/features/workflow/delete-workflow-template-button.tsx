import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useState } from 'react';
import { useDeleteWorkflowTemplate } from '@/hooks/service/workflows';
import { getServerErrorMessage } from '@/lib/api';

interface DeleteWorkflowTemplateButtonProps {
  templateId?: string;
  templateName?: string;
  onDeleted?: () => void;
}

export const DeleteWorkflowTemplateButton = ({
  templateId,
  templateName,
  onDeleted,
}: DeleteWorkflowTemplateButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { deleteWorkflowTemplate, isPending } = useDeleteWorkflowTemplate();
  const toast = useToast();
  const hasTemplate = !!templateId;

  const handleDelete = () => {
    if (!templateId) return;

    deleteWorkflowTemplate(templateId, {
      onSuccess: () => {
        toast.open({
          status: 'positive',
          title: '템플릿 삭제 성공',
          children: '워크플로우 템플릿이 성공적으로 삭제되었습니다.',
        });
        setIsOpen(false);
        onDeleted?.();
      },
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '템플릿 삭제 실패',
          children: getServerErrorMessage(error, '템플릿 삭제 중 오류가 발생했습니다.'),
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
        disabled={!hasTemplate || isPending}
      >
        삭제
      </Button>
      <AlertDialog
        isOpen={isOpen}
        confirmButtonText={isPending ? '삭제 중...' : '확인'}
        cancelButtonText="취소"
        onClickConfirm={handleDelete}
        onClickClose={() => !isPending && setIsOpen(false)}
      >
        <span>
          {templateName
            ? `${templateName} 템플릿을 삭제하시겠습니까?`
            : '템플릿을 삭제하시겠습니까?'}
        </span>
      </AlertDialog>
    </>
  );
};
