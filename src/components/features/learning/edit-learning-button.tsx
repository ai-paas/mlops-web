import { useGetLearning, useUpdateLearning } from '@/hooks/service/learning';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Modal, Textarea, useToast } from '@innogrid/ui';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { getServerErrorMessage } from '@/lib/api';

const schema = z.object({
  name: z.string().min(1, '이름은 필수입니다.'),
  description: z.string().optional(),
});

type Schema = z.infer<typeof schema>;

export const EditLearningButton = ({ experimentId }: { experimentId?: number }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { learning } = useGetLearning(experimentId);
  const { updateLearning, isPending } = useUpdateLearning();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const descriptionValue = watch('description') ?? '';

  const openModal = useCallback(() => {
    if (!experimentId) return;
    setIsModalOpen(true);
  }, [experimentId]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    reset({ name: '', description: '' });
  }, [reset]);

  const onSubmit = (data: Schema) => {
    if (!experimentId) return;
    updateLearning(
      {
        experimentId,
        name: data.name,
        description: data.description,
      },
      {
        onSuccess: () => {
          toast.open({
            status: 'positive',
            title: '학습 편집 성공',
            children: '학습이 성공적으로 편집되었습니다.',
          });
          closeModal();
        },
        onError: (error) => {
          toast.open({
            status: 'negative',
            title: '학습 편집 실패',
            children: getServerErrorMessage(error, '학습 편집 중 오류가 발생했습니다.'),
          });
        },
      }
    );
  };

  useEffect(() => {
    if (learning && isModalOpen) {
      reset({
        name: learning.name ?? '',
        description: learning.description ?? '',
      });
    }
  }, [learning, isModalOpen, reset]);

  return (
    <>
      <Button size="medium" color="secondary" disabled={!experimentId} onClick={openModal}>
        편집
      </Button>
      <Modal
        allowOutsideInteraction
        isOpen={isModalOpen}
        isButtonLoading={isPending}
        buttonDisabled={isPending}
        size="small"
        title="학습 편집"
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
              <Textarea
                placeholder="설명을 입력해주세요."
                errMessage={errors.description?.message}
                {...register('description')}
                value={descriptionValue}
              />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
