import { useMemo } from 'react';
import { BreadCrumb, Button, Input, Textarea, useToast } from '@innogrid/ui';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { useCreatePrompt, useGetPromptVariableTypes } from '@/hooks/service/prompts';
import { PromptEditor } from '@/components/ui/prompt-editor';
import { getServerErrorMessage } from '@/lib/api';
import {
  createInitialPromptFormValues,
  createPromptFormSchema,
  extractPromptVariables,
  findInvalidPromptVariables,
  PROMPT_FORM_MESSAGES,
  type PromptFormValues,
} from '@/components/features/prompt/prompt-form';

export default function PromptCreatePage() {
  const { createPrompt, isPending } = useCreatePrompt();
  const { availableTypes } = useGetPromptVariableTypes();
  const navigate = useNavigate();
  const toast = useToast();

  // 사용 가능한 변수 목록은 비동기로 로드되므로 목록이 바뀌면 resolver도 다시 만든다
  const resolver = useMemo(
    () => zodResolver(createPromptFormSchema(availableTypes)),
    [availableTypes]
  );
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PromptFormValues>({
    resolver,
    defaultValues: createInitialPromptFormValues(),
  });

  // 입력 중에도 허용되지 않은 변수를 바로 경고하고 생성 버튼을 잠근다(제출 검증은 스키마가 담당)
  const content = useWatch({ control, name: 'content' });
  const invalidVariables = useMemo(
    () => findInvalidPromptVariables(content, availableTypes),
    [content, availableTypes]
  );

  const onValid = async (values: PromptFormValues) => {
    try {
      await createPrompt({
        prompt: {
          name: values.name,
          description: values.description,
          content: values.content,
        },
        prompt_variable: extractPromptVariables(values.content),
      });
      toast.open({
        status: 'positive',
        title: '프롬프트 생성 성공',
        children: '프롬프트가 성공적으로 생성되었습니다.',
      });
      navigate('/prompt');
    } catch (error) {
      toast.open({
        status: 'negative',
        title: '프롬프트 생성 실패',
        children: getServerErrorMessage(error, '프롬프트 생성 중 오류가 발생했습니다.'),
      });
    }
  };

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[{ label: '프롬프트', path: '/prompt' }, { label: '프롬프트 생성' }]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">프롬프트 생성</h2>
      </div>
      <div className="page-content page-pb-40">
        <div className="page-input-box">
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">이름</div>
            <div className="page-input_item-data">
              <Input
                placeholder="이름을 입력해주세요."
                errMessage={errors.name?.message}
                {...register('name')}
              />
              <p className="page-input_item-input-desc">이름 입력에 대한 설명글이 들어갑니다.</p>
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name">설명</div>
            <div className="page-input_item-data">
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Textarea
                    placeholder="설명을 입력해주세요."
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">프롬프트 입력</div>
            <div className="page-input_item-data">
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <PromptEditor
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={
                      '예) 당신은 친절한 고객 상담원입니다. 다음 질문에 정중하게 답변해주세요: {{#context#}}'
                    }
                    name={field.name}
                    height={320}
                    allowedVariables={availableTypes}
                  />
                )}
              />
              {errors.content?.message ? (
                <p className="mt-1 text-xs leading-normal tracking-[-0.5px] text-[#dc4646]">
                  {errors.content.message}
                </p>
              ) : (
                invalidVariables.length > 0 && (
                  <p className="mt-1 text-xs leading-normal tracking-[-0.5px] text-[#dc4646]">
                    {PROMPT_FORM_MESSAGES.invalidVariables(invalidVariables)}
                  </p>
                )
              )}
              <p className="page-input_item-input-desc">
                {'{{#변수명#}}'} 형식으로 변수를 지정할 수 있습니다. 사용 가능한 변수:{' '}
                {availableTypes.length > 0
                  ? availableTypes.map((type) => `{{#${type}#}}`).join(', ')
                  : '없음'}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="page-footer">
        <div className="page-footer_btn-box">
          <div />
          <div>
            <Button size="large" color="secondary" onClick={() => navigate('/prompt')}>
              취소
            </Button>
            <Button
              size="large"
              color="primary"
              onClick={handleSubmit(onValid)}
              disabled={isPending || invalidVariables.length > 0}
            >
              생성
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
