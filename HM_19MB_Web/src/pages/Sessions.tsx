import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SessionForm from '../components/sessions/SessionForm';
import { useSession } from '../contexts/useSession';
import { getErrorMessage, sessionApi } from '../services/api';
import type { PhienDoSummary, SessionMetadata } from '../types/models';
import './Sessions.css';

const { Search } = Input;
const { Text, Title } = Typography;

const EMPTY_SESSION: SessionMetadata = {
  tenThietBi: '',
  kyHieu: '',
  soHieu: '',
  soTem: '',
  noiSanXuat: '',
  namSanXuat: '',
  donViSuDung: '',
  phuongPhap: '',
  ngayHieuChuan: dayjs().format('YYYY-MM-DD'),
  nhietDoMoiTruong: '',
  doAmTuongDoi: '',
  nhietDoLamViec: '',
  dacTinhKyThuat: '',
  thietBiChuan: '',
};

function formatDate(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    return '---';
  }

  const date = dayjs(value);
  return date.isValid() ? date.format('DD/MM/YYYY') : '---';
}

function formatDateTime(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    return '---';
  }

  const date = dayjs(value);
  return date.isValid() ? date.format('DD/MM/YYYY HH:mm') : '---';
}

function displayText(value: string | undefined): string {
  return value !== undefined && value.trim().length > 0 ? value : '---';
}

export default function Sessions() {
  const queryClient = useQueryClient();
  const {
    currentSessionId,
    loadingSessions,
    refreshSessions,
    sessions,
    setCurrentSessionId,
  } = useSession();
  const [searchText, setSearchText] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedSummary = useMemo(
    () =>
      selectedSessionId === null
        ? null
        : sessions.find(session => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const sessionDetailQueryKey = useMemo(
    () => ['session-detail', selectedSessionId] as const,
    [selectedSessionId]
  );

  const {
    data: selectedSession = null,
    error: selectedSessionError,
    isFetching: loadingDetail,
  } = useQuery({
    queryKey: sessionDetailQueryKey,
    enabled: selectedSessionId !== null,
    queryFn: async () => {
      if (selectedSessionId === null) {
        return null;
      }

      const response = await sessionApi.getById(selectedSessionId);
      return response.data;
    },
  });

  useEffect(() => {
    if (selectedSessionId !== null || sessions.length === 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      const initialSession =
        currentSessionId !== null
          ? sessions.find(session => session.id === currentSessionId) ?? sessions[0]
          : sessions[0];

      setSelectedSessionId(initialSession.id);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [currentSessionId, selectedSessionId, sessions]);

  useEffect(() => {
    if (
      selectedSessionId === null ||
      sessions.length === 0 ||
      sessions.some(session => session.id === selectedSessionId)
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setSelectedSessionId(null);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (selectedSessionError !== null) {
      console.error('[Sessions] Load detail failed:', selectedSessionError);
      message.error(
        getErrorMessage(selectedSessionError, 'Không tải được thông tin phiên đo')
      );
    }
  }, [selectedSessionError]);

  const filteredSessions = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (keyword.length === 0) {
      return sessions;
    }

    return sessions.filter(session => {
      return (
        session.tenThietBi.toLowerCase().includes(keyword) ||
        session.soHieu.toLowerCase().includes(keyword)
      );
    });
  }, [searchText, sessions]);

  const handleSelectSession = useCallback(
    (sessionId: number) => {
      setSelectedSessionId(sessionId);
      setCurrentSessionId(sessionId);
      setListOpen(false);
    },
    [setCurrentSessionId]
  );

  const handleEditSession = useCallback(
    (sessionId: number) => {
      setSelectedSessionId(sessionId);
      setCurrentSessionId(sessionId);
      setListOpen(false);
    },
    [setCurrentSessionId]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      try {
        await sessionApi.delete(sessionId);
        message.success('Đã xóa phiên đo');

        if (sessionId === currentSessionId) {
          setCurrentSessionId(null);
        }

        if (sessionId === selectedSessionId) {
          setSelectedSessionId(null);
        }

        await refreshSessions();
      } catch (error) {
        console.error('[Sessions] Delete failed:', error);
        message.error(getErrorMessage(error, 'Không xóa được phiên đo'));
      }
    },
    [
      currentSessionId,
      refreshSessions,
      selectedSessionId,
      setCurrentSessionId,
    ]
  );

  const handleSearch = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(event.target.value);
    },
    []
  );

  const handleCreateOpen = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleCreateCancel = useCallback(() => {
    if (!creating) {
      setCreateOpen(false);
    }
  }, [creating]);

  const handleListOpen = useCallback(() => {
    setListOpen(true);
  }, []);

  const handleListClose = useCallback(() => {
    setListOpen(false);
  }, []);

  const handleCreate = useCallback(
    async (values: SessionMetadata) => {
      setCreating(true);
      try {
        const response = await sessionApi.create(values);
        const newSessionId = response.data.id;
        message.success('Đã tạo phiên đo mới');
        setSelectedSessionId(newSessionId);
        setCurrentSessionId(newSessionId);
        setCreateOpen(false);
        await refreshSessions();
      } catch (error) {
        console.error('[Sessions] Create failed:', error);
        message.error(getErrorMessage(error, 'Không tạo được phiên đo'));
      } finally {
        setCreating(false);
      }
    },
    [refreshSessions, setCurrentSessionId]
  );

  const handleUpdate = useCallback(
    async (values: SessionMetadata) => {
      if (selectedSessionId === null) {
        return;
      }

      setSavingEdit(true);
      try {
        await sessionApi.update(selectedSessionId, values);
        message.success('Đã lưu thay đổi');
        queryClient.setQueryData(sessionDetailQueryKey, {
          ...values,
          id: selectedSessionId,
        });
        await refreshSessions();
      } catch (error) {
        console.error('[Sessions] Update failed:', error);
        message.error(getErrorMessage(error, 'Không lưu được thay đổi'));
      } finally {
        setSavingEdit(false);
      }
    },
    [queryClient, refreshSessions, selectedSessionId, sessionDetailQueryKey]
  );

  const handleEditCancel = useCallback(() => {
    setSelectedSessionId(null);
  }, []);

  const columns = useMemo<TableColumnsType<PhienDoSummary>>(
    () => [
      {
        title: 'STT',
        key: 'stt',
        width: 56,
        render: (_value, _record, index) => index + 1,
      },
      {
        title: 'Tên thiết bị',
        dataIndex: 'tenThietBi',
        key: 'tenThietBi',
        sorter: (a, b) => a.tenThietBi.localeCompare(b.tenThietBi),
      },
      {
        title: 'Ký hiệu',
        dataIndex: 'kyHieu',
        key: 'kyHieu',
        width: 100,
      },
      {
        title: 'Số hiệu',
        dataIndex: 'soHieu',
        key: 'soHieu',
        width: 110,
      },
      {
        title: 'Ngày hiệu chuẩn',
        dataIndex: 'ngayHieuChuan',
        key: 'ngayHieuChuan',
        width: 140,
        render: (value: string) => formatDate(value),
        sorter: (a, b) =>
          dayjs(a.ngayHieuChuan).valueOf() - dayjs(b.ngayHieuChuan).valueOf(),
      },
      {
        title: 'Điểm KT',
        dataIndex: 'soDiemKiemTra',
        key: 'soDiemKiemTra',
        align: 'right',
        width: 80,
      },
      {
        title: 'Lần đo',
        dataIndex: 'soLanDoTho',
        key: 'soLanDoTho',
        align: 'right',
        width: 80,
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 190,
        render: (_value, record) => (
          <Space size={4} className="sessions-row-actions">
            <Button
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => handleSelectSession(record.id)}
            >
              Chọn
            </Button>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditSession(record.id)}
            >
              Sửa
            </Button>
            <Popconfirm
              title="Xóa phiên này?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDeleteSession(record.id)}
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDeleteSession, handleEditSession, handleSelectSession]
  );

  return (
    <section>
      <div className="sessions-page-header">
        <Space direction="vertical" size={2}>
          <Title level={2} style={{ margin: 0 }}>
            Quản lý phiên đo
          </Title>
          <Text type="secondary">
            Xem và cập nhật metadata của phiên đo đang chọn.
          </Text>
        </Space>

        <div className="sessions-page-header-actions">
          <Button icon={<UnorderedListOutlined />} onClick={handleListOpen}>
            Danh sách phiên đo
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateOpen}>
            Tạo phiên mới
          </Button>
        </div>
      </div>

      {selectedSessionId === null ? (
        <Card>
          <Empty
            description="Chưa chọn phiên đo"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Space wrap>
              <Button icon={<UnorderedListOutlined />} onClick={handleListOpen}>
                Danh sách phiên đo
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateOpen}>
                Tạo phiên mới
              </Button>
            </Space>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card
              className="sessions-info-card"
              title="Tóm tắt"
              extra={<Text type="secondary">ID: {selectedSessionId}</Text>}
              loading={loadingDetail}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Tên thiết bị">
                  {displayText(selectedSession?.tenThietBi ?? selectedSummary?.tenThietBi)}
                </Descriptions.Item>
                <Descriptions.Item label="Ký hiệu">
                  {displayText(selectedSession?.kyHieu ?? selectedSummary?.kyHieu)}
                </Descriptions.Item>
                <Descriptions.Item label="Số hiệu">
                  {displayText(selectedSession?.soHieu ?? selectedSummary?.soHieu)}
                </Descriptions.Item>
                <Descriptions.Item label="Đơn vị sử dụng">
                  {displayText(
                    selectedSession?.donViSuDung ?? selectedSummary?.donViSuDung
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày hiệu chuẩn">
                  {formatDate(
                    selectedSession?.ngayHieuChuan ?? selectedSummary?.ngayHieuChuan
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">
                  {formatDateTime(selectedSummary?.ngayTao)}
                </Descriptions.Item>
                <Descriptions.Item label="Điểm kiểm tra">
                  {selectedSummary?.soDiemKiemTra ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="Lần đo thô">
                  {selectedSummary?.soLanDoTho ?? 0}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} xl={16}>
            <Card
              title="Thông tin chi tiết"
              extra={<Text type="secondary">Có thể chỉnh sửa trực tiếp</Text>}
              loading={loadingDetail}
            >
              <SessionForm
                initialValues={selectedSession}
                onSubmit={handleUpdate}
                loading={savingEdit}
                onCancel={handleEditCancel}
                submitText="Lưu thay đổi"
              />
            </Card>
          </Col>
        </Row>
      )}

      <Drawer
        title="Danh sách phiên đo"
        open={listOpen}
        onClose={handleListClose}
        width={980}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateOpen}>
            Tạo phiên mới
          </Button>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Search
            allowClear
            placeholder="Tìm theo thiết bị hoặc số hiệu"
            value={searchText}
            onSearch={handleSearch}
            onChange={handleSearchChange}
            style={{ maxWidth: 360 }}
          />

          <Table<PhienDoSummary>
            rowKey="id"
            columns={columns}
            dataSource={filteredSessions}
            loading={loadingSessions}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            rowClassName={record =>
              record.id === selectedSessionId || record.id === currentSessionId
                ? 'sessions-current-row'
                : ''
            }
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Chưa có phiên đo nào"
                />
              ),
            }}
            onRow={record => ({
              onDoubleClick: () => handleSelectSession(record.id),
            })}
            scroll={{ x: 850 }}
          />
        </Space>
      </Drawer>

      <Modal
        title="Tạo phiên đo mới"
        open={createOpen}
        width={600}
        onCancel={handleCreateCancel}
        footer={null}
        destroyOnHidden
      >
        <SessionForm
          initialValues={EMPTY_SESSION}
          onSubmit={handleCreate}
          loading={creating}
          onCancel={handleCreateCancel}
          submitText="Tạo phiên"
        />
      </Modal>
    </section>
  );
}
