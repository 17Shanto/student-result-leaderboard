import { useState } from 'react';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useUrlState } from '../hooks/useUrlState';
import { useToast } from '../context/ToastContext';
import Modal, { ConfirmDialog } from '../components/Modal';
import Pagination from '../components/Pagination';
import FormField from '../components/FormField';
import { ExamSelect, StudentPicker, useExamOptions } from '../components/Pickers';
import { Alert, Empty, ErrorState, Loading } from '../components/StateViews';
import { formatDateTime } from '../utils/format';

function ResultForm({ initial, exams, onClose, onSaved }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState({
    student: initial?.student?._id || initial?.student || '',
    exam: initial?.exam?._id || initial?.exam || '',
    marksObtained: initial?.marksObtained ?? '',
    remarks: initial?.remarks || '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedExam = exams.find((x) => x._id === form.exam);
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const e = {};
    if (!form.student) e.student = 'Select a student';
    if (!form.exam) e.exam = 'Select an examination';
    const m = Number(form.marksObtained);
    if (form.marksObtained === '' || Number.isNaN(m)) e.marksObtained = 'Marks are required';
    else if (m < 0) e.marksObtained = 'Marks cannot be negative';
    else if (selectedExam && m > selectedExam.totalMarks) e.marksObtained = `Marks must be between 0 and ${selectedExam.totalMarks}`;
    if (form.remarks.length > 300) e.remarks = 'Remarks must be at most 300 characters';
    return e;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const v = validate();
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) return;

    const payload = { student: form.student, exam: form.exam, marksObtained: Number(form.marksObtained), remarks: form.remarks.trim() };
    setSubmitting(true);
    try {
      if (isEdit) await api.put(`/results/${initial._id}`, payload);
      else await api.post('/results', payload);
      onSaved(isEdit ? 'Result updated' : 'Result created');
    } catch (err) {
      setErrors(err.errors || {});
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Edit result' : 'Add result'} onClose={onClose} busy={submitting}>
      <form onSubmit={onSubmit} noValidate>
        <Alert>{formError}</Alert>
        <FormField label="Student" name="student" error={errors.student}>
          <StudentPicker id="student" value={form.student} onChange={(v) => setField('student', v)} invalid={!!errors.student} />
        </FormField>
        <FormField label="Examination" name="exam" error={errors.exam}>
          <ExamSelect id="exam" exams={exams} value={form.exam} onChange={(v) => setField('exam', v)} invalid={!!errors.exam} />
        </FormField>
        <FormField
          label="Marks obtained"
          name="marksObtained"
          error={errors.marksObtained}
          hint={selectedExam ? `Between 0 and ${selectedExam.totalMarks}` : undefined}
        >
          <input
            id="marksObtained"
            type="number"
            min="0"
            max={selectedExam?.totalMarks}
            step="any"
            value={form.marksObtained}
            onChange={(e) => setField('marksObtained', e.target.value)}
          />
        </FormField>
        <FormField label="Remarks (optional)" name="remarks" error={errors.remarks}>
          <textarea id="remarks" rows="2" maxLength={300} value={form.remarks} onChange={(e) => setField('remarks', e.target.value)} />
        </FormField>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create result'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ResultsPage() {
  const notify = useToast();
  const [{ page, student, exam }, setUrl] = useUrlState({ page: 1, student: '', exam: '' });
  const { exams, error: examsError } = useExamOptions();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data, loading, error, reload } = useFetch(
    () => api.get('/results', { page, limit: 10, student, exam }),
    [page, student, exam]
  );

  function onSaved(msg) {
    setEditing(null);
    notify(msg);
    reload();
  }

  async function confirmDelete() {
    await api.del(`/results/${deleting._id}`);
    notify('Result deleted');
    if (data?.data.length === 1 && page > 1) setUrl({ page: page - 1 });
    else reload();
  }

  const filtered = Boolean(student || exam);

  return (
    <section>
      <div className="page-header">
        <h1>Results</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ student, exam })}>+ Add result</button>
      </div>

      <div className="toolbar toolbar-wrap">
        <div className="toolbar-item">
          <label className="small muted" htmlFor="filter-student">Student</label>
          <StudentPicker id="filter-student" value={student} emptyLabel="All students" onChange={(v) => setUrl({ student: v, page: 1 })} />
        </div>
        <div className="toolbar-item">
          <label className="small muted" htmlFor="filter-exam">Examination</label>
          <ExamSelect id="filter-exam" exams={exams} value={exam} emptyLabel="All examinations" onChange={(v) => setUrl({ exam: v, page: 1 })} />
        </div>
        {filtered && (
          <button type="button" className="btn btn-ghost btn-sm align-end" onClick={() => setUrl({ student: '', exam: '', page: 1 })}>
            Clear filters
          </button>
        )}
      </div>
      {examsError && <Alert>Could not load examinations: {examsError.message}</Alert>}

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : data.data.length === 0 ? (
        <Empty title={filtered ? 'No results match the filters' : 'No results yet'}>
          {filtered ? 'Try clearing the filters.' : 'Click “Add result” to record marks.'}
        </Empty>
      ) : (
        <div className={`card table-card ${loading ? 'is-loading' : ''}`}>
          <table className="table">
            <thead>
              <tr><th>Reg. no</th><th>Student</th><th>Examination</th><th>Marks</th><th>%</th><th>Remarks</th><th>Updated</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {data.data.map((r) => (
                <tr key={r._id}>
                  <td data-label="Reg. no" className="mono">{r.student?.registrationNo ?? '—'}</td>
                  <td data-label="Student">{r.student?.name ?? '—'}</td>
                  <td data-label="Examination">{r.exam?.title ?? '—'}</td>
                  <td data-label="Marks" className="mono">{r.marksObtained}/{r.exam?.totalMarks ?? '?'}</td>
                  <td data-label="%">{r.percentage ?? '—'}</td>
                  <td data-label="Remarks">{r.remarks || '—'}</td>
                  <td data-label="Updated">{formatDateTime(r.updatedAt)}</td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(r)}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => setDeleting(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={data.meta} onPage={(p) => setUrl({ page: p })} />
        </div>
      )}

      {editing && <ResultForm initial={editing} exams={exams} onClose={() => setEditing(null)} onSaved={onSaved} />}
      {deleting && (
        <ConfirmDialog
          title="Delete result"
          message={`Delete the result of ${deleting.student?.name ?? 'this student'} in “${deleting.exam?.title ?? 'this exam'}”?`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
