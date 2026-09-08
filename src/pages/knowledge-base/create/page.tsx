import {
  Accordion,
  BreadCrumb,
  Button,
  FileDrop,
  Input,
  RadioGroupButton,
  Select,
  Slider,
  Stepper,
  Textarea,
  useToast,
} from '@innogrid/ui';
import { useNavigate } from 'react-router';
import { IconArrCount, IconDocument } from '../../../assets/img/icon';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCreateKnowledgeBase,
  useGetChunkTypes,
  useGetLanguages,
  useGetSearchMethods,
} from '@/hooks/service/knowledgebase';
import { useGetModels, useGetModelTypes } from '@/hooks/service/models';
import type { ChunkType, SearchMethod } from '@/types/knowledgebase';
import type { Model } from '@/types/model';
import {
  KNOWLEDGE_BASE_DEFAULTS,
  KNOWLEDGE_BASE_FILE_EXTENSIONS,
  KNOWLEDGE_BASE_LIMITS,
  KNOWLEDGE_BASE_STEP_FIELDS,
  VERIFIED_EMBEDDING_MODEL_IDS,
  buildKnowledgeBaseCreatePayload,
  createInitialKnowledgeBaseFormValues,
  getKnowledgeBaseCreateErrorMessage,
  knowledgeBaseFormSchema,
  type KnowledgeBaseFormValues,
} from './knowledge-base-form';

type KnowledgeBaseFormField = keyof KnowledgeBaseFormValues;

// 폼 타입은 resolver에서 추론시킨다 — useForm에 제네릭을 직접 주면 TTransformedValues가 맞지 않아
// Control을 하위 컴포넌트로 넘길 때 타입이 어긋난다.
const useKnowledgeBaseForm = () =>
  useForm({
    resolver: zodResolver(knowledgeBaseFormSchema),
    defaultValues: createInitialKnowledgeBaseFormValues(),
    // 입력 중에는 검증하지 않고 단계 이동·생성 시점(trigger/handleSubmit)에만 검증한다.
    // 입력을 고치는 즉시 그 필드의 에러만 지운다(각 Controller의 clearErrors).
    mode: 'onSubmit',
  });

interface StepProps {
  form: ReturnType<typeof useKnowledgeBaseForm>;
}

export default function KnowledgeBaseCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<number>(0);
  const { createKnowledgeBase, isPending } = useCreateKnowledgeBase();
  const form = useKnowledgeBaseForm();
  const { trigger, handleSubmit, getFieldState, getValues } = form;

  // 검증 실패 시 첫 에러를 토스트로 알린다 — 필드 옆 인라인 표시는 각 Controller가 맡는다
  const toastFirstError = (fields: readonly KnowledgeBaseFormField[]) => {
    const message = fields
      .map((field) => getFieldState(field).error?.message)
      .find((candidate): candidate is string => Boolean(candidate));
    if (!message) return;

    toast.open({ status: 'negative', title: '입력값을 확인해주세요.', children: message });
  };

  const handleClickNext = async () => {
    if (step >= 2) return;

    const fields =
      step === 0 ? KNOWLEDGE_BASE_STEP_FIELDS.basic : KNOWLEDGE_BASE_STEP_FIELDS.embedding;
    const isValid = await trigger(fields);
    if (!isValid) {
      toastFirstError(fields);
      return;
    }

    setStep((prev) => prev + 1);
  };

  const handleClickPrevious = () => {
    if (step !== 0) setStep((prev) => prev - 1);
  };

  const handleClickCreate = handleSubmit(
    async (values) => {
      try {
        const created = await createKnowledgeBase(buildKnowledgeBaseCreatePayload(values));
        toast.open({
          status: 'positive',
          title: '지식 베이스 생성 성공',
          children: '지식 베이스가 성공적으로 생성되었습니다.',
        });
        navigate(`/knowledge-base/${created.surro_knowledge_id}`);
      } catch (error) {
        toast.open({
          status: 'negative',
          title: '지식 베이스 생성 실패',
          children: (
            <>
              {getKnowledgeBaseCreateErrorMessage(error)}
              <br />
              다시 시도하면 파일이 다시 업로드됩니다.
            </>
          ),
        });
      }
    },
    (fieldErrors) => {
      // 에러가 있는 단계로 되돌린다 — 기본 설정 에러가 우선
      toastFirstError([
        ...KNOWLEDGE_BASE_STEP_FIELDS.basic,
        ...KNOWLEDGE_BASE_STEP_FIELDS.embedding,
      ]);
      const hasBasicError = KNOWLEDGE_BASE_STEP_FIELDS.basic.some((field) => fieldErrors[field]);
      setStep(hasBasicError ? 0 : 1);
    }
  );

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[{ label: '지식 베이스', path: '/knowledge-base' }, { label: '지식 베이스 생성' }]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">지식 베이스</h2>
      </div>
      <div className="page-content-stepper">
        <div className="page-stepper-box">
          <Stepper
            step={step}
            steps={[{ title: '기본 설정' }, { title: '임베딩 설정' }, { title: '검토' }]}
          />
        </div>
        <div className="page-content-stepper-desc">
          {step === 0 && <Step1 form={form} />}
          {step === 1 && <Step2 form={form} />}
          {step === 2 && <Step3 values={getValues()} />}
          {step === 2 && isPending && (
            <div
              className="mx-10 mb-10 rounded-lg border border-[#d9dee8] bg-[#f7f9fc] p-5"
              role="status"
              aria-live="polite"
            >
              <div className="mb-2 text-sm font-semibold">
                파일을 업로드하고 문서를 처리하고 있습니다.
              </div>
              <p className="mt-2 text-xs leading-5 text-[#667085]">
                대용량 파일은 업로드와 임베딩에 수 분 이상 걸릴 수 있습니다. 생성 결과가 확인될
                때까지 이 화면을 유지해주세요.
              </p>
            </div>
          )}

          <div className="page-footer">
            <div className="page-footer_btn-box">
              <Button
                size="large"
                color="secondary"
                disabled={isPending}
                onClick={() => navigate('/knowledge-base')}
              >
                취소
              </Button>
              <div className="flex gap-1.5">
                <Button
                  size="large"
                  color="tertiary"
                  disabled={step === 0 || isPending}
                  onClick={handleClickPrevious}
                >
                  이전
                </Button>
                {step === 2 ? (
                  <Button
                    size="large"
                    color="primary"
                    onClick={handleClickCreate}
                    disabled={isPending}
                  >
                    {isPending ? '생성 중...' : '생성'}
                  </Button>
                ) : (
                  <div className="btn-next">
                    <Button
                      size="large"
                      color="primary"
                      disabled={isPending}
                      onClick={handleClickNext}
                    >
                      다음
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const Step1 = ({ form }: StepProps) => {
  const { control, clearErrors } = form;
  const toast = useToast();

  return (
    <div className="page-content page-pb-40">
      <div className="page-input-box">
        <div className="page-input_title">기본 설정</div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">이름</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    placeholder="이름을 입력해주세요."
                    value={field.value}
                    errMessage={fieldState.error?.message}
                    onBlur={field.onBlur}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(e.target.value);
                      clearErrors('name');
                    }}
                  />
                  {!fieldState.error && (
                    <p className="page-input_item-input-desc">지식 베이스 이름을 입력해주세요.</p>
                  )}
                </>
              )}
            />
          </div>
        </div>
        <div className="page-input_item-box">
          <div className="page-input_item-name">설명</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <Textarea
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    field.onChange(e.target.value)
                  }
                  placeholder="설명을 입력해주세요."
                />
              )}
            />
          </div>
        </div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">파일</div>
          <div className="page-input_item-data">
            <div className="page-input_item-data_fileUpload">
              <Controller
                control={control}
                name="file"
                render={({ field, fieldState }) => (
                  <>
                    <FileDrop
                      id="knowledge-base-file"
                      extensions={[...KNOWLEDGE_BASE_FILE_EXTENSIONS]}
                      description={
                        <>
                          파일을 여기에 드래그하거나 클릭하여 업로드하세요.
                          <br />
                          허용되는 파일 형식: pdf, doc, docx, xls, xlsx, ppt, pptx, csv
                        </>
                      }
                      files={field.value ? [field.value] : []}
                      onAddFile={(files: File[]) => {
                        field.onChange(files[0] ?? null);
                        clearErrors('file');
                      }}
                      onDeleteFile={() => field.onChange(null)}
                      onError={({ errorMessage }) =>
                        toast.open({
                          status: 'negative',
                          title: '파일 업로드 실패',
                          children: errorMessage,
                        })
                      }
                    />
                    {fieldState.error ? (
                      <p className="mt-1 text-xs leading-normal text-[#dc4646]">
                        {fieldState.error.message}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-[#667085]">
                        대용량 파일은 업로드·임베딩에 수 분 이상 걸릴 수 있으며, 서버 처리 실패 시
                        다시 업로드해야 할 수 있습니다.
                      </p>
                    )}
                  </>
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const parseNumericInput = (value: string) => (value === '' ? Number.NaN : Number(value));
const displayNumericInput = (value: number) => (Number.isFinite(value) ? String(value) : '');
const getSliderValue = (value: number, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));

interface SliderNumberFieldProps {
  value: number;
  fallback: number;
  min: number;
  max: number;
  step: number;
  placeholder: string;
  onChange: (value: number) => void;
}

// 슬라이더 + 숫자 입력 + 증감 버튼이 한 값을 공유하는 입력 묶음 (Top K, 점수 임계값)
const SliderNumberField = ({
  value,
  fallback,
  min,
  max,
  step,
  placeholder,
  onChange,
}: SliderNumberFieldProps) => {
  // 0.1 단위 증감의 부동소수 오차(0.30000000000000004)를 step 자릿수로 정리한다
  const decimals = step < 1 ? 1 : 0;
  const clamp = (next: number) => Number(Math.min(max, Math.max(min, next)).toFixed(decimals));
  // 값이 비어 있으면(NaN) 증감 버튼은 최소값에서 시작한다
  const stepUp = () => onChange(clamp((Number.isFinite(value) ? value : min - step) + step));
  const stepDown = () => onChange(clamp((Number.isFinite(value) ? value : min + step) - step));

  return (
    <div className="page-input_item-row2">
      <div className="w-54">
        <Slider
          step={step}
          min={min}
          max={max}
          value={[getSliderValue(value, fallback, min, max)]}
          onValueChange={(next) => onChange(next[0] ?? value)}
        />
      </div>
      <div className="page-num-count">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          value={displayNumericInput(value)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(parseNumericInput(e.target.value))
          }
        />
        <div className="page-num-count-control">
          <button type="button" className="btn-num" onClick={stepUp}>
            <span className="icon-arr icon-arrUp">
              <IconArrCount />
            </span>
          </button>
          <button type="button" className="btn-num" onClick={stepDown}>
            <span className="icon-arr icon-arrDown">
              <IconArrCount />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

const Step2 = ({ form }: StepProps) => {
  const { control, clearErrors } = form;
  const { chunkTypes } = useGetChunkTypes();
  const { languages } = useGetLanguages();
  const { searchMethods } = useGetSearchMethods();
  const { modelTypes } = useGetModelTypes({ type_name: 'Embedding' });
  const { models } = useGetModels(
    { page: 1, size: 999, model_type_id: modelTypes[0]?.id },
    { enabled: !!modelTypes.length }
  );
  const verifiedModels = models.filter((model) =>
    VERIFIED_EMBEDDING_MODEL_IDS.includes(model.id as (typeof VERIFIED_EMBEDDING_MODEL_IDS)[number])
  );
  // 청크 중첩의 상한은 청크 길이에 따라 움직인다
  const chunkSize = useWatch({ control, name: 'chunk_size' });

  return (
    <div className="page-content page-pb-40">
      <div className="page-input-box">
        <div className="page-input_title">청크 설정</div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">청크 길이</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="chunk_size"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    type="number"
                    placeholder="청크 길이를 입력해주세요."
                    min={KNOWLEDGE_BASE_LIMITS.chunkSize.min}
                    max={KNOWLEDGE_BASE_LIMITS.chunkSize.max}
                    step={1}
                    value={displayNumericInput(field.value)}
                    errMessage={fieldState.error?.message}
                    onBlur={field.onBlur}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(parseNumericInput(e.target.value));
                      clearErrors('chunk_size');
                    }}
                  />
                  {!fieldState.error && (
                    <p className="page-input_item-input-desc">
                      300~1,000자 범위에서 500자를 권장합니다.
                    </p>
                  )}
                </>
              )}
            />
          </div>
        </div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">청크 중첩</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="chunk_overlap"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    type="number"
                    placeholder="청크 중첩을 입력해주세요."
                    min={0}
                    max={Number.isFinite(chunkSize) ? Math.max(0, chunkSize - 1) : undefined}
                    step={1}
                    value={displayNumericInput(field.value)}
                    errMessage={fieldState.error?.message}
                    onBlur={field.onBlur}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(parseNumericInput(e.target.value));
                      clearErrors('chunk_overlap');
                    }}
                  />
                  {!fieldState.error && (
                    <p className="page-input_item-input-desc">
                      청크 길이보다 작아야 하며, 청크 길이의 10~20%를 권장합니다.
                    </p>
                  )}
                </>
              )}
            />
          </div>
        </div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">청크 타입</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="chunk_type"
              render={({ field, fieldState }) => (
                <Select
                  classNames={{ container: () => 'page-input_item-data_select' }}
                  options={chunkTypes}
                  getOptionLabel={(option: ChunkType) => option.name}
                  getOptionValue={(option: ChunkType) => option.id.toString()}
                  value={chunkTypes.find((type: ChunkType) => type.id === field.value.id) ?? null}
                  isError={!!fieldState.error}
                  errMessage={fieldState.error?.message}
                  onChange={(option: ChunkType | null) => {
                    if (option) {
                      field.onChange(option);
                      clearErrors('chunk_type');
                    }
                  }}
                />
              )}
            />
          </div>
        </div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">언어</div>
          <div className="page-input_item-data">
            <div className="page-input_item-col2">
              <Controller
                control={control}
                name="language"
                render={({ field, fieldState }) => (
                  <>
                    <RadioGroupButton
                      id="language"
                      options={languages.map((lang) => ({
                        label: lang.description,
                        value: String(lang.id),
                      }))}
                      orientation="vertical"
                      value={String(field.value.id)}
                      onValueChange={(languageId: string) => {
                        const selectedLanguage = languages.find(
                          (lang) => lang.id === Number(languageId)
                        );
                        if (selectedLanguage) {
                          field.onChange(selectedLanguage);
                          clearErrors('language');
                        }
                      }}
                    />
                    {fieldState.error && (
                      <p className="mt-1 text-xs leading-normal text-[#dc4646]">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="page-input-box page-input-hr">
        <div className="page-input_title">임베딩 설정</div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">임베딩 모델</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="embedding_model"
              render={({ field, fieldState }) => (
                <>
                  <Select
                    classNames={{ container: () => 'page-input_item-data_select' }}
                    options={verifiedModels}
                    getOptionLabel={(option: Model) => option.name}
                    getOptionValue={(option: Model) => option.id.toString()}
                    value={
                      verifiedModels.find((model: Model) => model.id === field.value.id) ?? null
                    }
                    isDisabled={verifiedModels.length <= 1}
                    isError={!!fieldState.error}
                    errMessage={fieldState.error?.message}
                    onChange={(option: Model | null) => {
                      if (option) {
                        field.onChange(option);
                        clearErrors('embedding_model');
                      }
                    }}
                  />
                  {!fieldState.error && (
                    <p className="page-input_item-input-desc">
                      현재 배포가 확인된 bge-m3 모델만 사용할 수 있습니다.
                    </p>
                  )}
                </>
              )}
            />
          </div>
        </div>
      </div>
      <div className="page-input-box page-input-hr">
        <div className="page-input_title">검색 설정</div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">검색 타입</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="search_method"
              render={({ field, fieldState }) => (
                <Select
                  classNames={{ container: () => 'page-input_item-data_select' }}
                  options={searchMethods}
                  getOptionLabel={(option: SearchMethod) => option.name}
                  getOptionValue={(option: SearchMethod) => option.id.toString()}
                  value={
                    searchMethods.find((method: SearchMethod) => method.id === field.value.id) ??
                    null
                  }
                  isError={!!fieldState.error}
                  errMessage={fieldState.error?.message}
                  onChange={(option: SearchMethod | null) => {
                    if (option) {
                      field.onChange(option);
                      clearErrors('search_method');
                    }
                  }}
                />
              )}
            />
          </div>
        </div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">Top K</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="top_k"
              render={({ field, fieldState }) => (
                <>
                  <SliderNumberField
                    value={field.value}
                    fallback={KNOWLEDGE_BASE_DEFAULTS.topK}
                    min={KNOWLEDGE_BASE_LIMITS.topK.min}
                    max={KNOWLEDGE_BASE_LIMITS.topK.max}
                    step={1}
                    placeholder="3"
                    onChange={(value) => {
                      field.onChange(value);
                      clearErrors('top_k');
                    }}
                  />
                  {fieldState.error ? (
                    <p className="mt-1 text-xs leading-normal text-[#dc4646]">
                      {fieldState.error.message}
                    </p>
                  ) : (
                    <p className="page-input_item-input-desc">1~20 범위에서 3~5를 권장합니다.</p>
                  )}
                </>
              )}
            />
          </div>
        </div>
        <div className="page-input_item-box">
          <div className="page-input_item-name page-icon-requisite">점수 임계값</div>
          <div className="page-input_item-data">
            <Controller
              control={control}
              name="threshold"
              render={({ field, fieldState }) => (
                <>
                  <SliderNumberField
                    value={field.value}
                    fallback={KNOWLEDGE_BASE_DEFAULTS.threshold}
                    min={KNOWLEDGE_BASE_LIMITS.threshold.min}
                    max={KNOWLEDGE_BASE_LIMITS.threshold.max}
                    step={0.1}
                    placeholder="0"
                    onChange={(value) => {
                      field.onChange(value);
                      clearErrors('threshold');
                    }}
                  />
                  {fieldState.error ? (
                    <p className="mt-1 text-xs leading-normal text-[#dc4646]">
                      {fieldState.error.message}
                    </p>
                  ) : (
                    <p className="page-input_item-input-desc">
                      0.3~0.5를 권장합니다. 0은 유사도 필터를 적용하지 않습니다.
                    </p>
                  )}
                </>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface Step3Props {
  values: KnowledgeBaseFormValues;
}

const Step3 = ({ values }: Step3Props) => {
  const accordionItems1 = [
    {
      label: '기본 정보',
      component: (
        <div>
          <div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">이름</div>
              <div className="page-accordion_item-data">{values.name || '-'}</div>
            </div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">설명</div>
              <div className="page-accordion_item-data">{values.description || '-'}</div>
            </div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">파일</div>
              <div className="page-accordion_item-data">
                {values.file ? (
                  <div className="flex items-center gap-2">
                    <IconDocument /> {values.file.name}
                  </div>
                ) : (
                  '-'
                )}
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const accordionItems2 = [
    {
      label: '청크 설정',
      component: (
        <div>
          <div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">청크 타입</div>
              <div className="page-accordion_item-data">{values.chunk_type.name || '-'}</div>
            </div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">청크 길이</div>
              <div className="page-accordion_item-data">{values.chunk_size}</div>
            </div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">언어</div>
              <div className="page-accordion_item-data">{values.language.name || '-'}</div>
            </div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">청크 중첩</div>
              <div className="page-accordion_item-data">{values.chunk_overlap}</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const accordionItems3 = [
    {
      label: '임베딩 설정',
      component: (
        <div>
          <div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">모델</div>
              <div className="page-accordion_item-data">{values.embedding_model.name || '-'}</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const accordionItems4 = [
    {
      label: '검색 설정',
      component: (
        <div>
          <div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">검색 타입</div>
              <div className="page-accordion_item-data">{values.search_method.name || '-'}</div>
            </div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">Top K</div>
              <div className="page-accordion_item-data">{values.top_k}</div>
            </div>
            <div className="page-accordion_item-box">
              <div className="page-accordion_item-name">점수 임계값</div>
              <div className="page-accordion_item-data">{values.threshold}</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="page-content page-pb-40">
      <div className="page-accordion-box">
        <Accordion components={accordionItems1} defaultValue="0" />
        <Accordion components={accordionItems2} defaultValue="0" />
        <Accordion components={accordionItems3} defaultValue="0" />
        <Accordion components={accordionItems4} defaultValue="0" />
      </div>
    </div>
  );
};
