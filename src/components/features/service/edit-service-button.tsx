import { Button, Input, Modal, Textarea, useToast } from '@innogrid/ui';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useGetService, useUpdateService } from '@/hooks/service/services';
import { getServerErrorMessage } from '@/lib/api';

const schema = z.object({
  name: z.string().min(1, '이름은 필수입니다.'),
  description: z.string().optional(),
  tags: z.string().optional(),
});

type Schema = z.infer<typeof schema>;

export const EditServiceButton = ({ serviceId }: { serviceId?: string }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { service } = useGetService(serviceId, isModalOpen && !!serviceId);
  const { updateService, isPending } = useUpdateService();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', tags: '' },
  });

  const descriptionValue = watch('description') ?? '';

  const openModal = useCallback(() => {
    if (!serviceId) return;
    setIsModalOpen(true);
  }, [serviceId]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    reset({ name: '', description: '', tags: '' });
  }, [reset]);

  const onSubmit = (data: Schema) => {
    if (!serviceId) return;
    updateService(
      {
        surro_service_id: serviceId,
        name: data.name,
        description: data.description ?? '',
        tags: data.tags ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      },
      {
        onSuccess: () => {
          toast.open({
            status: 'positive',
            title: '서비스 편집 성공',
            children: '서비스가 성공적으로 편집되었습니다.',
          });
          closeModal();
        },
        onError: (error) => {
          toast.open({
            status: 'negative',
            title: '서비스 편집 실패',
            children: getServerErrorMessage(error, '서비스 편집 중 오류가 발생했습니다.'),
          });
        },
      }
    );
  };

  useEffect(() => {
    if (service && isModalOpen) {
      reset({
        name: service.name,
        description: service.description ?? '',
        tags: service.tags?.join(', ') ?? '',
      });
    }
  }, [service, isModalOpen, reset]);

  return (
    <>
      <Button size="medium" color="secondary" disabled={!serviceId} onClick={openModal}>
        편집
      </Button>
      <Modal
        allowOutsideInteraction
        isOpen={isModalOpen}
        isButtonLoading={isPending}
        buttonDisabled={isPending}
        size="small"
        title="서비스 편집"
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
          <div className="flex flex-col gap-2.5">
            <div className="page-input_item-name">태그</div>
            <div className="page-input_item-data">
              <Input
                placeholder="태그 내용을 입력해주세요."
                errMessage={errors.tags?.message}
                {...register('tags')}
              />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
