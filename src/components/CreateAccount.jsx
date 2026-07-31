import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function CreateAccount() {
  const { createUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', userId: '', password: '', role: 'student' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setError('');
    try {
      await createUser(form);
      setStatus('Account created successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#071024', color: '#e6eef8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 520, background: '#08263a', padding: 28, borderRadius: 12 }}>
        <h2 style={{ marginBottom: 12 }}>Create Account</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 6 }}>Name</label>
          <input name="name" value={form.name} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 12 }} />

          <label style={{ display: 'block', marginBottom: 6 }}>User ID</label>
          <input name="userId" value={form.userId} onChange={handleChange} required style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 12 }} />

          <label style={{ display: 'block', marginBottom: 6 }}>Password</label>
          <input name="password" value={form.password} onChange={handleChange} type="password" required style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 12 }} />

          <label style={{ display: 'block', marginBottom: 6 }}>Role</label>
          <select name="role" value={form.role} onChange={handleChange} style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 12 }}>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, background: '#06b6d4', color: '#042027', fontWeight: 700 }}>Create</button>
            <button type="button" style={{ padding: '10px 14px', borderRadius: 8, background: '#0ea5a4', color: '#042027' }} onClick={() => navigate(-1)}>Cancel</button>
          </div>

          {status && <div style={{ marginTop: 12, color: '#a7f3d0' }}>{status}</div>}
          {error && <div style={{ marginTop: 12, color: '#fca5a5' }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
