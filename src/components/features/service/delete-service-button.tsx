import { useDeleteService } from '@/hooks/service/services';
import { AlertDialog, Button, useToast } from '@innogrid/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';

export const DeleteServiceButton = ({ serviceId }: { serviceId?: string }) => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { deleteService } = useDeleteService();
  const navigate = useNavigate();
  const toast = useToast();

  const openAlert = () => {
    if (!serviceId) return;
    setIsAlertOpen(true);
  };

  const handleClickConfirm = () => {
    if (!serviceId) return;

    deleteService(serviceId, {
      onSuccess: () => {
        toast.open({
          status: 'positive',
          title: '서비스 삭제 성공',
          children: '서비스가 성공적으로 삭제되었습니다.',
        });
        setIsAlertOpen(false);
        navigate('/service');
      },
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '서비스 삭제 실패',
          children: getServerErrorMessage(error, '서비스 삭제 중 오류가 발생했습니다.'),
        });
      },
    });
  };

  return (
    <>
      <Button size="medium" color="negative" disabled={!serviceId} onClick={openAlert}>
        삭제
      </Button>
      <AlertDialog
        isOpen={isAlertOpen}
        confirmButtonText="확인"
        cancelButtonText="취소"
        onClickConfirm={handleClickConfirm}
        onClickClose={() => setIsAlertOpen(false)}
      >
        <span>서비스를 삭제하시겠습니까?</span>
      </AlertDialog>
    </>
  );
};
