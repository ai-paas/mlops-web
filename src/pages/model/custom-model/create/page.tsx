import {
  useCreateModel,
  useGetModelFormats,
  useGetModelProviders,
  useGetModelTypes,
} from '@/hooks/service/models';
import type { HubModel } from '@/types/model';
import { BreadCrumb, Button, FileDrop, Input, Textarea, useToast } from '@innogrid/ui';
import { useEffect } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';
import {
  buildModelCreateFormData,
  useModelCreateForm,
  type ModelCreateFormOutput,
} from '@/components/features/model/model-create-form';
import { ModelOptionSelect } from '@/components/features/model/model-option-select';

export default function CustomModelCreatePage() {
  const location = useLocation();
  const selectedModel = location.state?.selectedModel as HubModel | undefined;
  const market = location.state?.market as 'huggingface' | 'kaggle' | undefined;
  const { modelProviders } = useGetModelProviders();
  const { modelTypes } = useGetModelTypes();
  const { modelFormats } = useGetModelFormats();
  const navigate = useNavigate();
  const toast = useToast();
  const { createModel, isPending } = useCreateModel();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useModelCreateForm();
  const file = useWatch({ control, name: 'file' });

  const onValid = async (values: ModelCreateFormOutput) => {
    try {
      await createModel(buildModelCreateFormData(values));
      toast.open({
        status: 'positive',
        title: '커스텀 모델 생성 성공',
        children: '커스텀 모델이 성공적으로 생성되었습니다.',
      });
      navigate('/model/custom-model');
    } catch (error) {
      toast.open({
        status: 'negative',
        title: '커스텀 모델 생성 실패',
        children: getServerErrorMessage(error, '커스텀 모델 생성 중 오류가 발생했습니다.'),
      });
    }
  };

  useEffect(() => {
    if (!selectedModel) return;
    // 연동된 마켓(huggingface/kaggle)과 이름이 일치하는 공급자를 찾아 자동 선택
    const normalize = (value: string) => value.toLowerCase().replace(/[\s-]/g, '');
    const matchedProvider = market
      ? modelProviders.find((provider) => normalize(provider.name).includes(normalize(market)))
      : undefined;
    setValue('repo_id', selectedModel.id);
    if (matchedProvider) setValue('provider_id', matchedProvider.id);
  }, [market, modelProviders, selectedModel, setValue]);

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[
            { label: '모델' },
            { label: '커스텀 모델', path: '/model/custom-model' },
            { label: '커스텀 모델 생성' },
          ]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">커스텀 모델 생성</h2>
      </div>
      <div className="page-content page-p-40">
        <div className="page-input-box">
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">모델명</div>
            <div className="page-input_item-data">
              <Input
                placeholder="모델명을 입력해주세요."
                errMessage={errors.name?.message}
                {...register('name')}
              />
              <p className="page-input_item-input-desc">
                화면에 표시될 커스텀 모델의 이름을 입력해주세요.
              </p>
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">모델 ID</div>
            <div className="page-input_item-data">
              {/* 허브에서 넘어온 모델은 ID를 잠근다 — disabled 필드는 register 값에서 빠지므로 Controller로 값을 유지한다 */}
              <Controller
                name="repo_id"
                control={control}
                render={({ field, fieldState }) => (
                  <Input
                    ref={field.ref}
                    name={field.name}
                    placeholder="모델 ID를 입력해주세요."
                    disabled={!!selectedModel}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    errMessage={fieldState.error?.message}
                  />
                )}
              />
              <p className="page-input_item-input-desc">
                모델 저장소(Repository)의 고유 ID를 입력해주세요.
              </p>
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">모델 공급자 ID</div>
            <div className="page-input_item-data">
              <Controller
                name="provider_id"
                control={control}
                render={({ field, fieldState }) => (
                  <ModelOptionSelect
                    placeholder="모델 공급자를 선택해주세요."
                    isDisabled={!!selectedModel}
                    options={modelProviders}
                    value={field.value}
                    onChange={field.onChange}
                    errMessage={fieldState.error?.message}
                  />
                )}
              />
              <p className="page-input_item-input-desc">모델을 제공하는 공급자를 선택해주세요.</p>
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">모델 타입 ID</div>
            <div className="page-input_item-data">
              <Controller
                name="type_id"
                control={control}
                render={({ field, fieldState }) => (
                  <ModelOptionSelect
                    placeholder="모델 타입을 선택해주세요."
                    options={modelTypes}
                    value={field.value}
                    onChange={field.onChange}
                    errMessage={fieldState.error?.message}
                  />
                )}
              />
              <p className="page-input_item-input-desc">모델의 용도에 맞는 타입을 선택해주세요.</p>
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">모델 포맷 ID</div>
            <div className="page-input_item-data">
              <Controller
                name="format_id"
                control={control}
                render={({ field, fieldState }) => (
                  <ModelOptionSelect
                    placeholder="모델 포맷을 선택해주세요."
                    options={modelFormats}
                    value={field.value}
                    onChange={field.onChange}
                    errMessage={fieldState.error?.message}
                  />
                )}
              />
              <p className="page-input_item-input-desc">모델 가중치 파일의 포맷을 선택해주세요.</p>
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name">파일</div>
            <div className="page-input_item-data">
              {/* 외부 연동 모델은 저장소 파일을 사용하므로 직접 업로드/변경을 막는다. */}
              <div
                className="page-input_item-data_fileUpload"
                aria-disabled={!!selectedModel}
                style={
                  selectedModel
                    ? { pointerEvents: 'none', opacity: 0.6, userSelect: 'none' }
                    : undefined
                }
              >
                <FileDrop
                  id="custom-model-file"
                  description={
                    selectedModel
                      ? selectedModel.id
                      : '파일을 여기에 드래그하거나 클릭하여 업로드하세요. (파일당 최대 크기 15MB)'
                  }
                  files={!selectedModel && file ? [file] : []}
                  onAddFile={(added) => {
                    if (!selectedModel && added[0]) setValue('file', added[0]);
                  }}
                  onDeleteFile={() => setValue('file', null)}
                />
              </div>
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name">모델 소개</div>
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
            <div className="page-input_item-name">샘플 코드</div>
            <div className="page-input_item-data">
              <Controller
                name="sample_code"
                control={control}
                render={({ field }) => (
                  <Textarea
                    placeholder="샘플 코드를 입력해주세요."
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="page-footer">
        <div className="page-footer_btn-box">
          <div />
          <div>
            <Button size="large" color="secondary" onClick={() => navigate('/model/custom-model')}>
              취소
            </Button>
            <Button
              size="large"
              color="primary"
              onClick={handleSubmit(onValid)}
              disabled={isPending}
            >
              {isPending ? '생성 중...' : '생성'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
