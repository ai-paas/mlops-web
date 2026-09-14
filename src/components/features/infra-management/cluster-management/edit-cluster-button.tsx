import { Button } from '@innogrid/ui';
import { useNavigate } from 'react-router';

interface EditClusterButtonProps {
  clusterId?: string | null;
  returnTo?: string; // 이전 경로 정보
}

export const EditClusterButton = ({ clusterId, returnTo }: EditClusterButtonProps) => {
  const navigate = useNavigate();

  const handleEdit = () => {
    if (clusterId) {
      const returnUrl = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
      navigate(`/infra-management/cluster-management/edit/${clusterId}${returnUrl}`);
    }
  };

  return (
    <Button size="medium" color="secondary" disabled={!clusterId} onClick={handleEdit}>
      편집
    </Button>
  );
};