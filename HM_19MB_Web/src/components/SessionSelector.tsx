import { Select } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/useSession';

export default function SessionSelector() {
  const {
    currentSessionId,
    loadingSessions,
    sessions,
    setCurrentSessionId,
  } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentSessionId === null) {
      return;
    }

    if (loadingSessions) {
      return;
    }

    const sessionExists = sessions.some((session) => session.id === currentSessionId);
    if (!sessionExists) {
      setCurrentSessionId(null);
    }
  }, [currentSessionId, loadingSessions, sessions, setCurrentSessionId]);

  const options = useMemo(
    () =>
      sessions.map((session) => ({
        value: session.id,
        label: `${session.tenThietBi} — ${dayjs(session.ngayHieuChuan).format('DD/MM/YYYY')}`,
      })),
    [sessions]
  );

  const handleChange = useCallback(
    (sessionId: number) => {
      setCurrentSessionId(sessionId);
      navigate(`/sessions/${sessionId}/calibration`);
    },
    [navigate, setCurrentSessionId]
  );

  return (
    <Select<number>
      className="session-selector"
      loading={loadingSessions}
      onChange={handleChange}
      options={options}
      placeholder="Chọn phiên đo"
      showSearch
      optionFilterProp="label"
      value={currentSessionId ?? undefined}
    />
  );
}
