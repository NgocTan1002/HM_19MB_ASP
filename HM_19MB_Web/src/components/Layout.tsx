import {
  BarChartOutlined,
  CalculatorOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { FloatButton, Grid, Layout as AntLayout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/useSession';
import {
  CALIBRATION_DRAFT_CHANGED_EVENT,
  getMinimizedCalibrationDraft,
  type MinimizedCalibrationDraft,
} from '../utils/calibrationDraft';
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
  const [calibrationDraft, setCalibrationDraft] =
    useState<MinimizedCalibrationDraft | null>(() =>
      getMinimizedCalibrationDraft()
    );

  const isSmallScreen = screens.md === false;
  const siderCollapsed = isSmallScreen || collapsed;

  const items = useMemo<MenuItem[]>(
    () => [
      {
        key: 'dashboard',
        icon: <BarChartOutlined />,
        label: 'Theo dõi dữ liệu đo',
      },
      {
        key: 'sessions',
        icon: <DatabaseOutlined />,
        label: 'Quản lý phiên đo',
      },
      {
        key: 'calibration',
        icon: <CalculatorOutlined />,
        label: 'Tính hiệu chuẩn',
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

  useEffect(() => {
    const updateDraft = () => {
      setCalibrationDraft(getMinimizedCalibrationDraft());
    };

    window.addEventListener(CALIBRATION_DRAFT_CHANGED_EVENT, updateDraft);
    window.addEventListener('storage', updateDraft);

    return () => {
      window.removeEventListener(CALIBRATION_DRAFT_CHANGED_EVENT, updateDraft);
      window.removeEventListener('storage', updateDraft);
    };
  }, []);

  const handleResumeCalibrationDraft = () => {
    const draft = getMinimizedCalibrationDraft();

    if (draft === null) {
      setCalibrationDraft(null);
      return;
    }

    navigate(`/sessions/${draft.sessionId}/calibration`, {
      state: { resumeCalibrationDraft: Date.now() },
    });
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
          <div className="app-header-right">
            <div id="app-header-actions" className="app-header-actions" />
            <SessionSelector />
          </div>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>

        {calibrationDraft !== null ? (
          <FloatButton
            className="calibration-draft-float"
            description={`STT ${calibrationDraft.stt}`}
            icon={<CalculatorOutlined />}
            onClick={handleResumeCalibrationDraft}
            tooltip="Tiep tuc nhap du lieu hieu chuan"
          />
        ) : null}
      </AntLayout>
    </AntLayout>
  );
}
