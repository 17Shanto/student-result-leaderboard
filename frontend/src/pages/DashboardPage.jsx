import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { Empty, ErrorState, Loading } from '../components/StateViews';
import { formatDate, formatDateTime } from '../utils/format';

export default function DashboardPage() {
  const { data, loading, error, reload } = useFetch(() => api.get('/dashboard').then((r) => r.data), []);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { totals, recentExams, recentResults } = data;
  return (
    <section>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats">
        <Link to="/students" className="stat card"><span>Students</span><strong>{totals.students}</strong></Link>
        <Link to="/exams" className="stat card"><span>Examinations</span><strong>{totals.exams}</strong></Link>
        <Link to="/results" className="stat card"><span>Results</span><strong>{totals.results}</strong></Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Recent examinations</h2>
          {recentExams.length === 0 ? (
            <Empty title="No examinations yet"><Link to="/exams">Create one</Link></Empty>
          ) : (
            <ul className="list">
              {recentExams.map((e) => (
                <li key={e._id}>
                  <div>
                    <strong>{e.title}</strong>
                    <div className="muted small">{formatDate(e.examDate)} · {e.totalMarks} marks</div>
                  </div>
                  <span className={`badge badge-${e.status}`}>{e.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>Recent result activity</h2>
          {recentResults.length === 0 ? (
            <Empty title="No results yet"><Link to="/results">Add a result</Link></Empty>
          ) : (
            <ul className="list">
              {recentResults.map((r) => (
                <li key={r._id}>
                  <div>
                    <strong>{r.student?.name ?? 'Unknown student'}</strong>
                    <div className="muted small">{r.exam?.title ?? 'Unknown exam'} · {formatDateTime(r.updatedAt)}</div>
                  </div>
                  <span className="mono">{r.marksObtained}/{r.exam?.totalMarks ?? '?'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
