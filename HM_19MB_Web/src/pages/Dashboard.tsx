import { Typography } from 'antd';

const { Paragraph, Title } = Typography;

export default function Dashboard() {
  return (
    <section>
      <Title level={1}>Dashboard</Title>
      <Paragraph>
        Live measurement view for HM-19MB will be implemented in Phase 2.
      </Paragraph>
    </section>
  );
}
