import { ModelFileTable } from '@/components/features/model/model-file-table';
import { CodeBlock } from '@/components/ui/code-block';
import { DetailValue } from '@/components/ui/detail-value';
import { useGetModel } from '@/hooks/service/models';
import type { ModelCatalog } from '@/types/model';
import { formatDateTime } from '@/util/date';
import { BreadCrumb, Tabs } from '@innogrid/ui';
import { useNavigate, useParams } from 'react-router';

export default function ModelCatalogDetailPage() {
  const { id } = useParams();
  const { model, isPending } = useGetModel<ModelCatalog>(Number(id));
  const navigate = useNavigate();

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[
            { label: '모델' },
            { label: '모델 카탈로그', path: '/model/model-catalog' },
            { label: model?.name ?? '' },
          ]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">모델 상세</h2>
      </div>
      <div className="page-content page-p-40">
        <h3 className="page-detail-title">상세 정보</h3>
        <ul style={{ marginBottom: '20px' }}>
          <li className="space-y-2 rounded-md bg-[#F2F2F2] px-5 pt-3.5 pb-4">
            <div className="page-detail_item-name">모델 소개</div>
            <div className="page-detail_item-data">
              <DetailValue isLoading={isPending} width={240}>
                {model?.description ?? ''}
              </DetailValue>
            </div>
          </li>
        </ul>
        <div className="page-detail-list-box">
          <ul className="page-detail-list">
            <li>
              <div className="page-detail_item-name">이름</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={160}>
                  {model?.name ?? '-'}
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">생성자</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={120}>
                  {model?.created_by || '-'}
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">task</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={120}>
                  {model?.task ?? '-'}
                </DetailValue>
              </div>
            </li>
          </ul>
          <ul className="page-detail-list">
            <li>
              <div className="page-detail_item-name">생성일시</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={140}>
                  {formatDateTime(model?.created_at)}
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">모델 ID</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={200}>
                  {model?.registry?.uri ?? '-'}
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">Params</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={100}>
                  {model?.parameter ?? '-'}
                </DetailValue>
              </div>
            </li>
          </ul>
          <ul className="page-detail-list">
            <li>
              <div className="page-detail_item-name">최근 업데이트</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={140}>
                  {formatDateTime(model?.updated_at)}
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">버전 정보</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={100}>
                  v1
                </DetailValue>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div className="page-content page-content-detail">
        <div className="page-tabsBox">
          <Tabs
            labels={['파일', '샘플 코드']}
            components={[
              <ModelFileTable modelId={model?.id} key="files" />,
              <div className="tabs-Content" key="sample-code">
                <CodeBlock code={model?.sample_code ?? ''} />
              </div>,
            ]}
          />
        </div>
      </div>
    </main>
  );
}
