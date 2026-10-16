import React from 'react';
import PortalLogin from '../components/PortalLogin';

export default function StudentLogin({ setView }) {
  return <PortalLogin kind="student" setView={setView} />;
}
