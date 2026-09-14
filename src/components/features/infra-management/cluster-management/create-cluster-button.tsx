import { Button } from '@innogrid/ui';
import { useNavigate } from 'react-router';

export const CreateClusterButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate('/infra-management/cluster-management/create')}
      size="medium"
      color="primary"
    >
      등록
    </Button>
  );
};