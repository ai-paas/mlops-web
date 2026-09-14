import {
  useCreateModel,
  useGetModelFormats,
  useGetModelProviders,
  useGetModelTypes,
} from '@/hooks/service/models';
import type { ModelProvider } from '@/types/model';
import { BreadCrumb, Button, FileDrop, Input, Textarea, useToast } from '@innogrid/ui';
import { Controller, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { getServerErrorMessage } from '@/lib/api';
import {
  buildModelCreateFormData,
  useModelCreateForm,
  type ModelCreateFormOutput,
} from '@/components/features/model/model-create-form';
import { ModelOptionSelect } from '@/components/features/model/model-option-select';

// 공급자 이름은 백엔드 데이터라 표기(대소문자·공백·하이픈)가 흔들릴 수 있어 정규화 후 매칭한다.
const normalize = (value: string) => value.toLowerCase().replace(/[\s-]/g, '');

// 공급자에 따라 모델 ID 입력 규칙이 다르다 — custom 공급자만 임의 입력,
// 허브 공급자는 해당 허브에 등록된 ID를 그대로 입력해야 한다.
export const getRepoIdDescription = (provider: ModelProvider | undefined): string => {
  if (!provider) return '모델 공급자를 먼저 선택해주세요.';
  const name = normalize(provider.name);
  if (name.includes('custom')) {
    return '모델 저장소(Repository)의 고유 ID를 임의로 입력해주세요.';
  }
  if (name.includes('huggingface')) {
    return 'Hugging Face에 등록된 모델 ID를 정확히 입력해주세요. (예: meta-llama/Llama-3-8B)';
  }
  if (name.includes('kaggle')) {
    return 'Kaggle에 등록된 모델 ID를 정확히 입력해주세요. (예: google/gemma/PyTorch/7b)';
  }
  return `${provider.name}에 등록된 모델 ID를 정확히 입력해주세요.`;
};

export default function ModelCatalogCreatePage() {
  const { modelProviders } = useGetModelProviders();
  const { modelTypes } = useGetModelTypes();
  const { modelFormats } = useGetModelFormats();
  const { createModel, isPending } = useCreateModel();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useModelCreateForm();
  const providerId = useWatch({ control, name: 'provider_id' });
  const file = useWatch({ control, name: 'file' });
  const selectedProvider = modelProviders.find((provider) => provider.id === providerId);

  const onValid = async (values: ModelCreateFormOutput) => {
    try {
      await createModel(buildModelCreateFormData(values));
      toast.open({
        status: 'positive',
        title: '모델 카탈로그 생성 성공',
        children: '모델 카탈로그가 성공적으로 생성되었습니다.',
      });
      navigate('/model/model-catalog');
    } catch (error) {
      toast.open({
        status: 'negative',
        title: '모델 카탈로그 생성 실패',
        children: getServerErrorMessage(error, '모델 카탈로그 생성 중 오류가 발생했습니다.'),
      });
    }
  };

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[
            { label: '모델' },
            { label: '모델 카탈로그', path: '/model/model-catalog' },
            { label: '모델 카탈로그 생성' },
          ]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">모델 카탈로그 생성</h2>
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
                화면에 표시될 모델의 이름을 입력해주세요.
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
            <div className="page-input_item-name page-icon-requisite">모델 ID</div>
            <div className="page-input_item-data">
              <Input
                placeholder="모델 ID를 입력해주세요."
                errMessage={errors.repo_id?.message}
                {...register('repo_id')}
              />
              <p className="page-input_item-input-desc">{getRepoIdDescription(selectedProvider)}</p>
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
              <div className="page-input_item-data_fileUpload">
                <FileDrop
                  id="model-catalog-file"
                  description="파일을 여기에 드래그하거나 클릭하여 업로드하세요. (파일당 최대 크기 15MB)"
                  files={file ? [file] : []}
                  onAddFile={(added) => {
                    if (added[0]) setValue('file', added[0]);
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
            <Button size="large" color="secondary" onClick={() => navigate('/model/model-catalog')}>
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
