import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { toastOpenSpy } from '@/test/mocks/innogrid-ui';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createModel: vi.fn(),
  // 허브(huggingface/kaggle) 검색 페이지가 navigate state로 넘기는 값 — 테스트별로 갈아 끼운다
  locationState: undefined as unknown,
}));

vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mocks.navigate,
  useLocation: () => ({
    pathname: '/model/custom-model/create',
    search: '',
    hash: '',
    key: 'test',
    state: mocks.locationState,
  }),
}));

// 옵션 조회는 MSW(handlers/models.ts)로 흘리고, multipart 생성 요청만 목으로 잡아 FormData를 직접 단언한다
// (MSW 핸들러의 request.formData()는 jsdom File 본문에서 행이 걸린다 — TEST_PLAN 부록 B)
vi.mock('@/hooks/service/models', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/service/models')>()),
  useCreateModel: () => ({ createModel: mocks.createModel, isPending: false }),
}));

import CustomModelCreatePage from './page';

const renderPage = async () => {
  const view = renderWithUser(<CustomModelCreatePage />);
  // 공급자·타입·포맷 옵션 로드가 끝난 뒤에 상호작용을 시작한다
  await screen.findByRole('option', { name: 'Hugging Face' });
  await screen.findByRole('option', { name: 'LLM' });
  await screen.findByRole('option', { name: 'safetensors' });
  return view;
};

const lastFormData = () => mocks.createModel.mock.calls.at(-1)?.[0] as FormData;

describe('CustomModelCreatePage', () => {
  beforeEach(() => {
    mocks.locationState = undefined;
    mocks.createModel.mockResolvedValue({ id: 99 });
  });

  it('아무 입력 없이 생성하면 필수 5개 필드의 에러를 인라인으로 표시하고 요청하지 않는다', async () => {
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: '생성' }));

    expect(await screen.findByText('모델명은 필수입니다.')).toBeInTheDocument();
    expect(screen.getByText('모델 ID는 필수입니다.')).toBeInTheDocument();
    expect(screen.getByText('모델 공급자는 필수입니다.')).toBeInTheDocument();
    expect(screen.getByText('모델 타입은 필수입니다.')).toBeInTheDocument();
    expect(screen.getByText('모델 포맷은 필수입니다.')).toBeInTheDocument();
    expect(mocks.createModel).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('직접 입력한 값과 파일·소개·샘플 코드를 FormData로 보내고 성공 토스트 후 목록으로 이동한다', async () => {
    const { user } = await renderPage();
    const file = new File(['weights'], 'model.safetensors');

    await user.type(screen.getByPlaceholderText('모델명을 입력해주세요.'), '내 모델');
    await user.type(screen.getByPlaceholderText('모델 ID를 입력해주세요.'), 'my-org/my-model');
    await user.selectOptions(screen.getByLabelText('모델 공급자를 선택해주세요.'), 'Custom');
    await user.selectOptions(screen.getByLabelText('모델 타입을 선택해주세요.'), 'LLM');
    await user.selectOptions(screen.getByLabelText('모델 포맷을 선택해주세요.'), 'gguf');
    await user.upload(screen.getByLabelText('파일 업로드'), file);
    await user.type(screen.getByPlaceholderText('설명을 입력해주세요.'), '소개');
    await user.type(screen.getByPlaceholderText('샘플 코드를 입력해주세요.'), 'run()');

    await user.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/model/custom-model'));
    const body = lastFormData();
    expect(Object.fromEntries(body.entries())).toEqual({
      name: '내 모델',
      repo_id: 'my-org/my-model',
      provider_id: '1',
      type_id: '1',
      format_id: '2',
      description: '소개',
      sample_code: 'run()',
      file,
    });
    expect(toastOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'positive', title: '커스텀 모델 생성 성공' })
    );
  });

  it('허브에서 넘어온 모델은 ID를 채워 잠그고 마켓과 일치하는 공급자를 자동 선택한 뒤 그대로 전송한다', async () => {
    mocks.locationState = {
      selectedModel: { id: 'meta-llama/Llama-3-8B' },
      market: 'huggingface',
    };
    const { user } = await renderPage();

    const repoIdInput = screen.getByPlaceholderText('모델 ID를 입력해주세요.');
    await waitFor(() => expect(repoIdInput).toHaveValue('meta-llama/Llama-3-8B'));
    expect(repoIdInput).toBeDisabled();
    // 'huggingface' 마켓 → 'Hugging Face' 공급자(id 2)
    expect(screen.getByLabelText('모델 공급자를 선택해주세요.')).toHaveValue('2');
    // 파일 업로드 대신 저장소 ID를 안내한다
    expect(screen.getByText('meta-llama/Llama-3-8B')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('모델명을 입력해주세요.'), 'Llama 3');
    await user.selectOptions(screen.getByLabelText('모델 타입을 선택해주세요.'), 'LLM');
    await user.selectOptions(screen.getByLabelText('모델 포맷을 선택해주세요.'), 'safetensors');
    await user.click(screen.getByRole('button', { name: '생성' }));

    // disabled 입력이라도 프리필된 repo_id·provider_id가 본문에서 빠지지 않아야 한다
    await waitFor(() => expect(mocks.createModel).toHaveBeenCalledTimes(1));
    const body = lastFormData();
    expect(body.get('repo_id')).toBe('meta-llama/Llama-3-8B');
    expect(body.get('provider_id')).toBe('2');
    expect(body.has('file')).toBe(false);
  });

  it('생성 실패 시 실패 토스트를 띄우고 이동하지 않는다', async () => {
    mocks.createModel.mockRejectedValue(new Error('boom'));
    const { user } = await renderPage();

    await user.type(screen.getByPlaceholderText('모델명을 입력해주세요.'), '내 모델');
    await user.type(screen.getByPlaceholderText('모델 ID를 입력해주세요.'), 'my-org/my-model');
    await user.selectOptions(screen.getByLabelText('모델 공급자를 선택해주세요.'), 'Custom');
    await user.selectOptions(screen.getByLabelText('모델 타입을 선택해주세요.'), 'LLM');
    await user.selectOptions(screen.getByLabelText('모델 포맷을 선택해주세요.'), 'gguf');
    await user.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => {
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'negative',
          title: '커스텀 모델 생성 실패',
          children: '커스텀 모델 생성 중 오류가 발생했습니다.',
        })
      );
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('취소를 클릭하면 커스텀 모델 목록으로 이동한다', async () => {
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/model/custom-model');
  });
});
