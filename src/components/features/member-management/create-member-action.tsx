import { AlertDialog, Button } from '@innogrid/ui';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useCreateMember } from '@/hooks/service/member';
import { getServerErrorMessage } from '@/lib/api';
import type { CreateMemberRequest } from '@/types/member';
import type { MemberCreateFormValues } from './member-form';

interface CreateMemberActionProps {
  // 페이지가 소유한 RHF 폼 — 검증(zod)은 생성 클릭 시 handleSubmit이 수행하고 인라인 에러는 페이지가 표시한다
  form: UseFormReturn<MemberCreateFormValues>;
}

export const CreateMemberAction = ({ form }: CreateMemberActionProps) => {
  const navigate = useNavigate();
  const { createMember, isPending } = useCreateMember();

  const [isOpenConfirm, setIsOpenConfirm] = useState(false);
  const [isOpenResult, setIsOpenResult] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resultNode, setResultNode] = useState<React.ReactNode>(null);

  // 검증을 통과하면 확인 모달을 연다 — 실패하면 각 필드 옆에 에러가 표시된다
  const handleSubmit = form.handleSubmit(() => setIsOpenConfirm(true));

  const handleClickConfirm = () => {
    const values = form.getValues();
    const payload: CreateMemberRequest = {
      name: values.name,
      member_id: values.memberId,
      email: values.email,
      phone: values.phone,
      role: values.role,
      is_active: true,
      description: values.description,
      password: values.password,
      password_confirm: values.passwordConfirm,
    };

    createMember(payload, {
      onSuccess: (res) => {
        setIsSuccess(true);
        setResultNode(`회원 생성이 완료되었습니다. ID: ${res?.member_id ?? '—'}`);
        setIsOpenConfirm(false);
        setIsOpenResult(true);
      },
      onError: (error) => {
        setIsSuccess(false);
        setResultNode(
          getServerErrorMessage(error, '회원 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        );
        setIsOpenConfirm(false);
        setIsOpenResult(true);
      },
    });
  };

  const handleCloseResult = () => {
    setIsOpenResult(false);
    if (isSuccess) navigate('/member-management');
  };

  return (
    <>
      <Button size="large" color="primary" onClick={handleSubmit} disabled={isPending}>
        {isPending ? '처리 중...' : '생성'}
      </Button>

      {/* 확인 모달 */}
      <AlertDialog
        isOpen={isOpenConfirm}
        confirmButtonText={isPending ? '처리 중...' : '확인'}
        cancelButtonText="취소"
        onClickConfirm={handleClickConfirm}
        onClickClose={() => !isPending && setIsOpenConfirm(false)}
      >
        <span>입력하신 정보로 회원을 생성하시겠습니까?</span>
      </AlertDialog>

      {/* 결과 모달 */}
      <AlertDialog
        isOpen={isOpenResult}
        confirmButtonText="닫기"
        onClickConfirm={handleCloseResult}
        onClickClose={handleCloseResult}
      >
        {resultNode}
      </AlertDialog>
    </>
  );
};
