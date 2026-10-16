import React from 'react';
import PortalLogin from '../components/PortalLogin';

export default function FacultyLogin({ setView }) {
  return <PortalLogin kind="faculty" setView={setView} />;
}
