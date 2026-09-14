import { AlertDialog, Button } from '@innogrid/ui';
import { useState } from 'react';
import { useDeleteMember } from '@/hooks/service/member';
import { getServerErrorMessage } from '@/lib/api';

interface DeleteMemberButtonProps {
  selectedMemberId?: string | null;
}

export const DeleteMemberButton = ({ selectedMemberId }: DeleteMemberButtonProps) => {
  const [isOpenConfirm, setIsOpenConfirm] = useState(false);
  const [isOpenResult, setIsOpenResult] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const { deleteMember, isPending } = useDeleteMember();

  const hasSelection = !!selectedMemberId;

  const handleOpenConfirm = () => {
    if (!hasSelection) return;
    setIsOpenConfirm(true);
  };

  const handleClickConfirm = () => {
    if (!selectedMemberId) return;
    deleteMember(selectedMemberId, {
      onSuccess: () => {
        setResultMessage(`${selectedMemberId} 삭제가 완료되었습니다.`);
        setIsOpenConfirm(false);
        setIsOpenResult(true);
      },
      onError: (error) => {
        setResultMessage(getServerErrorMessage(error, `${selectedMemberId} 삭제에 실패했습니다.`));
        setIsOpenConfirm(false);
        setIsOpenResult(true);
      },
    });
  };

  return (
    <>
      <Button
        onClick={handleOpenConfirm}
        color="negative"
        disabled={!hasSelection || isPending}
        title={hasSelection ? '' : '삭제할 멤버를 선택해 주세요.'}
      >
        삭제
      </Button>

      {/* 확인 모달 */}
      <AlertDialog
        isOpen={isOpenConfirm}
        confirmButtonText={isPending ? '처리 중...' : '확인'}
        cancelButtonText="취소"
        onClickConfirm={handleClickConfirm}
        onClickClose={() => !isPending && setIsOpenConfirm(false)}
      >
        <span>
          {selectedMemberId
            ? `${selectedMemberId}를 삭제하시겠습니까?`
            : '삭제할 멤버를 선택해 주세요.'}
        </span>
      </AlertDialog>

      {/* 결과 모달 */}
      <AlertDialog
        isOpen={isOpenResult}
        confirmButtonText="닫기"
        onClickConfirm={() => setIsOpenResult(false)}
        onClickClose={() => setIsOpenResult(false)}
      >
        <span>{resultMessage}</span>
      </AlertDialog>
    </>
  );
};
