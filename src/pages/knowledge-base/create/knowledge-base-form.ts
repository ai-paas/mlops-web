import * as z from 'zod';

export const KNOWLEDGE_BASE_DEFAULTS = {
  chunkSize: 500,
  chunkOverlap: 50,
  languageId: 1,
  embeddingModelId: 13,
  chunkTypeId: 1,
  searchMethodId: 1,
  topK: 3,
  threshold: 0.4,
} as const;

export const KNOWLEDGE_BASE_LIMITS = {
  chunkSize: { min: 300, max: 1000 },
  topK: { min: 1, max: 20 },
  threshold: { min: 0, max: 1 },
} as const;

export const KNOWLEDGE_BASE_FILE_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
] as const;

/** 배포 상태 조회 API가 없어 실호출로 검증된 모델만 생성 화면에 노출한다. */
export const VERIFIED_EMBEDDING_MODEL_IDS = [KNOWLEDGE_BASE_DEFAULTS.embeddingModelId] as const;

const getExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';

const optionSchema = (message: string) =>
  z.object({
    id: z.number().int().positive(message),
    name: z.string(),
    description: z.string().nullable().optional(),
  });

export type KnowledgeBaseFormOption = z.infer<ReturnType<typeof optionSchema>>;

/**
 * 생성 폼 전체 스키마 — RHF zodResolver에 그대로 넣는다.
 * 단계별 검증은 KNOWLEDGE_BASE_STEP_FIELDS로 trigger 대상 필드만 좁혀서 한다.
 */
export const knowledgeBaseFormSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해주세요.'),
    description: z.string(),
    // 파일은 업로드 전 null — 필수·확장자 검사를 각각의 문구로 알린다.
    // 반환 타입을 boolean으로 명시하는 이유: TS가 `file !== null`을 타입 가드로 추론하면
    // zod가 출력 타입을 File로 좁혀 폼 값(File | null)과 어긋난다.
    file: z
      .instanceof(File)
      .nullable()
      .refine((file): boolean => file !== null, '파일을 업로드해주세요.')
      .refine(
        (file) =>
          file === null ||
          KNOWLEDGE_BASE_FILE_EXTENSIONS.includes(
            getExtension(file.name) as (typeof KNOWLEDGE_BASE_FILE_EXTENSIONS)[number]
          ),
        '지원되는 문서 파일을 업로드해주세요.'
      ),
    chunk_size: z
      .number({ error: '청크 길이를 입력해주세요.' })
      .int('청크 길이는 정수여야 합니다.')
      .min(
        KNOWLEDGE_BASE_LIMITS.chunkSize.min,
        `청크 길이는 ${KNOWLEDGE_BASE_LIMITS.chunkSize.min} 이상이어야 합니다.`
      )
      .max(
        KNOWLEDGE_BASE_LIMITS.chunkSize.max,
        `청크 길이는 ${KNOWLEDGE_BASE_LIMITS.chunkSize.max} 이하여야 합니다.`
      ),
    chunk_overlap: z
      .number({ error: '청크 중첩을 입력해주세요.' })
      .int('청크 중첩은 정수여야 합니다.')
      .min(0, '청크 중첩은 0 이상이어야 합니다.'),
    chunk_type: optionSchema('청크 타입을 선택해주세요.'),
    language: optionSchema('언어를 선택해주세요.'),
    embedding_model: optionSchema('임베딩 모델을 선택해주세요.').refine(
      (model) =>
        VERIFIED_EMBEDDING_MODEL_IDS.includes(
          model.id as (typeof VERIFIED_EMBEDDING_MODEL_IDS)[number]
        ),
      '배포가 확인된 임베딩 모델을 선택해주세요.'
    ),
    search_method: optionSchema('검색 타입을 선택해주세요.'),
    top_k: z
      .number({ error: 'Top K를 입력해주세요.' })
      .int('Top K는 정수여야 합니다.')
      .min(
        KNOWLEDGE_BASE_LIMITS.topK.min,
        `Top K는 ${KNOWLEDGE_BASE_LIMITS.topK.min} 이상이어야 합니다.`
      )
      .max(
        KNOWLEDGE_BASE_LIMITS.topK.max,
        `Top K는 ${KNOWLEDGE_BASE_LIMITS.topK.max} 이하여야 합니다.`
      ),
    threshold: z
      .number({ error: '점수 임계값을 입력해주세요.' })
      .min(
        KNOWLEDGE_BASE_LIMITS.threshold.min,
        `점수 임계값은 ${KNOWLEDGE_BASE_LIMITS.threshold.min} 이상이어야 합니다.`
      )
      .max(
        KNOWLEDGE_BASE_LIMITS.threshold.max,
        `점수 임계값은 ${KNOWLEDGE_BASE_LIMITS.threshold.max} 이하여야 합니다.`
      ),
  })
  .superRefine((values, context) => {
    if (values.chunk_overlap >= values.chunk_size) {
      context.addIssue({
        code: 'custom',
        path: ['chunk_overlap'],
        message: '청크 중첩은 청크 길이보다 작아야 합니다.',
      });
    }
  });

export type KnowledgeBaseFormValues = z.infer<typeof knowledgeBaseFormSchema>;

/** 스텝퍼 단계별로 trigger할 필드 — 두 목록을 합치면 폼 전체 필드다 */
export const KNOWLEDGE_BASE_STEP_FIELDS = {
  basic: ['name', 'description', 'file'],
  embedding: [
    'chunk_size',
    'chunk_overlap',
    'chunk_type',
    'language',
    'embedding_model',
    'search_method',
    'top_k',
    'threshold',
  ],
} as const satisfies Record<string, readonly (keyof KnowledgeBaseFormValues)[]>;

export const createInitialKnowledgeBaseFormValues = (): KnowledgeBaseFormValues => ({
  name: '',
  description: '',
  file: null,
  chunk_size: KNOWLEDGE_BASE_DEFAULTS.chunkSize,
  chunk_overlap: KNOWLEDGE_BASE_DEFAULTS.chunkOverlap,
  chunk_type: {
    id: KNOWLEDGE_BASE_DEFAULTS.chunkTypeId,
    name: 'RecursiveCharacterSplitter',
  },
  language: { id: KNOWLEDGE_BASE_DEFAULTS.languageId, name: 'KO' },
  embedding_model: {
    id: KNOWLEDGE_BASE_DEFAULTS.embeddingModelId,
    name: 'bge-m3',
  },
  search_method: { id: KNOWLEDGE_BASE_DEFAULTS.searchMethodId, name: 'vector' },
  top_k: KNOWLEDGE_BASE_DEFAULTS.topK,
  threshold: KNOWLEDGE_BASE_DEFAULTS.threshold,
});

export const buildKnowledgeBaseCreatePayload = (values: KnowledgeBaseFormValues) => {
  const payload = new FormData();
  const description = values.description.trim();

  payload.append('name', values.name.trim());
  if (description) payload.append('description', description);
  payload.append('language_id', String(values.language.id));
  payload.append('embedding_model_id', String(values.embedding_model.id));
  payload.append('chunk_size', String(values.chunk_size));
  payload.append('chunk_overlap', String(values.chunk_overlap));
  payload.append('chunk_type_id', String(values.chunk_type.id));
  payload.append('search_method_id', String(values.search_method.id));
  payload.append('top_k', String(values.top_k));
  payload.append('threshold', String(values.threshold));
  if (values.file) payload.append('file', values.file);

  return payload;
};

export const getKnowledgeBaseCreateErrorMessage = (error: unknown) => {
  const fallback = '지식 베이스 생성 중 오류가 발생했습니다.';
  if (!(error instanceof Error)) return fallback;

  if (error.message.trim() === 'Deployment not found') {
    return '선택한 임베딩 모델이 배포되어 있지 않습니다. 다른 모델을 선택하세요.';
  }

  if (error.message.startsWith('Request failed')) return fallback;

  return error.message || fallback;
};
