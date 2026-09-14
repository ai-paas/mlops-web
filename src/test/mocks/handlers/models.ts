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
