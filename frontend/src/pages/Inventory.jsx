import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export function Inventory() {
  const [items, setItems] = useState([]);
  const [refills, setRefills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add Item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [medicineName, setMedicineName] = useState('');
  const [activeSalt, setActiveSalt] = useState('');
  const [pillsRemaining, setPillsRemaining] = useState(30);
  const [dailyDosage, setDailyDosage] = useState(2);
  const [expiryDate, setExpiryDate] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeSearching, setBarcodeSearching] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState('');

  const fetchCabinet = async () => {
    try {
      setLoading(true);
      const [invRes, refillsRes] = await Promise.allSettled([
        api.getInventory(),
        api.checkRefills(),
      ]);
      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value?.data)) {
        setItems(invRes.value.data);
      }
      if (refillsRes.status === 'fulfilled' && Array.isArray(refillsRes.value?.data)) {
        setRefills(refillsRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCabinet();
  }, []);

  const handleBarcodeLookup = async (codeToLookup) => {
    const code = (codeToLookup || barcodeInput).trim();
    if (!code) return;
    setBarcodeSearching(true);
    setBarcodeMsg('');
    try {
      const res = await api.lookupBarcode(code);
      if (res?.data) {
        setMedicineName(res.data.medicineName || '');
        setActiveSalt(res.data.activeSalt || '');
        if (res.data.pillsRemaining) setPillsRemaining(res.data.pillsRemaining);
        setBarcodeMsg(`✓ Found: ${res.data.medicineName} (${res.data.activeSalt || 'Active salt'})`);
      } else {
        setBarcodeMsg('No exact barcode match in catalog. Please enter details manually.');
      }
    } catch (err) {
      setBarcodeMsg('Catalog lookup failed. Please enter details manually.');
    } finally {
      setBarcodeSearching(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!medicineName) return;

    try {
      await api.addInventory({
        medicineName: medicineName.trim(),
        activeSalt: activeSalt.trim() || undefined,
        pillsRemaining: Number(pillsRemaining),
        dailyDosage: Number(dailyDosage),
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
        batchNumber: batchNumber.trim() || undefined,
        barcode: barcodeInput.trim() || undefined,
      });

      setShowAddForm(false);
      setMedicineName('');
      setActiveSalt('');
      setPillsRemaining(30);
      setDailyDosage(2);
      setExpiryDate('');
      setBatchNumber('');
      setBarcodeInput('');
      setBarcodeMsg('');
      fetchCabinet();
    } catch (err) {
      alert('Failed to save medicine: ' + err.message);
    }
  };

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">HOUSEHOLD APOTHECARY</span>
          <h1>Medicine Cabinet.</h1>
          <p>Track household medicine stocks, expiry dates, and automated 2-day refill warnings with live DB updates.</p>
        </div>
        <button
          className="primary-btn"
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '✕ Close Form' : '＋ Add Medicine to Cabinet'}
        </button>
      </div>

      {/* Refill Alerts Banner */}
      {refills.length > 0 && (
        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #f43f5e',
            borderRadius: '20px',
            padding: '20px 24px',
            marginBottom: '30px',
          }}
        >
          <strong style={{ color: '#be123c', fontSize: '17px', display: 'block', marginBottom: '6px' }}>
            🚨 Urgent Refill Alert: {refills.length} medicine(s) run out in &lt; 48 hours!
          </strong>
          <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
            {refills.map((rf, i) => (
              <div
                key={i}
                style={{
                  background: '#fff',
                  border: '1px solid #fecdd3',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{rf.medicineName}</strong>
                  <span style={{ color: '#881337', fontSize: '13px', marginLeft: '12px' }}>
                    Only {rf.pillsRemaining} pill(s) remaining (Consuming {rf.dailyDosage}/day)
                  </span>
                </div>
                <span style={{ background: '#ffe4e6', color: '#be123c', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 800 }}>
                  Refill Needed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Medicine Drawer / Modal */}
      {showAddForm && (
        <div
          style={{
            background: 'var(--white)',
            border: '1px solid var(--line)',
            borderRadius: '24px',
            padding: '30px',
            marginBottom: '35px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <span className="eyebrow">NEW CABINET SUPPLY</span>
          <h2 style={{ fontFamily: 'Manrope', margin: '6px 0 18px' }}>Register Household Medicine</h2>

          {/* Barcode Quick Lookup */}
          <div style={{ background: '#f8fafc', border: '1px dashed #94a3b8', borderRadius: '16px', padding: '16px', marginBottom: '22px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--plum)', display: 'block', marginBottom: '8px' }}>
              Barcode Quick Catalog Autofill
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan or type barcode (e.g. 8901234567890)"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                }}
              />
              <button
                type="button"
                className="secondary-btn"
                onClick={() => handleBarcodeLookup()}
                disabled={barcodeSearching}
                style={{ padding: '10px 18px', fontSize: '14px' }}
              >
                {barcodeSearching ? 'Searching...' : 'Lookup Barcode 🔍'}
              </button>
            </div>
            {barcodeMsg && (
              <small style={{ display: 'block', marginTop: '6px', color: barcodeMsg.startsWith('✓') ? '#16a34a' : '#b45309', fontWeight: 600 }}>
                {barcodeMsg}
              </small>
            )}
          </div>

          <form onSubmit={handleAddSubmit}>
            <div className="inventory-form-grid">
              <label>
                <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Medicine Brand Name *</span>
                <input
                  type="text"
                  required
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  placeholder="e.g. Augmentin 625 Duo"
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid var(--line)' }}
                />
              </label>

              <label>
                <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Active Salt Composition</span>
                <input
                  type="text"
                  value={activeSalt}
                  onChange={(e) => setActiveSalt(e.target.value)}
                  placeholder="e.g. Amoxicillin + Clavulanic Acid"
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid var(--line)' }}
                />
              </label>

              <label>
                <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Pills / Units Remaining</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={pillsRemaining}
                  onChange={(e) => setPillsRemaining(e.target.value)}
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid var(--line)' }}
                />
              </label>

              <label>
                <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Daily Dosage (Doses/Day)</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={dailyDosage}
                  onChange={(e) => setDailyDosage(e.target.value)}
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid var(--line)' }}
                />
              </label>

              <label>
                <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Expiry Date</span>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid var(--line)' }}
                />
              </label>

              <label>
                <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Batch Number</span>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. BT-9021"
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid var(--line)' }}
                />
              </label>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button className="primary-btn" type="submit">
                Save Medicine to Cabinet ↗
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inventory Grid */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          Loading household supplies...
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⊞</div>
          <h2>Medicine cabinet is empty.</h2>
          <p>Keep track of household medicines, get predictive 2-day refill alerts, and avoid taking expired pills.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' }}>
          {items.map((item) => {
            const daysLeft = item.dailyDosage > 0 ? Math.floor(item.pillsRemaining / item.dailyDosage) : 99;
            const isLow = daysLeft <= 2;
            const expiryStr = item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'Not recorded';

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--white)',
                  border: isLow ? '2px solid #f43f5e' : '1px solid var(--line)',
                  borderRadius: '20px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--plum)', letterSpacing: '1px' }}>
                      {item.batchNumber ? `BATCH: ${item.batchNumber}` : 'MEDICINE'}
                    </span>
                    <span
                      style={{
                        background: isLow ? '#ffe4e6' : 'var(--sage)',
                        color: isLow ? '#be123c' : '#2d5a27',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 800,
                      }}
                    >
                      {daysLeft} days stock
                    </span>
                  </div>

                  <h3 style={{ margin: '8px 0 2px', fontFamily: 'Manrope', fontSize: '19px' }}>
                    {item.medicineName}
                  </h3>
                  {item.activeSalt && (
                    <small style={{ color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                      {item.activeSalt}
                    </small>
                  )}
                </div>

                <div style={{ marginTop: '16px', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--muted)' }}>Pills Remaining:</span>
                    <strong>{item.pillsRemaining} pills</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--muted)' }}>Daily Consumption:</span>
                    <span>{item.dailyDosage} dose/day</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--muted)' }}>Expiry Date:</span>
                    <span style={{ fontWeight: 600 }}>{expiryStr}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
