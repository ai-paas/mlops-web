export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'ERROR';
export type WorkflowComponentType = 'START' | 'END' | 'MODEL' | 'KNOWLEDGE_BASE';

/** WorkflowResponse — 목록 조회(GET /workflows) 및 생성(POST /workflows) 응답 */
export interface Workflow {
  id: number;
  surro_workflow_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  name: string;
  description?: string | null;
  category?: string | null;
  status: WorkflowStatus;
  service_id: string | null;
  is_template: boolean;
  template_id: string | null;
}

export interface WorkflowComponentInfo {
  id: number;
  name: string;
  description: string;
}

export interface WorkflowModelBrief {
  id: number;
  name: string;
  description: string;
  provider_info?: WorkflowComponentInfo | null;
  type_info?: WorkflowComponentInfo | null;
  format_info?: WorkflowComponentInfo | null;
  parent_model_id?: number | null;
  registry?: Record<string, unknown> | null;
  task?: WorkflowModelTask | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowComponent {
  id: string;
  workflow_id: string;
  component_id: string;
  name: string;
  type: WorkflowComponentType;
  description?: string | null;
  model_id?: number | null;
  knowledge_base_id?: number | null;
  prompt_id?: number | null;
  config?: Record<string, unknown> | null;
  x?: number | null;
  y?: number | null;
  model?: WorkflowModelBrief | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowComponentConnection {
  id?: string;
  workflow_id?: string;
  source_component_id: string;
  target_component_id: string;
  source_component?: WorkflowComponent;
  target_component?: WorkflowComponent;
  created_at?: string;
}

/** WorkflowDetailResponse — 상세 조회(GET /workflows/{id}) 응답 */
export interface WorkflowRead extends Workflow {
  service_name: string | null;
  creator_id: number;
  template_name: string | null;
  kubeflow_run_id: string | null;
  public_url: string | null;
  backend_api_url: string | null;
  components?: WorkflowComponent[];
  component_connections?: WorkflowComponentConnection[];
}

export interface WorkflowTemplateCreator {
  id: number;
  username: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface WorkflowTemplateBrief {
  id: string;
  name: string;
  description: string;
  category: string;
  status: WorkflowStatus;
  service_id: string | null;
  creator_id: number;
  creator: WorkflowTemplateCreator;
  created_by?: string | null;
  updated_by?: string | null;
  is_template: true;
  template_id: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateListResponse {
  total: number;
  items: WorkflowTemplateBrief[];
}

/** WorkflowTemplateReadSchema — 템플릿 상세 조회(GET /workflows/templates/{id}) 응답 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  status: WorkflowStatus;
  service_id: string | null;
  creator_id: number;
  creator: WorkflowTemplateCreator;
  is_template: true;
  template_id: string | null;
  components?: WorkflowComponent[];
  component_connections?: WorkflowComponentConnection[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateListParams {
  page?: number;
  size?: number;
  category?: string;
}

export interface GetWorkflowComponentTypes {
  data: {
    type: WorkflowComponentType;
    component_id: WorkflowComponentType;
    name: string;
    description: string;
  }[];
}

export interface WorkflowComponentDefinition {
  ref_id: string;
  name: string;
  type: WorkflowComponentType;
  description?: string;
  model_id?: number;
  knowledge_base_id?: number;
  prompt_id?: number;
  config?: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface WorkflowConnectionDefinition {
  source_ref_id: string;
  target_ref_id: string;
}

export interface WorkflowDefinition {
  components: WorkflowComponentDefinition[];
  connections: WorkflowConnectionDefinition[];
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string | null;
  category?: string | null;
  service_id?: string | null;
  workflow_definition?: WorkflowDefinition | null;
}

export interface CreateWorkflowTemplateRequest {
  name: string;
  description?: string | null;
  category?: string | null;
  workflow_definition?: WorkflowDefinition | null;
}

export interface CloneWorkflowTemplateRequest {
  templateId: string;
  workflow_name: string;
  service_id?: number;
}

export interface ClonedWorkflow {
  id: string;
  name: string;
  description: string;
  category: string;
  status: WorkflowStatus;
  service_id: string | null;
  service_name: string | null;
  creator_id: number;
  creator: WorkflowTemplateCreator;
  is_template: false;
  template_id: string | null;
  template_name: string | null;
  kubeflow_run_id: string | null;
  components?: WorkflowComponent[];
  component_connections?: WorkflowComponentConnection[];
  created_at: string;
  updated_at: string;
}

export interface CleanupWorkflowResponse {
  message: string;
  workflow_id: string;
  cleanup_run_id: string;
  status: 'cleanup_in_progress' | string;
  next_step: string;
}

export interface DeleteWorkflowResponse {
  message: string;
  workflow_id: string;
  cleanup_run_id: string;
  status: 'cleanup_in_progress' | string;
  next_step: string;
}

export interface FinalizeWorkflowDeletionResponse {
  message?: string;
  error_message?: string;
  workflow_id?: string;
  status?: 'in_progress' | 'completed' | 'failed' | string;
  deleted_from_db?: boolean;
}

export interface FinalizeWorkflowCleanupResponse {
  message?: string;
  error_message?: string;
  workflow_id?: string;
  status?: 'in_progress' | 'completed' | 'failed' | string;
  // cleanup은 워크플로우가 남는다 — true면 ERROR → DRAFT로 전환됐다는 뜻
  workflow_updated?: boolean;
}

export interface ExecuteWorkflowResponse {
  workflow_id: string;
  kubeflow_run_id: string;
  status: 'PENDING' | string;
  message: string;
}

export interface WorkflowStatusModel {
  component_id: string;
  service_name: string;
  service_hostname?: string | null;
  model_name: string;
  sanitized_model_name: string;
  deployment_type: 'KSERVE' | 'OLLAMA' | 'REMOTE' | string;
  internal_url?: string | null;
  gateway_url?: string | null;
  public_url?: string | null;
  backend_api_url?: string | null;
  status: 'PENDING' | 'DEPLOYING' | 'DEPLOYED' | 'FAILED' | 'DELETED' | string;
  deployed_at?: string | null;
  error_message?: string | null;
  model_id?: number | null;
}

export interface WorkflowStatusResponse {
  workflow_id: string;
  status: WorkflowStatus | string;
  kubeflow_run_id?: string | null;
  deployed_models?: WorkflowStatusModel[];
}

export interface ValidateWorkflowRequest {
  workflow_definition: WorkflowDefinition;
}

export interface ValidationCheck {
  rule: string;
  passed: boolean;
  message?: string | null;
}

export interface ValidateWorkflowResponse {
  valid: boolean;
  checks: ValidationCheck[];
}

export interface UpdateWorkflowRequest {
  workflowId: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  status?: WorkflowStatus | null;
  service_id?: string | null;
  workflow_definition?: WorkflowDefinition | null;
}

export interface UpdateWorkflowTemplateRequest {
  templateId: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  status?: WorkflowStatus | null;
  workflow_definition?: WorkflowDefinition | null;
}

export interface WorkflowModel {
  workflow_id: string;
  component_id: string;
  component_name: string;
  model_id: number;
  model_type?: 'LLM' | 'ODM' | 'BFM' | string;
  task?: WorkflowModelTask | null;
  model_name: string;
  sanitized_model_name: string;
  service_name: string;
  service_hostname?: string | null;
  status: 'DEPLOYING' | 'DEPLOYED' | 'FAILED' | 'DELETED' | string;
  internal_url?: string | null;
  deployment_type: 'KSERVE' | 'OLLAMA' | 'REMOTE' | string;
  public_url?: string | null;
  backend_api_url?: string | null;
  gateway_url?: string | null;
  deployed_at?: string | null;
  deleted_at?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowModelsResponse {
  workflow_id: string;
  backend_api_url?: string | null;
  deployed_models: WorkflowModel[];
  total: number;
}

export interface WorkflowTestSuccessResult {
  component_id: string;
  component_name: string;
  component_type: WorkflowComponentType;
  model_type: 'LLM' | 'ODM' | 'BFM' | string | null;
  task: WorkflowModelTask | string | null;
  result: unknown;
  error?: null;
}

export interface WorkflowTestErrorResult {
  component_id: string;
  component_name: string;
  component_type: WorkflowComponentType;
  model_type: string | null;
  error: string;
  task?: never;
  result?: never;
}

export type WorkflowTestResult = WorkflowTestSuccessResult | WorkflowTestErrorResult;

export type WorkflowModelTask =
  | 'embedding'
  | 'text-generation'
  | 'object-detection'
  | 'fill-mask'
  | 'protein-classification'
  | 'protein-structure-prediction'
  | 'vqa';

export interface WorkflowProteinClassificationTestRequest {
  epitope: string;
  cdr3b: string;
}
export interface ModelProteinClassificationTestResult {
  predictions: { label: 0 | 1; score: number; probabilities: Record<'0' | '1', number> }[];
  input_info: WorkflowProteinClassificationTestRequest | null;
}
export interface WorkflowFillMaskTestRequest {
  sequence: string;
  top_k?: number;
}
export interface ModelFillMaskTestResult {
  predictions: { position: number; predictions: { token: string; score: number }[] }[];
  input_info: Required<WorkflowFillMaskTestRequest> | null;
}
export interface WorkflowProteinStructurePredictionTestRequest {
  sequence: string;
  num_loops?: number;
  num_sampling_steps?: number;
}
export interface ModelStructurePredictionTestResult {
  predictions: {
    pdb: string;
    plddt_mean: number | null;
    ptm: number | null;
    iptm: number | null;
  }[];
  input_info: Required<WorkflowProteinStructurePredictionTestRequest> | null;
}
export interface WorkflowBfmTestResult<
  TResult,
  TTask extends WorkflowModelTask,
> extends WorkflowTestSuccessResult {
  model_type: 'BFM';
  task: TTask;
  result: TResult;
}
export interface WorkflowBfmTestResponse<TResult, TTask extends WorkflowModelTask> {
  workflow_id: string;
  execution_order: string[];
  results: (WorkflowBfmTestResult<TResult, TTask> | WorkflowTestErrorResult)[];
}
export type WorkflowProteinClassificationTestResponse = WorkflowBfmTestResponse<
  ModelProteinClassificationTestResult,
  'protein-classification'
>;
export type WorkflowFillMaskTestResponse = WorkflowBfmTestResponse<
  ModelFillMaskTestResult,
  'fill-mask'
>;
export type WorkflowProteinStructurePredictionTestResponse = WorkflowBfmTestResponse<
  ModelStructurePredictionTestResult,
  'protein-structure-prediction'
>;

export interface WorkflowRagTestResponse {
  workflow_id: string;
  execution_order: string[];
  results: WorkflowTestResult[];
  final_result: string | null;
}

export interface ModelObjectDetectionPrediction {
  score: number;
  label: string;
  box: number[];
}
export interface ModelObjectDetectionTestResult {
  predictions: ModelObjectDetectionPrediction[];
  image_info: {
    original_size: { width: number; height: number };
    model_input_size: { width: number; height: number };
  } | null;
}
export interface WorkflowMlTestSuccessResult extends WorkflowTestSuccessResult {
  result: ModelObjectDetectionTestResult;
}

export interface WorkflowMlTestResponse {
  workflow_id: string;
  execution_order: string[];
  results: (WorkflowMlTestSuccessResult | WorkflowTestErrorResult)[];
  final_result: string | null;
}

export interface ComponentDeployStatusBody {
  service_name: string;
  service_hostname: string;
  model_name: string;
  status: string;
  internal_url?: string;
  error_message?: string;
}
