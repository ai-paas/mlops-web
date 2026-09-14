import { toastOpenSpy } from '@/test/mocks/innogrid-ui';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { BASE_URL } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import { api } from '@/lib/api';
import { DatasetForm } from './dataset-form';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mockNavigate,
}));

const KIND_SELECT_LABEL = '데이터셋 분류를 선택해주세요.';

const makeZip = (name = 'data.zip') =>
  new File(['zip-content'], name, { type: 'application/zip' });

// 실제 1GB를 할당하지 않고 size만 위장한 파일
const makeOversizeZip = () => {
  const file = makeZip('huge.zip');
  Object.defineProperty(file, 'size', { value: 1024 * 1024 * 1024 + 1 });
  return file;
};

// 분류 옵션(handlers/datasets.ts의 kinds)이 비동기 로드된 뒤 선택한다
const selectKind = async (
  user: ReturnType<typeof renderWithUser>['user'],
  kind = 'classification'
) => {
  await screen.findByRole('option', { name: kind });
  await user.selectOptions(screen.getByLabelText(KIND_SELECT_LABEL), kind);
};

describe('DatasetForm', () => {
  describe('렌더링', () => {
    it('제목·필수 입력 필드·생성/취소 버튼이 렌더링된다', () => {
      renderWithUser(<DatasetForm />);

      expect(screen.getByText('데이터 셋 생성')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('이름을 입력해주세요.')).toBeInTheDocument();
      expect(screen.getByLabelText(KIND_SELECT_LABEL)).toBeInTheDocument();
      expect(screen.getByLabelText('파일 업로드')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    });

    it('취소 버튼 클릭 시 데이터셋 목록으로 이동한다', async () => {
      const { user } = renderWithUser(<DatasetForm />);

      await user.click(screen.getByRole('button', { name: '취소' }));

      expect(mockNavigate).toHaveBeenCalledWith('/dataset');
    });
  });

  describe('폼 검증', () => {
    it('빈 폼 제출 시 필수 항목 에러가 모두 표시되고 요청이 발생하지 않는다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.post(`${BASE_URL}/datasets`, () => {
          requestSpy();
          return HttpResponse.json({ id: 99 });
        })
      );
      const { user } = renderWithUser(<DatasetForm />);

      await user.click(screen.getByRole('button', { name: '생성' }));

      expect(await screen.findByText('이름은 필수입니다.')).toBeInTheDocument();
      expect(screen.getByText('데이터셋 분류를 선택해주세요.', { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByText('파일이 필요합니다.')).toBeInTheDocument();
      expect(requestSpy).not.toHaveBeenCalled();
    });
  });

  describe('파일 검증 (분류 연동 + 서버 사전검증)', () => {
    it('분류 선택 전에 파일을 추가하면 안내 에러가 뜨고 서버 검증을 호출하지 않는다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.post(`${BASE_URL}/datasets/validate`, () => {
          requestSpy();
          return HttpResponse.json({ is_valid: true, message: 'OK' });
        })
      );
      const { user } = renderWithUser(<DatasetForm />);

      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());

      expect(
        await screen.findByText('데이터셋 분류를 먼저 선택해주세요.')
      ).toBeInTheDocument();
      expect(requestSpy).not.toHaveBeenCalled();
    });

    it('1GB 초과 파일은 서버 검증 없이 즉시 거부된다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.post(`${BASE_URL}/datasets/validate`, () => {
          requestSpy();
          return HttpResponse.json({ is_valid: true, message: 'OK' });
        })
      );
      const { user } = renderWithUser(<DatasetForm />);

      await selectKind(user);
      await user.upload(screen.getByLabelText('파일 업로드'), makeOversizeZip());

      expect(await screen.findByText('파일 크기는 1GB 이하여야 합니다.')).toBeInTheDocument();
      expect(requestSpy).not.toHaveBeenCalled();
      expect(screen.queryByText('huge.zip')).not.toBeInTheDocument();
    });

    it('zip이 아닌 파일은 확장자 에러가 표시된다', async () => {
      const { user } = renderWithUser(<DatasetForm />);

      await selectKind(user);
      await user.upload(
        screen.getByLabelText('파일 업로드'),
        new File(['csv'], 'data.csv', { type: 'text/csv' })
      );

      expect(await screen.findByText('zip 파일만 업로드 가능합니다.')).toBeInTheDocument();
    });

    it('서버 검증을 통과하면 파일이 목록에 표시되고, 삭제 버튼으로 제거할 수 있다', async () => {
      const { user } = renderWithUser(<DatasetForm />);

      await selectKind(user);
      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());

      expect(await screen.findByText('data.zip')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '삭제' }));

      await waitFor(() => {
        expect(screen.queryByText('data.zip')).not.toBeInTheDocument();
      });
    });

    it('서버 검증 실패 시 서버 메시지가 표시되고 파일이 제거된다', async () => {
      server.use(
        http.post(`${BASE_URL}/datasets/validate`, () =>
          HttpResponse.json({ is_valid: false, message: '라벨 컬럼이 누락되었습니다.' })
        )
      );
      const { user } = renderWithUser(<DatasetForm />);

      await selectKind(user);
      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());

      expect(await screen.findByText('라벨 컬럼이 누락되었습니다.')).toBeInTheDocument();
      expect(screen.queryByText('data.zip')).not.toBeInTheDocument();
    });

    it('서버 검증 실패 메시지가 없으면 기본 문구가 표시된다', async () => {
      server.use(
        http.post(`${BASE_URL}/datasets/validate`, () =>
          HttpResponse.json({ is_valid: false, message: '' })
        )
      );
      const { user } = renderWithUser(<DatasetForm />);

      await selectKind(user);
      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());

      expect(
        await screen.findByText('유효하지 않은 데이터셋 구조입니다.')
      ).toBeInTheDocument();
    });

    it('서버 검증 요청이 실패하면 서버 오류 문구가 표시된다', async () => {
      server.use(
        http.post(`${BASE_URL}/datasets/validate`, () =>
          HttpResponse.json({ message: 'error' }, { status: 500 })
        )
      );
      const { user } = renderWithUser(<DatasetForm />);

      await selectKind(user);
      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());

      expect(
        await screen.findByText('파일 검증 중 서버 오류가 발생했습니다.')
      ).toBeInTheDocument();
    });

    it('파일이 있는 상태에서 분류를 바꾸면 새 분류로 재검증한다', async () => {
      // MSW 핸들러의 request.formData()는 jsdom File 파싱에 행이 걸리므로
      // api.post 스파이로 훅이 넘긴 FormData 본문을 직접 단언한다 (부록 B 참고)
      const postSpy = vi.spyOn(api, 'post').mockImplementation(
        () =>
          ({
            json: () => Promise.resolve({ is_valid: true, message: 'OK' }),
          }) as ReturnType<typeof api.post>
      );
      const { user } = renderWithUser(<DatasetForm />);

      await selectKind(user, 'classification');
      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());
      await screen.findByText('data.zip');

      await user.selectOptions(screen.getByLabelText(KIND_SELECT_LABEL), 'summarization');

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledTimes(2);
      });
      const kindsSent = postSpy.mock.calls.map(
        ([url, options]) =>
          [url, (options?.body as FormData).get('dataset_kind')] as const
      );
      expect(kindsSent).toEqual([
        ['datasets/validate', 'classification'],
        ['datasets/validate', 'summarization'],
      ]);

      postSpy.mockRestore();
    });
  });

  describe('폼 제출', () => {
    // 회귀: 취소 버튼에 type이 없으면 form 안에서 기본값 submit으로 동작해
    // 목록으로 이동하면서 생성 요청까지 함께 나갔다.
    it('폼을 모두 채운 뒤 취소를 누르면 생성 요청 없이 목록으로만 이동한다', async () => {
      const postSpy = vi.spyOn(api, 'post').mockImplementation(
        (url) =>
          ({
            json: () =>
              Promise.resolve(
                url === 'datasets/validate'
                  ? { is_valid: true, message: 'OK' }
                  : { id: 99, name: '새 데이터셋' }
              ),
          }) as ReturnType<typeof api.post>
      );
      const { user } = renderWithUser(<DatasetForm />);

      await user.type(screen.getByPlaceholderText('이름을 입력해주세요.'), '학습 데이터셋');
      await selectKind(user);
      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());
      await screen.findByText('data.zip');

      await user.click(screen.getByRole('button', { name: '취소' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dataset');
      });
      expect(postSpy.mock.calls.filter(([url]) => url === 'datasets')).toHaveLength(0);

      postSpy.mockRestore();
    });

    it('이름·분류·검증된 파일로 제출하면 FormData 본문으로 생성 요청 후 목록으로 이동한다', async () => {
      const postSpy = vi.spyOn(api, 'post').mockImplementation(
        (url) =>
          ({
            json: () =>
              Promise.resolve(
                url === 'datasets/validate'
                  ? { is_valid: true, message: 'OK' }
                  : { id: 99, name: '새 데이터셋' }
              ),
          }) as ReturnType<typeof api.post>
      );
      const { user } = renderWithUser(<DatasetForm />);

      await user.type(screen.getByPlaceholderText('이름을 입력해주세요.'), '학습 데이터셋');
      await user.type(screen.getByPlaceholderText('설명을 입력해주세요.'), '분류용 데이터');
      await selectKind(user);
      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());
      await screen.findByText('data.zip');

      await user.click(screen.getByRole('button', { name: '생성' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dataset');
      });

      const createCall = postSpy.mock.calls.find(([url]) => url === 'datasets');
      expect(createCall).toBeDefined();
      const body = createCall?.[1]?.body as FormData;
      expect(body.get('name')).toBe('학습 데이터셋');
      expect(body.get('description')).toBe('분류용 데이터');
      expect(body.get('dataset_kind')).toBe('classification');
      expect((body.get('file') as File).name).toBe('data.zip');

      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'positive', title: '데이터셋 생성 성공' })
      );

      postSpy.mockRestore();
    });

    it('생성 요청이 실패하면 실패 토스트가 뜨고 이동하지 않는다', async () => {
      server.use(
        http.post(`${BASE_URL}/datasets`, () =>
          HttpResponse.json({ message: 'error' }, { status: 500 })
        )
      );
      const { user } = renderWithUser(<DatasetForm />);

      await user.type(screen.getByPlaceholderText('이름을 입력해주세요.'), '학습 데이터셋');
      await selectKind(user);
      await user.upload(screen.getByLabelText('파일 업로드'), makeZip());
      await screen.findByText('data.zip');

      await user.click(screen.getByRole('button', { name: '생성' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'negative', title: '데이터셋 생성 실패' })
        );
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
