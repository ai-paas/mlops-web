import { BreadCrumb, Button, Input, Textarea, RadioButton } from '@innogrid/ui';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router';
import { formatPhone } from '@/util/phone';
import { useGetMember } from '@/hooks/service/member';
import { EditMemberAction } from '@/components/features/member-management/edit-member-action';
import {
  createInitialMemberEditFormValues,
  memberEditSchema,
  type MemberEditFormValues,
  type MemberRole,
} from '@/components/features/member-management/member-form';

const toDigits = (value: string) => value.replace(/\D/g, '').slice(0, 11);

export default function MemberEditPage() {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const { member } = useGetMember(paramId!);

  const form = useForm<MemberEditFormValues>({
    resolver: zodResolver(memberEditSchema),
    defaultValues: createInitialMemberEditFormValues(),
    // 입력 즉시 검증해 인라인 에러를 보여준다
    mode: 'onChange',
  });
  const {
    register,
    control,
    reset,
    formState: { errors },
  } = form;
  // 이름·아이디는 수정 불가 — register하지 않고(비활성 입력은 RHF 값에서 빠진다) 폼 값을 표시만 한다.
  // description은 innogrid Textarea의 value가 필수라 register와 함께 현재 값을 넘긴다.
  const [name, memberId, description] = useWatch({
    control,
    name: ['name', 'memberId', 'description'],
  });

  // 서버 데이터 → 폼 초기값 주입
  useEffect(() => {
    if (!member) return;
    reset({
      name: member.name ?? '',
      memberId: member.member_id ?? '',
      email: member.email ?? '',
      password: '',
      passwordConfirm: '',
      phone: toDigits(member.phone ?? ''),
      role: (member.role === 'admin' ? 'admin' : 'user') satisfies MemberRole,
      description: member.description ?? '',
    });
  }, [member, reset]);

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[{ label: '멤버 관리', path: '/member-management' }, { label: '멤버 수정' }]}
          onNavigate={navigate}
        />
      </div>

      <div className="page-title-box">
        <h2 className="page-title">멤버 수정</h2>
      </div>

      <div className="page-content page-p-40">
        <div className="page-input-box">
          {/* 이름 (수정불가) */}
          <div className="page-input_item-box">
            <div className="page-input_item-name">이름</div>
            <div className="page-input_item-data">
              <Input
                name="name"
                placeholder="이름을 입력해주세요."
                value={name}
                readOnly
                disabled
              />
            </div>
          </div>

          {/* 아이디 (수정불가) */}
          <div className="page-input_item-box">
            <div className="page-input_item-name">아이디</div>
            <div className="page-input_item-data">
              <Input name="memberId" value={memberId} readOnly disabled />
            </div>
          </div>

          {/* 이메일 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">이메일</div>
            <div className="page-input_item-data">
              <Input
                placeholder="email을 입력해주세요."
                errMessage={errors.email?.message}
                {...register('email')}
              />
            </div>
          </div>

          {/* 비밀번호(선택) */}
          <div className="page-input_item-box">
            <div className="page-input_item-name">비밀번호 변경</div>
            <div className="page-input_item-data">
              <Input
                type="password"
                placeholder="새 비밀번호 (선택)"
                errMessage={errors.password?.message}
                // 비밀번호를 바꾸면 확인란의 일치 에러도 즉시 다시 검사한다
                {...register('password', { deps: ['passwordConfirm'] })}
              />
              <div className="page-input_item-data mt-2">
                <Input
                  type="password"
                  placeholder="새 비밀번호 확인"
                  errMessage={errors.passwordConfirm?.message}
                  {...register('passwordConfirm', { deps: ['password'] })}
                />
              </div>
            </div>
          </div>

          {/* 연락처 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">연락처</div>
            <div className="page-input_item-data">
              <Controller
                control={control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Input
                    placeholder="숫자만 입력해주세요."
                    value={formatPhone(field.value)}
                    errMessage={fieldState.error?.message}
                    onBlur={field.onBlur}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      field.onChange(toDigits(e.target.value))
                    }
                  />
                )}
              />
            </div>
          </div>

          {/* 역할 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">역할</div>
            <div className="page-input_item_round-data">
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <>
                    <div className="py-2">
                      <RadioButton
                        id="radio-user"
                        label="사용자"
                        value="user"
                        checked={field.value === 'user'}
                        onCheckedChange={() => field.onChange('user')}
                      />
                    </div>
                    <RadioButton
                      id="radio-admin"
                      label="관리자"
                      value="admin"
                      checked={field.value === 'admin'}
                      onCheckedChange={() => field.onChange('admin')}
                    />
                  </>
                )}
              />
            </div>
          </div>

          {/* 설명 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name">설명</div>
            <div className="page-input_item-data">
              <Textarea
                placeholder="설명을 입력해주세요."
                {...register('description')}
                value={description}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="page-footer">
        <div className="page-footer_btn-box">
          <div />
          <div>
            <Button size="large" color="secondary" onClick={() => navigate(-1)}>
              취소
            </Button>
            <EditMemberAction form={form} />
          </div>
        </div>
      </div>
    </main>
  );
}
