import React, { useCallback, useState } from 'react';
import { FileExcelOutlined, FileWordOutlined } from '@ant-design/icons';
import { Button, message, Space } from 'antd';
import { downloadBlob, reportApi } from '../../services/api';

interface ExportButtonsProps {
  sessionId: number | null;
  kenhCount?: number;
  disabled?: boolean;
}

function buildTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '');
}

function assertBlob(data: unknown): Blob {
  if (data instanceof Blob) {
    return data;
  }

  throw new Error('Response data is not a Blob');
}

const ExportButtonsComponent: React.FC<ExportButtonsProps> = ({
  sessionId,
  kenhCount = 3,
  disabled = false,
}) => {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);

  const isDisabled = sessionId === null || disabled;

  const handleExportExcel = useCallback(async () => {
    if (sessionId === null) return;

    setExportingExcel(true);
    try {
      const response = await reportApi.exportExcel(sessionId, kenhCount);
      const blob = assertBlob(response.data);
      downloadBlob(blob, `BaoCao_${sessionId}_${buildTimestamp()}.xlsx`);
    } catch {
      message.error('Xuất Excel thất bại');
    } finally {
      setExportingExcel(false);
    }
  }, [kenhCount, sessionId]);

  const handleExportWord = useCallback(async () => {
    if (sessionId === null) return;

    setExportingWord(true);
    try {
      const response = await reportApi.exportWord(sessionId);
      const blob = assertBlob(response.data);
      downloadBlob(blob, `BaoCao_${sessionId}_${buildTimestamp()}.docx`);
    } catch {
      message.error('Xuất Word thất bại');
    } finally {
      setExportingWord(false);
    }
  }, [sessionId]);

  return (
    <Space wrap>
      <Button
        icon={<FileExcelOutlined />}
        loading={exportingExcel}
        disabled={isDisabled}
        onClick={handleExportExcel}
      >
        Xuất Excel
      </Button>
      <Button
        icon={<FileWordOutlined />}
        loading={exportingWord}
        disabled={isDisabled}
        onClick={handleExportWord}
      >
        Xuất Word
      </Button>
    </Space>
  );
};

export const ExportButtons = React.memo(ExportButtonsComponent);

