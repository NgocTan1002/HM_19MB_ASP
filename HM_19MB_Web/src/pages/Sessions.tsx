import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
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
import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import SessionForm from '../components/sessions/SessionForm';
import { useSession } from '../contexts/useSession';
import { sessionApi } from '../services/api';
import type { PhienDoSummary, SessionMetadata } from '../types/models';

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

function formatDate(value: string): string {
  const date = dayjs(value);
  return date.isValid() ? date.format('DD/MM/YYYY') : '---';
}

export default function Sessions() {
  const navigate = useNavigate();
  const {
    currentSessionId,
    loadingSessions,
    refreshSessions,
    sessions,
    setCurrentSessionId,
  } = useSession();
  const [searchText, setSearchText] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionMetadata | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (selectedSessionId === null) {
      return;
    }

    let cancelled = false;

    async function loadSessionDetail(sessionId: number) {
      setLoadingDetail(true);
      try {
        const response = await sessionApi.getById(sessionId);
        if (!cancelled) {
          setSelectedSession(response.data);
        }
      } catch (error) {
        console.error('[Sessions] Load detail failed:', error);
        if (!cancelled) {
          message.error('Không tải được thông tin phiên đo');
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadSessionDetail(selectedSessionId);

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  const filteredSessions = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (keyword.length === 0) {
      return sessions;
    }

    return sessions.filter((session) => {
      return (
        session.tenThietBi.toLowerCase().includes(keyword) ||
        session.soHieu.toLowerCase().includes(keyword)
      );
    });
  }, [searchText, sessions]);

  const handleOpenSession = useCallback(
    (sessionId: number) => {
      setCurrentSessionId(sessionId);
      navigate('/');
    },
    [navigate, setCurrentSessionId]
  );

  const handleEditSession = useCallback((sessionId: number) => {
    setSelectedSessionId(sessionId);
  }, []);

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
          setSelectedSession(null);
        }

        await refreshSessions();
      } catch (error) {
        console.error('[Sessions] Delete failed:', error);
        message.error('Không xóa được phiên đo');
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

  const handleCreate = useCallback(
    async (values: SessionMetadata) => {
      setCreating(true);
      try {
        const response = await sessionApi.create(values);
        const newSessionId = response.data.id;
        message.success('Đã tạo phiên đo mới');
        setCurrentSessionId(newSessionId);
        setCreateOpen(false);
        await refreshSessions();
        navigate('/');
      } catch (error) {
        console.error('[Sessions] Create failed:', error);
        message.error('Không tạo được phiên đo');
      } finally {
        setCreating(false);
      }
    },
    [navigate, refreshSessions, setCurrentSessionId]
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
        setSelectedSession({ ...values, id: selectedSessionId });
        await refreshSessions();
      } catch (error) {
        console.error('[Sessions] Update failed:', error);
        message.error('Không lưu được thay đổi');
      } finally {
        setSavingEdit(false);
      }
    },
    [refreshSessions, selectedSessionId]
  );

  const handleEditCancel = useCallback(() => {
    setSelectedSessionId(null);
    setSelectedSession(null);
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
              onClick={() => handleOpenSession(record.id)}
            >
              Mở
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
    [handleDeleteSession, handleEditSession, handleOpenSession]
  );

  return (
    <section>
      <style>
        {`
          .sessions-current-row > td {
            background: #e6f4ff !important;
          }
          .sessions-page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
          }
          .sessions-page-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          .sessions-row-actions {
            display: flex;
            flex-wrap: nowrap;
            white-space: nowrap;
          }
          @media (max-width: 768px) {
            .sessions-page-header {
              align-items: stretch;
              flex-direction: column;
            }
            .sessions-page-header-actions {
              justify-content: flex-start;
            }
          }
        `}
      </style>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={selectedSessionId === null ? 24 : 14}>
          <Card>
            <div className="sessions-page-header">
              <Title level={3} style={{ margin: 0 }}>
                Danh sách phiên đo
              </Title>
              <div className="sessions-page-header-actions">
                <Search
                  allowClear
                  placeholder="Tìm theo thiết bị hoặc số hiệu"
                  value={searchText}
                  onSearch={handleSearch}
                  onChange={handleSearchChange}
                  style={{ width: 260 }}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateOpen}
                >
                  Tạo phiên mới
                </Button>
              </div>
            </div>

            <Table<PhienDoSummary>
              rowKey="id"
              columns={columns}
              dataSource={filteredSessions}
              loading={loadingSessions}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              rowClassName={(record) =>
                record.id === currentSessionId ? 'sessions-current-row' : ''
              }
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa có phiên đo nào"
                  />
                ),
              }}
              scroll={{ x: 850 }}
            />
          </Card>
        </Col>

        <Col
          xs={24}
          lg={10}
          style={{ display: selectedSessionId === null ? 'none' : 'block' }}
        >
          <Card
            title="Thông tin phiên đo"
            extra={
              selectedSessionId !== null ? (
                <Text type="secondary">ID: {selectedSessionId}</Text>
              ) : null
            }
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
