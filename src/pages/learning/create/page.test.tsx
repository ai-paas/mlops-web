/**
 * 학습 생성 폼의 "데이터 유형" 연동 회귀 테스트.
 *
 * 이전에는 데이터 유형이 선택 불가한 고정 마크업이었고, 데이터셋 목록은 유형과 무관하게
 * 전부 노출됐으며, 업로드 경로는 유형을 'object-detection'으로 고정 전송했다.
 */
import '@/test/mocks/innogrid-ui';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { BASE_URL } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import { api } from '@/lib/api';
import LearningCreatePage from './page';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mockNavigate,
}));

// 공용 목(handlers/datasets.ts)의 kind 값은 dataset-form.test.tsx가 의존하므로 건드리지 않고,
// 이 파일에서만 실제 DatasetKind 유니온에 맞는 응답으로 덮어쓴다.
const kindsResponse = [
  {
    name: 'object-detection',
    description: '이미지 객체 감지',
    accepted_formats: ['zip'],
    supported_models: [],
  },
  {
    name: 'protein-classification',
    description: '단백질 서열 분류',
    accepted_formats: ['zip'],
    supported_models: [],
  },
];

const datasetsResponse = [
  { id: 1, name: '객체 데이터셋', kind: 'object-detection' },
  { id: 2, name: '단백질 데이터셋', kind: 'protein-classification' },
];

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/datasets/kinds`, () => HttpResponse.json(kindsResponse)),
    http.get(`${BASE_URL}/datasets`, () =>
      HttpResponse.json({
        data: datasetsResponse,
        page: 1,
        size: 100,
        total: datasetsResponse.length,
      })
    )
  );
});

const makeZip = (name = 'data.zip') =>
  new File(['dummy'], name, { type: 'application/x-zip-compressed' });

type User = ReturnType<typeof renderWithUser>['user'];

/** 1단계(기본 설정)를 채우고 2단계(데이터 설정)로 넘어간다 */
const goToDataStep = async (user: User) => {
  await user.type(screen.getByPlaceholderText('이름을 입력해주세요.'), '테스트 학습');
  await user.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByRole('radio', { name: '객체 감지' });
};

const getDatasetSelect = () => screen.getByLabelText('데이터 셋을 선택해주세요.');

describe('LearningCreatePage — 데이터 유형', () => {
  describe('데이터 유형 선택', () => {
    it('서버가 준 kinds를 한글 라벨의 라디오로 렌더하고 기본값은 객체 감지다', async () => {
      const { user } = renderWithUser(<LearningCreatePage />);
      await goToDataStep(user);

      expect(screen.getByRole('radio', { name: '객체 감지' })).toBeChecked();
      expect(screen.getByRole('radio', { name: '단백질 분류' })).not.toBeChecked();
    });

    it('유형을 바꾸면 해당 유형이 선택 상태가 된다', async () => {
      const { user } = renderWithUser(<LearningCreatePage />);
      await goToDataStep(user);

      await user.click(screen.getByRole('radio', { name: '단백질 분류' }));

      expect(screen.getByRole('radio', { name: '단백질 분류' })).toBeChecked();
      expect(screen.getByRole('radio', { name: '객체 감지' })).not.toBeChecked();
    });
  });

  describe('데이터셋 목록 필터링', () => {
    it('선택한 유형의 데이터셋만 드롭다운에 노출한다', async () => {
      const { user } = renderWithUser(<LearningCreatePage />);
      await goToDataStep(user);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: '객체 데이터셋' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('option', { name: '단백질 데이터셋' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('radio', { name: '단백질 분류' }));

      expect(await screen.findByRole('option', { name: '단백질 데이터셋' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: '객체 데이터셋' })).not.toBeInTheDocument();
    });

    it('유형을 바꾸면 이미 선택한 데이터셋이 초기화된다', async () => {
      const { user } = renderWithUser(<LearningCreatePage />);
      await goToDataStep(user);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: '객체 데이터셋' })).toBeInTheDocument();
      });
      await user.selectOptions(getDatasetSelect(), '1');
      expect(getDatasetSelect()).toHaveValue('1');

      await user.click(screen.getByRole('radio', { name: '단백질 분류' }));

      expect(getDatasetSelect()).toHaveValue('');
    });

    it('해당 유형의 데이터셋이 없으면 안내 문구를 placeholder로 보여준다', async () => {
      server.use(
        http.get(`${BASE_URL}/datasets`, () =>
          HttpResponse.json({ data: [datasetsResponse[0]], page: 1, size: 100, total: 1 })
        )
      );
      const { user } = renderWithUser(<LearningCreatePage />);
      await goToDataStep(user);

      await user.click(screen.getByRole('radio', { name: '단백질 분류' }));

      expect(await screen.findByLabelText('해당 유형의 데이터 셋이 없습니다.')).toBeInTheDocument();
    });
  });

  describe('업로드 경로의 dataset_kind 전송', () => {
    it('유효성 검증 요청에 선택한 유형을 보낸다', async () => {
      const postSpy = vi.spyOn(api, 'post');
      const { user } = renderWithUser(<LearningCreatePage />);
      await goToDataStep(user);

      await user.click(screen.getByRole('radio', { name: '단백질 분류' }));
      await user.click(screen.getByRole('radio', { name: '파일 업로드' }));
      await user.upload(screen.getByTestId('learning-dataset-file'), makeZip());
      await user.click(screen.getByRole('button', { name: '유효성 검증' }));

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('datasets/validate', expect.anything());
      });
      const [, options] = postSpy.mock.calls[0];
      expect((options?.body as FormData).get('dataset_kind')).toBe('protein-classification');

      postSpy.mockRestore();
    });

    it('데이터셋 생성 요청에 선택한 유형을 보낸다', async () => {
      const { user } = renderWithUser(<LearningCreatePage />);
      await goToDataStep(user);

      await user.click(screen.getByRole('radio', { name: '단백질 분류' }));
      await user.click(screen.getByRole('radio', { name: '파일 업로드' }));
      await user.upload(screen.getByTestId('learning-dataset-file'), makeZip());
      await user.click(screen.getByRole('button', { name: '유효성 검증' }));
      await screen.findByRole('button', { name: '검증 완료' });

      const postSpy = vi.spyOn(api, 'post');
      await user.click(screen.getByRole('button', { name: '다음' }));
      await user.selectOptions(await screen.findByLabelText('모델을 선택해주세요.'), '11');
      await user.click(screen.getByRole('button', { name: '다음' }));
      await user.click(await screen.findByRole('button', { name: '생성' }));

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('datasets', expect.anything());
      });
      const createCall = postSpy.mock.calls.find(([url]) => url === 'datasets');
      expect((createCall?.[1]?.body as FormData).get('dataset_kind')).toBe(
        'protein-classification'
      );

      postSpy.mockRestore();
    });
  });

  describe('검토 단계 요약', () => {
    it('선택한 유형의 한글 라벨을 표시한다', async () => {
      const { user } = renderWithUser(<LearningCreatePage />);
      await goToDataStep(user);

      await user.click(screen.getByRole('radio', { name: '단백질 분류' }));
      await user.selectOptions(await screen.findByLabelText('데이터 셋을 선택해주세요.'), '2');
      await user.click(screen.getByRole('button', { name: '다음' }));
      await user.selectOptions(await screen.findByLabelText('모델을 선택해주세요.'), '11');
      await user.click(screen.getByRole('button', { name: '다음' }));

      expect(await screen.findByText('단백질 분류')).toBeInTheDocument();
    });
  });
});
