import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL, mockKnowledgeBase } from '@/test/mocks/handlers';
import { renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { toastOpenSpy } from '@/test/mocks/innogrid-ui';
import { CreateKnowledgeBaseFileButton } from './create-knowledge-base-file-button';

const pdf = (name: string) => new File(['본문'], name, { type: 'application/pdf' });

const openModal = async (user: ReturnType<typeof renderWithUser>['user']) => {
  await user.click(screen.getByRole('button', { name: '생성' }));
  await screen.findByRole('dialog', { name: '파일 생성' });
};

describe('CreateKnowledgeBaseFileButton', () => {
  it('knowledgeBaseId가 없으면 생성 버튼이 비활성화된다', () => {
    renderWithUser(<CreateKnowledgeBaseFileButton />);

    expect(screen.getByRole('button', { name: '생성' })).toBeDisabled();
  });

  it('파일 없이 확인하면 안내를 표시하고 요청하지 않는다', async () => {
    const requestSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/knowledge-bases/:id/files`, () => {
        requestSpy();
        return HttpResponse.json(mockKnowledgeBase);
      })
    );
    const { user } = renderWithUser(<CreateKnowledgeBaseFileButton knowledgeBaseId={7} />);
    await openModal(user);

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('업로드할 파일을 추가해주세요.')).toBeInTheDocument();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('허용되지 않는 확장자는 업로드 실패 토스트를 띄우고 목록에 넣지 않는다', async () => {
    const { user } = renderWithUser(<CreateKnowledgeBaseFileButton knowledgeBaseId={7} />);
    await openModal(user);

    await user.upload(
      screen.getByLabelText('파일 업로드'),
      new File(['x'], 'setup.exe', { type: 'application/octet-stream' })
    );

    expect(toastOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'negative',
        title: '파일 업로드 실패',
        children: '허용되지 않는 파일 형식입니다.',
      })
    );
    expect(screen.queryByText('setup.exe')).not.toBeInTheDocument();
  });

  it('추가한 파일을 하나씩 업로드하고 성공 토스트 후 모달을 닫는다', async () => {
    const uploadedIds: string[] = [];
    server.use(
      http.post(`${BASE_URL}/knowledge-bases/:id/files`, ({ params }) => {
        uploadedIds.push(params.id as string);
        return HttpResponse.json(mockKnowledgeBase);
      })
    );
    const { user } = renderWithUser(<CreateKnowledgeBaseFileButton knowledgeBaseId={7} />);
    await openModal(user);

    // 목 FileDrop은 단일 input이라 두 번에 나눠 올린다 — 누적되어야 한다
    await user.upload(screen.getByLabelText('파일 업로드'), pdf('규정.pdf'));
    await user.upload(screen.getByLabelText('파일 업로드'), pdf('매뉴얼.pdf'));
    expect(screen.getByText('규정.pdf')).toBeInTheDocument();
    expect(screen.getByText('매뉴얼.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(uploadedIds).toEqual(['7', '7']));
    expect(toastOpenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'positive', title: '파일 생성 성공' })
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('목록에서 파일을 삭제하면 사라지고, 빈 상태로 확인하면 다시 안내가 뜬다', async () => {
    const { user } = renderWithUser(<CreateKnowledgeBaseFileButton knowledgeBaseId={7} />);
    await openModal(user);
    await user.upload(screen.getByLabelText('파일 업로드'), pdf('규정.pdf'));
    expect(screen.getByText('규정.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '삭제' }));
    expect(screen.queryByText('규정.pdf')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('업로드할 파일을 추가해주세요.')).toBeInTheDocument();
  });

  it('업로드 실패 시 서버 detail을 담은 실패 토스트를 띄우고 모달은 열려 있다', async () => {
    server.use(
      http.post(`${BASE_URL}/knowledge-bases/:id/files`, () =>
        HttpResponse.json({ detail: '지원하지 않는 문서 형식입니다.' }, { status: 415 })
      )
    );
    const { user } = renderWithUser(<CreateKnowledgeBaseFileButton knowledgeBaseId={7} />);
    await openModal(user);
    await user.upload(screen.getByLabelText('파일 업로드'), pdf('규정.pdf'));

    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'negative',
          title: '파일 생성 실패',
          children: '지원하지 않는 문서 형식입니다.',
        })
      );
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
