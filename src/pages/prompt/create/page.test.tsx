import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { fireEvent, renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { toastOpenSpy } from '@/test/mocks/innogrid-ui';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mockNavigate,
}));

import PromptCreatePage from './page';

// PromptEditor는 실제 컴포넌트 — fireEvent.change로 본문을 넣으면 키 이벤트가 없어
// 변수 선택 팝오버 로직을 건드리지 않는다 (팝오버 동작은 prompt-editor.test.tsx가 담당).
const contentPlaceholder =
  '예) 당신은 친절한 고객 상담원입니다. 다음 질문에 정중하게 답변해주세요: {{#context#}}';

const renderPage = async () => {
  const view = renderWithUser(<PromptCreatePage />);
  // variable-types(available_types: context, query) 로드가 끝난 뒤에 상호작용을 시작한다
  await screen.findByText(/사용 가능한 변수: \{\{#context#\}\}, \{\{#query#\}\}/);
  return view;
};

const setContent = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText(contentPlaceholder), { target: { value } });
};

// 생성 POST 도달 여부만 기록하는 핸들러
const spyCreateRequest = () => {
  const requestSpy = vi.fn();
  server.use(
    http.post(`${BASE_URL}/prompts`, () => {
      requestSpy();
      return HttpResponse.json({ surro_prompt_id: 999 }, { status: 201 });
    })
  );
  return requestSpy;
};

describe('PromptCreatePage', () => {
  it('variable-types 응답으로 사용 가능한 변수 안내를 렌더한다', async () => {
    await renderPage();

    expect(
      screen.getByText(/사용 가능한 변수: \{\{#context#\}\}, \{\{#query#\}\}/)
    ).toBeInTheDocument();
  });

  it('아무 입력 없이 생성하면 이름·본문 필수 에러를 인라인으로 표시하고 요청하지 않는다', async () => {
    const requestSpy = spyCreateRequest();
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: '생성' }));

    expect(await screen.findByText('이름은 필수입니다.')).toBeInTheDocument();
    expect(screen.getByText('프롬프트 내용은 필수입니다.')).toBeInTheDocument();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('본문만 입력하면 이름 에러만 표시된다', async () => {
    const requestSpy = spyCreateRequest();
    const { user } = await renderPage();
    setContent('본문만 입력');

    await user.click(screen.getByRole('button', { name: '생성' }));

    expect(await screen.findByText('이름은 필수입니다.')).toBeInTheDocument();
    expect(screen.queryByText('프롬프트 내용은 필수입니다.')).not.toBeInTheDocument();
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('이름만 입력하면 본문 에러만 표시되고, 본문을 채우면 에러가 사라진다', async () => {
    const requestSpy = spyCreateRequest();
    const { user } = await renderPage();
    await user.type(screen.getByPlaceholderText('이름을 입력해주세요.'), '상담 프롬프트');

    await user.click(screen.getByRole('button', { name: '생성' }));

    expect(await screen.findByText('프롬프트 내용은 필수입니다.')).toBeInTheDocument();
    expect(screen.queryByText('이름은 필수입니다.')).not.toBeInTheDocument();
    expect(requestSpy).not.toHaveBeenCalled();

    // 제출 후에는 입력 즉시 재검증(reValidateMode: onChange)되어 에러가 지워진다
    setContent('본문 입력');
    await waitFor(() => {
      expect(screen.queryByText('프롬프트 내용은 필수입니다.')).not.toBeInTheDocument();
    });
  });

  it('제출 에러가 있는 상태에서 허용 외 변수를 입력하면 경고를 한 번만 표시한다', async () => {
    const { user } = await renderPage();
    await user.type(screen.getByPlaceholderText('이름을 입력해주세요.'), '상담 프롬프트');
    await user.click(screen.getByRole('button', { name: '생성' }));
    expect(await screen.findByText('프롬프트 내용은 필수입니다.')).toBeInTheDocument();

    // 재검증(onChange)으로 zod 에러가 허용 외 변수 메시지로 바뀌어도 실시간 경고와 중복 표시되지 않아야 한다
    setContent('참고: {{#foo#}}');

    await waitFor(() => {
      expect(screen.queryByText('프롬프트 내용은 필수입니다.')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText(/사용할 수 없는 변수입니다: \{\{#foo#\}\}/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled();
  });

  it('본문에서 변수를 추출(공백 trim·중복 제거)해 함께 POST하고 성공 토스트 후 목록으로 이동한다', async () => {
    let captured: unknown;
    server.use(
      http.post(`${BASE_URL}/prompts`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ surro_prompt_id: 999 }, { status: 201 });
      })
    );

    const { user } = await renderPage();
    await user.type(screen.getByPlaceholderText('이름을 입력해주세요.'), '상담 프롬프트');
    await user.type(screen.getByPlaceholderText('설명을 입력해주세요.'), '고객 상담용');
    // context는 공백 포함 표기와 중복으로 두 번 등장 — 추출 결과는 한 번만 담겨야 한다
    setContent('질문: {{#query#}} 참고: {{# context #}} 재참고: {{#context#}}');

    await user.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/prompt');
    });
    expect(captured).toEqual({
      prompt: {
        name: '상담 프롬프트',
        description: '고객 상담용',
        content: '질문: {{#query#}} 참고: {{# context #}} 재참고: {{#context#}}',
      },
      prompt_variable: ['query', 'context'],
    });
    expect(toastOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'positive', title: '프롬프트 생성 성공' })
    );
  });

  it('생성 실패 시 서버 detail을 담은 실패 토스트를 띄우고 이동하지 않는다', async () => {
    server.use(
      http.post(`${BASE_URL}/prompts`, () =>
        HttpResponse.json({ detail: '같은 이름의 프롬프트가 있습니다.' }, { status: 409 })
      )
    );

    const { user } = await renderPage();
    await user.type(screen.getByPlaceholderText('이름을 입력해주세요.'), '상담 프롬프트');
    setContent('본문');

    await user.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => {
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'negative',
          title: '프롬프트 생성 실패',
          children: '같은 이름의 프롬프트가 있습니다.',
        })
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('허용되지 않은 변수가 있으면 경고 문구를 표시하고 생성 버튼을 비활성화한다', async () => {
    await renderPage();

    setContent('참고: {{#foo#}}');

    expect(screen.getByText(/사용할 수 없는 변수입니다: \{\{#foo#\}\}/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled();
  });

  it('허용되지 않은 변수를 지우면 경고가 사라지고 생성 버튼이 다시 활성화된다', async () => {
    await renderPage();

    setContent('참고: {{#foo#}}');
    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled();

    setContent('참고: {{#context#}}');

    expect(screen.queryByText(/사용할 수 없는 변수입니다/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '생성' })).toBeEnabled();
  });

  it('취소를 클릭하면 프롬프트 목록으로 이동한다', async () => {
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(mockNavigate).toHaveBeenCalledWith('/prompt');
  });
});
