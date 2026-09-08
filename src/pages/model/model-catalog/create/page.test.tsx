import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { toastOpenSpy } from '@/test/mocks/innogrid-ui';
import type { ModelProvider } from '@/types/model';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createModel: vi.fn(),
}));

vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mocks.navigate,
}));

// 옵션 조회는 MSW(handlers/models.ts)로 흘리고, multipart 생성 요청만 목으로 잡아 FormData를 직접 단언한다
// (MSW 핸들러의 request.formData()는 jsdom File 본문에서 행이 걸린다 — TEST_PLAN 부록 B)
vi.mock('@/hooks/service/models', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/service/models')>()),
  useCreateModel: () => ({ createModel: mocks.createModel, isPending: false }),
}));

import ModelCatalogCreatePage, { getRepoIdDescription } from './page';

const provider = (name: string): ModelProvider => ({ id: 1, name, description: '' });

describe('getRepoIdDescription', () => {
  it('공급자 미선택 시 공급자 먼저 선택하라고 안내한다', () => {
    expect(getRepoIdDescription(undefined)).toBe('모델 공급자를 먼저 선택해주세요.');
  });

  it('custom 공급자는 임의 입력 안내를 보여준다', () => {
    expect(getRepoIdDescription(provider('Custom'))).toBe(
      '모델 저장소(Repository)의 고유 ID를 임의로 입력해주세요.'
    );
  });

  it('Hugging Face 공급자는 예시와 함께 등록된 ID 입력을 안내한다', () => {
    expect(getRepoIdDescription(provider('Hugging Face'))).toBe(
      'Hugging Face에 등록된 모델 ID를 정확히 입력해주세요. (예: meta-llama/Llama-3-8B)'
    );
  });

  it('Kaggle 공급자는 예시와 함께 등록된 ID 입력을 안내한다', () => {
    expect(getRepoIdDescription(provider('Kaggle'))).toBe(
      'Kaggle에 등록된 모델 ID를 정확히 입력해주세요. (예: google/gemma/PyTorch/7b)'
    );
  });

  // 공급자 이름은 백엔드 데이터라 표기가 흔들릴 수 있다 — 정규화 매칭 검증
  it.each([
    ['CUSTOM', '임의로 입력'],
    ['custom-model', '임의로 입력'],
    ['HuggingFace', 'Hugging Face에 등록된'],
    ['hugging-face', 'Hugging Face에 등록된'],
    ['KAGGLE', 'Kaggle에 등록된'],
  ])('공급자 이름 "%s"의 표기 차이를 무시하고 매칭한다', (name, expected) => {
    expect(getRepoIdDescription(provider(name))).toContain(expected);
  });

  it('알려지지 않은 허브 공급자는 공급자 이름을 포함해 안내한다', () => {
    expect(getRepoIdDescription(provider('OpenML'))).toBe(
      'OpenML에 등록된 모델 ID를 정확히 입력해주세요.'
    );
  });
});

const renderPage = async () => {
  const view = renderWithUser(<ModelCatalogCreatePage />);
  // 공급자·타입·포맷 옵션 로드가 끝난 뒤에 상호작용을 시작한다
  await screen.findByRole('option', { name: 'Hugging Face' });
  await screen.findByRole('option', { name: 'LLM' });
  await screen.findByRole('option', { name: 'safetensors' });
  return view;
};

const lastFormData = () => mocks.createModel.mock.calls.at(-1)?.[0] as FormData;

describe('ModelCatalogCreatePage', () => {
  beforeEach(() => {
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

  it('공급자를 선택하면 모델 ID 안내가 공급자별 문구로 바뀐다', async () => {
    const { user } = await renderPage();
    expect(screen.getByText('모델 공급자를 먼저 선택해주세요.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('모델 공급자를 선택해주세요.'), 'Hugging Face');

    expect(
      screen.getByText(
        'Hugging Face에 등록된 모델 ID를 정확히 입력해주세요. (예: meta-llama/Llama-3-8B)'
      )
    ).toBeInTheDocument();
  });

  it('필수 필드를 채우면 소개·샘플 코드·파일까지 FormData로 보내고 성공 토스트 후 목록으로 이동한다', async () => {
    const { user } = await renderPage();
    const file = new File(['weights'], 'model.safetensors');

    await user.type(screen.getByPlaceholderText('모델명을 입력해주세요.'), 'Llama 3');
    await user.selectOptions(screen.getByLabelText('모델 공급자를 선택해주세요.'), 'Hugging Face');
    await user.type(
      screen.getByPlaceholderText('모델 ID를 입력해주세요.'),
      'meta-llama/Llama-3-8B'
    );
    await user.selectOptions(screen.getByLabelText('모델 타입을 선택해주세요.'), 'LLM');
    await user.selectOptions(screen.getByLabelText('모델 포맷을 선택해주세요.'), 'safetensors');
    await user.upload(screen.getByLabelText('파일 업로드'), file);
    await user.type(screen.getByPlaceholderText('설명을 입력해주세요.'), '소개');
    await user.type(screen.getByPlaceholderText('샘플 코드를 입력해주세요.'), 'run()');

    await user.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/model/model-catalog'));
    // 이전 구현은 모델 소개·샘플 코드를 입력받고도 본문에서 빠뜨렸다 — 이제 함께 전송된다
    expect(Object.fromEntries(lastFormData().entries())).toEqual({
      name: 'Llama 3',
      repo_id: 'meta-llama/Llama-3-8B',
      provider_id: '2',
      type_id: '1',
      format_id: '1',
      description: '소개',
      sample_code: 'run()',
      file,
    });
    expect(toastOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'positive', title: '모델 카탈로그 생성 성공' })
    );
  });

  it('생성 실패 시 실패 토스트를 띄우고 이동하지 않는다', async () => {
    mocks.createModel.mockRejectedValue(new Error('boom'));
    const { user } = await renderPage();

    await user.type(screen.getByPlaceholderText('모델명을 입력해주세요.'), 'Llama 3');
    await user.selectOptions(screen.getByLabelText('모델 공급자를 선택해주세요.'), 'Custom');
    await user.type(screen.getByPlaceholderText('모델 ID를 입력해주세요.'), 'my/model');
    await user.selectOptions(screen.getByLabelText('모델 타입을 선택해주세요.'), 'LLM');
    await user.selectOptions(screen.getByLabelText('모델 포맷을 선택해주세요.'), 'gguf');
    await user.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => {
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'negative',
          title: '모델 카탈로그 생성 실패',
          children: '모델 카탈로그 생성 중 오류가 발생했습니다.',
        })
      );
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('취소를 클릭하면 모델 카탈로그 목록으로 이동한다', async () => {
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/model/model-catalog');
  });
});
