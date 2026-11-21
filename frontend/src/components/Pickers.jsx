import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useDebounce } from '../hooks/useFetch';
import { formatDate } from '../utils/format';

/** Searchable student selector (server-side search, so it scales to many students). */
export function StudentPicker({ id, value, onChange, emptyLabel, invalid }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/students', { search: debounced, limit: 20 })
      .then((r) => active && setOptions(r.data))
      .catch(() => active && setOptions([]));
    return () => { active = false; };
  }, [debounced]);

  // Make sure the currently selected student is always shown, even if not in the search results.
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?._id === value) return;
    api.get(`/students/${value}`).then((r) => setSelected(r.data)).catch(() => setSelected(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const merged = selected && !options.some((o) => o._id === selected._id) ? [selected, ...options] : options;

  return (
    <div className="picker">
      <input type="search" placeholder="Type to search students…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students" />
      <select
        id={id}
        value={value || ''}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setSelected(merged.find((o) => o._id === e.target.value) || null);
          onChange(e.target.value);
        }}
      >
        <option value="" disabled={!emptyLabel}>{emptyLabel || 'Select a student'}</option>
        {merged.map((s) => (
          <option key={s._id} value={s._id}>{s.registrationNo} — {s.name}</option>
        ))}
      </select>
    </div>
  );
}

/** Loads every exam once (lightweight list) for selectors. */
export function useExamOptions() {
  const [state, setState] = useState({ exams: [], loading: true, error: null });
  useEffect(() => {
    api.get('/leaderboard/exams')
      .then((r) => setState({ exams: r.data, loading: false, error: null }))
      .catch((error) => setState({ exams: [], loading: false, error }));
  }, []);
  return state;
}

export function ExamSelect({ id, exams, value, onChange, emptyLabel, invalid }) {
  return (
    <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined}>
      <option value="" disabled={!emptyLabel}>{emptyLabel || 'Select an examination'}</option>
      {exams.map((x) => (
        <option key={x._id} value={x._id}>{x.title} ({formatDate(x.examDate)}, {x.totalMarks} marks)</option>
      ))}
    </select>
  );
}
