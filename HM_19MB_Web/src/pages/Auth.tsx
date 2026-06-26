import {
  LockOutlined,
  LoginOutlined,
  MailOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Input,
  Space,
  Tabs,
  Typography,
} from 'antd';
import { useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { authApi, getErrorMessage } from '../services/api';
import './Auth.css';

const { Text, Title } = Typography;

type AuthTab = 'login' | 'register';
type AuthMode = AuthTab | 'forgot';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode');
  const [activeMode, setActiveMode] = useState<AuthMode>(
    initialMode === 'register' || initialMode === 'forgot' ? initialMode : 'login'
  );
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, register } = useAuth();

  const from =
    (location.state as LocationState | null)?.from?.pathname || '/';

  const handleLogin = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setMessage(null);

    try {
      await login(values.email, values.password);
      navigate(from, { replace: true });
    } catch (error) {
      setMessage(getErrorMessage(error, 'Không thể đăng nhập'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (values: {
    fullName: string;
    email: string;
    password: string;
  }) => {
    setSubmitting(true);
    setMessage(null);

    try {
      await register(values.fullName, values.email, values.password);
      navigate('/', { replace: true });
    } catch (error) {
      setMessage(getErrorMessage(error, 'Không thể tạo tài khoản'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (values: { email: string }) => {
    setSubmitting(true);
    setMessage(null);
    setResetUrl(null);

    try {
      const response = await authApi.forgotPassword({ email: values.email });
      setMessage(response.data.message);
      setResetUrl(response.data.resetUrl);
    } catch (error) {
      setMessage(getErrorMessage(error, 'Không thể tạo yêu cầu đặt lại mật khẩu'));
    } finally {
      setSubmitting(false);
    }
  };

  const items = [
      {
        key: 'login',
        label: 'Đăng nhập',
        children: (
          <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Nhập email' },
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input prefix={<MailOutlined />} autoComplete="email" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: true, message: 'Nhập mật khẩu' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                autoComplete="current-password"
              />
            </Form.Item>

            <div className="auth-form-row">
              <Button
                className="auth-link-button"
                onClick={() => {
                  setActiveMode('forgot');
                  setMessage(null);
                  setResetUrl(null);
                }}
                type="link"
              >
                Quên mật khẩu?
              </Button>
            </div>

            <Button
              block
              htmlType="submit"
              icon={<LoginOutlined />}
              loading={submitting}
              type="primary"
            >
              Đăng nhập
            </Button>
          </Form>
        ),
      },
      {
        key: 'register',
        label: 'Tạo tài khoản',
        children: (
          <Form layout="vertical" onFinish={handleRegister} requiredMark={false}>
            <Form.Item
              name="fullName"
              label="Họ tên"
              rules={[{ required: true, message: 'Nhập họ tên' }]}
            >
              <Input prefix={<UserOutlined />} autoComplete="name" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Nhập email' },
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input prefix={<MailOutlined />} autoComplete="email" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[
                { required: true, message: 'Nhập mật khẩu' },
                { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                autoComplete="new-password"
              />
            </Form.Item>

            <Button
              block
              htmlType="submit"
              icon={<UserAddOutlined />}
              loading={submitting}
              type="primary"
            >
              Tạo tài khoản
            </Button>
          </Form>
        ),
      },
    ];

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <Title level={2}>
              {activeMode === 'forgot' ? 'Lấy lại mật khẩu' : 'Đăng nhập hệ thống'}
            </Title>
            <Text type="secondary">
              {activeMode === 'forgot'
                ? 'Nhập email tài khoản để tạo liên kết đặt lại mật khẩu.'
                : 'Đăng nhập để quản lý phiên đấu và báo cáo hiệu chuẩn.'}
            </Text>
          </div>

          {activeMode === 'forgot' ? (
            <Form layout="vertical" onFinish={handleForgotPassword} requiredMark={false}>
              <Form.Item
                name="email"
                label="Email tài khoản"
                rules={[
                  { required: true, message: 'Nhập email' },
                  { type: 'email', message: 'Email không hợp lệ' },
                ]}
              >
                <Input prefix={<MailOutlined />} autoComplete="email" />
              </Form.Item>

              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Button
                  block
                  htmlType="submit"
                  loading={submitting}
                  type="primary"
                >
                  Gửi yêu cầu
                </Button>
                <Button
                  block
                  onClick={() => {
                    setActiveMode('login');
                    setMessage(null);
                    setResetUrl(null);
                  }}
                >
                  Quay lại đăng nhập
                </Button>
              </Space>
            </Form>
          ) : (
            <Tabs
              activeKey={activeMode}
              items={items}
              onChange={key => {
                setActiveMode(key as AuthTab);
                setMessage(null);
                setResetUrl(null);
              }}
            />
          )}

          {message ? (
            <Alert
              className="auth-message"
              message={message}
              type={resetUrl ? 'success' : 'warning'}
              showIcon
            />
          ) : null}

          {resetUrl ? (
            <Alert
              className="auth-message"
              message="Liên kết đặt lại mật khẩu"
              description={
                <Space direction="vertical" size={4}>
                  <Link to={resetUrl}>Mở trang đặt lại mật khẩu</Link>
                  <Text copyable>{`${window.location.origin}${resetUrl}`}</Text>
                </Space>
              }
              type="info"
              showIcon
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
