import { useEffect } from 'react';
import { Button, DatePicker, Divider, Form, Input, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { SessionMetadata } from '../../types/models';

const { TextArea } = Input;

export interface SessionFormProps {
  initialValues?: Partial<SessionMetadata> | null;
  onSubmit: (values: SessionMetadata) => Promise<void> | void;
  loading?: boolean;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
}

interface SessionFormValues
  extends Omit<SessionMetadata, 'id' | 'ngayHieuChuan'> {
  ngayHieuChuan?: Dayjs;
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
  nhietDoMoiTruong: '',
  doAmTuongDoi: '',
  nhietDoLamViec: '',
  dacTinhKyThuat: '',
  thietBiChuan: '',
};

function toFormValues(
  initialValues?: Partial<SessionMetadata> | null
): SessionFormValues {
  return {
    ...EMPTY_VALUES,
    ...initialValues,
    ngayHieuChuan: initialValues?.ngayHieuChuan
      ? dayjs(initialValues.ngayHieuChuan)
      : dayjs(),
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
      nhietDoMoiTruong: normalizeText(values.nhietDoMoiTruong),
      doAmTuongDoi: normalizeText(values.doAmTuongDoi),
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

      <Form.Item name="kyHieu" label="Ký hiệu">
        <Input />
      </Form.Item>

      <Form.Item name="soHieu" label="Số hiệu">
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

      <Form.Item
        name="nhietDoMoiTruong"
        label="Nhiệt độ môi trường"
      >
        <Input placeholder="25°C ± 2°C" />
      </Form.Item>

      <Form.Item name="doAmTuongDoi" label="Độ ẩm tương đối">
        <Input placeholder="60% ± 10%" />
      </Form.Item>

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
