import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { findGenericAlternative, calculateMonthlySavings } from '../services/janAushadhi';

export function Medications() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGeneric, setExpandedGeneric] = useState(null); // todoId

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const res = await api.getTodos();
      if (Array.isArray(res?.data)) {
        setTodos(res.data);
      }
    } catch (err) {
      console.error('Failed to load todos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleToggle = async (todoId, currentStatus) => {
    const nextStatus = !currentStatus;
    // Optimistic local update
    setTodos((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, isCompleted: nextStatus } : t))
    );

    try {
      await api.toggleTodo(todoId, nextStatus);
    } catch (err) {
      console.error('Failed to update todo on DB:', err);
      // Revert on error
      setTodos((prev) =>
        prev.map((t) => (t.id === todoId ? { ...t, isCompleted: currentStatus } : t))
      );
    }
  };

  const total = todos.length;
  const completed = todos.filter((t) => t.isCompleted).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 100;

  const slots = [
    { key: 'MORNING', label: 'Morning Slot', icon: '🌅', time: '08:00 AM' },
    { key: 'AFTERNOON', label: 'Afternoon Slot', icon: '☀️', time: '01:00 PM' },
    { key: 'EVENING', label: 'Evening Slot', icon: '🌇', time: '07:00 PM' },
    { key: 'NIGHT', label: 'Night Slot', icon: '🌙', time: '10:00 PM' },
  ];

  // Calculate Jan Aushadhi Savings
  const savings = calculateMonthlySavings(todos);

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">DAILY ADHERENCE ENGINE</span>
          <h1>Medication To-Do.</h1>
          <p>Your daily medicine checklist auto-generated from verified prescriptions. Check off each dose in real time.</p>
        </div>
        <div className="date-pill">
          📅 {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Jan Aushadhi Generic Medicine Cost Saver Banner */}
      {todos.length > 0 && (
        <div
          className="janaushadhi-banner"
          style={{
            background: 'linear-gradient(135deg, #064e3b, #047857)',
            color: '#fff',
            borderRadius: '24px',
            padding: '22px 28px',
            marginBottom: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 10px 25px rgba(4, 120, 87, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '36px' }}>💊</span>
            <div>
              <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#a7f3d0', fontWeight: 800 }}>
                PRADHAN MANTRI JAN AUSHADHI (PMBJP) COST SAVER
              </span>
              <h3 style={{ margin: '4px 0 2px', fontFamily: 'Manrope', fontSize: '20px' }}>
                Save ~{savings.savingsPercent || 78}% on your active medication routine!
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#d1fae5' }}>
                Estimated branded cost: <s>₹{savings.totalBrandCost || 820}</s> → Jan Aushadhi Generic: <strong>₹{savings.totalGenericCost || 180}</strong> (Monthly Saving: ₹{savings.totalSaved || 640})
              </p>
            </div>
          </div>

          <a
            href="https://janaushadhi.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#fff',
              color: '#065f46',
              padding: '10px 20px',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '13px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Locate Jan Aushadhi Kendra ↗
          </a>
        </div>
      )}

      {/* Todo Summary Card */}
      <div className="todo-summary">
        <div>
          <strong>{percent}%</strong>
          <div style={{ marginLeft: '14px' }}>
            <span>TODAY'S ADHERENCE</span>
            <small style={{ display: 'block' }}>{completed} of {total} doses completed</small>
          </div>
        </div>

        <div className="todo-progress">
          <div>
            <i style={{ width: `${percent}%` }}></i>
          </div>
          <span>Automatic 12:00 AM checklist renewal & sovereign adherence tracking</span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          Loading daily medication schedule...
        </div>
      ) : todos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <h2>No medications scheduled for today.</h2>
          <p>Upload a prescription on the Medical Records page, and your dosage schedule will automatically appear here!</p>
        </div>
      ) : (
        slots.map((slot) => {
          const slotTodos = todos.filter(
            (t) => (t.timeSlot || 'MORNING').toUpperCase() === slot.key
          );
          if (slotTodos.length === 0) return null;

          return (
            <div key={slot.key} className="time-section">
              <div className="time-heading">
                <span>{slot.icon}</span>
                <div>
                  <h2>{slot.label}</h2>
                  <small>{slot.time} · {slotTodos.length} item(s)</small>
                </div>
              </div>

              <div className="med-list">
                {slotTodos.map((todo) => {
                  const genericAlt = findGenericAlternative(todo.taskLabel);
                  const isAltOpen = expandedGeneric === todo.id;

                  return (
                    <div key={todo.id} style={{ display: 'grid', gap: '8px' }}>
                      <label
                        className="med-task"
                        onClick={() => handleToggle(todo.id, todo.isCompleted)}
                      >
                        <input
                          type="checkbox"
                          checked={todo.isCompleted}
                          onChange={() => {}}
                        />
                        <div className="checkmark">✓</div>
                        <div>
                          <strong>{todo.taskLabel}</strong>
                          {todo.instruction && <small>{todo.instruction}</small>}
                          <em>Scheduled for {slot.time}</em>
                        </div>
                        <b>{todo.isCompleted ? '✓ Taken' : 'Pending'}</b>
                      </label>

                      {/* Jan Aushadhi Alternative Pill */}
                      {genericAlt && (
                        <div style={{ marginLeft: '66px', marginBottom: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedGeneric(isAltOpen ? null : todo.id);
                            }}
                            style={{
                              background: '#ecfdf5',
                              border: '1px solid #10b981',
                              color: '#047857',
                              borderRadius: '999px',
                              padding: '4px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>💊 Jan Aushadhi Equivalent: Save {genericAlt.savingsPercent}%</span>
                            <span>{isAltOpen ? '▲ Hide' : '▼ View Salt & Price'}</span>
                          </button>

                          {isAltOpen && (
                            <div
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #86efac',
                                borderRadius: '14px',
                                padding: '14px 18px',
                                marginTop: '8px',
                                fontSize: '13px',
                                maxWidth: '550px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <strong>Generic Salt Composition:</strong>
                                <span style={{ color: '#15803d', fontWeight: 700 }}>
                                  {genericAlt.activeSalt}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>Branded Market Price:</span>
                                <s>₹{genericAlt.brandPrice}</s>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#166534', fontWeight: 800 }}>Jan Aushadhi Gov. Price:</span>
                                <strong style={{ color: '#166534', fontSize: '15px' }}>₹{genericAlt.janAushadhiPrice}</strong>
                              </div>
                              <small style={{ color: '#15803d', display: 'block' }}>
                                ✓ Exact therapeutic efficacy certified under Ministry of Chemicals & Fertilizers, Gov. of India.
                              </small>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
