import { Form, InputNumber, Radio, Segmented, type FormInstance } from 'antd';
import { useMemo } from 'react';
import type { CalibrationMode, CalibrationQuantity } from '../../types/models';
import './CalibrationConfigForm.css';

export interface CalibrationFormValues {
  giaTriDat: number;
  j: number;
  n: number;
  phuongPhapB: 'U' | 'Delta';
  ubk: number;
  allowedError: number;
  resolutionA: number;
  resolutionD: number;
}

interface CalibrationConfigFormProps {
  form: FormInstance<CalibrationFormValues>;
  initialValues: CalibrationFormValues;
  quantity: CalibrationQuantity;
  calibrationMode: CalibrationMode;
  modeDisabled?: boolean;
  channelCount: number;
  corrections: number[];
  onCalibrationModeChange: (mode: CalibrationMode) => void;
  onValuesChange: (
    changedValues: Partial<CalibrationFormValues>,
    allValues: CalibrationFormValues
  ) => void;
  onCorrectionChange: (index: number, value: number | null) => void;
}

export default function CalibrationConfigForm({
  form,
  initialValues,
  quantity,
  calibrationMode,
  modeDisabled = false,
  channelCount,
  corrections,
  onCalibrationModeChange,
  onValuesChange,
  onCorrectionChange,
}: CalibrationConfigFormProps) {
  const correctionRows = useMemo(
    () => Array.from({ length: channelCount }, (_item, index) => index),
    [channelCount]
  );

  return (
    <Form<CalibrationFormValues>
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onValuesChange={onValuesChange}
    >
      <div className="calibration-config">
        <div className="calibration-config-mode-row">
          <span className="calibration-method-label">Chức năng hiệu chuẩn</span>
          <Segmented<CalibrationMode>
            options={[
              { label: 'Nhiệt độ', value: 'NhietDo' },
              { label: 'Độ ẩm', value: 'DoAm' },
              { label: 'Nhiệt độ + Độ ẩm', value: 'Both' },
            ]}
            disabled={modeDisabled}
            value={calibrationMode}
            onChange={onCalibrationModeChange}
          />
        </div>

        <div className="calibration-config-primary-row">
          <Form.Item
            className="calibration-field-point"
            name="giaTriDat"
            label="Điểm kiểm tra"
            rules={[{ required: true, message: 'Nhập điểm kiểm tra' }]}
          >
            <InputNumber<number>
              controls={false}
              addonAfter={quantity === 'DoAm' ? '%RH' : '\u00B0C'}
            />
          </Form.Item>

          <Form.Item className="calibration-field-count" name="j" label="Số kênh">
            <InputNumber<number> min={1} max={10} precision={0} />
          </Form.Item>

          <Form.Item className="calibration-field-count" name="n" label="Số lần đo">
            <InputNumber<number> min={2} max={20} precision={0} />
          </Form.Item>
        </div>

        <div className="calibration-config-parameter-row">
          <div className="calibration-inline-field">
            <span>DKDBD mo rong ({quantity === 'DoAm' ? '%RH' : '\u00B0C'})</span>
            <Form.Item name="ubk" noStyle>
              <InputNumber<number> controls={false} />
            </Form.Item>
          </div>

          <div className="calibration-inline-field">
            <span>Sai so cho phep ({quantity === 'DoAm' ? '%RH' : '\u00B0C'})</span>
            <Form.Item name="allowedError" noStyle>
              <InputNumber<number> controls={false} />
            </Form.Item>
          </div>

          <div className="calibration-inline-field">
            <span>Độ chia A</span>
            <Form.Item name="resolutionA" noStyle>
              <InputNumber<number> controls={false} />
            </Form.Item>
          </div>

          <div className="calibration-inline-field">
            <span>Hệ số d</span>
            <Form.Item name="resolutionD" noStyle>
              <InputNumber<number> controls={false} min={0} step={0.1} />
            </Form.Item>
          </div>
        </div>

        <div className="calibration-correction-row">
          <span className="calibration-correction-label">
            Số hiệu chính của nhiệt kế chuẩn từ GCNHC
          </span>
          <div className="calibration-correction-list">
            {correctionRows.map((index) => (
              <label className="calibration-correction-item" key={index}>
                <span>Kênh {index + 1}</span>
                <InputNumber<number>
                  controls={false}
                  value={corrections[index]}
                  onChange={(value) => onCorrectionChange(index, value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="calibration-config-method-row">
          <span className="calibration-method-label">Phương pháp loại B</span>
          <Form.Item name="phuongPhapB" noStyle>
            <Radio.Group>
              <Radio.Button value="U">Dùng U</Radio.Button>
              <Radio.Button value="Delta">Dùng δ</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </div>
      </div>
    </Form>
  );
}
