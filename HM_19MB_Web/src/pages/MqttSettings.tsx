import {
  ApiOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getErrorMessage,
  mqttSettingsApi,
  type MqttSettingsResponse,
  type MqttSettingsUpdateRequest,
} from '../services/api';
import './MqttSettings.css';

const { Text, Title } = Typography;

type FormValues = {
  enabled: boolean;
  host: string;
  port: number;
  clientId: string;
  topic: string;
  username: string;
  password?: string;
  useTls: boolean;
};

function toFormValues(settings: MqttSettingsResponse): FormValues {
  return {
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    clientId: settings.clientId,
    topic: settings.topic,
    username: settings.username,
    password: '',
    useTls: settings.useTls,
  };
}

function toRequest(
  values: FormValues,
  changePassword: boolean,
  clearPassword: boolean
): MqttSettingsUpdateRequest {
  let password: string | null = null;

  if (clearPassword) {
    password = '';
  } else if (changePassword) {
    password = values.password ?? '';
  }

  return {
    enabled: values.enabled,
    host: values.host.trim(),
    port: values.port,
    clientId: values.clientId.trim(),
    topic: values.topic.trim(),
    username: values.username.trim(),
    password,
    useTls: values.useTls,
  };
}

export default function MqttSettings() {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<MqttSettingsResponse | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const [clearPassword, setClearPassword] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const passwordStatus = useMemo(() => {
    if (clearPassword) {
      return 'Password will be cleared on save.';
    }

    if (changePassword) {
      return 'Password will be replaced on save.';
    }

    return settings?.hasPassword
      ? 'Current password will be kept.'
      : 'No password is currently saved.';
  }, [changePassword, clearPassword, settings?.hasPassword]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mqttSettingsApi.get();
      setSettings(response.data);
      form.setFieldsValue(toFormValues(response.data));
      setChangePassword(false);
      setClearPassword(false);
    } catch (error) {
      console.error('[MQTT Settings] Load failed:', error);
      message.error(getErrorMessage(error, 'Cannot load MQTT settings'));
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const buildRequestFromForm = useCallback(async () => {
    const values = await form.validateFields();
    return toRequest(values, changePassword, clearPassword);
  }, [changePassword, clearPassword, form]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const request = await buildRequestFromForm();
      const response = await mqttSettingsApi.testConnection(request);
      setTestResult(response.data);

      if (response.data.success) {
        message.success(response.data.message);
      } else {
        message.warning(response.data.message);
      }
    } catch (error) {
      console.error('[MQTT Settings] Test failed:', error);
      message.error(getErrorMessage(error, 'Cannot test MQTT connection'));
    } finally {
      setTesting(false);
    }
  }, [buildRequestFromForm]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setTestResult(null);

    try {
      const request = await buildRequestFromForm();
      const response = await mqttSettingsApi.update(request);
      setSettings(response.data);
      form.setFieldsValue(toFormValues(response.data));
      setChangePassword(false);
      setClearPassword(false);
      message.success('MQTT settings saved');
    } catch (error) {
      console.error('[MQTT Settings] Save failed:', error);
      message.error(getErrorMessage(error, 'Cannot save MQTT settings'));
    } finally {
      setSaving(false);
    }
  }, [buildRequestFromForm, form]);

  return (
    <section className="mqtt-settings-page">
      <div className="mqtt-settings-header">
        <Space direction="vertical" size={2}>
          <Title level={2} style={{ margin: 0 }}>
            MQTT Settings
          </Title>
          <Text type="secondary">
            Broker and topic used by the background ingestion service.
          </Text>
        </Space>

        <div className="mqtt-settings-actions">
          <Button
            icon={<ThunderboltOutlined />}
            loading={testing}
            onClick={handleTest}
          >
            Test
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </div>

      {testResult !== null ? (
        <Alert
          showIcon
          type={testResult.success ? 'success' : 'warning'}
          message={testResult.message}
        />
      ) : null}

      <div className="mqtt-settings-grid">
        <Card className="mqtt-settings-card" loading={loading}>
          <Form<FormValues>
            form={form}
            layout="vertical"
            initialValues={{
              enabled: true,
              host: '',
              port: 1883,
              clientId: '',
              topic: '',
              username: '',
              password: '',
              useTls: false,
            }}
          >
            <Form.Item name="enabled" label="Enabled" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item
              name="host"
              label="Host"
              rules={[{ required: true, message: 'Host is required' }]}
            >
              <Input placeholder="broker.hivemq.com" />
            </Form.Item>

            <Form.Item
              name="port"
              label="Port"
              rules={[{ required: true, message: 'Port is required' }]}
            >
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="clientId"
              label="Client ID"
              rules={[{ required: true, message: 'Client ID is required' }]}
            >
              <Input placeholder="HM_19MB_API" />
            </Form.Item>

            <Form.Item
              name="topic"
              label="Topic"
              rules={[{ required: true, message: 'Topic is required' }]}
            >
              <Input placeholder="esp32/responses" />
            </Form.Item>

            <Form.Item name="username" label="Username">
              <Input autoComplete="username" />
            </Form.Item>

            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Checkbox
                  checked={changePassword}
                  disabled={clearPassword}
                  onChange={event => {
                    setChangePassword(event.target.checked);
                    if (!event.target.checked) {
                      form.setFieldValue('password', '');
                    }
                  }}
                >
                  Change password
                </Checkbox>
                <Checkbox
                  checked={clearPassword}
                  onChange={event => {
                    const checked = event.target.checked;
                    setClearPassword(checked);
                    if (checked) {
                      setChangePassword(false);
                      form.setFieldValue('password', '');
                    }
                  }}
                >
                  Clear password
                </Checkbox>
              </Space>

              <Form.Item name="password" label="Password">
                <Input.Password
                  autoComplete="new-password"
                  disabled={!changePassword || clearPassword}
                />
              </Form.Item>

              <Text type="secondary">{passwordStatus}</Text>
            </Space>

            <Form.Item name="useTls" label="Use TLS" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Card>

        <Card
          className="mqtt-settings-card"
          title="Runtime"
          loading={loading}
        >
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Status">
              <Space>
                {settings?.enabled ? (
                  <CheckCircleOutlined style={{ color: '#16a34a' }} />
                ) : (
                  <ApiOutlined style={{ color: '#6b7280' }} />
                )}
                <Text>{settings?.enabled ? 'Enabled' : 'Disabled'}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Broker">
              {settings ? `${settings.host}:${settings.port}` : '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Topic">
              {settings?.topic || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Client ID">
              {settings?.clientId || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="TLS">
              {settings?.useTls ? 'On' : 'Off'}
            </Descriptions.Item>
            <Descriptions.Item label="Password">
              {settings?.hasPassword ? 'Saved' : 'Not set'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    </section>
  );
}
