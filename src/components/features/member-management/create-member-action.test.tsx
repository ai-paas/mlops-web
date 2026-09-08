import '@/test/mocks/innogrid-ui';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { BASE_URL, mockMembers } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import type { CreateMemberRequest } from '@/types/member';
import { CreateMemberAction } from './create-member-action';
import { memberCreateSchema, type MemberCreateFormValues } from './member-form';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mockNavigate,
}));

// 검증 규칙 자체는 member-form.test.ts가 전수 검증한다. 여기서는 액션이 폼 검증 결과에 따라
// 확인 모달을 열고, 확인 시 페이로드를 보내고, 결과 모달을 처리하는 흐름만 본다.
const validValues: MemberCreateFormValues = {
  name: '홍길동',
  memberId: 'hong-gildong',
  email: 'hong@example.com',
  password: 'Abcd123!',
  passwordConfirm: 'Abcd123!',
  phone: '01012345678',
  role: 'user',
  description: '테스트 회원',
};

// 페이지처럼 RHF 폼을 소유하고 액션에 넘기는 하네스
const Harness = ({ values }: { values: MemberCreateFormValues }) => {
  const form = useForm<MemberCreateFormValues>({
    resolver: zodResolver(memberCreateSchema),
    defaultValues: values,
  });
  return <CreateMemberAction form={form} />;
};

const CONFIRM_QUESTION = '입력하신 정보로 회원을 생성하시겠습니까?';

describe('CreateMemberAction', () => {
  it('"생성" 버튼이 렌더링되고 초기에는 모달이 없다', () => {
    renderWithUser(<Harness values={validValues} />);

    expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it.each([
    ['이름이 비어 있으면', { name: '' }],
    ['아이디 규칙에 어긋나면', { memberId: 'Hong' }],
    ['비밀번호 확인이 다르면', { passwordConfirm: 'Abcd123?' }],
  ])('%s 확인 모달을 열지 않고 요청도 보내지 않는다', async (_label, override) => {
    const requestSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/members/`, () => {
        requestSpy();
        return HttpResponse.json(mockMembers[0]);
      })
    );
    const { user } = renderWithUser(<Harness values={{ ...validValues, ...override }} />);

    await user.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => {
      expect(screen.queryByText(CONFIRM_QUESTION)).not.toBeInTheDocument();
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('검증을 통과하면 확인 모달이 열리고, 취소하면 요청 없이 닫힌다', async () => {
    const requestSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/members/`, () => {
        requestSpy();
        return HttpResponse.json(mockMembers[0]);
      })
    );
    const { user } = renderWithUser(<Harness values={validValues} />);

    await user.click(screen.getByRole('button', { name: '생성' }));
    expect(await screen.findByText(CONFIRM_QUESTION)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '취소' }));

    await waitFor(() => {
      expect(screen.queryByText(CONFIRM_QUESTION)).not.toBeInTheDocument();
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('확인 시 폼 값이 snake_case 페이로드로 전송되고 성공 모달 닫기 후 목록으로 이동한다', async () => {
    let captured: CreateMemberRequest | undefined;
    server.use(
      http.post(`${BASE_URL}/members/`, async ({ request }) => {
        captured = (await request.json()) as CreateMemberRequest;
        return HttpResponse.json({ ...mockMembers[0], member_id: 'hong-gildong' });
      })
    );
    const { user } = renderWithUser(<Harness values={validValues} />);

    await user.click(screen.getByRole('button', { name: '생성' }));
    await user.click(await screen.findByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(captured).toBeDefined();
    });
    expect(captured).toEqual({
      name: '홍길동',
      member_id: 'hong-gildong',
      email: 'hong@example.com',
      phone: '01012345678',
      role: 'user',
      is_active: true,
      description: '테스트 회원',
      password: 'Abcd123!',
      password_confirm: 'Abcd123!',
    });

    // 결과 모달에 생성된 ID가 표시된다
    expect(
      await screen.findByText('회원 생성이 완료되었습니다. ID: hong-gildong')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/member-management');
  });

  it('생성 실패 시 서버 detail 메시지를 결과 모달에 보이고 닫아도 이동하지 않는다', async () => {
    mockNavigate.mockClear();
    server.use(
      http.post(`${BASE_URL}/members/`, () =>
        HttpResponse.json({ detail: '이미 사용 중인 아이디입니다.' }, { status: 409 })
      )
    );
    const { user } = renderWithUser(<Harness values={validValues} />);

    await user.click(screen.getByRole('button', { name: '생성' }));
    await user.click(await screen.findByRole('button', { name: '확인' }));

    expect(await screen.findByText('이미 사용 중인 아이디입니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '닫기' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('서버 detail이 없으면 기본 실패 문구를 보인다', async () => {
    server.use(
      http.post(`${BASE_URL}/members/`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })
      )
    );
    const { user } = renderWithUser(<Harness values={validValues} />);

    await user.click(screen.getByRole('button', { name: '생성' }));
    await user.click(await screen.findByRole('button', { name: '확인' }));

    expect(
      await screen.findByText('회원 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    ).toBeInTheDocument();
  });
});
