import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export function Records() {
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Upload Form state
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState('PRESCRIPTION');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [userNote, setUserNote] = useState('');
  const [isOngoing, setIsOngoing] = useState(true);

  const fetchRecords = async (currentFilter = filter) => {
    try {
      setLoading(true);
      const res = await api.listRecords(currentFilter);
      if (Array.isArray(res?.data)) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(filter);
  }, [filter]);

  const handleFilterChange = (type) => {
    setFilter(type);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadMsg('Encrypting and sending to sovereign vault...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docType);
      formData.append('eventDate', eventDate);
      formData.append('note', userNote);
      formData.append('isMedicineStillNeeded', String(isOngoing));

      const res = await api.uploadRecord(formData);
      const recordId = res?.data?.record?.id;

      if (recordId) {
        setUploadMsg('Analyzing clinical documents with Mistral AI...');
        // Poll status up to 8 times
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await api.getRecordStatus(recordId);
            const status = statusRes?.data?.processingStatus || statusRes?.data?.status;
            if (status === 'COMPLETED' || attempts > 8) {
              clearInterval(interval);
              setUploading(false);
              setUploadMsg('✓ Record processed and added to timeline.');
              setFile(null);
              setUserNote('');
              fetchRecords();
              setTimeout(() => setUploadMsg(''), 4000);
            }
          } catch {
            clearInterval(interval);
            setUploading(false);
            fetchRecords();
          }
        }, 2000);
      } else {
        setUploading(false);
        setUploadMsg('✓ Document uploaded successfully.');
        setFile(null);
        fetchRecords();
        setTimeout(() => setUploadMsg(''), 4000);
      }
    } catch (err) {
      setUploading(false);
      setUploadError(err.message || 'Upload failed.');
    }
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Are you sure you want to permanently delete this medical record? This action cascades to delete associated timeline events.')) {
      return;
    }
    try {
      await api.deleteRecord(recordId);
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const getRecordIcon = (type) => {
    switch (type) {
      case 'PRESCRIPTION':
        return { className: 'prescription-icon', icon: 'Rx' };
      case 'LAB_REPORT':
      case 'REPORT':
        return { className: 'report-icon', icon: 'Lab' };
      case 'SCAN':
      case 'IMAGING':
        return { className: 'scan-icon', icon: 'Scan' };
      default:
        return { className: 'prescription-icon', icon: 'Doc' };
    }
  };

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">SOVEREIGN HEALTH VAULT</span>
          <h1>Medical Records.</h1>
          <p>Review verified prescriptions, diagnostic lab investigations, and digital imaging records.</p>
        </div>
      </div>

      {/* Upload Drop Zone & Card */}
      <div className="upload-card" style={{ marginBottom: '40px' }}>
        <div className="drop-zone">
          <div className="upload-symbol">⬆</div>
          <h2>Upload Medical Record</h2>
          <p>Prescriptions, lab reports, discharge summaries or doctor notes</p>
          <small>Supported: PDF, PNG, JPG, JPEG (Max 25 MB)</small>

          <label className="primary-btn upload-label" style={{ cursor: 'pointer', display: 'inline-block' }}>
            <span>{file ? file.name : 'Choose Document File 📁'}</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                if (e.target.files?.[0]) setFile(e.target.files[0]);
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <form className="upload-form" onSubmit={handleUploadSubmit}>
          <label>
            <span>Document Type</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="PRESCRIPTION">Prescription</option>
              <option value="LAB_REPORT">Laboratory / Diagnostic Report</option>
              <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
              <option value="SCAN">Imaging / Radiology Scan</option>
              <option value="OTHER">Other Clinical Document</option>
            </select>
          </label>

          <label>
            <span>Consultation / Event Date</span>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Notes or Doctor Remarks (Optional)</span>
            <textarea
              rows="2"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="e.g. Prescribed by Dr. Mehta for seasonal bronchitis"
            />
          </label>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isOngoing}
                onChange={(e) => setIsOngoing(e.target.checked)}
                style={{ width: 'auto', margin: 0 }}
              />
              <span style={{ fontSize: '13px' }}>Is this an active / ongoing prescription course?</span>
            </label>
          </div>

          {uploadError && (
            <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '10px' }}>
              {uploadError}
            </div>
          )}

          {uploadMsg && (
            <div style={{ color: '#16a34a', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              {uploadMsg}
            </div>
          )}

          <button className="primary-btn" type="submit" disabled={uploading} style={{ width: '100%' }}>
            {uploading ? 'Processing with Mistral AI...' : 'Securely Upload to Vault ↗'}
          </button>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="filter-bar">
        <button
          type="button"
          className={`filter ${filter === '' ? 'active' : ''}`}
          onClick={() => handleFilterChange('')}
        >
          All Records ({records.length})
        </button>
        <button
          type="button"
          className={`filter ${filter === 'PRESCRIPTION' ? 'active' : ''}`}
          onClick={() => handleFilterChange('PRESCRIPTION')}
        >
          Prescriptions
        </button>
        <button
          type="button"
          className={`filter ${filter === 'LAB_REPORT' ? 'active' : ''}`}
          onClick={() => handleFilterChange('LAB_REPORT')}
        >
          Lab Reports
        </button>
        <button
          type="button"
          className={`filter ${filter === 'SCAN' ? 'active' : ''}`}
          onClick={() => handleFilterChange('SCAN')}
        >
          Scans & Imaging
        </button>
      </div>

      {/* Records List */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          Loading records from live vault...
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h2>No records found.</h2>
          <p>Upload a paper prescription or diagnostic test above to start building your chronological timeline.</p>
        </div>
      ) : (
        <div className="records-list">
          {records.map((rec) => {
            const { className, icon } = getRecordIcon(rec.documentType);
            const dateStr = rec.timelineEvent?.eventDateDdmmyyyy
              ? `${rec.timelineEvent.eventDateDdmmyyyy.slice(0, 2)}/${rec.timelineEvent.eventDateDdmmyyyy.slice(2, 4)}/${rec.timelineEvent.eventDateDdmmyyyy.slice(4)}`
              : new Date(rec.uploadedAt).toLocaleDateString();

            const doctorName = rec.timelineEvent?.doctorName || 'Attending Physician';
            const diagnoses = rec.timelineEvent?.diagnoses || [];

            return (
              <article key={rec.id} className="record-card">
                <div className={`record-icon ${className}`}>{icon}</div>
                <div className="record-main">
                  <div>
                    <span className="record-type">{rec.documentType} · {dateStr}</span>
                    <h3>{rec.originalFilename || 'Medical Record'}</h3>
                    <p>
                      {doctorName}
                      {diagnoses.length > 0 && ` • Diagnoses: ${diagnoses.join(', ')}`}
                      {rec.userNote && ` • Note: ${rec.userNote}`}
                    </p>
                    {rec.processingStatus === 'PROCESSING' && (
                      <small style={{ color: '#d97706', fontWeight: 700 }}>
                        ⏳ AI Document Intelligence Processing...
                      </small>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <a
                      href={api.getRecordViewUrl(rec.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-btn"
                    >
                      View Record ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(rec.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #fca5a5',
                        color: '#dc2626',
                        borderRadius: '11px',
                        padding: '9px 14px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
