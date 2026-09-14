import { toastOpenSpy } from '@/test/mocks/innogrid-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { BASE_URL } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import { DeletePromptButton } from './delete-prompt-button';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mockNavigate,
}));

const QUESTION = '프롬프트를 삭제하시겠습니까?';

const openAndConfirm = async (user: ReturnType<typeof renderWithUser>['user']) => {
  await user.click(screen.getByRole('button', { name: '삭제' }));
  expect(screen.getByText(QUESTION)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '확인' }));
};

describe('DeletePromptButton', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    toastOpenSpy.mockClear();
  });

  it('promptId가 없으면 버튼이 비활성화된다', () => {
    renderWithUser(<DeletePromptButton />);

    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
  });

  it('삭제 성공 시 성공 토스트를 띄우고 다이얼로그를 닫은 뒤 redirect로 이동한다', async () => {
    const { user } = renderWithUser(<DeletePromptButton promptId={1} redirect="/prompt" />);

    await openAndConfirm(user);

    await waitFor(() => {
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'positive', title: '프롬프트 삭제 성공' })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/prompt', { replace: true });
  });

  it('삭제 실패 시 서버 detail 메시지를 토스트 본문에 표시하고 이동하지 않는다', async () => {
    server.use(
      http.delete(`${BASE_URL}/prompts/:surroPromptId`, () =>
        HttpResponse.json({ detail: '사용 중인 프롬프트는 삭제할 수 없습니다.' }, { status: 409 })
      )
    );
    const { user } = renderWithUser(<DeletePromptButton promptId={1} redirect="/prompt" />);

    await openAndConfirm(user);

    await waitFor(() => {
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'negative',
          title: '프롬프트 삭제 실패',
          children: '사용 중인 프롬프트는 삭제할 수 없습니다.',
        })
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('서버 detail이 없으면 기본 실패 문구를 표시한다', async () => {
    server.use(
      http.delete(`${BASE_URL}/prompts/:surroPromptId`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })
      )
    );
    const { user } = renderWithUser(<DeletePromptButton promptId={1} />);

    await openAndConfirm(user);

    await waitFor(() => {
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ children: '프롬프트 삭제 중 오류가 발생했습니다.' })
      );
    });
  });
});
