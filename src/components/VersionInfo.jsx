import React from 'react';
import { useSchoolProfile } from '../context/SchoolProfileContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function VersionInfo() {
  const { schoolProfile } = useSchoolProfile();
  const navigate = useNavigate();
  const version = '1.2';
  const buildDate = new Date().toLocaleDateString();

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>Back</button>
      <h1 style={{ marginTop: 0 }}>Version Info</h1>
      <div style={{ marginBottom: 8 }}><strong>App:</strong> {schoolProfile.schoolName}</div>
      <div style={{ marginBottom: 8 }}><strong>Version:</strong> {version}</div>
      <div style={{ marginBottom: 8 }}><strong>Build date:</strong> {buildDate}</div>
      <div style={{ marginBottom: 8 }}><strong>Admin contact:</strong> <a href={`mailto:${schoolProfile.adminEmail}`}>{schoolProfile.adminEmail}</a></div>
      <div style={{ marginTop: 16 }}>
        <strong>Notes:</strong>
        <p style={{ marginTop: 8 }}>This page shows the current app version and admin contact.</p>
      </div>
    </div>
  );
}
