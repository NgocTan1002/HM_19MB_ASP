import { LockOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, getErrorMessage } from '../services/api';
import './Auth.css';

const { Text, Title } = Typography;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const handleSubmit = async (values: { password: string }) => {
    setSubmitting(true);
    setMessage(null);

    try {
      await authApi.resetPassword({
        token,
        newPassword: values.password,
      });
      setSuccess(true);
      setMessage('Mật khẩu đã được cập nhật.');
      window.setTimeout(() => navigate('/auth'), 900);
    } catch (error) {
      setMessage(getErrorMessage(error, 'Không thể đặt lại mật khẩu'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel auth-panel-narrow">
        <div className="auth-card">
          <Title level={2}>Đặt lại mật khẩu</Title>
          <Text>Nhập mật khẩu mới cho tài khoản của bạn.</Text>

          {!token ? (
            <Alert
              className="auth-message"
              message="Thiếu reset token."
              description={<Link to="/auth?mode=forgot">Tạo yêu cầu mới</Link>}
              type="error"
              showIcon
            />
          ) : (
            <Form
              className="auth-reset-form"
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
            >
              <Form.Item
                name="password"
                label="Mật khẩu mới"
                rules={[
                  { required: true, message: 'Nhập mật khẩu mới' },
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
                loading={submitting}
                type="primary"
              >
                Cập nhật mật khẩu
              </Button>
            </Form>
          )}

          {message ? (
            <Alert
              className="auth-message"
              message={message}
              type={success ? 'success' : 'error'}
              showIcon
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
