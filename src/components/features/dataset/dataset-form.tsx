import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { Button, FileDrop, Input, Select, Textarea, useToast } from '@innogrid/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useValidateDataset, useCreateDataset, useGetDatasetKinds } from '@/hooks/service/datasets';
import * as z from 'zod';

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

const DATASET_KIND_LABELS: Record<string, string> = {
  'object-detection': '객체 감지',
  'protein-classification': '단백질 분류',
};

const schema = z.object({
  name: z.string().min(1, '이름은 필수입니다.'),
  dataset_kind: z.string().min(1, '데이터셋 분류를 선택해주세요.'),
  description: z.string().optional(),
  file: z
    .instanceof(File, { error: '파일이 필요합니다.' })
    .refine((file) => {
      const isZip =
        file.name.endsWith('.zip') ||
        file.type === 'application/zip' ||
        file.type === 'application/x-zip-compressed';
      return isZip;
    }, 'zip 파일만 업로드 가능합니다.')
    .refine((file) => file.size <= MAX_FILE_SIZE, '파일 크기는 1GB 이하여야 합니다.'),
});

type Schema = z.infer<typeof schema>;

export const DatasetForm = () => {
  const navigate = useNavigate();
  const { validateDataset } = useValidateDataset();
  const { createDataset, isPending } = useCreateDataset();
  const { kinds } = useGetDatasetKinds();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    setError,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<Schema>({ resolver: zodResolver(schema), defaultValues: { dataset_kind: '' } });

  const selectedFile = watch('file');
  const selectedKind = watch('dataset_kind');

  const kindOptions = useMemo(() => {
    const names =
      kinds.length > 0 ? kinds.map((kind) => kind.name) : Object.keys(DATASET_KIND_LABELS);
    return names.map((name) => ({ text: DATASET_KIND_LABELS[name] ?? name, value: name }));
  }, [kinds]);

  const selectedKindDescription = kinds.find((kind) => kind.name === selectedKind)?.description;

  const clearFile = () => {
    setValue('file', undefined as unknown as File, { shouldValidate: false });
  };

  const processFile = async (file: File, datasetKind: string) => {
    if (file.size > MAX_FILE_SIZE) {
      setError('file', { type: 'manual', message: '파일 크기는 1GB 이하여야 합니다.' });
      clearFile();
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataset_kind', datasetKind);
      const response = await validateDataset(formData);

      if (!response.is_valid) {
        setError('file', {
          type: 'manual',
          message: response.message || '유효하지 않은 데이터셋 구조입니다.',
        });
        clearFile();
        return;
      }

      clearErrors('file');
      setValue('file', file, { shouldValidate: true });
    } catch {
      setError('file', { type: 'manual', message: '파일 검증 중 서버 오류가 발생했습니다.' });
      clearFile();
    }
  };

  const handleAddFile = (files: File[]) => {
    const file = files[0];
    if (!file) return;

    const datasetKind = getValues('dataset_kind');
    if (!datasetKind) {
      setError('file', { type: 'manual', message: '데이터셋 분류를 먼저 선택해주세요.' });
      return;
    }

    void processFile(file, datasetKind);
  };

  const handleDeleteFile = () => {
    clearFile();
    clearErrors('file');
  };

  const handleFileError = () => {
    setError('file', { type: 'manual', message: 'zip 파일만 업로드 가능합니다.' });
    clearFile();
  };

  const onSubmit = async (data: Schema) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description || '');
    formData.append('dataset_kind', data.dataset_kind);
    formData.append('file', data.file);

    try {
      await createDataset(formData);
      toast.open({
        status: 'positive',
        title: '데이터셋 생성 성공',
        children: '데이터셋이 성공적으로 생성되었습니다.',
      });
      navigate('/dataset');
    } catch {
      toast.open({
        status: 'negative',
        title: '데이터셋 생성 실패',
        children: '데이터셋 생성 중 오류가 발생했습니다.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="page-title-box">
        <h2 className="page-title">데이터 셋 생성</h2>
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
              {!errors.name?.message && (
                <p className="page-input_item-input-desc">데이터셋의 이름을 입력하세요.</p>
              )}
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">분류</div>
            <div className="page-input_item-data">
              <Controller
                name="dataset_kind"
                control={control}
                render={({ field, fieldState }) => (
                  <Select
                    options={kindOptions}
                    getOptionLabel={(option: { text: string; value: string }) => option.text}
                    getOptionValue={(option: { text: string; value: string }) => option.value}
                    value={kindOptions.find((o) => o.value === field.value) ?? null}
                    onChange={(option: { text: string; value: string } | null) => {
                      field.onChange(option?.value ?? '');

                      const file = getValues('file');
                      if (option?.value && file instanceof File) {
                        void processFile(file, option.value);
                      }
                    }}
                    placeholder="데이터셋 분류를 선택해주세요."
                    errMessage={fieldState.error?.message}
                  />
                )}
              />
              {!errors.dataset_kind?.message && (
                <p className="page-input_item-input-desc">
                  {selectedKindDescription ||
                    '데이터셋의 학습 태스크 분류를 선택하세요. 등록 후에는 변경할 수 없습니다.'}
                </p>
              )}
            </div>
          </div>
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">학습 파일</div>
            <div className="page-input_item-data">
              <div className="page-input_item-data_fileUpload">
                <FileDrop
                  id="dataset-file"
                  extensions={['zip']}
                  description={
                    <>
                      파일을 여기에 드래그하거나 클릭하여 업로드하세요.
                      <br />
                      (zip 1GB 이하)
                    </>
                  }
                  files={selectedFile ? [selectedFile] : []}
                  onAddFile={handleAddFile}
                  onDeleteFile={handleDeleteFile}
                  onError={handleFileError}
                />
                {errors.file && (
                  <p className="mt-1 text-xs leading-normal tracking-[-0.5px] text-[#dc4646]">
                    {errors.file.message}
                  </p>
                )}
              </div>
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
                    errMessage={errors.description?.message}
                    value={field.value ?? ''}
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
            <Button
              type="button"
              size="large"
              color="secondary"
              onClick={() => navigate('/dataset')}
            >
              취소
            </Button>
            <Button
              type="submit"
              size="large"
              color="primary"
              disabled={isPending}
              isLoading={isPending}
            >
              생성
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
