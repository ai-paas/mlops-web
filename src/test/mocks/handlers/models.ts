import { http, HttpResponse } from 'msw';
import { BASE_URL } from './base';

// 커스텀 모델과 카탈로그 모델의 id가 겹치지 않게 구성한다
// (model-setting의 모델 유형 역추론이 목록 소속으로 판별하므로).
export const mockCustomModels = [
  { id: 11, name: '커스텀 모델 A' },
  { id: 12, name: '커스텀 모델 B' },
];

export const mockModelCatalogs = [
  { id: 21, name: '카탈로그 모델 A' },
  { id: 22, name: '카탈로그 모델 B' },
];

export const mockModels = [
  { id: 11, name: '커스텀 모델 A' },
  { id: 21, name: '카탈로그 모델 A' },
];

// 모델 생성 폼의 Select 옵션 — 공급자 이름은 허브 매칭(normalize 후 includes) 검증에 쓰인다
export const mockModelProviders = [
  { id: 1, name: 'Custom', description: '직접 등록' },
  { id: 2, name: 'Hugging Face', description: '허깅페이스 허브' },
];

export const mockModelTypes = [
  { id: 1, name: 'LLM', description: '대규모 언어 모델' },
  { id: 2, name: 'Embedding', description: '임베딩' },
];

export const mockModelFormats = [
  { id: 1, name: 'safetensors', description: '' },
  { id: 2, name: 'gguf', description: '' },
];

// download_url은 파일 주소가 아니라 서명 URL을 발급받는 게이트웨이 경로다
export const mockModelFiles = [
  {
    name: 'README.md',
    size_bytes: 4721,
    last_modified: '2026-09-14T03:31:31.253000Z',
    download_url: '/api/v1/models/11/files/download-url?name=README.md',
  },
  {
    name: 'model.safetensors',
    size_bytes: 135795376,
    last_modified: '2026-09-14T03:33:22.252000Z',
    download_url: '/api/v1/models/11/files/download-url?name=model.safetensors',
  },
];

export const mockImprovementTaskTypes = [
  { name: 'tensorrt', category: 'optimization', description: 'TensorRT 변환' },
  { name: 'openvino', category: 'optimization', description: 'OpenVINO 변환' },
];

const toPage = <T>(data: T[]) => ({ data, page: 1, size: 100, total: data.length });

export const modelHandlers = [
  http.get(`${BASE_URL}/models/custom-models`, () => HttpResponse.json(toPage(mockCustomModels))),
  http.get(`${BASE_URL}/models/model-catalog`, () => HttpResponse.json(toPage(mockModelCatalogs))),
  http.get(`${BASE_URL}/models/providers`, () => HttpResponse.json(toPage(mockModelProviders))),
  http.get(`${BASE_URL}/models/types`, () => HttpResponse.json(toPage(mockModelTypes))),
  http.get(`${BASE_URL}/models/formats`, () => HttpResponse.json(toPage(mockModelFormats))),
  // 더 구체적인 경로를 먼저 등록한다
  http.get(`${BASE_URL}/models/:modelId/files/download-url`, ({ request }) => {
    const name = new URL(request.url).searchParams.get('name') ?? '';
    return HttpResponse.json({
      model_id: 11,
      name,
      size_bytes: 4721,
      download_url: `http://storage.test/signed/${encodeURIComponent(name)}`,
      expires_at: '2026-09-15T00:32:03.291043Z',
    });
  }),
  http.get(`${BASE_URL}/models/:modelId/files`, () => HttpResponse.json(toPage(mockModelFiles))),
  http.get(`${BASE_URL}/models`, () => HttpResponse.json(toPage(mockModels))),
  http.post(`${BASE_URL}/models`, () => HttpResponse.json({ id: 99, name: '새 모델' })),
  http.delete(`${BASE_URL}/models/:modelId`, () => HttpResponse.json('deleted')),
  http.get(`${BASE_URL}/model-improvements/task-types`, () =>
    HttpResponse.json(mockImprovementTaskTypes)
  ),
  http.post(`${BASE_URL}/model-improvements`, () =>
    HttpResponse.json({ task_id: 1 }, { status: 201 })
  ),
];
