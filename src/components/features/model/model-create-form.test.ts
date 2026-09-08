import { describe, expect, it } from 'vitest';
import {
  buildModelCreateFormData,
  createInitialModelCreateFormValues,
  MODEL_CREATE_FORM_MESSAGES,
  modelCreateFormSchema,
  type ModelCreateFormValues,
} from './model-create-form';

const validValues = (): ModelCreateFormValues => ({
  name: 'Llama 3 8B',
  repo_id: 'meta-llama/Llama-3-8B',
  provider_id: 2,
  type_id: 1,
  format_id: 3,
  description: '',
  sample_code: '',
  file: null,
});

// 필드별 첫 에러 메시지만 모아 단언을 단순화한다
const fieldErrors = (values: ModelCreateFormValues) => {
  const result = modelCreateFormSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]).reverse()
  );
};

describe('modelCreateFormSchema', () => {
  it('초기값은 필수 5개 필드 모두 에러가 난다', () => {
    expect(fieldErrors(createInitialModelCreateFormValues())).toEqual({
      name: MODEL_CREATE_FORM_MESSAGES.nameRequired,
      repo_id: MODEL_CREATE_FORM_MESSAGES.repoIdRequired,
      provider_id: MODEL_CREATE_FORM_MESSAGES.providerRequired,
      type_id: MODEL_CREATE_FORM_MESSAGES.typeRequired,
      format_id: MODEL_CREATE_FORM_MESSAGES.formatRequired,
    });
  });

  it('필수 필드가 채워지면 통과하고 ID는 number로 유지된다', () => {
    const result = modelCreateFormSchema.safeParse(validValues());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider_id).toBe(2);
      expect(result.data.type_id).toBe(1);
      expect(result.data.format_id).toBe(3);
    }
  });

  it('파일은 선택 사항이고 File 인스턴스만 허용한다', () => {
    const file = new File(['weights'], 'model.safetensors');

    expect(fieldErrors({ ...validValues(), file })).toEqual({});
    expect(fieldErrors({ ...validValues(), file: null })).toEqual({});
    expect(fieldErrors({ ...validValues(), file: 'not-a-file' as unknown as File })).toHaveProperty(
      'file'
    );
  });
});

describe('buildModelCreateFormData', () => {
  it('필수·선택 텍스트 필드를 모두 담고 ID는 문자열로 변환한다', () => {
    const formData = buildModelCreateFormData({
      ...validValues(),
      provider_id: 2,
      type_id: 1,
      format_id: 3,
      description: '설명',
      sample_code: 'print("hi")',
    });

    expect(Object.fromEntries(formData.entries())).toEqual({
      name: 'Llama 3 8B',
      repo_id: 'meta-llama/Llama-3-8B',
      provider_id: '2',
      type_id: '1',
      format_id: '3',
      description: '설명',
      sample_code: 'print("hi")',
    });
    expect(formData.has('file')).toBe(false);
  });

  it('파일이 있으면 file 필드로 함께 담는다', () => {
    const file = new File(['weights'], 'model.safetensors');
    const formData = buildModelCreateFormData({
      ...validValues(),
      provider_id: 2,
      type_id: 1,
      format_id: 3,
      file,
    });

    expect(formData.get('file')).toBe(file);
  });
});
