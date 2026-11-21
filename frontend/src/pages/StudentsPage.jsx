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
import { formatDate } from '../utils/format';

const EMPTY = { registrationNo: '', name: '', email: '', batch: '', department: '' };

function validateStudent(f) {
  const e = {};
  if (!f.registrationNo.trim()) e.registrationNo = 'Registration number is required';
  else if (!/^[A-Za-z0-9\-/_.]+$/.test(f.registrationNo.trim())) e.registrationNo = 'Use letters, digits, - / _ . only';
  if (!f.name.trim()) e.name = 'Name is required';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
  if (!f.batch.trim()) e.batch = 'Batch / session is required';
  if (!f.department.trim()) e.department = 'Department / course is required';
  return e;
}

function StudentForm({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState(isEdit ? { ...EMPTY, ...initial } : EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return; // prevents accidental duplicate submission
    const v = validateStudent(form);
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) return;

    const payload = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, form[k].trim()]));
    setSubmitting(true);
    try {
      if (isEdit) await api.put(`/students/${initial._id}`, payload);
      else await api.post('/students', payload);
      onSaved(isEdit ? 'Student updated' : 'Student created');
    } catch (err) {
      setErrors(err.errors || {});
      setFormError(err.status === 409 ? 'A student with this registration number already exists.' : err.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Edit student' : 'Add student'} onClose={onClose} busy={submitting}>
      <form onSubmit={onSubmit} noValidate>
        <Alert>{formError}</Alert>
        <FormField label="Registration number" name="registrationNo" error={errors.registrationNo}>
          <input id="registrationNo" value={form.registrationNo} onChange={set('registrationNo')} autoFocus />
        </FormField>
        <FormField label="Full name" name="name" error={errors.name}>
          <input id="name" value={form.name} onChange={set('name')} />
        </FormField>
        <FormField label="Email" name="email" error={errors.email}>
          <input id="email" type="email" value={form.email} onChange={set('email')} />
        </FormField>
        <div className="row-2">
          <FormField label="Batch / session" name="batch" error={errors.batch}>
            <input id="batch" value={form.batch} onChange={set('batch')} placeholder="e.g. 2023-24" />
          </FormField>
          <FormField label="Department / course" name="department" error={errors.department}>
            <input id="department" value={form.department} onChange={set('department')} placeholder="e.g. CSE" />
          </FormField>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function StudentsPage() {
  const notify = useToast();
  const [{ page, search }, setUrl] = useUrlState({ page: 1, search: '' });
  const [searchInput, setSearchInput] = useState(search);
  const debounced = useDebounce(searchInput);
  const [editing, setEditing] = useState(null); // null | {} | student
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (debounced !== search) setUrl({ search: debounced, page: 1 });
  }, [debounced, search, setUrl]);

  const { data, loading, error, reload } = useFetch(
    () => api.get('/students', { page, limit: 10, search }),
    [page, search]
  );

  function onSaved(msg) {
    setEditing(null);
    notify(msg);
    reload();
  }

  async function confirmDelete() {
    const res = await api.del(`/students/${deleting._id}`);
    const n = res.data?.deletedResults ?? 0;
    notify(`Student deleted${n ? ` along with ${n} result(s)` : ''}`);
    // If we removed the last row on this page, step back a page.
    if (data?.data.length === 1 && page > 1) setUrl({ page: page - 1 });
    else reload();
  }

  return (
    <section>
      <div className="page-header">
        <h1>Students</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>+ Add student</button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name, registration no, email, batch, department…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search students"
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : data.data.length === 0 ? (
        <Empty title={search ? 'No students match your search' : 'No students yet'}>
          {search ? 'Try a different keyword.' : 'Click “Add student” to create the first one.'}
        </Empty>
      ) : (
        <div className={`card table-card ${loading ? 'is-loading' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                <th>Reg. no</th><th>Name</th><th>Email</th><th>Batch</th><th>Department</th><th>Updated</th><th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((s) => (
                <tr key={s._id}>
                  <td data-label="Reg. no" className="mono">{s.registrationNo}</td>
                  <td data-label="Name">{s.name}</td>
                  <td data-label="Email">{s.email}</td>
                  <td data-label="Batch">{s.batch}</td>
                  <td data-label="Department">{s.department}</td>
                  <td data-label="Updated">{formatDate(s.updatedAt)}</td>
                  <td className="actions">
                    <Link className="btn btn-ghost btn-sm" to={`/results?student=${s._id}`}>Results</Link>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => setDeleting(s)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={data.meta} onPage={(p) => setUrl({ page: p })} />
        </div>
      )}

      {editing && <StudentForm initial={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
      {deleting && (
        <ConfirmDialog
          title="Delete student"
          message={`Delete ${deleting.name} (${deleting.registrationNo})? All of this student's results will also be deleted. This cannot be undone.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
