import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import type { WorkflowModel } from '@/types/workflow';
import { WorkflowTestTab } from './workflow-test-tab';

// #8 RAG 결과 판정: MLOps는 실패도 HTTP 200 + results[].error로 반환하고, KB가 있으면
// final_result가 검색 결과로 채워져 non-null이 된다. final_result 유무로 성공을 판정하면
// 실패한 요청의 참고자료 원문이 답변처럼 노출되므로, 판정은 results[].error로 한다.

const WORKFLOW_ID = 'wf-001';
const RAG_URL = `${BASE_URL}/workflows/:id/test/rag`;

const llmModel: WorkflowModel = {
  workflow_id: WORKFLOW_ID,
  component_id: 'comp-llm',
  component_name: '모델',
  model_id: 1,
  model_type: 'LLM',
  task: 'text-generation',
  model_name: 'medllama3',
  sanitized_model_name: 'medllama3',
  service_name: 'svc-llm',
  status: 'DEPLOYED',
  deployment_type: 'OLLAMA',
  created_at: '2026-09-11T00:00:00Z',
  updated_at: '2026-09-11T00:00:00Z',
};

const modelWithTask = (task: WorkflowModel['task']): WorkflowModel => ({ ...llmModel, task });

const renderTab = (models: WorkflowModel[] = [llmModel]) =>
  renderWithUser(
    <WorkflowTestTab
      workflowId={WORKFLOW_ID}
      workflowStatus="ACTIVE"
      workflowModels={models}
      isModelsPending={false}
    />
  );

const send = async (user: ReturnType<typeof renderTab>['user'], message = '안녕') => {
  await user.type(screen.getByRole('textbox'), message);
  await user.click(screen.getByRole('button', { name: '전송' }));
};

describe('WorkflowTestTab - RAG 채팅', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 응답이면 final_result를 답변으로 표시한다', async () => {
    const { user } = renderTab();

    await send(user);

    expect(await screen.findByText('안녕하세요. 무엇을 도와드릴까요?')).toBeInTheDocument();
  });

  // 회귀 테스트: 이 이슈의 증상 — 실패인데 KB 검색 결과가 답변처럼 보였다
  it('results에 error가 있으면 final_result가 차 있어도 답변으로 노출하지 않는다', async () => {
    server.use(
      http.post(RAG_URL, () =>
        HttpResponse.json({
          workflow_id: WORKFLOW_ID,
          execution_order: ['comp-kb', 'comp-llm'],
          results: [
            {
              component_id: 'comp-kb',
              component_name: '지식베이스',
              component_type: 'KNOWLEDGE_BASE',
              model_type: null,
              task: 'embedding',
              result: { documents: ['사내 규정 문서 원문'] },
              error: null,
            },
            {
              component_id: 'comp-llm',
              component_name: '모델',
              component_type: 'MODEL',
              model_type: 'LLM',
              error: 'Ollama 연결에 실패했습니다.',
            },
          ],
          final_result: '사내 규정 문서 원문',
        })
      )
    );

    const { user } = renderTab();

    await send(user);

    expect(await screen.findByText(/Ollama 연결에 실패했습니다\./)).toBeInTheDocument();
    expect(screen.queryByText('사내 규정 문서 원문')).not.toBeInTheDocument();
  });

  it('실패 메시지에 어떤 컴포넌트가 실패했는지 함께 보여준다', async () => {
    server.use(
      http.post(RAG_URL, () =>
        HttpResponse.json({
          workflow_id: WORKFLOW_ID,
          execution_order: ['comp-kb', 'comp-llm'],
          results: [
            {
              component_id: 'comp-kb',
              component_name: '지식베이스',
              component_type: 'KNOWLEDGE_BASE',
              model_type: null,
              error: '문서를 찾지 못했습니다.',
            },
            {
              component_id: 'comp-llm',
              component_name: '모델',
              component_type: 'MODEL',
              model_type: 'LLM',
              error: 'Ollama 연결에 실패했습니다.',
            },
          ],
          final_result: null,
        })
      )
    );

    const { user } = renderTab();

    await send(user);

    const message = await screen.findByText(/지식베이스/);
    expect(message).toHaveTextContent('지식베이스: 문서를 찾지 못했습니다.');
    expect(message).toHaveTextContent('모델: Ollama 연결에 실패했습니다.');
  });

  it('에러가 없는데 final_result도 없으면 원문 덤프 대신 안내 문구를 보여준다', async () => {
    server.use(
      http.post(RAG_URL, () =>
        HttpResponse.json({
          workflow_id: WORKFLOW_ID,
          execution_order: ['comp-llm'],
          results: [
            {
              component_id: 'comp-llm',
              component_name: '모델',
              component_type: 'MODEL',
              model_type: 'LLM',
              task: null,
              result: { response: '' },
              error: null,
            },
          ],
          final_result: null,
        })
      )
    );

    const { user } = renderTab();

    await send(user);

    expect(await screen.findByText('답변을 받지 못했습니다.')).toBeInTheDocument();
    // 응답 원문을 그대로 덤프하지 않는다
    expect(screen.queryByText(/comp-llm/)).not.toBeInTheDocument();
  });

  it('HTTP 오류면 서버 메시지를 에러로 표시한다', async () => {
    server.use(
      http.post(RAG_URL, () =>
        HttpResponse.json({ detail: '모델이 배포되지 않았습니다.' }, { status: 400 })
      )
    );

    const { user } = renderTab();

    await send(user);

    expect(await screen.findByText('모델이 배포되지 않았습니다.')).toBeInTheDocument();
  });

  it('보낸 메시지는 사용자 말풍선으로 남는다', async () => {
    const { user } = renderTab();

    await send(user, '테스트 질문');

    await waitFor(() => {
      expect(screen.getByText('테스트 질문')).toBeInTheDocument();
    });
  });
});

// RAG와 같은 판정 구조 — 여기도 final_result나 응답 원문이 아니라 results[].error를 본다.
describe('WorkflowTestTab - 객체 탐지(ML) 결과 판정', () => {
  const runMlTest = async (user: ReturnType<typeof renderTab>['user']) => {
    await user.upload(
      screen.getByLabelText('이미지'),
      new File(['dummy'], 'sample.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: '테스트 실행' }));
  };

  it('성공 응답이면 결과 이미지를 그린다', async () => {
    server.use(
      http.post(`${BASE_URL}/workflows/:id/test/ml`, () =>
        HttpResponse.json({
          workflow_id: WORKFLOW_ID,
          execution_order: ['comp-odm'],
          results: [
            {
              component_id: 'comp-odm',
              component_name: '탐지 모델',
              component_type: 'MODEL',
              model_type: 'ODM',
              task: 'object-detection',
              result: { predictions: [], image_info: null },
              error: null,
            },
          ],
          final_result: 'BASE64IMAGE',
        })
      )
    );

    const { user } = renderTab([modelWithTask('object-detection')]);

    await runMlTest(user);

    expect(await screen.findByAltText('객체 탐지 결과 이미지')).toBeInTheDocument();
  });

  // 회귀 테스트: 실패인데 이미지가 오면 성공처럼 보였고, 원인은 화면에 없었다
  it('results에 error가 있으면 이미지 대신 실패 원인을 보여준다', async () => {
    server.use(
      http.post(`${BASE_URL}/workflows/:id/test/ml`, () =>
        HttpResponse.json({
          workflow_id: WORKFLOW_ID,
          execution_order: ['comp-odm'],
          results: [
            {
              component_id: 'comp-odm',
              component_name: '탐지 모델',
              component_type: 'MODEL',
              model_type: 'ODM',
              error: '추론 서버에 연결하지 못했습니다.',
            },
          ],
          final_result: 'BASE64IMAGE',
        })
      )
    );

    const { user } = renderTab([modelWithTask('object-detection')]);

    await runMlTest(user);

    expect(await screen.findByText('탐지 모델: 추론 서버에 연결하지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByAltText('객체 탐지 결과 이미지')).not.toBeInTheDocument();
  });
});

describe('WorkflowTestTab - BFM(마스크 예측) 결과 판정', () => {
  const runFillMaskTest = async (user: ReturnType<typeof renderTab>['user']) => {
    await user.type(screen.getByLabelText('서열'), 'MKT<mask>V');
    await user.click(screen.getByRole('button', { name: '테스트 실행' }));
  };

  it('성공 응답이면 결과를 그대로 보여준다', async () => {
    server.use(
      http.post(`${BASE_URL}/workflows/:id/test/fill-mask`, () =>
        HttpResponse.json({
          workflow_id: WORKFLOW_ID,
          execution_order: ['comp-bfm'],
          results: [
            {
              component_id: 'comp-bfm',
              component_name: '마스크 모델',
              component_type: 'MODEL',
              model_type: 'BFM',
              task: 'fill-mask',
              result: { predictions: [{ sequence: 'MKTAV', score: 0.9, token_str: 'A' }] },
              error: null,
            },
          ],
        })
      )
    );

    const { user } = renderTab([modelWithTask('fill-mask')]);

    await runFillMaskTest(user);

    expect(await screen.findByText(/comp-bfm/)).toBeInTheDocument();
  });

  it('results에 error가 있으면 응답 원문 대신 실패 원인을 보여준다', async () => {
    server.use(
      http.post(`${BASE_URL}/workflows/:id/test/fill-mask`, () =>
        HttpResponse.json({
          workflow_id: WORKFLOW_ID,
          execution_order: ['comp-bfm'],
          results: [
            {
              component_id: 'comp-bfm',
              component_name: '마스크 모델',
              component_type: 'MODEL',
              model_type: 'BFM',
              error: '입력 서열에 마스크 토큰이 없습니다.',
            },
          ],
        })
      )
    );

    const { user } = renderTab([modelWithTask('fill-mask')]);

    await runFillMaskTest(user);

    expect(
      await screen.findByText('마스크 모델: 입력 서열에 마스크 토큰이 없습니다.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/comp-bfm"/)).not.toBeInTheDocument();
  });
});
