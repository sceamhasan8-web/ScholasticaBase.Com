import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useFormFields from '../hooks/useFormFields.js';
import schoolHallway from '../school_hallway.png';
import defaultLogo from '../greenfield_logo.png';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { MotivationalQuote } from './MotivationalQuote.jsx';
import ScholasticBaseLogo from './ScholasticBaseLogo.jsx';

export default function LoginScreen() {
  const navigate = useNavigate();
  const { role: routeRole } = useParams();
  const { user, signIn } = useAuth();
  const { schoolProfile } = useSchoolProfile();

  useEffect(() => {
    if (user) {
      const validRoles = ['admin', 'teacher', 'student', 'principal'];
      const userRole = String(user?.role || '').toLowerCase();
      if (user.isSuperAdmin || validRoles.includes(userRole)) {
        navigate(user.isSuperAdmin ? '/admin' : `/${userRole}`, { replace: true });
      }
    }
  }, [user, navigate]);

  const { fields, handleChange } = useFormFields({
    userId: '',
    password: '',
    eiinNumber: schoolProfile?.eiinNumber || '',
    loginKey: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const normalizeLoginMode = (role) => (role === 'class-teacher' ? 'classTeacher' : role || 'student');
  const [mode, setMode] = useState(normalizeLoginMode(routeRole));
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (routeRole) setMode(normalizeLoginMode(routeRole));
  }, [routeRole]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      let signInRole, accessMode;
      const sanitizedUserId = (fields.userId || '').trim();

      // Dynamic Role Resolution: Perform inline asynchronous lookup from localStorage
      let matchedUser = null;
      try {
        const raw = await Promise.resolve(window.localStorage.getItem('schoolAppLocalUsers'));
        if (raw) {
          const users = JSON.parse(raw);
          if (users && typeof users === 'object') {
            const matchedKey = Object.keys(users).find(
              (key) => key.toLowerCase() === sanitizedUserId.toLowerCase()
            );
            if (matchedKey) {
              matchedUser = users[matchedKey];
            }
          }
        }
      } catch (err) {
        // Robust exception handling: gracefully ignore JSON parsing exceptions or missing local storage anomalies
      }

      const extractedRole = matchedUser ? String(matchedUser.role || '').trim().toLowerCase() : '';
      const isSuperAdminAccount = !!(matchedUser && matchedUser.isSuperAdmin);

      // Intelligent Routing & Radio Override
      // Super Admin accounts always get admin role + full access, regardless of radio button
      if (isSuperAdminAccount || extractedRole === 'admin') {
        signInRole = 'admin';
        accessMode = 'full';
      } else if (extractedRole === 'principal') {
        signInRole = 'principal';
        accessMode = 'full';
      } else {
        // Fallback to legacy string matches or standard cascade logic
        if (sanitizedUserId === 'admin') {
          signInRole = 'admin';
          accessMode = 'full';
        } else if (sanitizedUserId === 'principal' || sanitizedUserId.startsWith('prn-')) {
          signInRole = 'principal';
          accessMode = 'full';
        } else {
          if (mode === 'classTeacher') {
            signInRole = 'teacher';
            accessMode = 'classTeacher';
          } else if (mode === 'teacher') {
            signInRole = 'teacher';
            accessMode = 'readOnly';
          } else if (mode === 'principal') {
            signInRole = 'principal';
            accessMode = 'full';
          } else {
            signInRole = mode;
            accessMode = 'full';
          }
        }
      }

      const user = await signIn({
        userId: fields.userId,
        password: fields.password,
        eiinNumber: fields.eiinNumber,
        role: signInRole,
        accessMode,
        loginKey: fields.loginKey
      });
      // Super admins always navigate to /admin as their home base
      navigate(user.isSuperAdmin ? '/admin' : `/${user.role}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Incorrect username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page-container" style={{ backgroundImage: `url(${schoolHallway})` }}>
      {/* Top Header */}
      <header className="login-header">
        <div className="login-header-left">
          {schoolProfile?.logo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={schoolProfile.logo} alt={`${schoolProfile.schoolName || 'School'} logo`} className="login-logo" />
              <span className="login-school-name">{schoolProfile.schoolName || 'ScholasticBase'}</span>
            </div>
          ) : (
            <ScholasticBaseLogo variant="horizontal" size={40} showTagline={true} />
          )}
        </div>
        <div className="login-header-right">
          <h2 className="login-portal-title">SCHOOL PORTAL</h2>
          <div className="login-header-links">
            <span>Version 1.2</span>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <div className="login-card">
        <MotivationalQuote />
        <h1 className="login-card-title">LOGIN TO YOUR PORTAL</h1>

        <form onSubmit={handleSubmit}>

          {/* Username / ID */}
          <div className="login-field-group">
            <label className="login-label" htmlFor="userId">USERNAME / ID</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <input
                id="userId"
                name="userId"
                value={fields.userId}
                onChange={handleChange}
                placeholder="Enter your assigned ID..."
                required
                className="login-input"
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field-group">
            <label className="login-label" htmlFor="password">PASSWORD</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={fields.password}
                onChange={handleChange}
                placeholder="Enter your password..."
                required
                className="login-input"
              />
              <button
                type="button"
                className="login-input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mode === 'classTeacher' && (
            <div className="login-field-group">
              <label className="login-label" htmlFor="loginKey">CLASS TEACHER LOGIN KEY</label>
              <div className="login-input-wrapper">
                <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
                <input
                  id="loginKey"
                  name="loginKey"
                  value={fields.loginKey}
                  onChange={handleChange}
                  placeholder="Enter class teacher key..."
                  required
                  className="login-input"
                />
              </div>
            </div>
          )}

          {/* Options: Remember Me & Forgot Password */}
          <div className="login-options-row">
            <label className="login-remember-me">
              <input type="checkbox" className="login-checkbox" />
              REMEMBER ME
            </label>
            <a href="#forgot" className="login-forgot-link">Forgot Password?</a>
          </div>

          {/* Role selector (Radio Buttons) */}
          <div className="login-role-row">
            <label className="login-role-option">
              <input
                type="radio"
                name="role"
                value="student"
                checked={mode === 'student'}
                onChange={() => setMode('student')}
                className="login-hidden-radio"
              />
              <span className="login-radio-circle">
                <span className="login-radio-inner"></span>
              </span>
              Login as Student
            </label>

            <label className="login-role-option">
              <input
                type="radio"
                name="role"
                value="teacher"
                checked={mode === 'teacher'}
                onChange={() => setMode('teacher')}
                className="login-hidden-radio"
              />
              <span className="login-radio-circle">
                <span className="login-radio-inner"></span>
              </span>
              Login as Teacher (Read Only)
            </label>

            <label className="login-role-option">
              <input
                type="radio"
                name="role"
                value="classTeacher"
                checked={mode === 'classTeacher'}
                onChange={() => setMode('classTeacher')}
                className="login-hidden-radio"
              />
              <span className="login-radio-circle">
                <span className="login-radio-inner"></span>
              </span>
              Login as Class Teacher
            </label>
          </div>

          {mode === 'teacher' && (
            <div className="login-class-teacher-section">
              <div className="login-class-teacher-icon">RO</div>
              <div>
                <h3>Teacher Read-Only Login</h3>
                <p>Teachers can view the app and records only. Adding, editing, deleting, assigning, and saving are disabled.</p>
              </div>
            </div>
          )}

          {mode === 'classTeacher' && (
            <div className="login-class-teacher-section">
              <div className="login-class-teacher-icon">CT</div>
              <div>
                <h3>Class Teacher Login</h3>
                <p>Use your teacher account plus the admin-provided class teacher key to edit only your assigned class.</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button className="login-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'SIGNING IN...' : 'SIGN IN'}
            <span className="login-submit-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </button>

          {error && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: '#ef4444', textAlign: 'center', fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>
                {error}
              </div>
            </div>
          )}
        </form>

        {/* Footer info */}
        <div className="login-card-footer">
          <div className="login-footer-help" style={{ color: '#64748b', marginBottom: 8, fontSize: 13 }}>
            Need help? <a href={`mailto:${schoolProfile?.adminEmail || 'sceamhasan8@gmail.com'}`} className="login-footer-link">{schoolProfile?.adminName || 'Contact Admin'}</a>
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', margin: '6px 0 2px', fontWeight: 500 }}>
            © 2026 {schoolProfile?.schoolName || 'Progga School'}. All rights reserved.
          </div>
          <div className="login-version" style={{ fontSize: 10.5, color: '#cbd5e1', opacity: 0.8 }}>Version 1.2</div>
        </div>
      </div>
    </div>
  );
}
