/** 모델 분류. 게이트웨이가 관련 모델 노드에 보강하며, 보강 실패 시 null. */
export type ModelVisibility = 'CATALOG' | 'CUSTOM';

/** 부모 모델 정보 (재귀적). 파인튜닝된 모델의 원본 계보를 거슬러 올라간다. */
export interface ModelReadParent {
  id: number;
  name: string;
  description: string | null;
  /** 부모 모델 분류 (CATALOG 또는 CUSTOM). 게이트웨이 보강 실패 시 null. */
  visibility?: ModelVisibility | null;
  parent_model?: ModelReadParent | null;
}

/** 자식 모델 정보 (재귀적). 해당 모델을 기반으로 파생된 모델 트리. */
export interface ModelReadChild {
  id: number;
  name: string;
  description: string | null;
  /** 자식 모델 분류 (CATALOG 또는 CUSTOM). 게이트웨이 보강 실패 시 null. */
  visibility?: ModelVisibility | null;
  child_models?: ModelReadChild[] | null;
}

export interface Model {
  id: number;
  name: string;
  description: string | null;
  repo_id: string | null;
  provider_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  type_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  format_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  parent_model_id: number | null;
  task: string | null;
  parameter: string | null;
  sample_code: string | null;
  registry: {
    id: number;
    artifact_path: string;
    uri: string;
    run_id: string | null;
    reference_model_id: number;
    created_at: string | null;
    updated_at: string | null;
    created_by: string | null;
    updated_by: string | null;
  } | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  learning_enable_yn: boolean | null;
  opt_enable_yn: boolean | null;
  visibility: ModelVisibility | null;
  parent_model?: ModelReadParent | null;
  child_models?: ModelReadChild[] | null;
  member_info?: {
    member_id: string;
    role: string;
    name: string;
  };
}

export interface CustomModel {
  id: number;
  name: string;
  repo_id: string | null;
  description: string | null;
  parameter: string | null;
  sample_code: string | null;
  task: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  parent_model_id: number | null;
  provider_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  format_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  type_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  registry: {
    id: number;
    uri: string;
    artifact_path: string;
    run_id: string | null;
    reference_model_id: number;
    created_at: string | null;
    created_by: string | null;
    updated_at: string | null;
    updated_by: string | null;
  } | null;
  learning_enable_yn: boolean | null;
  opt_enable_yn: boolean | null;
  visibility: ModelVisibility | null;
  parent_model?: ModelReadParent | null;
  child_models?: ModelReadChild[] | null;
}

export interface ModelCatalog {
  id: number;
  name: string;
  repo_id: string | null;
  description: string | null;
  parameter: string | null;
  sample_code: string | null;
  task: string | null;
  parent_model_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  provider_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  format_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  type_info: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  registry: {
    id: number;
    uri: string;
    artifact_path: string;
    run_id: string | null;
    reference_model_id: number;
    created_at: string | null;
    created_by: string | null;
    updated_at: string | null;
    updated_by: string | null;
  } | null;
  learning_enable_yn: boolean | null;
  opt_enable_yn: boolean | null;
  visibility: ModelVisibility | null;
  parent_model?: ModelReadParent | null;
  child_models?: ModelReadChild[] | null;
}

export interface ModelProvider {
  id: number;
  name: string;
  description: string;
}

export interface ModelType {
  id: number;
  name: string;
  description: string;
}

export interface ModelFormat {
  id: number;
  name: string;
  description: string;
}

export interface HubModel {
  _id?: string | null;
  id: string;
  modelId?: string | null;
  author?: string | null;
  createdAt?: string | null;
  lastModified?: string | null;
  downloads?: number | null;
  likes?: number | null;
  tags?: string[] | null;
  pipeline_tag?: string | null;
  task?: string | null;
  library_name?: string | null;
  numParameters?: number | null;
  /** 사람이 읽기 쉬운 파라미터 표기. Kaggle은 항상 null */
  parameterDisplay?: string | null;
  /** 파라미터 범주 정보. Kaggle은 항상 null */
  parameterRange?: string | null;
  private?: boolean | null;
  gated?: boolean | string | null;
  sha?: string | null;
}

export interface HubModelsResponse {
  data: HubModel[];
  pagination?: {
    total?: number | null;
    page?: number;
    limit?: number;
    /** 다음 페이지가 있을 가능성 (Kaggle 등 lower-bound total 마켓에서 페이지 이동 판단용) */
    has_more?: boolean | null;
    /** total 이 정확한 전체 수인지 (HuggingFace=true, Kaggle=false 하한값) */
    total_is_exact?: boolean | null;
    /** 실제 업스트림에 적용된 필터 정보 */
    applied_filters?: Record<string, unknown> | null;
  } | null;
}

export interface HubModelTag {
  data: {
    id: string;
    label: string;
    type: string;
  }[];
  remaining_count: number;
}

/** 모델 최적화/경량화 task 분류. */
export type ModelImprovementCategory = 'optimization' | 'lightweight';

/** 최적화/경량화 task 진행 상태. */
export type ModelImprovementStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** 사용 가능한 최적화/경량화 기법. */
export interface ModelImprovementTaskType {
  /** 기법 식별자 (tensorrt, openvino, pruning, ptq 등) */
  name: string;
  category: ModelImprovementCategory;
  /** 표시용 설명 */
  description: string | null;
}

export interface GetImprovementTaskTypesParams {
  /** 카테고리 필터 (optimization, lightweight) */
  category?: ModelImprovementCategory;
  /** 지정 시 본인 소유 모델에 한해 repo_id 기반 허용 기법만 반환 */
  source_model_id?: number;
}

export interface CreateImprovementRequest {
  /** 대상 모델 ID */
  source_model_id: number;
  /** 최적화 기법 (tensorrt, openvino, pruning, ptq 등) */
  task_type: string;
}

export interface CreateImprovementResponse {
  /** task 추적 UUID */
  task_id: string;
  /** 초기값 PENDING */
  status: ModelImprovementStatus;
  source_model_id: number;
  created_at: string;
}

export interface ImprovementStatusResponse {
  task_id: string;
  status: ModelImprovementStatus;
  source_model_id: number;
  created_at: string;
  updated_at: string;
  /** 상태 메시지 */
  message: string | null;
  /** 결과 모델 ID (SUCCEEDED 시) */
  result_model_id: number | null;
  /** 에러 메시지 (FAILED 시) */
  error: string | null;
}

/** 모델의 저장 파일 한 건 (MLflow 아티팩트) */
export interface ModelFile {
  name: string;
  size_bytes: number;
  last_modified: string;
  /** 파일 주소가 아니라 서명 URL을 발급받는 게이트웨이 API 경로 */
  download_url: string;
}

/** 다운로드 URL 발급 응답. download_url은 5분간 무인증 접근이 가능하므로 저장·로깅 금지. */
export interface ModelFileDownloadUrl {
  model_id: number;
  name: string;
  size_bytes: number;
  download_url: string;
  expires_at: string;
}

export interface GetModelsParams {
  page?: number;
  size?: number;
  search?: string;
  model_type_id?: number;
  model_provider_id?: number;
  model_format_id?: number;
  visibility?: 'catalog' | 'custom';
  filter_type?: string;
  sort?: string;
}

export interface GetCustomModelsParams {
  page?: number;
  size?: number;
  model_provider_id?: number;
  model_type_id?: number;
  model_format_id?: number;
  search?: string;
}

export interface GetModelCatalogsParams {
  page?: number;
  size?: number;
  model_provider_id?: number;
  model_type_id?: number;
  model_format_id?: number;
  search?: string;
}

export interface GetModelProvidersParams {
  page?: number;
  size?: number;
  provider_name?: string;
}

export interface GetModelTypesParams {
  page?: number;
  size?: number;
  type_name?: string;
}

export interface GetModelFormatsParams {
  page?: number;
  size?: number;
  format_name?: string;
}

export interface GetModelFilesParams {
  page?: number;
  size?: number;
  /** name·size_bytes·last_modified. 내림차순은 '-' 접두사 */
  sort?: string;
}

export interface GetHubModelsParams {
  market: 'huggingface' | 'kaggle';
  sort?: string;
  page?: number;
  limit?: number;
  search?: string;
  num_parameters_min?: string | null;
  num_parameters_max?: string | null;
  task?: string;
  library?: string[];
  language?: string[];
  license?: string | null;
  apps?: string[];
  inference_provider?: string[];
  other?: string[];
}
