import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// placeholder('…를 입력/선택해주세요.')와 겹치지 않도록 다른 폼과 같은 '…는 필수입니다.' 패턴을 쓴다
export const MODEL_CREATE_FORM_MESSAGES = {
  nameRequired: '모델명은 필수입니다.',
  repoIdRequired: '모델 ID는 필수입니다.',
  providerRequired: '모델 공급자는 필수입니다.',
  typeRequired: '모델 타입은 필수입니다.',
  formatRequired: '모델 포맷은 필수입니다.',
} as const;

// Select 미선택은 null로 들고 있다가 제출 시점에 필수 검사하고, 통과하면 number로 좁힌다
const requiredId = (message: string) =>
  z
    .number()
    .nullable()
    .refine((id): boolean => id !== null, message)
    .transform((id) => id as number);

/** 커스텀 모델·모델 카탈로그 생성 공용 스키마 (두 폼의 필드·필수 규칙이 같다) */
export const modelCreateFormSchema = z.object({
  name: z.string().min(1, MODEL_CREATE_FORM_MESSAGES.nameRequired),
  repo_id: z.string().min(1, MODEL_CREATE_FORM_MESSAGES.repoIdRequired),
  provider_id: requiredId(MODEL_CREATE_FORM_MESSAGES.providerRequired),
  type_id: requiredId(MODEL_CREATE_FORM_MESSAGES.typeRequired),
  format_id: requiredId(MODEL_CREATE_FORM_MESSAGES.formatRequired),
  description: z.string(),
  sample_code: z.string(),
  /** 모델 가중치 파일 — 선택 사항(외부 허브 모델은 저장소 파일을 사용) */
  file: z.instanceof(File).nullable(),
});

/** 폼이 들고 있는 값 (Select 미선택 = null) */
export type ModelCreateFormValues = z.input<typeof modelCreateFormSchema>;
/** 검증을 통과한 값 (필수 ID가 number로 좁혀진다) */
export type ModelCreateFormOutput = z.output<typeof modelCreateFormSchema>;

export const createInitialModelCreateFormValues = (): ModelCreateFormValues => ({
  name: '',
  repo_id: '',
  provider_id: null,
  type_id: null,
  format_id: null,
  description: '',
  sample_code: '',
  file: null,
});

/** 두 생성 페이지가 같은 설정의 폼을 쓰도록 useForm 호출을 한곳에 둔다 */
export const useModelCreateForm = () =>
  useForm({
    resolver: zodResolver(modelCreateFormSchema),
    defaultValues: createInitialModelCreateFormValues(),
  });

/** 모델 생성 API(multipart) 본문. 파일이 없으면 file 필드를 생략한다. */
export const buildModelCreateFormData = (values: ModelCreateFormOutput) => {
  const formData = new FormData();
  formData.append('name', values.name);
  formData.append('repo_id', values.repo_id);
  formData.append('provider_id', String(values.provider_id));
  formData.append('type_id', String(values.type_id));
  formData.append('format_id', String(values.format_id));
  formData.append('description', values.description);
  formData.append('sample_code', values.sample_code);
  if (values.file) formData.append('file', values.file);
  return formData;
};
