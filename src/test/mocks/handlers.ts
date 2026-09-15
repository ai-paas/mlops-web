// 도메인별 핸들러를 합치는 배럴.
// 새 도메인 훅/컴포넌트를 테스트하려면 handlers/<도메인>.ts를 만들어 여기에 합친다.
// (setup-tests.ts가 onUnhandledRequest: 'error'라 핸들러 없는 요청은 테스트가 즉시 실패한다)
import { authHandlers } from './handlers/auth';
import { dashboardHandlers } from './handlers/dashboard';
import { datasetHandlers } from './handlers/datasets';
import { knowledgebaseHandlers } from './handlers/knowledgebase';
import { learningHandlers } from './handlers/learning';
import { memberHandlers } from './handlers/members';
import { modelHandlers } from './handlers/models';
import { monitoringHandlers } from './handlers/monitoring';
import { promptHandlers } from './handlers/prompts';
import { serviceHandlers } from './handlers/services';
import { workflowHandlers } from './handlers/workflows';

export { BASE_URL } from './handlers/base';
export { mockDatasets, mockDatasetKinds } from './handlers/datasets';
export { mockKnowledgeBase } from './handlers/knowledgebase';
export { mockLearnings } from './handlers/learning';
export { mockMembers } from './handlers/members';
export {
  mockCustomModels,
  mockImprovementTaskTypes,
  mockModelCatalogs,
  mockModelFiles,
  mockModelFormats,
  mockModelProviders,
  mockModels,
  mockModelTypes,
} from './handlers/models';
export { mockPod } from './handlers/monitoring';
export { mockPrompts, mockPromptVariableTypes } from './handlers/prompts';
export { mockServices, mockServiceDetail } from './handlers/services';
export { mockWorkflow, mockWorkflowRead, mockWorkflowTemplate } from './handlers/workflows';

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...datasetHandlers,
  ...knowledgebaseHandlers,
  ...learningHandlers,
  ...memberHandlers,
  ...modelHandlers,
  ...monitoringHandlers,
  ...promptHandlers,
  ...serviceHandlers,
  ...workflowHandlers,
];
