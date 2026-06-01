import { Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/useSession';
import { sessionApi } from '../services/api';
import type { PhienDoSummary } from '../types/models';

export default function SessionSelector() {
  const [sessions, setSessions] = useState<PhienDoSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentSessionId, setCurrentSessionId } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;

    async function loadSessions() {
      setLoading(true);

      try {
        const response = await sessionApi.getList();

        if (!ignore) {
          setSessions(response.data);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadSessions();

    return () => {
      ignore = true;
    };
  }, []);

  const options = useMemo(
    () =>
      sessions.map(session => ({
        value: session.id,
        label: `${session.tenThietBi} — ${dayjs(session.ngayHieuChuan).format('DD/MM/YYYY')}`,
      })),
    [sessions]
  );

  const handleChange = (sessionId: number) => {
    setCurrentSessionId(sessionId);
    navigate(`/sessions/${sessionId}/calibration`);
  };

  return (
    <Select<number>
      className="session-selector"
      loading={loading}
      onChange={handleChange}
      options={options}
      placeholder="Chọn phiên đo"
      showSearch
      optionFilterProp="label"
      value={currentSessionId ?? undefined}
    />
  );
}
