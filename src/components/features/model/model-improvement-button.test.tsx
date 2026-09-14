import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { toastOpenSpy } from '@/test/mocks/innogrid-ui';
import { ModelImprovementButton } from './model-improvement-button';

const renderButton = (customModelId?: number) =>
  renderWithUser(
    <ModelImprovementButton
      customModelId={customModelId}
      category="optimization"
      title="하드웨어 최적화"
      selectLabel="최적화 방식"
    />
  );

// 모달을 열고 기법 목록(handlers/models.ts)이 Select에 채워질 때까지 대기
const openModal = async (user: ReturnType<typeof renderButton>['user']) => {
  await user.click(screen.getByRole('button', { name: '하드웨어 최적화' }));
  await screen.findByRole('option', { name: 'tensorrt' });
};

describe('ModelImprovementButton', () => {
  it('customModelId가 없으면 버튼이 비활성화된다', () => {
    renderButton();

    expect(screen.getByRole('button', { name: '하드웨어 최적화' })).toBeDisabled();
  });

  it('방식을 선택하지 않고 확인하면 에러를 표시하고 요청하지 않는다', async () => {
    const requestSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/model-improvements`, () => {
        requestSpy();
        return HttpResponse.json({ task_id: 1 }, { status: 201 });
      })
    );
    const { user } = renderButton(11);
    await openModal(user);

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('적용할 방식은 필수입니다.')).toBeInTheDocument();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('방식을 선택해 확인하면 대상 모델·기법을 POST하고 성공 토스트 후 모달을 닫는다', async () => {
    let captured: unknown;
    server.use(
      http.post(`${BASE_URL}/model-improvements`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ task_id: 1 }, { status: 201 });
      })
    );
    const { user } = renderButton(11);
    await openModal(user);

    await user.selectOptions(screen.getByLabelText('적용할 방식을 선택해주세요.'), 'tensorrt');
    // 폼 값(task_type 문자열) → 표시 옵션 역매핑이 동작해야 선택이 화면에 남는다
    expect(screen.getByLabelText('적용할 방식을 선택해주세요.')).toHaveValue('tensorrt');
    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(captured).toEqual({ source_model_id: 11, task_type: 'tensorrt' });
    });
    expect(toastOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'positive', title: '하드웨어 최적화 요청 완료' })
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('취소하면 선택이 초기화되어 다시 열었을 때 미선택 상태다', async () => {
    const { user } = renderButton(11);
    await openModal(user);
    await user.selectOptions(screen.getByLabelText('적용할 방식을 선택해주세요.'), 'openvino');

    await user.click(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await openModal(user);

    expect(screen.getByLabelText('적용할 방식을 선택해주세요.')).toHaveValue('');
  });

  it('요청 실패 시 서버 detail을 담은 실패 토스트를 띄우고 모달은 열려 있다', async () => {
    server.use(
      http.post(`${BASE_URL}/model-improvements`, () =>
        HttpResponse.json({ detail: '지원하지 않는 모델 형식입니다.' }, { status: 400 })
      )
    );
    const { user } = renderButton(11);
    await openModal(user);

    await user.selectOptions(screen.getByLabelText('적용할 방식을 선택해주세요.'), 'openvino');
    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'negative',
          title: '하드웨어 최적화 요청 실패',
          children: '지원하지 않는 모델 형식입니다.',
        })
      );
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
