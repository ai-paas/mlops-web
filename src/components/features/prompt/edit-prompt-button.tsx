import { Button, Input, Modal, Textarea, useToast } from '@innogrid/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useGetPrompt, useGetPromptVariableTypes, useUpdatePrompt } from '@/hooks/service/prompts';
import { PromptEditor } from '@/components/ui/prompt-editor';
import { getServerErrorMessage } from '@/lib/api';
import {
  createInitialPromptFormValues,
  createPromptFormSchema,
  extractPromptVariables,
  findInvalidPromptVariables,
  PROMPT_FORM_MESSAGES,
  type PromptFormValues,
} from './prompt-form';

export const EditPromptButton = ({ promptId }: { promptId?: number }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { prompt } = useGetPrompt(isModalOpen ? promptId : undefined);
  const { updatePrompt, isPending } = useUpdatePrompt();
  const { availableTypes } = useGetPromptVariableTypes();
  const toast = useToast();

  // 사용 가능한 변수 목록은 비동기로 로드되므로 목록이 바뀌면 resolver도 다시 만든다
  const resolver = useMemo(
    () => zodResolver(createPromptFormSchema(availableTypes)),
    [availableTypes]
  );
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<PromptFormValues>({
    resolver,
    defaultValues: createInitialPromptFormValues(),
  });

  // 입력 중에도 허용되지 않은 변수를 바로 경고하고 확인 버튼을 잠근다(제출 검증은 스키마가 담당)
  const content = watch('content');
  const invalidVariables = useMemo(
    () => findInvalidPromptVariables(content ?? '', availableTypes),
    [content, availableTypes]
  );

  const openModal = useCallback(() => {
    if (!promptId) return;
    setIsModalOpen(true);
  }, [promptId]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    reset(createInitialPromptFormValues());
  }, [reset]);

  const onSubmit = (data: PromptFormValues) => {
    if (!promptId) return;
    updatePrompt(
      {
        surro_prompt_id: promptId,
        name: data.name,
        description: data.description,
        content: data.content,
        prompt_variable: extractPromptVariables(data.content),
      },
      {
        onSuccess: () => {
          toast.open({
            status: 'positive',
            title: '프롬프트 편집 성공',
            children: '프롬프트가 성공적으로 편집되었습니다.',
          });
          closeModal();
        },
        onError: (error) => {
          toast.open({
            status: 'negative',
            title: '프롬프트 편집 실패',
            children: getServerErrorMessage(error, '프롬프트 편집 중 오류가 발생했습니다.'),
          });
        },
      }
    );
  };

  useEffect(() => {
    if (prompt && isModalOpen) {
      reset({
        name: prompt.name,
        description: prompt.description ?? '',
        content: prompt.content ?? '',
      });
    }
  }, [prompt, isModalOpen, reset]);

  return (
    <>
      <Button size="medium" color="secondary" disabled={!promptId} onClick={openModal}>
        편집
      </Button>
      <Modal
        allowOutsideInteraction
        isOpen={isModalOpen}
        isButtonLoading={isPending}
        buttonDisabled={isPending || invalidVariables.length > 0}
        size="small"
        title="프롬프트 편집"
        buttonTitle="확인"
        onRequestClose={closeModal}
        action={handleSubmit(onSubmit)}
        subButton={
          <Button size="large" color="secondary" onClick={closeModal}>
            취소
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <div className="page-input_item-name page-icon-requisite">이름</div>
            <div className="page-input_item-data">
              <Input
                placeholder="이름을 입력해주세요."
                errMessage={errors.name?.message}
                {...register('name')}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="page-input_item-name">설명</div>
            <div className="page-input_item-data">
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Textarea
                    placeholder="설명을 입력해주세요."
                    errMessage={errors.description?.message}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="page-input_item-name page-icon-requisite">프롬프트 내용</div>
            <div className="page-input_item-data">
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <PromptEditor
                    placeholder="프롬프트를 입력해주세요."
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    height={240}
                    allowedVariables={availableTypes}
                  />
                )}
              />
              {errors.content?.message ? (
                <p className="mt-1 text-xs leading-normal tracking-[-0.5px] text-[#dc4646]">
                  {errors.content.message}
                </p>
              ) : invalidVariables.length > 0 ? (
                <p className="mt-1 text-xs leading-normal tracking-[-0.5px] text-[#dc4646]">
                  {PROMPT_FORM_MESSAGES.invalidVariables(invalidVariables)}
                </p>
              ) : (
                <p className="page-input_item-input-desc">
                  {'{{#변수명#}}'} 형식으로 변수를 지정할 수 있습니다. 사용 가능한 변수:{' '}
                  {availableTypes.length > 0
                    ? availableTypes.map((type) => `{{#${type}#}}`).join(', ')
                    : '없음'}
                </p>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
