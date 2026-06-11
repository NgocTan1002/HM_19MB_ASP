import { useEffect } from 'react';
import {
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { SessionMetadata } from '../../types/models';

const { TextArea } = Input;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9 ._/-]+$/;

export interface SessionFormProps {
  initialValues?: Partial<SessionMetadata> | null;
  onSubmit: (values: SessionMetadata) => Promise<void> | void;
  loading?: boolean;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
}

interface SessionFormValues
  extends Omit<
    SessionMetadata,
    'id' | 'ngayHieuChuan' | 'nhietDoMoiTruong' | 'doAmTuongDoi'
  > {
  ngayHieuChuan?: Dayjs;
  nhietDoMoiTruongValue?: number;
  doAmTuongDoiValue?: number;
}

interface ReferencePair {
  value?: number;
}

const EMPTY_VALUES: SessionFormValues = {
  tenThietBi: '',
  kyHieu: '',
  soHieu: '',
  soTem: '',
  noiSanXuat: '',
  namSanXuat: '',
  donViSuDung: '',
  phuongPhap: '',
  ngayHieuChuan: dayjs(),
  nhietDoMoiTruongValue: undefined,
  doAmTuongDoiValue: undefined,
  nhietDoLamViec: '',
  dacTinhKyThuat: '',
  thietBiChuan: '',
};

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseReferencePair(value: string | undefined): ReferencePair {
  if (value === undefined || value.trim().length === 0) {
    return {};
  }

  const matches = value.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  return {
    value: parseNumber(matches[0]),
  };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatReferenceValue(value: number | undefined, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  return `${formatNumber(value)}${unit}`;
}

function toFormValues(
  initialValues?: Partial<SessionMetadata> | null
): SessionFormValues {
  const temperature = parseReferencePair(initialValues?.nhietDoMoiTruong);
  const humidity = parseReferencePair(initialValues?.doAmTuongDoi);

  return {
    ...EMPTY_VALUES,
    ...initialValues,
    ngayHieuChuan: initialValues?.ngayHieuChuan
      ? dayjs(initialValues.ngayHieuChuan)
      : dayjs(),
    nhietDoMoiTruongValue: temperature.value,
    doAmTuongDoiValue: humidity.value,
  };
}

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? '';
}

export default function SessionForm({
  initialValues,
  onSubmit,
  loading = false,
  onCancel,
  submitText = 'Lưu thay đổi',
  cancelText = 'Hủy',
}: SessionFormProps) {
  const [form] = Form.useForm<SessionFormValues>();

  useEffect(() => {
    form.setFieldsValue(toFormValues(initialValues));
  }, [form, initialValues]);

  const handleFinish = async (values: SessionFormValues) => {
    const payload: SessionMetadata = {
      id: initialValues?.id,
      tenThietBi: normalizeText(values.tenThietBi),
      kyHieu: normalizeText(values.kyHieu),
      soHieu: normalizeText(values.soHieu),
      soTem: normalizeText(values.soTem),
      noiSanXuat: normalizeText(values.noiSanXuat),
      namSanXuat: normalizeText(values.namSanXuat),
      donViSuDung: normalizeText(values.donViSuDung),
      phuongPhap: normalizeText(values.phuongPhap),
      ngayHieuChuan: (values.ngayHieuChuan ?? dayjs()).format('YYYY-MM-DD'),
      nhietDoMoiTruong: formatReferenceValue(
        values.nhietDoMoiTruongValue,
        '\u00b0C'
      ),
      doAmTuongDoi: formatReferenceValue(
        values.doAmTuongDoiValue,
        '%'
      ),
      nhietDoLamViec: normalizeText(values.nhietDoLamViec),
      dacTinhKyThuat: normalizeText(values.dacTinhKyThuat),
      thietBiChuan: normalizeText(values.thietBiChuan),
    };

    await onSubmit(payload);
  };

  return (
    <Form<SessionFormValues>
      form={form}
      layout="vertical"
      initialValues={toFormValues(initialValues)}
      onFinish={handleFinish}
      requiredMark={false}
      size="middle"
    >
      <Divider titlePlacement="start" plain>
        Thông tin thiết bị
      </Divider>

      <Form.Item
        name="tenThietBi"
        label="Tên thiết bị"
        rules={[{ required: true, message: 'Vui lòng nhập tên thiết bị' }]}
      >
        <Input placeholder="Nhập tên thiết bị" />
      </Form.Item>

      <Form.Item
        name="kyHieu"
        label="Ký hiệu"
        rules={[
          {
            pattern: IDENTIFIER_PATTERN,
            message: 'Chỉ dùng chữ, số, khoảng trắng và . _ / -',
          },
          { max: 60, message: 'Tối đa 60 ký tự' },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item
        name="soHieu"
        label="Số hiệu"
        rules={[
          {
            pattern: IDENTIFIER_PATTERN,
            message: 'Chỉ dùng chữ, số, khoảng trắng và . _ / -',
          },
          { max: 60, message: 'Tối đa 60 ký tự' },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item name="soTem" label="Số tem hiệu chuẩn">
        <Input />
      </Form.Item>

      <Form.Item name="noiSanXuat" label="Nơi sản xuất">
        <Input />
      </Form.Item>

      <Form.Item name="namSanXuat" label="Năm sản xuất">
        <Input />
      </Form.Item>

      <Form.Item name="donViSuDung" label="Đơn vị sử dụng">
        <Input />
      </Form.Item>

      <Divider titlePlacement="start" plain>
        Thông tin hiệu chuẩn
      </Divider>

      <Form.Item name="phuongPhap" label="Phương pháp">
        <Input />
      </Form.Item>

      <Form.Item name="ngayHieuChuan" label="Ngày hiệu chuẩn">
        <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
      </Form.Item>

      <Row gutter={12}>
        <Col xs={24} md={12}>
          <Form.Item label="Nhiệt độ môi trường">
            <Row gutter={8}>
              <Col span={24}>
                <Form.Item
                  name="nhietDoMoiTruongValue"
                  noStyle
                  rules={[{ type: 'number', min: -80, max: 200 }]}
                >
                  <InputNumber<number>
                    controls={false}
                    placeholder="Giá trị"
                    style={{ width: '100%' }}
                    addonAfter="°C"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item label="Độ ẩm tương đối">
            <Row gutter={8}>
              <Col span={24}>
                <Form.Item
                  name="doAmTuongDoiValue"
                  noStyle
                  rules={[{ type: 'number', min: 0, max: 100 }]}
                >
                  <InputNumber<number>
                    controls={false}
                    placeholder="Giá trị"
                    style={{ width: '100%' }}
                    addonAfter="%"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="nhietDoLamViec" label="Nhiệt độ làm việc">
        <Input />
      </Form.Item>

      <Divider titlePlacement="start" plain>
        Thông tin kỹ thuật
      </Divider>

      <Form.Item name="dacTinhKyThuat" label="Đặc tính kỹ thuật">
        <TextArea rows={3} />
      </Form.Item>

      <Form.Item name="thietBiChuan" label="Thiết bị chuẩn">
        <TextArea rows={3} />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Space wrap>
          <Button type="primary" htmlType="submit" loading={loading}>
            {submitText}
          </Button>
          {onCancel ? (
            <Button onClick={onCancel} disabled={loading}>
              {cancelText}
            </Button>
          ) : null}
        </Space>
      </Form.Item>
    </Form>
  );
}
