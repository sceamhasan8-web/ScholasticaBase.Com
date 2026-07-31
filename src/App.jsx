import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext.jsx';
import { SchoolProfileProvider } from './context/SchoolProfileContext.jsx';
import { ViewModeProvider } from './context/ViewModeContext.jsx';
import { ConfirmProvider } from './context/ConfirmContext.jsx';
import { AlertProvider } from './context/AlertContext.jsx';

import LoginScreen from './components/LoginScreen.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import TeacherPanel from './components/TeacherPanel.jsx';
import StudentView from './components/StudentView.jsx';
import PrincipalDashboard from './components/PrincipalDashboard.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SuperAdminSwitcher from './components/SuperAdminSwitcher.jsx';

export default function App() {
  return (
    <AuthProvider>
      <SchoolProfileProvider>
        <ViewModeProvider>
          <ConfirmProvider>
            <AlertProvider>
              <SuperAdminSwitcher />
              <Routes>
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/login/:role" element={<LoginScreen />} />
                <Route
                  path="/super-admin"
                  element={<Navigate to="/admin" replace />}
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <TeacherPanel />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute allowedRoles={['student', 'admin']}>
                      <StudentView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/principal"
                  element={
                    <ProtectedRoute allowedRoles={['principal', 'admin']}>
                      <PrincipalDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </AlertProvider>
          </ConfirmProvider>
        </ViewModeProvider>
      </SchoolProfileProvider>
    </AuthProvider>
  );
}
