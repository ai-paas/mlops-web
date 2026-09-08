import '@/test/mocks/innogrid-ui';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { BASE_URL, mockMembers } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import { EditMemberAction } from './edit-member-action';
import { memberEditSchema, type MemberEditFormValues } from './member-form';

const baseValues: MemberEditFormValues = {
  name: '홍길동',
  memberId: 'hong-gildong',
  email: 'hong@example.com',
  password: '',
  passwordConfirm: '',
  phone: '01012345678',
  role: 'user',
  description: '테스트 회원',
};

// 페이지처럼 RHF 폼을 소유하고 액션에 넘기는 하네스
const Harness = ({ values }: { values: MemberEditFormValues }) => {
  const form = useForm<MemberEditFormValues>({
    resolver: zodResolver(memberEditSchema),
    defaultValues: values,
  });
  return <EditMemberAction form={form} />;
};

const submitUpdate = async (values: MemberEditFormValues) => {
  let capturedBody: Record<string, unknown> | undefined;
  server.use(
    http.put(`${BASE_URL}/members/:memberId`, async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(mockMembers[0]);
    })
  );
  const { user } = renderWithUser(<Harness values={values} />);

  await user.click(screen.getByRole('button', { name: '수정' }));
  await user.click(await screen.findByRole('button', { name: '확인' }));

  await waitFor(() => expect(capturedBody).toBeDefined());
  return capturedBody;
};

describe('EditMemberAction 요청 계약', () => {
  it('비밀번호를 변경하지 않으면 password, password_confirm, is_active를 전송하지 않는다', async () => {
    const capturedBody = await submitUpdate(baseValues);

    expect(capturedBody).toEqual({
      name: '홍길동',
      email: 'hong@example.com',
      phone: '01012345678',
      role: 'user',
      description: '테스트 회원',
    });
    expect(capturedBody).not.toHaveProperty('password');
    expect(capturedBody).not.toHaveProperty('password_confirm');
    expect(capturedBody).not.toHaveProperty('is_active');
  });

  it('비밀번호를 변경하면 password만 추가하고 password_confirm, is_active는 전송하지 않는다', async () => {
    const capturedBody = await submitUpdate({
      ...baseValues,
      password: 'Abcd123!',
      passwordConfirm: 'Abcd123!',
    });

    expect(capturedBody).toEqual({
      name: '홍길동',
      email: 'hong@example.com',
      phone: '01012345678',
      role: 'user',
      description: '테스트 회원',
      password: 'Abcd123!',
    });
    expect(capturedBody).not.toHaveProperty('password_confirm');
    expect(capturedBody).not.toHaveProperty('is_active');
  });

  it('검증에 실패하면(비밀번호 규칙 위반) 확인 모달을 열지 않는다', async () => {
    const { user } = renderWithUser(
      <Harness values={{ ...baseValues, password: 'weak', passwordConfirm: 'weak' }} />
    );

    await user.click(screen.getByRole('button', { name: '수정' }));

    await waitFor(() => {
      expect(
        screen.queryByText('입력하신 정보로 회원 정보를 수정하시겠습니까?')
      ).not.toBeInTheDocument();
    });
  });

  it('수정 실패 시 서버 detail 메시지를 결과 모달에 보인다', async () => {
    server.use(
      http.put(`${BASE_URL}/members/:memberId`, () =>
        HttpResponse.json({ detail: '이메일이 이미 사용 중입니다.' }, { status: 409 })
      )
    );
    const { user } = renderWithUser(<Harness values={baseValues} />);

    await user.click(screen.getByRole('button', { name: '수정' }));
    await user.click(await screen.findByRole('button', { name: '확인' }));

    expect(await screen.findByText('이메일이 이미 사용 중입니다.')).toBeInTheDocument();
  });
});
