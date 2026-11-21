import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useUrlState } from '../hooks/useUrlState';
import { ExamSelect, useExamOptions } from '../components/Pickers';
import { Empty, ErrorState, Loading } from '../components/StateViews';
import { formatDate } from '../utils/format';

function LeaderboardTable({ examId }) {
  const { data, loading, error, reload } = useFetch(
    () => api.get(`/leaderboard/${examId}`).then((r) => r.data),
    [examId]
  );

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;

  const { exam, entries, rankingRule } = data;
  return (
    <div className={`card table-card ${loading ? 'is-loading' : ''}`}>
      <div className="lb-head">
        <div>
          <h2>{exam.title}</h2>
          <p className="muted small">{formatDate(exam.examDate)} · Total {exam.totalMarks} marks · <span className={`badge badge-${exam.status}`}>{exam.status}</span></p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Refresh</button>
      </div>
      {entries.length === 0 ? (
        <Empty title="No results recorded for this examination yet" />
      ) : (
        <table className="table leaderboard">
          <thead>
            <tr><th>Rank</th><th>Reg. no</th><th>Student</th><th>Marks</th><th>Total</th><th>%</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.resultId} className={e.rank <= 3 ? `top top-${e.rank}` : ''}>
                <td data-label="Rank"><span className="rank">{e.rank}</span></td>
                <td data-label="Reg. no" className="mono">{e.registrationNo}</td>
                <td data-label="Student">{e.name}</td>
                <td data-label="Marks" className="mono">{e.marksObtained}</td>
                <td data-label="Total">{e.totalMarks}</td>
                <td data-label="%">{e.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small rule"><strong>Ranking rule:</strong> {rankingRule}</p>
    </div>
  );
}

export default function LeaderboardPage({ isPublic = false }) {
  const [{ exam }, setUrl] = useUrlState({ exam: '' });
  const { exams, loading, error } = useExamOptions();

  // Default to the most recent exam once the list loads.
  useEffect(() => {
    if (!exam && exams.length) setUrl({ exam: exams[0]._id });
  }, [exam, exams, setUrl]);

  const content = (
    <section>
      <div className="page-header">
        <h1>Leaderboard</h1>
        {isPublic && <Link className="btn btn-secondary btn-sm" to="/login">Admin login</Link>}
      </div>
      {error ? (
        <ErrorState error={error} />
      ) : loading ? (
        <Loading />
      ) : exams.length === 0 ? (
        <Empty title="No examinations available" />
      ) : (
        <>
          <div className="toolbar">
            <ExamSelect id="lb-exam" exams={exams} value={exam} onChange={(v) => setUrl({ exam: v })} />
          </div>
          {exam && <LeaderboardTable examId={exam} />}
        </>
      )}
    </section>
  );

  return isPublic ? <div className="public-page">{content}</div> : content;
}
