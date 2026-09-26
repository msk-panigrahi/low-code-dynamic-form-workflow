import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts';
import {
  Landing, Login, Register,
  Dashboard, FormBuilder, Responses, Analytics, Settings, AuditLogs,
  PublicFormPage, ResponseSuccess,
} from './pages';
import { PrivateRoute } from './context/AuthContext';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Auth Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Public Form Routes - NO sidebar/nav */}
        <Route path="/f/:link_token" element={<PublicFormPage />} />
        <Route path="/submitted" element={<ResponseSuccess />} />

        {/* Protected Routes with MainLayout (Dashboard/Sidebar) */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/form-builder"
          element={
            <PrivateRoute>
              <MainLayout>
                <FormBuilder />
              </MainLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/responses"
          element={
            <PrivateRoute>
              <MainLayout>
                <Responses />
              </MainLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <PrivateRoute>
              <MainLayout>
                <Analytics />
              </MainLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <MainLayout>
                <Settings />
              </MainLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <PrivateRoute>
              <MainLayout>
                <AuditLogs />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* Unknown URLs previously rendered a blank page (no matching route).
            Send them back to the landing page instead. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
