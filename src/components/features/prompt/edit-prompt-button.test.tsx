import { toastOpenSpy } from '@/test/mocks/innogrid-ui';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { BASE_URL, mockPrompts } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import type { UpdatePromptRequest } from '@/types/prompt';
import { EditPromptButton } from './edit-prompt-button';

type UpdateBody = Omit<UpdatePromptRequest, 'surro_prompt_id'>;

const NAME_INPUT = '이름을 입력해주세요.';
const CONTENT_INPUT = '프롬프트를 입력해주세요.';

// 모달을 열고 기존 프롬프트가 폼에 로드될 때까지 대기
const openModal = async (user: ReturnType<typeof renderWithUser>['user']) => {
  await user.click(screen.getByRole('button', { name: '편집' }));
  await waitFor(() => {
    expect(screen.getByPlaceholderText(NAME_INPUT)).toHaveValue('기본 프롬프트');
  });
};

// userEvent.type의 '{' 이스케이프 함정을 피하기 위해 변수 문법은 붙여넣기로 입력한다
const replaceContent = async (
  user: ReturnType<typeof renderWithUser>['user'],
  content: string
) => {
  await user.clear(screen.getByPlaceholderText(CONTENT_INPUT));
  await user.paste(content);
};

describe('EditPromptButton', () => {
  describe('렌더링', () => {
    it('promptId가 없으면 편집 버튼이 비활성화된다', () => {
      renderWithUser(<EditPromptButton />);

      expect(screen.getByRole('button', { name: '편집' })).toBeDisabled();
    });

    it('초기 상태에서 모달이 표시되지 않는다', () => {
      renderWithUser(<EditPromptButton promptId={301} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('모달 인터랙션', () => {
    it('편집 클릭 시 기존 프롬프트 값과 사용 가능한 변수 안내가 표시된다', async () => {
      const { user } = renderWithUser(<EditPromptButton promptId={301} />);

      await openModal(user);

      expect(screen.getByText('프롬프트 편집')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('설명을 입력해주세요.')).toHaveValue('기본 설명');
      expect(screen.getByPlaceholderText(CONTENT_INPUT)).toHaveValue('너는 친절한 비서다.');
      // 변수 타입 목록(handlers/prompts.ts)이 안내문에 노출된다
      expect(
        screen.getByText(/사용 가능한 변수: \{\{#context#\}\}, \{\{#query#\}\}/)
      ).toBeInTheDocument();
    });

    it('취소 클릭 시 모달이 닫힌다', async () => {
      const { user } = renderWithUser(<EditPromptButton promptId={301} />);

      await openModal(user);
      await user.click(screen.getByRole('button', { name: '취소' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('변수 검증', () => {
    it('허용되지 않은 변수를 쓰면 경고가 표시되고 확인 버튼이 비활성화된다', async () => {
      const { user } = renderWithUser(<EditPromptButton promptId={301} />);

      await openModal(user);
      await replaceContent(user, '다음을 참고해줘 {{#foo#}}');

      expect(
        await screen.findByText('사용할 수 없는 변수입니다: {{#foo#}}')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
    });

    it('허용된 변수만 쓰면 경고 없이 확인 버튼이 활성화된다', async () => {
      const { user } = renderWithUser(<EditPromptButton promptId={301} />);

      await openModal(user);
      await replaceContent(user, '{{#context#}}를 참고해 {{#query#}}에 답해줘');

      expect(screen.queryByText(/사용할 수 없는 변수입니다/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '확인' })).toBeEnabled();
    });
  });

  describe('폼 검증', () => {
    it('이름을 비우고 제출하면 에러가 표시되고 요청이 발생하지 않는다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.put(`${BASE_URL}/prompts/:surroPromptId`, () => {
          requestSpy();
          return HttpResponse.json(mockPrompts[0]);
        })
      );
      const { user } = renderWithUser(<EditPromptButton promptId={301} />);

      await openModal(user);
      await user.clear(screen.getByPlaceholderText(NAME_INPUT));
      await user.click(screen.getByRole('button', { name: '확인' }));

      expect(await screen.findByText('이름은 필수입니다.')).toBeInTheDocument();
      expect(requestSpy).not.toHaveBeenCalled();
    });

    it('본문을 비우고 제출하면 본문 필수 에러가 표시되고 요청이 발생하지 않는다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.put(`${BASE_URL}/prompts/:surroPromptId`, () => {
          requestSpy();
          return HttpResponse.json(mockPrompts[0]);
        })
      );
      const { user } = renderWithUser(<EditPromptButton promptId={301} />);

      await openModal(user);
      await user.clear(screen.getByPlaceholderText(CONTENT_INPUT));
      await user.click(screen.getByRole('button', { name: '확인' }));

      expect(await screen.findByText('프롬프트 내용은 필수입니다.')).toBeInTheDocument();
      expect(requestSpy).not.toHaveBeenCalled();
    });
  });

  describe('폼 제출', () => {
    it('수정한 값과 중복 제거된 변수 목록이 PUT 본문에 담기고 성공 시 모달이 닫힌다', async () => {
      let captured: UpdateBody | undefined;
      let capturedId: string | undefined;
      server.use(
        http.put(`${BASE_URL}/prompts/:surroPromptId`, async ({ params, request }) => {
          capturedId = params.surroPromptId as string;
          captured = (await request.json()) as UpdateBody;
          return HttpResponse.json(mockPrompts[0]);
        })
      );
      const { user } = renderWithUser(<EditPromptButton promptId={301} />);

      await openModal(user);

      const nameInput = screen.getByPlaceholderText(NAME_INPUT);
      await user.clear(nameInput);
      await user.type(nameInput, '수정된 프롬프트');
      // 같은 변수를 두 번 써도 prompt_variable에는 한 번만 담긴다
      await replaceContent(user, '{{#context#}} 그리고 {{#context#}}와 {{#query#}}');

      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(captured).toBeDefined();
      });
      expect(capturedId).toBe('301');
      expect(captured).toEqual({
        name: '수정된 프롬프트',
        description: '기본 설명',
        content: '{{#context#}} 그리고 {{#context#}}와 {{#query#}}',
        prompt_variable: ['context', 'query'],
      });

      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'positive', title: '프롬프트 편집 성공' })
      );
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('편집 실패 시 서버 detail을 담은 실패 토스트가 뜨고 모달은 열려 있다', async () => {
      server.use(
        http.put(`${BASE_URL}/prompts/:surroPromptId`, () =>
          HttpResponse.json({ detail: '같은 이름의 프롬프트가 있습니다.' }, { status: 409 })
        )
      );
      const { user } = renderWithUser(<EditPromptButton promptId={301} />);

      await openModal(user);
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'negative',
            title: '프롬프트 편집 실패',
            children: '같은 이름의 프롬프트가 있습니다.',
          })
        );
      });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
