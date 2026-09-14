import { useState } from 'react';
import { Button, Input, Password } from '@innogrid/ui';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Logo from '../../assets/img/header/logo.svg';
import styles from './login.module.scss';
import { useLogin } from '../../hooks/service/authentication';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

const MEMBER_ID_INPUT_ID = 'member-id';
const MEMBER_ID_ERROR_ID = 'member-id-error';
const PASSWORD_INPUT_ID = 'password';
const PASSWORD_ERROR_ID = 'password-error';
const LOGIN_ERROR_ID = 'login-error';

const loginFormSchema = z.object({
  memberId: z.string().min(1, '아이디는 필수입니다.'),
  password: z.string().min(1, '비밀번호는 필수입니다.'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

// 입력에 연결할 설명(aria-describedby) id — 표시 중인 에러만 포함한다
const describedBy = (...ids: (string | false | undefined)[]) =>
  ids.filter(Boolean).join(' ') || undefined;

export default function LoginPage() {
  const { isAuthenticated, setAccessToken } = useAuth();
  // 서버 응답 에러(자격 증명·네트워크)는 두 입력에 공통으로 표시한다 — 필드 검증 에러와 별도
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { mutate: login, isPending } = useLogin();
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { memberId: '', password: '' },
  });
  const memberId = useWatch({ control, name: 'memberId' });
  // 서버 에러가 떠 있는 동안은 필드 에러를 숨겨 붉은 문구가 겹치지 않게 한다(다음 제출에서 서버 에러가 지워진다).
  // innogrid errMessage는 id 없이 렌더돼 스크린리더에 연결되지 않으므로 필드 에러는 직접 렌더한다.
  const memberIdError = errorMessage ? undefined : errors.memberId?.message;
  const passwordError = errorMessage ? undefined : errors.password?.message;

  const onValid = ({ memberId, password }: LoginFormValues) => {
    setErrorMessage('');

    login(
      { member_id: memberId, password },
      {
        onSuccess: (data) => {
          setAccessToken(data.access_token);

          navigate('/service');
        },
        onError: (error) => {
          let message = error.message || '로그인에 실패했습니다.';

          if (error.message.includes('HTTP 401')) {
            message = '아이디 또는 비밀번호를 확인해주세요.';
          } else if (/Network|Failed to fetch|fetch failed/i.test(error.message)) {
            message = '네트워크 연결을 확인해주세요.';
          }

          setErrorMessage(message);
        },
      }
    );
  };

  // 검증에 실패한 재제출도 이전 서버 에러는 지운다(제출마다 초기화되던 기존 동작 유지)
  const onInvalid = () => setErrorMessage('');

  const handleClearMemberId = () => {
    // 값과 함께 필드 검증 에러도 지우고 포커스를 되돌린다
    resetField('memberId');
    setFocus('memberId');
  };

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <main className={styles.loginMain}>
      <form onSubmit={handleSubmit(onValid, onInvalid)} noValidate className={styles.loginBox}>
        <div>
          <Logo />
        </div>
        <p>로그인</p>
        <div className={styles.loginInputBox}>
          <div>
            <label htmlFor={MEMBER_ID_INPUT_ID}>아이디</label>
            <div className={`${styles.inputBox} ${styles.idInput}`}>
              <Controller
                name="memberId"
                control={control}
                render={({ field }) => (
                  <Input
                    ref={field.ref}
                    id={MEMBER_ID_INPUT_ID}
                    name="username"
                    autoComplete="username"
                    placeholder="아이디를 입력해주세요."
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    size="large"
                    customSize={{ width: '100%', height: '48px' }}
                    variant={errorMessage || memberIdError ? 'err' : 'default'}
                    aria-invalid={Boolean(errorMessage || memberIdError)}
                    aria-describedby={describedBy(
                      errorMessage && LOGIN_ERROR_ID,
                      memberIdError && MEMBER_ID_ERROR_ID
                    )}
                  />
                )}
              />
              {memberId && (
                <button
                  type="button"
                  aria-label="아이디 지우기"
                  onClick={handleClearMemberId}
                  className={styles.btnDel}
                />
              )}
            </div>
            {memberIdError && (
              <p id={MEMBER_ID_ERROR_ID} role="alert" className={styles.errorMessage}>
                {memberIdError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={PASSWORD_INPUT_ID}>비밀번호</label>
            <div className={styles.inputBox}>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Password
                    ref={field.ref}
                    id={PASSWORD_INPUT_ID}
                    name="password"
                    autoComplete="current-password"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    size="large"
                    customSize={{ width: '100%', height: '48px' }}
                    variant={errorMessage || passwordError ? 'err' : 'default'}
                    aria-invalid={Boolean(errorMessage || passwordError)}
                    aria-describedby={describedBy(
                      errorMessage && LOGIN_ERROR_ID,
                      passwordError && PASSWORD_ERROR_ID
                    )}
                  />
                )}
              />
            </div>
            {passwordError && (
              <p id={PASSWORD_ERROR_ID} role="alert" className={styles.errorMessage}>
                {passwordError}
              </p>
            )}
            {errorMessage && (
              <p id={LOGIN_ERROR_ID} role="alert" className={styles.errorMessage}>
                {errorMessage}
              </p>
            )}
          </div>
        </div>
        <div className={styles.btnBox}>
          <Button disabled={isPending} color="primary" size="large">
            로그인
          </Button>
        </div>
      </form>
      <p className={styles.copyright}>© 2026 Innogrid. All rights reserved copyright.</p>
    </main>
  );
}
