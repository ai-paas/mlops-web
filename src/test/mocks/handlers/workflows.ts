import { http, HttpResponse } from 'msw';
import { BASE_URL } from './base';
import type {
  UpdateWorkflowRequest,
  Workflow,
  WorkflowRead,
  WorkflowTemplate,
} from '@/types/workflow';

// 테스트용 목 데이터
export const mockWorkflow: Workflow = {
  id: 1,
  surro_workflow_id: 'wf-001',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  created_by: 'user1',
  name: '테스트 워크플로우',
  description: '테스트 설명',
  category: '테스트 카테고리',
  status: 'DRAFT',
  service_id: null,
  is_template: false,
  template_id: null,
};

export const mockWorkflowRead: WorkflowRead = {
  ...mockWorkflow,
  service_name: null,
  creator_id: 1,
  template_name: null,
  kubeflow_run_id: null,
  public_url: null,
  backend_api_url: null,
};

export const mockWorkflowTemplate: WorkflowTemplate = {
  id: 'tpl-001',
  name: '테스트 템플릿',
  description: '템플릿 설명',
  category: '템플릿 카테고리',
  status: 'ACTIVE',
  service_id: null,
  creator_id: 1,
  creator: {
    id: 1,
    username: 'user1',
    name: '사용자1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  is_template: true,
  template_id: null,
  usage_count: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const workflowHandlers = [
  // GET /workflows - 워크플로우 목록 조회
  http.get(`${BASE_URL}/workflows`, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const size = Number(url.searchParams.get('size')) || 10;
    return HttpResponse.json({ data: [mockWorkflow], total: 1, page, size });
  }),

  // POST /workflows - 워크플로우 생성
  http.post(`${BASE_URL}/workflows`, () => HttpResponse.json(mockWorkflow)),

  // POST /workflows/validate - 워크플로우 검증 (기본: 통과)
  http.post(`${BASE_URL}/workflows/validate`, () => HttpResponse.json({ valid: true, checks: [] })),

  // GET /workflows/templates - 템플릿 목록 조회
  // (:surro_workflow_id 단일 파라미터 라우트보다 먼저 등록해야 'templates' 리터럴이 우선 매칭된다)
  http.get(`${BASE_URL}/workflows/templates`, () =>
    HttpResponse.json({ total: 1, items: [mockWorkflowTemplate] })
  ),

  // GET /workflows/templates/:templateId - 템플릿 상세
  http.get(`${BASE_URL}/workflows/templates/:templateId`, ({ params }) =>
    HttpResponse.json({ ...mockWorkflowTemplate, id: params.templateId as string })
  ),

  // DELETE /workflows/templates/:templateId - 템플릿 삭제
  http.delete(
    `${BASE_URL}/workflows/templates/:templateId`,
    () => new HttpResponse(null, { status: 204 })
  ),

  // DELETE /workflows/:surro_workflow_id - 삭제 시작 (완료가 아니라 정리 시작이다. 실서버는 202)
  http.delete(`${BASE_URL}/workflows/:surro_workflow_id`, ({ params }) =>
    HttpResponse.json(
      {
        message: 'deletion started',
        workflow_id: params.surro_workflow_id as string,
        cleanup_run_id: 'run-001',
        status: 'cleanup_in_progress',
        next_step: 'finalize-deletion',
      },
      { status: 202 }
    )
  ),

  // POST /workflows/:surro_workflow_id/finalize-deletion - 삭제 완료 확인 probe
  // 기본은 즉시 completed. status는 in_progress/completed/failed 3개뿐이다.
  http.post(`${BASE_URL}/workflows/:surro_workflow_id/finalize-deletion`, ({ params }) =>
    HttpResponse.json({
      message: 'deletion completed',
      workflow_id: params.surro_workflow_id as string,
      status: 'completed',
      deleted_from_db: true,
    })
  ),

  // POST /workflows/:surro_workflow_id/test/rag - 텍스트 생성 테스트 (기본: 성공)
  // MLOps는 실패도 200 + results[].error로 반환한다 — 실패 케이스는 각 테스트에서 덮어쓴다.
  http.post(`${BASE_URL}/workflows/:surro_workflow_id/test/rag`, ({ params }) =>
    HttpResponse.json({
      workflow_id: params.surro_workflow_id as string,
      execution_order: ['comp-llm'],
      results: [
        {
          component_id: 'comp-llm',
          component_name: '모델',
          component_type: 'MODEL',
          model_type: 'LLM',
          task: null,
          result: { response: '안녕하세요. 무엇을 도와드릴까요?' },
          error: null,
        },
      ],
      final_result: '안녕하세요. 무엇을 도와드릴까요?',
    })
  ),

  // GET /workflows/:surro_workflow_id/status - 배포 상태 (기본: 배포 완료 모델 1개)
  http.get(`${BASE_URL}/workflows/:surro_workflow_id/status`, ({ params }) =>
    HttpResponse.json({
      workflow_id: params.surro_workflow_id as string,
      status: 'ACTIVE',
      deployed_models: [
        {
          component_id: 'comp-1',
          service_name: 'svc-1',
          model_name: '모델 A',
          sanitized_model_name: 'model-a',
          deployment_type: 'KSERVE',
          status: 'DEPLOYED',
        },
      ],
    })
  ),

  // POST /workflows/:surro_workflow_id/cleanup - 배포 리소스 정리 시작
  http.post(`${BASE_URL}/workflows/:surro_workflow_id/cleanup`, ({ params }) =>
    HttpResponse.json({
      message: 'cleanup started',
      workflow_id: params.surro_workflow_id as string,
      cleanup_run_id: 'run-001',
      status: 'cleanup_in_progress',
      next_step: 'finalize-cleanup',
    })
  ),

  // POST /workflows/:surro_workflow_id/finalize-cleanup - 정리 완료 확인 (기본: 즉시 completed)
  http.post(`${BASE_URL}/workflows/:surro_workflow_id/finalize-cleanup`, ({ params }) =>
    HttpResponse.json({
      message: 'cleanup completed',
      workflow_id: params.surro_workflow_id as string,
      status: 'completed',
      workflow_updated: true,
    })
  ),

  // GET /workflows/:surro_workflow_id - 워크플로우 상세
  http.get(`${BASE_URL}/workflows/:surro_workflow_id`, ({ params }) =>
    HttpResponse.json({
      ...mockWorkflowRead,
      surro_workflow_id: params.surro_workflow_id as string,
    })
  ),

  // PUT /workflows/:surro_workflow_id - 워크플로우 수정 (부분 업데이트)
  http.put(`${BASE_URL}/workflows/:surro_workflow_id`, async ({ params, request }) => {
    const body = (await request.json()) as Omit<UpdateWorkflowRequest, 'workflowId'>;
    const updated: Workflow = {
      ...mockWorkflow,
      surro_workflow_id: params.surro_workflow_id as string,
      name: body.name ?? mockWorkflow.name,
      description: body.description ?? mockWorkflow.description,
      category: body.category ?? mockWorkflow.category,
      status: body.status ?? mockWorkflow.status,
      service_id: body.service_id !== undefined ? body.service_id : mockWorkflow.service_id,
      updated_at: '2024-01-02T00:00:00Z',
    };
    return HttpResponse.json(updated);
  }),
];
