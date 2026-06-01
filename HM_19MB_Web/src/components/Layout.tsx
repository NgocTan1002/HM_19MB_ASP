import {
  BarChartOutlined,
  CalculatorOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { Grid, Layout as AntLayout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/useSession';
import SessionSelector from './SessionSelector';

const { Header, Content, Sider } = AntLayout;
const { Text } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

function getSelectedKey(pathname: string): string {
  if (pathname === '/') {
    return 'dashboard';
  }

  if (pathname === '/sessions') {
    return 'sessions';
  }

  if (pathname.includes('/calibration')) {
    return 'calibration';
  }

  return 'dashboard';
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const screens = Grid.useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSessionId } = useSession();

  const isSmallScreen = screens.md === false;
  const siderCollapsed = isSmallScreen || collapsed;

  const items = useMemo<MenuItem[]>(
    () => [
      {
        key: 'dashboard',
        icon: <BarChartOutlined />,
        label: 'Dashboard',
      },
      {
        key: 'sessions',
        icon: <DatabaseOutlined />,
        label: 'Sessions',
      },
      {
        key: 'calibration',
        icon: <CalculatorOutlined />,
        label: 'Calibration',
      },
    ],
    []
  );

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'dashboard') {
      navigate('/');
      return;
    }

    if (key === 'sessions') {
      navigate('/sessions');
      return;
    }

    if (key === 'calibration') {
      if (currentSessionId !== null) {
        navigate(`/sessions/${currentSessionId}/calibration`);
      } else {
        navigate('/sessions');
      }
    }
  };

  return (
    <AntLayout className="app-shell">
      <Sider
        breakpoint="md"
        collapsed={siderCollapsed}
        collapsible
        onCollapse={setCollapsed}
        theme="dark"
        width={240}
      >
        <div className="sider-brand">HM</div>
        <Menu
          items={items}
          mode="inline"
          onClick={handleMenuClick}
          selectedKeys={[getSelectedKey(location.pathname)]}
          theme="dark"
        />
      </Sider>

      <AntLayout>
        <Header className="app-header">
          <Text strong className="app-title">
            HM-19MB Hiệu chuẩn
          </Text>
          <SessionSelector />
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
