import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useDebounce, useFetch } from '../hooks/useFetch';
import { useUrlState } from '../hooks/useUrlState';
import { useToast } from '../context/ToastContext';
import Modal, { ConfirmDialog } from '../components/Modal';
import Pagination from '../components/Pagination';
import FormField from '../components/FormField';
import { Alert, Empty, ErrorState, Loading } from '../components/StateViews';
import { EXAM_STATUSES, formatDate, toDateInput } from '../utils/format';

function ExamForm({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState({
    title: initial?.title || '',
    examDate: toDateInput(initial?.examDate),
    totalMarks: initial?.totalMarks ?? '',
    status: initial?.status || 'upcoming',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.examDate) e.examDate = 'Examination date is required';
    const tm = Number(form.totalMarks);
    if (form.totalMarks === '' || !Number.isInteger(tm) || tm < 1 || tm > 10000) {
      e.totalMarks = 'Total marks must be a whole number between 1 and 10000';
    }
    if (!EXAM_STATUSES.includes(form.status)) e.status = 'Select a status';
    return e;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const v = validate();
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) return;

    const payload = { title: form.title.trim(), examDate: form.examDate, totalMarks: Number(form.totalMarks), status: form.status };
    setSubmitting(true);
    try {
      if (isEdit) await api.put(`/exams/${initial._id}`, payload);
      else await api.post('/exams', payload);
      onSaved(isEdit ? 'Examination updated' : 'Examination created');
    } catch (err) {
      setErrors(err.errors || {});
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Edit examination' : 'Add examination'} onClose={onClose} busy={submitting}>
      <form onSubmit={onSubmit} noValidate>
        <Alert>{formError}</Alert>
        <FormField label="Title" name="title" error={errors.title}>
          <input id="title" value={form.title} onChange={set('title')} autoFocus />
        </FormField>
        <div className="row-2">
          <FormField label="Examination date" name="examDate" error={errors.examDate}>
            <input id="examDate" type="date" value={form.examDate} onChange={set('examDate')} />
          </FormField>
          <FormField label="Total marks" name="totalMarks" error={errors.totalMarks}>
            <input id="totalMarks" type="number" min="1" max="10000" step="1" value={form.totalMarks} onChange={set('totalMarks')} />
          </FormField>
        </div>
        <FormField label="Status" name="status" error={errors.status}>
          <select id="status" value={form.status} onChange={set('status')}>
            {EXAM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create examination'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ExamsPage() {
  const notify = useToast();
  const [{ page, search, status }, setUrl] = useUrlState({ page: 1, search: '', status: '' });
  const [searchInput, setSearchInput] = useState(search);
  const debounced = useDebounce(searchInput);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (debounced !== search) setUrl({ search: debounced, page: 1 });
  }, [debounced, search, setUrl]);

  const { data, loading, error, reload } = useFetch(
    () => api.get('/exams', { page, limit: 10, search, status }),
    [page, search, status]
  );

  function onSaved(msg) {
    setEditing(null);
    notify(msg);
    reload();
  }

  async function confirmDelete() {
    const res = await api.del(`/exams/${deleting._id}`);
    const n = res.data?.deletedResults ?? 0;
    notify(`Examination deleted${n ? ` along with ${n} result(s)` : ''}`);
    if (data?.data.length === 1 && page > 1) setUrl({ page: page - 1 });
    else reload();
  }

  return (
    <section>
      <div className="page-header">
        <h1>Examinations</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>+ Add examination</button>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Search by title…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search examinations" />
        <select value={status} onChange={(e) => setUrl({ status: e.target.value, page: 1 })} aria-label="Filter by status">
          <option value="">All statuses</option>
          {EXAM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : data.data.length === 0 ? (
        <Empty title={search || status ? 'No examinations match the filters' : 'No examinations yet'}>
          {search || status ? 'Try changing the filters.' : 'Click “Add examination” to create one.'}
        </Empty>
      ) : (
        <div className={`card table-card ${loading ? 'is-loading' : ''}`}>
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Date</th><th>Total marks</th><th>Status</th><th>Updated</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {data.data.map((x) => (
                <tr key={x._id}>
                  <td data-label="Title">{x.title}</td>
                  <td data-label="Date">{formatDate(x.examDate)}</td>
                  <td data-label="Total marks">{x.totalMarks}</td>
                  <td data-label="Status"><span className={`badge badge-${x.status}`}>{x.status}</span></td>
                  <td data-label="Updated">{formatDate(x.updatedAt)}</td>
                  <td className="actions">
                    <Link className="btn btn-ghost btn-sm" to={`/leaderboard?exam=${x._id}`}>Leaderboard</Link>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(x)}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => setDeleting(x)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={data.meta} onPage={(p) => setUrl({ page: p })} />
        </div>
      )}

      {editing && <ExamForm initial={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
      {deleting && (
        <ConfirmDialog
          title="Delete examination"
          message={`Delete “${deleting.title}”? All results recorded for this examination will also be deleted. This cannot be undone.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
