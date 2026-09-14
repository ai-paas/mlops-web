import { useAddFileToKnowledgeBase } from '@/hooks/service/knowledgebase';
import { getServerErrorMessage } from '@/lib/api';
import { Button, FileDrop, Modal, useToast } from '@innogrid/ui';
import { useCallback, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const fileFormSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, '업로드할 파일을 추가해주세요.'),
});

type FileFormValues = z.infer<typeof fileFormSchema>;

export const CreateKnowledgeBaseFileButton = ({
  knowledgeBaseId,
}: {
  knowledgeBaseId?: number;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addFileAsync, isPending } = useAddFileToKnowledgeBase(knowledgeBaseId ?? 0);
  const toast = useToast();
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FileFormValues>({
    resolver: zodResolver(fileFormSchema),
    defaultValues: { files: [] },
  });
  const files = useWatch({ control, name: 'files' });

  const openModal = useCallback(() => {
    if (!knowledgeBaseId) return;
    setIsModalOpen(true);
  }, [knowledgeBaseId]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    reset();
  }, [reset]);

  const handleAddFile = (added: File[]) => {
    // 파일이 추가되면 '파일 없음' 에러도 함께 지운다
    setValue('files', [...files, ...added], { shouldValidate: true });
  };

  const handleDeleteFile = ({ fileIndex }: { file: File; fileIndex: number }) => {
    setValue(
      'files',
      files.filter((_, index) => index !== fileIndex)
    );
  };

  const onValid = async (values: FileFormValues) => {
    if (!knowledgeBaseId) return;

    try {
      for (const file of values.files) {
        await addFileAsync({ file });
      }
      toast.open({
        status: 'positive',
        title: '파일 생성 성공',
        children: '파일이 성공적으로 생성되었습니다.',
      });
      closeModal();
    } catch (error) {
      toast.open({
        status: 'negative',
        title: '파일 생성 실패',
        children: getServerErrorMessage(
          error,
          '파일 생성 중 오류가 발생했습니다. 다시 시도하면 파일이 다시 업로드됩니다.'
        ),
      });
    }
  };

  return (
    <>
      <Button size="medium" color="primary" disabled={!knowledgeBaseId} onClick={openModal}>
        생성
      </Button>
      <Modal
        allowOutsideInteraction
        isOpen={isModalOpen}
        isButtonLoading={isPending}
        // 파일이 없을 때는 버튼을 잠그는 대신 스키마(min 1)가 제출 시 인라인으로 안내한다
        buttonDisabled={isPending}
        size="small"
        title="파일 생성"
        buttonTitle="확인"
        onRequestClose={() => {
          if (!isPending) closeModal();
        }}
        action={handleSubmit(onValid)}
        subButton={
          <Button size="large" color="secondary" disabled={isPending} onClick={closeModal}>
            취소
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <div className="page-input_item-name page-icon-requisite">파일</div>
            <div className="page-input_item-data">
              <div className="page-input_item-data_fileUpload">
                <FileDrop
                  id="create-knowledge-base-file"
                  extensions={['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv']}
                  description={
                    <>
                      파일을 여기에 드래그하거나 클릭하여 업로드하세요.
                      <br />
                      허용되는 파일 형식: pdf, doc, docx, xls, xlsx, ppt, pptx, csv
                    </>
                  }
                  files={files}
                  onAddFile={handleAddFile}
                  onDeleteFile={handleDeleteFile}
                  onError={({ errorMessage }) =>
                    toast.open({
                      status: 'negative',
                      title: '파일 업로드 실패',
                      children: errorMessage,
                    })
                  }
                />
                {errors.files?.message && (
                  <p className="mt-1 text-xs leading-normal tracking-[-0.5px] text-[#dc4646]">
                    {errors.files.message}
                  </p>
                )}
                <p className="mt-2 text-xs leading-5 text-[#667085]">
                  대용량 파일은 업로드·임베딩에 수 분 이상 걸릴 수 있습니다.
                </p>
                {isPending && (
                  <div className="mt-4" role="status" aria-live="polite">
                    <div className="text-xs font-semibold">
                      파일을 업로드하고 문서를 처리하고 있습니다.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
