import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { createHookWrapper, createTestQueryClient } from '@/test/utils/test-utils';
import { queryKeys } from '@/lib/query-keys';
import {
  useCreateModel,
  useDeleteModel,
  useDownloadModelFile,
  useGetCustomModels,
  useGetHubModels,
  useGetModelFiles,
  useGetModels,
} from './models';

// a3dd1d4 회귀 방지: models.detail이 models.all 하위 계층(['models','detail',id])이고,
// 생성/삭제가 models/model-catalogs/custom-models 3중 무효화를 수행하는 계약을 고정한다.
// 캐시를 직접 시드한 뒤 실제 QueryClient의 부분 일치 무효화 결과(isInvalidated)로 검증한다.

const seedCaches = (queryClient: ReturnType<typeof createTestQueryClient>) => {
  queryClient.setQueryData(queryKeys.models.detail(11), { id: 11, name: '커스텀 모델 A' });
  queryClient.setQueryData(queryKeys.models.detail(12), { id: 12, name: '커스텀 모델 B' });
  // 파일 목록은 detail(id) 하위 계층 — detail 제거/무효화가 함께 덮어야 한다
  queryClient.setQueryData(queryKeys.models.files(11, { page: 1 }), { data: [], total: 0 });
  queryClient.setQueryData(queryKeys.models.list({ page: 1 }), { data: [], total: 0 });
  queryClient.setQueryData(queryKeys.modelCatalogs.list(), { data: [], total: 0 });
  queryClient.setQueryData(queryKeys.customModels.list(), { data: [], total: 0 });
  // 무관 도메인 — 무효화가 번지지 않아야 한다
  queryClient.setQueryData(queryKeys.prompts.list(), { data: [], total: 0 });
};

describe('models hooks — a3dd1d4 캐시 무효화 계약', () => {
  // ============================================
  // useDeleteModel
  // ============================================
  describe('useDeleteModel', () => {
    it('삭제 성공 시 해당 모델의 detail 캐시를 제거한다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useDeleteModel(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.deleteModel(11);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // removeQueries — 캐시 엔트리 자체가 사라진다
      expect(queryClient.getQueryState(queryKeys.models.detail(11))).toBeUndefined();
      // 파일 목록 키가 detail 하위 계층이라 별도 처리 없이 함께 제거된다
      expect(queryClient.getQueryState(queryKeys.models.files(11, { page: 1 }))).toBeUndefined();
    });

    it('다른 모델의 detail은 제거되지 않고 models.all 계층 무효화로 stale 처리된다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useDeleteModel(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.deleteModel(11);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // detail(12)는 남아 있되, models.all(['models']) 프리픽스 무효화에 걸린다
      // — a3dd1d4가 detail 키를 all 하위 계층으로 옮긴 핵심 계약
      const otherDetail = queryClient.getQueryState(queryKeys.models.detail(12));
      expect(otherDetail).toBeDefined();
      expect(otherDetail?.isInvalidated).toBe(true);
    });

    it('models/model-catalogs/custom-models 목록을 3중 무효화하고 무관 도메인은 건드리지 않는다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useDeleteModel(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.deleteModel(11);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(queryClient.getQueryState(queryKeys.models.list({ page: 1 }))?.isInvalidated).toBe(
        true
      );
      expect(queryClient.getQueryState(queryKeys.modelCatalogs.list())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(queryKeys.customModels.list())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(queryKeys.prompts.list())?.isInvalidated).toBe(false);
    });

    it('삭제 실패 시 캐시를 제거하지도 무효화하지도 않는다', async () => {
      server.use(
        http.delete(`${BASE_URL}/models/:modelId`, () =>
          HttpResponse.json({ message: 'Forbidden' }, { status: 403 })
        )
      );

      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useDeleteModel(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.deleteModel(11);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      const detail = queryClient.getQueryState(queryKeys.models.detail(11));
      expect(detail).toBeDefined();
      expect(detail?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(queryKeys.models.list({ page: 1 }))?.isInvalidated).toBe(
        false
      );
    });
  });

  // ============================================
  // useCreateModel
  // ============================================
  describe('useCreateModel', () => {
    it('생성 성공 시 models/model-catalogs/custom-models 목록을 3중 무효화한다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useCreateModel(), {
        wrapper: createHookWrapper(queryClient),
      });

      await result.current.createModel(new FormData());

      expect(queryClient.getQueryState(queryKeys.models.list({ page: 1 }))?.isInvalidated).toBe(
        true
      );
      expect(queryClient.getQueryState(queryKeys.modelCatalogs.list())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(queryKeys.customModels.list())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(queryKeys.prompts.list())?.isInvalidated).toBe(false);
    });

    it('생성 성공 시 detail 캐시도 models.all 계층 무효화에 걸린다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useCreateModel(), {
        wrapper: createHookWrapper(queryClient),
      });

      await result.current.createModel(new FormData());

      expect(queryClient.getQueryState(queryKeys.models.detail(11))?.isInvalidated).toBe(true);
    });

    it('크로스 도메인: 모델 생성 후 학습 생성 드롭다운(useGetModels)에 새 모델이 반영된다', async () => {
      // a3dd1d4 원 버그: useCreateModel이 models.all을 무효화하지 않아
      // 학습 생성 페이지의 모델 드롭다운(useGetModels({ size: 100 }))에 새 모델이 안 보였다.
      const models = [{ id: 11, name: '커스텀 모델 A' }];
      server.use(
        http.get(`${BASE_URL}/models`, () =>
          HttpResponse.json({ data: models, page: 1, size: 100, total: models.length })
        ),
        http.post(`${BASE_URL}/models`, () => {
          const created = { id: 99, name: '새 모델' };
          models.push(created);
          return HttpResponse.json(created);
        })
      );

      const queryClient = createTestQueryClient({ gcTime: Infinity });
      const wrapper = createHookWrapper(queryClient);
      // 학습 생성 페이지와 동일한 파라미터의 활성 옵저버 + 생성 훅을 같은 캐시에서 구동
      const { result } = renderHook(
        () => ({
          dropdown: useGetModels({ size: 100 }, {}),
          create: useCreateModel(),
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.dropdown.isPending).toBe(false);
      });
      expect(result.current.dropdown.models).toHaveLength(1);

      await result.current.create.createModel(new FormData());

      // 무효화 → 활성 쿼리 자동 refetch → 새 모델 반영
      await waitFor(() => {
        expect(result.current.dropdown.models).toHaveLength(2);
      });
      expect(result.current.dropdown.models[1].name).toBe('새 모델');
    });

    it('생성 실패 시 목록을 무효화하지 않는다', async () => {
      server.use(
        http.post(`${BASE_URL}/models`, () =>
          HttpResponse.json({ message: 'Bad Request' }, { status: 400 })
        )
      );

      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useCreateModel(), {
        wrapper: createHookWrapper(queryClient),
      });

      await expect(result.current.createModel(new FormData())).rejects.toThrow();

      expect(queryClient.getQueryState(queryKeys.models.list({ page: 1 }))?.isInvalidated).toBe(
        false
      );
      expect(queryClient.getQueryState(queryKeys.modelCatalogs.list())?.isInvalidated).toBe(false);
    });
  });
});

describe('models hooks — OpenAPI 요청/응답 계약', () => {
  it('커스텀 모델 필터는 명세의 model_*_id 이름으로 보낸다', async () => {
    let receivedParams: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE_URL}/models/custom-models`, ({ request }) => {
        receivedParams = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [], total: 0, page: 1, size: 10 });
      })
    );

    const { result } = renderHook(
      () =>
        useGetCustomModels({
          page: 1,
          size: 10,
          model_provider_id: 2,
          model_type_id: 3,
          model_format_id: 4,
        }),
      { wrapper: createHookWrapper() }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(Object.fromEntries(receivedParams ?? [])).toEqual({
      page: '1',
      size: '10',
      model_provider_id: '2',
      model_type_id: '3',
      model_format_id: '4',
    });
  });

  it('허브 모델 응답의 pagination이 null이어도 기본 페이지 정보를 반환한다', async () => {
    server.use(
      http.get(`${BASE_URL}/hub-connect/models`, () =>
        HttpResponse.json({ data: [], pagination: null })
      )
    );

    const { result } = renderHook(
      () => useGetHubModels({ market: 'huggingface', page: 1, limit: 30 }),
      { wrapper: createHookWrapper() }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.page).toEqual({ number: 1, size: 30, total: 0 });
    expect(result.current.hasMore).toBe(false);
    expect(result.current.totalIsExact).toBe(true);
  });
});

// ============================================
// 모델 파일 목록·다운로드
// ============================================

describe('useGetModelFiles', () => {
  it('파일 목록과 페이지 정보를 반환한다', async () => {
    const { result } = renderHook(() => useGetModelFiles(11), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.modelFiles).toHaveLength(2);
    expect(result.current.modelFiles[0].name).toBe('README.md');
    expect(result.current.page.total).toBe(2);
  });

  it('page·size·sort를 쿼리 파라미터로 그대로 보낸다', async () => {
    let receivedParams: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files`, ({ request }) => {
        receivedParams = new URL(request.url).searchParams;
        return HttpResponse.json({ data: [], total: 0, page: 2, size: 20 });
      })
    );

    const { result } = renderHook(
      () => useGetModelFiles(11, { page: 2, size: 20, sort: '-size_bytes' }),
      { wrapper: createHookWrapper() }
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(Object.fromEntries(receivedParams ?? [])).toEqual({
      page: '2',
      size: '20',
      sort: '-size_bytes',
    });
  });

  it('modelId가 없으면(0) 요청하지 않는다', async () => {
    const requestSpy = vi.fn();
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files`, () => {
        requestSpy();
        return HttpResponse.json({ data: [], total: 0, page: 1, size: 20 });
      })
    );

    renderHook(() => useGetModelFiles(0), { wrapper: createHookWrapper() });

    await waitFor(() => expect(requestSpy).not.toHaveBeenCalled());
  });

  it('빈 목록(OLLAMA·NONE 모델)은 오류가 아니라 빈 배열로 돌려준다', async () => {
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files`, () =>
        HttpResponse.json({ data: [], total: 0, page: 1, size: 20 })
      )
    );

    const { result } = renderHook(() => useGetModelFiles(11), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.modelFiles).toEqual([]);
    expect(result.current.page.total).toBe(0);
  });

  it('조회 실패는 isError로 알린다', async () => {
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files`, () =>
        HttpResponse.json({ detail: '스토리지를 사용할 수 없습니다.' }, { status: 502 })
      )
    );

    const { result } = renderHook(() => useGetModelFiles(11), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.modelFiles).toEqual([]);
  });
});

describe('useDownloadModelFile', () => {
  /** 앵커 클릭을 가로채 이동할 URL만 기록한다 (jsdom은 실제 내비게이션을 못 한다) */
  const spyAnchorClick = () => {
    const hrefs: string[] = [];
    const spy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        hrefs.push(this.href);
      });
    return { hrefs, spy };
  };

  it('/api/v1 접두사를 떼고 발급 API를 호출한 뒤 서명 URL로 이동한다', async () => {
    let requestedUrl: URL | undefined;
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files/download-url`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json({
          model_id: 11,
          name: 'README.md',
          size_bytes: 4721,
          download_url: 'http://storage.test/signed/README.md?X-Amz-Signature=abc',
          expires_at: '2026-09-15T00:32:03.291043Z',
        });
      })
    );
    const { hrefs, spy } = spyAnchorClick();

    try {
      const { result } = renderHook(() => useDownloadModelFile(), {
        wrapper: createHookWrapper(),
      });

      result.current.downloadModelFile('/api/v1/models/11/files/download-url?name=README.md');

      await waitFor(() => expect(hrefs).toHaveLength(1));

      // 경로와 name 쿼리가 목록 응답 그대로 전달된다
      expect(requestedUrl?.pathname).toBe('/api/v1/models/11/files/download-url');
      expect(requestedUrl?.searchParams.get('name')).toBe('README.md');
      expect(hrefs[0]).toBe('http://storage.test/signed/README.md?X-Amz-Signature=abc');
    } finally {
      spy.mockRestore();
    }
  });

  it('발급 실패 시 이동하지 않고 에러를 알린다', async () => {
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files/download-url`, () =>
        HttpResponse.json({ detail: '파일을 찾을 수 없습니다.' }, { status: 404 })
      )
    );
    const { hrefs, spy } = spyAnchorClick();

    try {
      const { result } = renderHook(() => useDownloadModelFile(), {
        wrapper: createHookWrapper(),
      });

      result.current.downloadModelFile('/api/v1/models/11/files/download-url?name=missing.txt');

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(hrefs).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
