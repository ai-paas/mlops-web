import { BreadCrumb, Button, Input, Textarea, RadioButton } from '@innogrid/ui';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { formatPhone } from '@/util/phone';
import { CreateMemberAction } from '@/components/features/member-management/create-member-action';
import {
  createInitialMemberCreateFormValues,
  memberCreateSchema,
  type MemberCreateFormValues,
} from '@/components/features/member-management/member-form';

export default function MemberCreatePage() {
  const navigate = useNavigate();
  const form = useForm<MemberCreateFormValues>({
    resolver: zodResolver(memberCreateSchema),
    defaultValues: createInitialMemberCreateFormValues(),
    // 입력 즉시 검증해 인라인 에러를 보여준다
    mode: 'onChange',
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  // innogrid Textarea는 value가 필수라 register와 함께 현재 값을 넘긴다
  const description = useWatch({ control, name: 'description' });

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[{ label: '멤버 관리', path: '/member-management' }, { label: '멤버 생성' }]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">멤버 생성</h2>
      </div>
      <div className="page-content page-p-40">
        <div className="page-input-box">
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">이름</div>
            <div className="page-input_item-data">
              <Input
                placeholder="이름을 입력해주세요."
                errMessage={errors.name?.message}
                {...register('name')}
              />
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">아이디</div>
            <div className="page-input_item-data">
              <Input
                placeholder="ID를 입력해주세요."
                errMessage={errors.memberId?.message}
                {...register('memberId')}
              />
            </div>
          </div>
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
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">비밀번호</div>
            <div className="page-input_item-data">
              <Input
                type="password"
                placeholder="비밀번호를 입력해주세요."
                errMessage={errors.password?.message}
                // 비밀번호를 바꾸면 확인란의 일치 에러도 즉시 다시 검사한다
                {...register('password', { deps: ['passwordConfirm'] })}
              />
              <div className="page-input_item-data mt-2">
                <Input
                  type="password"
                  placeholder="비밀번호를 한 번 더 입력해주세요."
                  errMessage={errors.passwordConfirm?.message}
                  {...register('passwordConfirm')}
                />
              </div>
            </div>
          </div>

          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">연락처</div>
            <div className="page-input_item-data">
              <Controller
                control={control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Input
                    placeholder="숫자만 입력해주세요."
                    // 폼에는 숫자만(최대 11자리) 보관하고 화면에는 하이픈 포맷으로 표시한다
                    value={formatPhone(field.value)}
                    errMessage={fieldState.error?.message}
                    onBlur={field.onBlur}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      field.onChange(e.target.value.replace(/\D/g, '').slice(0, 11))
                    }
                  />
                )}
              />
            </div>
          </div>

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
            <Button size="large" color="secondary" onClick={() => navigate('/member-management')}>
              취소
            </Button>
            <CreateMemberAction form={form} />
          </div>
        </div>
      </div>
    </main>
  );
}
