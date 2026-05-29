import { Typography } from 'antd';
import { useParams } from 'react-router-dom';

const { Paragraph, Title } = Typography;

export default function Calibration() {
  const { id } = useParams();

  return (
    <section>
      <Title level={1}>Calibration</Title>
      <Paragraph>
        Calibration workflow for session {id ?? 'selected'} will be implemented
        in Phase 4.
      </Paragraph>
    </section>
  );
}
