import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import useTranslation from '../hooks/useTranslation.js';
import useAlert from '../hooks/useAlert.js';
import { saveTeacherPanelData } from '../firebase/firestoreSchema.js';
import { sortClasses } from '../utils/schoolResolver.js';
import PrintContainer from './PrintContainer.jsx';

// ==========================================
// Design tokens
// ==========================================
const TOKENS = {
  ink: '#1C2333',
  indigo: '#1E2A4A',
  indigoDeep: '#141B30',
  marigold: '#E3A23C',
  marigoldDeep: '#B97E24',
  forest: '#2F6B4F',
  forestDeep: '#1F4E38',
  rose: '#C4483D',
  parchment: '#FAF7F0',
  paper: '#FFFFFF',
  line: '#E4DFD3',
  muted: '#8A8478',
};

// ==========================================
// Shared scoped styles
// ==========================================
const ROUTINE_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Tiro+Bangla:ital@0;1&family=Hind+Siliguri:wght@400;500;600;700&display=swap');

.routine-root, .routine-root * { font-family: 'Hind Siliguri', 'Noto Sans Bengali', sans-serif; box-sizing: border-box; }
.routine-display { font-family: 'Tiro Bangla', 'Noto Serif Bengali', serif; }

.routine-fade { animation: routineFade 0.35s ease; }
@keyframes routineFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.routine-class-card { transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease; }
.routine-class-card:hover { box-shadow: 0 10px 24px -8px rgba(30,42,74,0.25); transform: translateY(-3px); border-color: ${TOKENS.marigold} !important; }

.routine-slot-cell { position: relative; }
.routine-slot-cell:hover { background: #FBF3E4 !important; }

.routine-input { transition: background 0.15s ease, box-shadow 0.15s ease; border-radius: 4px; opacity: 1; display: block; width: 100%; }
.routine-input:focus { background: #FFFDF7 !important; box-shadow: inset 0 0 0 1.5px ${TOKENS.marigold}; }

.routine-backbtn:hover { background: ${TOKENS.parchment}; border-color: ${TOKENS.indigo} !important; }
.routine-tab:hover { filter: brightness(0.97); }
.routine-savebtn:hover { background: ${TOKENS.indigoDeep} !important; }
.routine-toolbtn:hover { filter: brightness(0.95); transform: translateY(-1px); }

.routine-select { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.routine-select:focus { outline: none; border-color: ${TOKENS.indigo} !important; box-shadow: 0 0 0 3px rgba(30,42,74,0.12); }

.routine-tiffin-col {
  background: repeating-linear-gradient(135deg, #F3E3C4, #F3E3C4 6px, #EAD6A8 6px, #EAD6A8 12px);
  text-align: center;
}

@media (max-width: 768px) {
  .routine-main-container { padding: 10px !important; }
  .routine-header { flex-direction: column; align-items: flex-start !important; gap: 14px; padding: 16px !important; }
  .routine-header h2 { font-size: 21px !important; }
  .routine-tab-container { width: 100%; justify-content: space-between; }
  .routine-tab { flex: 1; text-align: center; padding: 9px 10px !important; font-size: 13px !important; }
  .routine-fade { width: 100%; }
  .routine-selector-row { flex-direction: column; align-items: flex-start !important; gap: 8px; }
  .routine-selector-row select { width: 100%; }
  .routine-table-container table { font-size: 11.5px !important; min-width: 640px !important; }
  .routine-table-container th, .routine-table-container td { padding: 5px 3px !important; }
  .routine-table-container input { font-size: 11.5px !important; }
}

@media print {
  @page { size: A4 landscape; margin: 10mm; }

  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }

  body { background: #fff !important; }
  .routine-print-hide { display: none !important; }

  .routine-main-container { background: #fff !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; min-height: 0 !important; }

  .routine-header { background: #fff !important; box-shadow: none !important; border-radius: 0 !important; border-bottom: 2px solid ${TOKENS.indigo} !important; padding: 0 0 10px 0 !important; margin-bottom: 14px !important; }
  .routine-header h2, .routine-header div { color: ${TOKENS.ink} !important; }

  .routine-print-only-hide { display: none !important; }

  .routine-table-container { box-shadow: none !important; padding: 0 !important; border: none !important; overflow: visible !important; width: 100% !important; }
  .routine-table-container table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; font-size: 12px !important; page-break-inside: avoid; }
  .routine-table-container th, .routine-table-container td { padding: 6px 4px !important; word-break: break-word; }
  .routine-table-container tr { page-break-inside: avoid; }
  .routine-table-container input { border: none !important; background: transparent !important; outline: none !important; }
}
`;

// --- Shared Constants ---
const DEFAULT_TIME_SLOTS = [
  "৯:০০-৯:৫০", "৯:৫০-১০:৩৫", "১০:৩৫-১১:২০",
  "১১:২০-১২:০৫", "১২:০৫-১২:৫০", "১:৩০-২:১০", "২:১০-২:৫০"
];

// Static day keys in Bangla for database consistency across language switches
const STATIC_DAYS_BN = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];

// Fallback sample data
const SAMPLE_CLASSES = [
  {
    id: 'c6', className: 'ষষ্ঠ শ্রেণী',
    groups: [
      {
        id: 'c6-ka', name: 'ক', gridRoutine: {
          'রবিবার': [{ subject: 'বাংলা', bg: '#DCFCE7' }, { subject: 'ইংরেজি', bg: '#DCFCE7' }, { subject: 'গণিত', bg: '#DCFCE7' }, null, { subject: 'বিজ্ঞান', bg: '#DCFCE7' }, { subject: 'ধর্ম', bg: '#DCFCE7' }, null],
        }
      },
      { id: 'c6-kha', name: 'খ', gridRoutine: {} },
    ],
  },
  {
    id: 'c7', className: 'সপ্তম শ্রেণী',
    groups: [
      { id: 'c7-ka', name: 'ক', gridRoutine: {} },
      { id: 'c7-kha', name: 'খ', gridRoutine: {} },
    ],
  },
  {
    id: 'c8', className: 'অষ্টম শ্রেণী',
    groups: [
      { id: 'c8-ka', name: 'ক', gridRoutine: {} },
    ],
  },
];

const SAMPLE_TEACHERS = [{ name: 'রহিমা বেগম' }, { name: 'কামাল হোসেন' }, { name: 'সুমাইয়া আক্তার' }];

const SAMPLE_TEACHER_ROUTINES = {
  'রহিমা বেগম': {
    'রবিবার': [
      { class: 'ষষ্ঠ-ক', subject: 'বাংলা', bg: '#CFFAFE' },
      { class: 'সপ্তম-খ', subject: 'বাংলা', bg: '#CFFAFE' },
      null, null,
      { class: 'অষ্টম-ক', subject: 'বাংলা', bg: '#CFFAFE' },
      null, null,
    ],
    'মঙ্গলবার': [null, { class: 'ষষ্ঠ-ক', subject: 'বাংলা', bg: '#CFFAFE' }, null, null, null, null, null],
  },
};

const normalizeGroups = (cls, classId) => {
  const rawGroups = Array.isArray(cls.groups) ? cls.groups.filter(Boolean) : [];

  if (rawGroups.length > 0) {
    return rawGroups.map((g, i) => {
      if (typeof g === 'string') {
        return { id: `${classId}-grp-${i}`, name: g, gridRoutine: {} };
      }
      const name = g.name || g.section || g.label || `গ্রুপ ${i + 1}`;
      const id = g.id || `${classId}-grp-${i}`;
      const gridRoutine = g.gridRoutine && typeof g.gridRoutine === 'object' ? g.gridRoutine : {};
      return { id: String(id), name: String(name), gridRoutine };
    });
  }

  const legacyName = cls.section || cls.group || 'গ্রুপ ১';
  const legacyRoutine = cls.gridRoutine && typeof cls.gridRoutine === 'object' ? cls.gridRoutine : {};
  return [{ id: `${classId}-default`, name: String(legacyName), gridRoutine: legacyRoutine }];
};

const normalizeClasses = (classes = []) => {
  if (!Array.isArray(classes)) return [];

  return sortClasses(
    classes
      .filter(Boolean)
      .map((cls, index) => {
        const className = cls.className || cls.name || cls.label || `Class ${index + 1}`;
        const classId = String(cls.id || cls.classId || cls.className || cls.name || `class-${index + 1}`);

        return {
          id: classId,
          name: String(className),
          groups: normalizeGroups(cls, classId),
          raw: cls,
        };
      }),
    'name'
  );
};

const resolveTimeSlots = (timeSlots) =>
  Array.isArray(timeSlots) && timeSlots.length > 0 ? timeSlots : DEFAULT_TIME_SLOTS;

const TIFFIN_AFTER_INDEX = 5;

// Helper to check if any routine cell has non-empty data
const hasAnyRoutineData = (classesList, routinesMap) => {
  if (Array.isArray(classesList)) {
    for (const cls of classesList) {
      if (!cls) continue;
      const groups = Array.isArray(cls.groups) ? cls.groups : [];
      for (const group of groups) {
        const grid = group?.gridRoutine;
        if (grid && typeof grid === 'object') {
          for (const day of Object.keys(grid)) {
            const slots = grid[day];
            if (Array.isArray(slots)) {
              for (const slot of slots) {
                if (slot && typeof slot === 'object') {
                  if ((slot.subject && String(slot.subject).trim() !== '') || (slot.class && String(slot.class).trim() !== '')) {
                    return true;
                  }
                }
              }
            }
          }
        }
      }
      const topGrid = cls.gridRoutine;
      if (topGrid && typeof topGrid === 'object') {
        for (const day of Object.keys(topGrid)) {
          const slots = topGrid[day];
          if (Array.isArray(slots)) {
            for (const slot of slots) {
              if (slot && typeof slot === 'object') {
                if ((slot.subject && String(slot.subject).trim() !== '') || (slot.class && String(slot.class).trim() !== '')) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }

  if (routinesMap && typeof routinesMap === 'object') {
    for (const teacherKey of Object.keys(routinesMap)) {
      const teacherRoutine = routinesMap[teacherKey];
      if (teacherRoutine && typeof teacherRoutine === 'object') {
        for (const day of Object.keys(teacherRoutine)) {
          const slots = teacherRoutine[day];
          if (Array.isArray(slots)) {
            for (const slot of slots) {
              if (slot && typeof slot === 'object') {
                if ((slot.subject && String(slot.subject).trim() !== '') || (slot.class && String(slot.class).trim() !== '')) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }

  return false;
};

// ==========================================
// 1. RoutineTable (Reusable table renderer)
// ==========================================
export const RoutineTable = ({
  days = STATIC_DAYS_BN,
  displayDays,
  getSlot,
  renderCell,
  timeSlots = DEFAULT_TIME_SLOTS,
  tiffinLabel = 'টিফিন',
  timeDayLabel = 'সময় / বার',
  noDataMsg,
  renderErrMsg,
}) => {
  const labels = Array.isArray(displayDays) && displayDays.length === days.length
    ? displayDays
    : days;

  if (!Array.isArray(days) || days.length === 0 || !timeSlots || timeSlots.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: TOKENS.rose }}>
        {noDataMsg || '⚠️ রুটিন তথ্য লোড করা যায়নি।'}
      </div>
    );
  }

  if (typeof getSlot !== 'function' || typeof renderCell !== 'function') {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: TOKENS.rose }}>
        {renderErrMsg || '⚠️ রুটিন রেন্ডার করতে সমস্যা হয়েছে।'}
      </div>
    );
  }

  const tiffinPos = timeSlots.length > TIFFIN_AFTER_INDEX ? TIFFIN_AFTER_INDEX : -1;
  const tiffinChars = [...tiffinLabel];

  const tiffinCell = (keyPrefix) => (
    <td
      key={`${keyPrefix}-tiffin`}
      className="routine-tiffin-col"
      style={{ borderRight: `1px solid ${TOKENS.line}`, width: 34, padding: 4, verticalAlign: 'middle', color: TOKENS.marigoldDeep, fontWeight: 700, fontSize: 13 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.15 }}>
        {tiffinChars.map((ch, i) => <span key={i}>{ch}</span>)}
      </div>
    </td>
  );

  return (
    <PrintContainer
      title="Class Weekly Routine Schedule"
      orientation="landscape"
      singlePageFit={true}
      showTriggerButton={false}
      signatures={['Routine Incharge', 'Class Teacher', 'Principal / Headmaster']}
    >
      <div className="routine-table-container print-table-container" style={{ width: '100%', overflowX: 'auto', background: TOKENS.paper, padding: 10, borderRadius: 12, boxShadow: '0 1px 2px rgba(28,35,51,0.06)', border: `1px solid ${TOKENS.line}` }}>
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'center', fontSize: 14, minWidth: 760 }}>
          <thead>
            <tr style={{ background: TOKENS.indigo }}>
              <th style={{ borderRight: `1px solid ${TOKENS.indigoDeep}`, borderBottom: `2px solid ${TOKENS.marigold}`, padding: '12px 8px', fontWeight: 700, width: 104, color: '#fff', letterSpacing: 0.2 }}>{timeDayLabel}</th>
              {timeSlots.map((time, idx) => (
                <React.Fragment key={`header-${idx}`}>
                  {idx === tiffinPos && (
                    <th
                      className="routine-tiffin-col"
                      style={{ borderRight: `1px solid ${TOKENS.line}`, borderBottom: `2px solid ${TOKENS.marigold}`, width: 34, fontWeight: 700, fontSize: 13, padding: 4, verticalAlign: 'middle', color: TOKENS.marigoldDeep }}
                    >
                      {tiffinLabel}
                    </th>
                  )}
                  <th style={{ borderRight: `1px solid ${TOKENS.indigoDeep}`, borderBottom: `2px solid ${TOKENS.marigold}`, padding: '12px 6px', fontWeight: 600, color: '#fff', fontSize: 13 }}>
                    {String(time || '')}
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, dayIdx) => (
              <tr key={`row-${day}`} style={{ borderBottom: `1px solid ${TOKENS.line}`, background: dayIdx % 2 === 1 ? '#FBF9F4' : TOKENS.paper }}>
                <td style={{ borderRight: `1px solid ${TOKENS.line}`, fontWeight: 700, background: TOKENS.parchment, padding: '10px 6px', color: TOKENS.indigo }}>{labels[dayIdx]}</td>
                {timeSlots.map((_, idx) => {
                  const rendered = (() => {
                    try {
                      const slot = getSlot(day, idx);
                      const cell = renderCell(day, idx, slot);
                      return (
                        <td
                          key={`cell-${day}-${idx}`}
                          className="routine-slot-cell"
                          style={{ borderRight: `1px solid ${TOKENS.line}`, padding: 6, minHeight: 54, background: (slot && slot.bg) || 'transparent' }}
                        >
                          {cell}
                        </td>
                      );
                    } catch (e) {
                      console.error(`Error rendering cell for ${day} at index ${idx}:`, e);
                      return (
                        <td
                          key={`cell-${day}-${idx}`}
                          style={{ borderRight: `1px solid ${TOKENS.line}`, padding: 6, background: '#FBE4E1', textAlign: 'center', color: TOKENS.rose, fontSize: 10 }}
                        >
                          ⚠️
                        </td>
                      );
                    }
                  })();

                  return (
                    <React.Fragment key={`frag-${day}-${idx}`}>
                      {idx === tiffinPos && tiffinCell(`${day}-${idx}`)}
                      {rendered}
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintContainer>
  );
};

// ==========================================
// 2. TeacherRoutineReadOnly (Read-only teacher view)
// ==========================================
export const TeacherRoutineReadOnly = ({ routine = {}, teacherName, timeSlots = DEFAULT_TIME_SLOTS }) => {
  const safeTimeSlots = useMemo(() => resolveTimeSlots(timeSlots), [timeSlots]);
  const { t } = useTranslation();
  const displayDays = t('routine.days');

  if (!routine || typeof routine !== 'object') {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: TOKENS.muted, fontSize: 14 }}>
        📅 {t('routine.noData')}
      </div>
    );
  }

  const hasAnySlot = STATIC_DAYS_BN.some(day => {
    const dayData = routine[day];
    if (!Array.isArray(dayData)) return false;
    return dayData.some((slot) => slot && (slot.class || slot.subject));
  });

  if (!hasAnySlot) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: TOKENS.muted, fontSize: 14 }}>
        📅 {t('routine.noData')}
      </div>
    );
  }

  return (
    <div className="routine-root routine-fade">
      <style>{ROUTINE_STYLES}</style>
      <RoutineTable
        days={STATIC_DAYS_BN}
        displayDays={displayDays}
        tiffinLabel={t('routine.tiffin')}
        timeDayLabel={t('routine.timeDay')}
        noDataMsg={t('routine.noData')}
        renderErrMsg={t('routine.renderErr')}
        timeSlots={safeTimeSlots}
        getSlot={(day, idx) => {
          const dayData = routine[day];
          if (!Array.isArray(dayData) || idx < 0 || idx >= dayData.length) return null;
          return dayData[idx];
        }}
        renderCell={(day, idx, slot) => {
          const safeSlot = slot && typeof slot === 'object' ? slot : null;
          return safeSlot && (safeSlot.class || safeSlot.subject) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 2px' }}>
              {safeSlot.class && <span style={{ fontWeight: 700, fontSize: 12, color: TOKENS.indigo }}>{safeSlot.class}</span>}
              {safeSlot.subject && <span style={{ fontSize: 11, color: '#4B5563' }}>{safeSlot.subject}</span>}
            </div>
          ) : (
            <span style={{ color: '#DCD6C8', fontSize: 10 }}>—</span>
          );
        }}
      />
    </div>
  );
};

// ==========================================
// 3. TeacherRoutine (Editable teacher view)
// ==========================================
export const TeacherRoutine = ({ teacherName, routine = {}, onUpdate, readOnly = false, timeSlots = DEFAULT_TIME_SLOTS }) => {
  const safeTimeSlots = useMemo(() => resolveTimeSlots(timeSlots), [timeSlots]);
  const { t } = useTranslation();
  const displayDays = t('routine.days');

  if (!teacherName || typeof teacherName !== 'string') {
    return <div style={{ padding: 20, color: TOKENS.rose, textAlign: 'center' }}>⚠️ শিক্ষক তথ্য অনুপলব্ধ</div>;
  }

  const handleUpdate = useCallback((day, slotIndex, field, value) => {
    if (readOnly || slotIndex < 0 || slotIndex >= safeTimeSlots.length) return;

    const existingDayData = routine && Array.isArray(routine[day]) ? routine[day] : [];
    const dayData = Array(safeTimeSlots.length).fill(null).map((_, i) => {
      if (existingDayData[i]) {
        return { ...existingDayData[i] };
      }
      return { class: '', subject: '', bg: '#EAF4FE' };
    });

    if (!dayData[slotIndex]) {
      dayData[slotIndex] = { class: '', subject: '', bg: '#EAF4FE' };
    }
    dayData[slotIndex][field] = String(value || '');

    if (onUpdate) {
      onUpdate({ ...(routine || {}), [day]: dayData });
    }
  }, [routine, onUpdate, readOnly, safeTimeSlots]);

  return (
    <div className="routine-fade printable-area">
      <div style={{ marginBottom: 18, background: '#EAF4FE', padding: '14px 16px', borderRadius: 10, border: `1px solid #C7DEF7`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: TOKENS.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👨‍🏫</div>
        <div style={{ flex: 1 }}>
          <h3 className="routine-display" style={{ fontWeight: 700, color: TOKENS.indigo, fontSize: 18, margin: 0 }}>{teacherName}</h3>
          <p style={{ fontSize: 13.5, color: '#3B5B85', margin: '2px 0 0' }}>{readOnly ? 'শিক্ষকের জন্য ক্লাস এবং বিষয় দেখুন।' : 'এখানে শিক্ষকের জন্য ক্লাস এবং বিষয় নির্ধারণ করুন।'}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="routine-toolbtn routine-print-hide"
          style={{ background: TOKENS.indigo, color: '#fff', border: 0, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        >
          🖨️ প্রিন্ট করুন
        </button>
      </div>

      <RoutineTable
        days={STATIC_DAYS_BN}
        displayDays={displayDays}
        tiffinLabel={t('routine.tiffin')}
        timeDayLabel={t('routine.timeDay')}
        noDataMsg={t('routine.noData')}
        renderErrMsg={t('routine.renderErr')}
        timeSlots={safeTimeSlots}
        getSlot={(day, idx) => {
          const dayData = routine && Array.isArray(routine[day]) ? routine[day] : null;
          if (!dayData || idx < 0 || idx >= dayData.length) return null;
          return dayData[idx];
        }}
        renderCell={(day, idx, slot) => {
          const safeSlot = slot && typeof slot === 'object' ? slot : null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', height: '100%' }}>
              <input
                type="text"
                value={safeSlot?.class || ''}
                onChange={(e) => handleUpdate(day, idx, 'class', e.target.value)}
                disabled={readOnly}
                className="routine-input"
                style={{ background: 'transparent', textAlign: 'center', fontWeight: 700, fontSize: 12.5, width: '100%', border: 0, outline: 'none', color: TOKENS.indigo, padding: '3px 2px' }}
                placeholder={readOnly ? '' : 'শ্রেণী'}
              />
              <input
                type="text"
                value={safeSlot?.subject || ''}
                onChange={(e) => handleUpdate(day, idx, 'subject', e.target.value)}
                disabled={readOnly}
                className="routine-input"
                style={{ background: 'transparent', textAlign: 'center', fontSize: 13.5, width: '100%', border: 0, outline: 'none', color: TOKENS.ink, padding: '3px 2px' }}
                placeholder={readOnly ? '' : 'বিষয়'}
              />
            </div>
          );
        }}
      />
    </div>
  );
};

// ==========================================
// 4. ClassRoutineManager (Class/Group routine editor)
// ==========================================
export const ClassRoutineManager = ({
  classes = [],
  readOnly = false,
  onSaveClassRoutine,
  onAddClassGroup,
  onDeleteClassGroup,
  onAddClass,
  onDeleteClass,
  timeSlots = DEFAULT_TIME_SLOTS,
  user: userProp,
  onSelectedClassChange,
}) => {
  const { user: authUser } = useAuth();
  const user = userProp || authUser;
  const isAdmin = user?.role === 'admin';
  const safeTimeSlots = useMemo(() => resolveTimeSlots(timeSlots), [timeSlots]);
  const { t } = useTranslation();
  const displayDays = t('routine.days');
  const classList = useMemo(() => normalizeClasses(classes), [classes]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const selectedClass = useMemo(() => {
    return classList.find((cls) => cls.id === selectedClassId) || null;
  }, [classList, selectedClassId]);

  useEffect(() => {
    if (onSelectedClassChange) {
      onSelectedClassChange(selectedClass);
    }
  }, [selectedClass, onSelectedClassChange]);

  const selectedGroup = useMemo(() => {
    if (!selectedClass) return null;
    return selectedClass.groups.find((g) => g.id === selectedGroupId) || null;
  }, [selectedClass, selectedGroupId]);

  const effectiveReadOnly = useMemo(() => {
    return readOnly;
  }, [readOnly]);

  const handleUpdate = useCallback((classId, groupId, day, slotIndex, value) => {
    if (effectiveReadOnly || slotIndex < 0 || slotIndex >= safeTimeSlots.length) return;
    if (!classId || !groupId) return;

    const currentClass = classList.find(c => c.id === classId);
    const currentGroup = currentClass?.groups?.find(g => g.id === groupId);
    if (!currentGroup) return;

    const currentGroupRoutine = currentGroup.gridRoutine || {};
    const existingDayData = (currentGroupRoutine && Array.isArray(currentGroupRoutine[day]))
      ? currentGroupRoutine[day]
      : [];

    const dayData = Array(safeTimeSlots.length).fill(null).map((_, i) => {
      if (existingDayData[i]) {
        return { ...existingDayData[i] };
      }
      return { subject: '', bg: '#EAF7EF' };
    });

    if (!dayData[slotIndex]) {
      dayData[slotIndex] = { subject: '', bg: '#EAF7EF' };
    }
    dayData[slotIndex].subject = String(value || '');

    const updatedRoutine = { ...currentGroupRoutine, [day]: dayData };

    if (onSaveClassRoutine) {
      onSaveClassRoutine(classId, groupId, updatedRoutine);
    }
  }, [classList, effectiveReadOnly, safeTimeSlots, onSaveClassRoutine]);

  const handleAddGroup = useCallback(() => {
    if (effectiveReadOnly) return;
    const name = newGroupName.trim();
    if (!name || !selectedClassId) return;
    if (onAddClassGroup) onAddClassGroup(selectedClassId, name);
    setNewGroupName('');
    setShowAddGroup(false);
  }, [newGroupName, selectedClassId, onAddClassGroup, effectiveReadOnly]);

  const handleDeleteGroup = useCallback((groupId, groupName) => {
    if (effectiveReadOnly) return;
    if (!selectedClassId) return;
    const ok = window.confirm(`"${groupName}" গ্রুপটি মুছে ফেলতে চান? এই গ্রুপের পুরো রুটিন মুছে যাবে।`);
    if (!ok) return;
    if (onDeleteClassGroup) onDeleteClassGroup(selectedClassId, groupId);
    if (selectedGroupId === groupId) setSelectedGroupId(null);
  }, [selectedClassId, selectedGroupId, onDeleteClassGroup, effectiveReadOnly]);

  const handleAddClass = useCallback(() => {
    if (!isAdmin) return;
    const name = newClassName.trim();
    if (!name) return;
    if (onAddClass) onAddClass(name);
    setNewClassName('');
    setShowAddClass(false);
  }, [newClassName, onAddClass, isAdmin]);

  const handleDeleteClass = useCallback((classId, className) => {
    if (!isAdmin) return;
    const ok = window.confirm(`"${className}" ক্লাসটি মুছে ফেলতে চান? এই ক্লাসের সব গ্রুপ ও রুটিন মুছে যাবে।`);
    if (!ok) return;
    if (onDeleteClass) onDeleteClass(classId);
    if (selectedClassId === classId) { setSelectedClassId(null); setSelectedGroupId(null); }
  }, [selectedClassId, onDeleteClass, isAdmin]);

  // Step 1: select class
  if (!selectedClass) {
    return (
      <div className="routine-fade">
        <div style={{ marginBottom: 18, background: '#EAF7EF', padding: '14px 16px', borderRadius: 10, border: `1px solid #BFE4CE`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: TOKENS.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏫</div>
          <div>
            <h3 className="routine-display" style={{ fontWeight: 700, color: TOKENS.forestDeep, fontSize: 18, margin: 0 }}>শ্রেণী নির্বাচন করুন</h3>
            <p style={{ fontSize: 13.5, color: '#2E6B4A', margin: '2px 0 0' }}>রুটিন দেখতে বা পরিবর্তন করতে নিচে থেকে যেকোনো একটি ক্লাসে ক্লিক করুন, অথবা নতুন ক্লাস যোগ করুন।</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {classList.map((cls) => (
            <div
              key={`class-${cls.id}`}
              className="routine-class-card"
              style={{ position: 'relative', background: TOKENS.paper, padding: 22, borderRadius: 12, border: `1px solid ${TOKENS.line}`, textAlign: 'center' }}
            >
              {!readOnly && isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id, cls.name); }}
                  title="ক্লাস মুছুন"
                  style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 8, border: `1px solid #F3C4BE`, background: '#FBE4E1', color: TOKENS.rose, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  🗑️
                </button>
              )}
              <div onClick={() => { setSelectedClassId(cls.id); setSelectedGroupId(null); }} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>📚</div>
                <h4 className="routine-display" style={{ fontWeight: 700, color: TOKENS.ink, fontSize: 18, margin: 0 }}>{cls.name}</h4>
                <p style={{ fontSize: 13.5, color: TOKENS.muted, marginTop: 4 }}>
                  {cls.groups.length} টি গ্রুপ: {cls.groups.map(g => g.name).join(', ')}
                </p>
                <button style={{ marginTop: 16, fontSize: 12, fontWeight: 700, background: '#EAF7EF', color: TOKENS.forestDeep, padding: '7px 14px', borderRadius: 999, border: '1px solid #BFE4CE' }}>
                  গ্রুপ দেখুন ➔
                </button>
              </div>
            </div>
          ))}

          {!readOnly && isAdmin && (
            showAddClass ? (
              <div style={{ background: TOKENS.paper, padding: 20, borderRadius: 12, border: `1px dashed ${TOKENS.forest}`, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: TOKENS.muted }}>নতুন ক্লাসের নাম</label>
                <input
                  type="text"
                  autoFocus
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddClass(); if (e.key === 'Escape') { setShowAddClass(false); setNewClassName(''); } }}
                  placeholder="যেমন: নবম শ্রেণী"
                  className="routine-select"
                  style={{ padding: '9px 10px', border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontSize: 14, outline: 'none', textAlign: 'center' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setShowAddClass(false); setNewClassName(''); }}
                    style={{ flex: 1, background: TOKENS.parchment, color: TOKENS.ink, padding: '8px 0', borderRadius: 8, border: `1px solid ${TOKENS.line}`, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleAddClass}
                    className="routine-savebtn"
                    style={{ flex: 1, background: TOKENS.forest, color: '#fff', padding: '8px 0', borderRadius: 8, border: 0, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                  >
                    যোগ করুন
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setShowAddClass(true)}
                className="routine-class-card"
                style={{ background: 'transparent', padding: 20, borderRadius: 12, border: `1.5px dashed ${TOKENS.forest}`, cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: TOKENS.forestDeep, minHeight: 150 }}
              >
                <div style={{ fontSize: 26, marginBottom: 8 }}>➕</div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>নতুন ক্লাস যোগ করুন</span>
              </div>
            )
          )}
        </div>

        {classList.length === 0 && !showAddClass && (
          <div style={{ marginTop: 16, borderRadius: 10, border: `1px dashed ${TOKENS.line}`, background: TOKENS.paper, padding: 28, textAlign: 'center', fontSize: 14, color: TOKENS.muted }}>
            কোনো ক্লাস পাওয়া যায়নি। উপরে থেকে একটি ক্লাস যোগ করুন।
          </div>
        )}
      </div>
    );
  }

  // Step 2: select group
  if (!selectedGroup) {
    return (
      <div className="routine-fade">
        <div style={{ marginBottom: 18, background: '#EAF7EF', padding: 16, borderRadius: 10, border: '1px solid #BFE4CE', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h3 className="routine-display" style={{ fontWeight: 700, color: TOKENS.forestDeep, fontSize: 18, margin: 0 }}>{selectedClass.name}</h3>
            <p style={{ fontSize: 13.5, color: '#2E6B4A', margin: '2px 0 0' }}>একটি গ্রুপ/শাখা নির্বাচন করুন, অথবা নতুন গ্রুপ যোগ করুন।</p>
          </div>
          <button
            onClick={() => { setSelectedClassId(null); setSelectedGroupId(null); }}
            className="routine-backbtn"
            style={{ background: TOKENS.paper, color: TOKENS.ink, border: `1px solid ${TOKENS.line}`, fontWeight: 600, padding: '8px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          >
            ⬅ ক্লাসের তালিকায় ফিরুন
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {selectedClass.groups.map((g) => (
            <div
              key={`group-${g.id}`}
              className="routine-class-card"
              style={{ position: 'relative', background: TOKENS.paper, padding: 20, borderRadius: 12, border: `1px solid ${TOKENS.line}`, textAlign: 'center' }}
            >
              {!effectiveReadOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id, g.name); }}
                  title="গ্রুপ মুছুন"
                  style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 8, border: `1px solid #F3C4BE`, background: '#FBE4E1', color: TOKENS.rose, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  🗑️
                </button>
              )}
              <div onClick={() => setSelectedGroupId(g.id)} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>👥</div>
                <h4 className="routine-display" style={{ fontWeight: 700, color: TOKENS.ink, fontSize: 17, margin: 0 }}>{g.name}</h4>
                <button style={{ marginTop: 14, fontSize: 12, fontWeight: 700, background: '#EAF7EF', color: TOKENS.forestDeep, padding: '7px 14px', borderRadius: 999, border: '1px solid #BFE4CE' }}>
                  রুটিন দেখুন ➔
                </button>
              </div>
            </div>
          ))}

          {!effectiveReadOnly && (
            showAddGroup ? (
              <div style={{ background: TOKENS.paper, padding: 20, borderRadius: 12, border: `1px dashed ${TOKENS.forest}`, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: TOKENS.muted }}>নতুন গ্রুপের নাম</label>
                <input
                  type="text"
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup(); if (e.key === 'Escape') { setShowAddGroup(false); setNewGroupName(''); } }}
                  placeholder="যেমন: গ"
                  className="routine-select"
                  style={{ padding: '9px 10px', border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontSize: 14, outline: 'none', textAlign: 'center' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setShowAddGroup(false); setNewGroupName(''); }}
                    style={{ flex: 1, background: TOKENS.parchment, color: TOKENS.ink, padding: '8px 0', borderRadius: 8, border: `1px solid ${TOKENS.line}`, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleAddGroup}
                    className="routine-savebtn"
                    style={{ flex: 1, background: TOKENS.forest, color: '#fff', padding: '8px 0', borderRadius: 8, border: 0, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                  >
                    যোগ করুন
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setShowAddGroup(true)}
                className="routine-class-card"
                style={{ background: 'transparent', padding: 20, borderRadius: 12, border: `1.5px dashed ${TOKENS.forest}`, cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: TOKENS.forestDeep, minHeight: 130 }}
              >
                <div style={{ fontSize: 26, marginBottom: 8 }}>➕</div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>নতুন গ্রুপ যোগ করুন</span>
              </div>
            )
          )}
        </div>

        {selectedClass.groups.length === 0 && !showAddGroup && (
          <div style={{ marginTop: 16, borderRadius: 10, border: `1px dashed ${TOKENS.line}`, background: TOKENS.paper, padding: 24, textAlign: 'center', fontSize: 14, color: TOKENS.muted }}>
            এই ক্লাসে এখনো কোনো গ্রুপ নেই। উপরে থেকে একটি গ্রুপ যোগ করুন।
          </div>
        )}
      </div>
    );
  }

  // Step 3: show routine grid with direct text input for every cell
  const currentRoutine = selectedGroup.gridRoutine || {};

  return (
    <div className="routine-fade printable-area">
      <div style={{ marginBottom: 18, background: '#EAF7EF', padding: 16, borderRadius: 10, border: '1px solid #BFE4CE', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h3 className="routine-display" style={{ fontWeight: 700, color: TOKENS.forestDeep, fontSize: 18, margin: 0 }}>{selectedClass.name} ({selectedGroup.name})</h3>
          <p style={{ fontSize: 13.5, color: '#2E6B4A', margin: '2px 0 0' }}>{effectiveReadOnly ? 'এই গ্রুপের রুটিন দেখুন।' : 'এই গ্রুপের রুটিন পরিবর্তন বা আপডেট করুন।'}</p>
        </div>
        <div className="routine-print-hide" style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setSelectedGroupId(null)}
            className="routine-backbtn"
            style={{ background: TOKENS.paper, color: TOKENS.ink, border: `1px solid ${TOKENS.line}`, fontWeight: 600, padding: '8px 16px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          >
            ⬅ গ্রুপ তালিকায় ফিরুন
          </button>
          <button
            onClick={() => window.print()}
            className="routine-toolbtn routine-print-hide"
            style={{ background: TOKENS.forest, color: '#fff', border: 0, padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            🖨️ প্রিন্ট করুন
          </button>
        </div>
      </div>

      <RoutineTable
        days={STATIC_DAYS_BN}
        displayDays={displayDays}
        tiffinLabel={t('routine.tiffin')}
        timeDayLabel={t('routine.timeDay')}
        noDataMsg={t('routine.noData')}
        renderErrMsg={t('routine.renderErr')}
        timeSlots={safeTimeSlots}
        getSlot={(day, idx) => {
          const dayData = currentRoutine && Array.isArray(currentRoutine[day]) ? currentRoutine[day] : null;
          if (!dayData || idx < 0 || idx >= dayData.length) return null;
          return dayData[idx];
        }}
        renderCell={(day, idx, slot) => {
          const safeSlot = slot && typeof slot === 'object' ? slot : { subject: '' };
          return (
            <input
              type="text"
              value={safeSlot.subject || ''}
              onChange={(e) => handleUpdate(selectedClass.id, selectedGroup.id, day, idx, e.target.value)}
              disabled={effectiveReadOnly}
              className="routine-input"
              style={{
                background: 'transparent',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 14,
                width: '100%',
                height: '100%',
                border: 0,
                outline: 'none',
                padding: '8px 2px',
                color: TOKENS.forestDeep
              }}
              placeholder={effectiveReadOnly ? '—' : '+ Subject'}
            />
          );
        }}
      />
    </div>
  );
};

// ==========================================
// 5. SchoolRoutineManager (Main dashboard component)
// ==========================================
export const SchoolRoutineManager = ({
  classes = SAMPLE_CLASSES,
  teachers = SAMPLE_TEACHERS,
  teacherRoutines = SAMPLE_TEACHER_ROUTINES,
  onSaveTeacherRoutine: onSaveTeacherRoutineProp,
  onSaveClassRoutine: onSaveClassRoutineProp,
  onAddClassGroup: onAddClassGroupProp,
  onDeleteClassGroup: onDeleteClassGroupProp,
  onAddClass: onAddClassProp,
  onDeleteClass: onDeleteClassProp,
  readOnly = false,
  timeSlots = DEFAULT_TIME_SLOTS,
  onSaveTimeSlots
}) => {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const safeTimeSlots = useMemo(() => resolveTimeSlots(timeSlots), [timeSlots]);
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('teacher');
  const [showTimeCustomizer, setShowTimeCustomizer] = useState(false);
  const [tempTimeSlots, setTempTimeSlots] = useState(safeTimeSlots);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const [localClasses, setLocalClasses] = useState(() => {
    try {
      const cached = localStorage.getItem('teacherPanelClasses');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to read teacherPanelClasses from localStorage:', e);
    }
    return Array.isArray(classes) && classes.length > 0 ? classes : SAMPLE_CLASSES;
  });

  const [localTeacherRoutines, setLocalTeacherRoutines] = useState(() => {
    try {
      const cached = localStorage.getItem('teacherPanelRoutines');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error('Failed to read teacherPanelRoutines from localStorage:', e);
    }
    return teacherRoutines && typeof teacherRoutines === 'object' ? teacherRoutines : SAMPLE_TEACHER_ROUTINES;
  });

  useEffect(() => {
    if (Array.isArray(classes) && classes.length > 0) {
      setLocalClasses((prev) => {
        if (!prev || prev.length === 0) return classes;
        return prev;
      });
    }
  }, [classes]);

  useEffect(() => {
    if (teacherRoutines && typeof teacherRoutines === 'object' && Object.keys(teacherRoutines).length > 0) {
      setLocalTeacherRoutines(teacherRoutines);
    }
  }, [teacherRoutines]);

  const teacherNames = useMemo(() => {
    if (!Array.isArray(teachers)) return [];
    const uniqueNames = new Set();
    teachers.forEach(t => {
      const name = t?.name ? String(t.name).trim() : '';
      if (name) uniqueNames.add(name);
    });
    return Array.from(uniqueNames).sort();
  }, [teachers]);

  useEffect(() => {
    if (teacherNames.length === 0) {
      setSelectedTeacher('');
      return;
    }
    if (teacherNames.includes(selectedTeacher)) return;
    setSelectedTeacher(teacherNames[0]);
  }, [teacherNames, selectedTeacher]);

  useEffect(() => {
    setTempTimeSlots(safeTimeSlots);
  }, [safeTimeSlots]);

  const currentRoutine = useMemo(() => {
    if (!selectedTeacher || typeof localTeacherRoutines !== 'object') return {};
    return localTeacherRoutines[selectedTeacher] || {};
  }, [selectedTeacher, localTeacherRoutines]);

  const handleRoutineUpdate = useCallback((newRoutine) => {
    if (!selectedTeacher) return;

    setLocalTeacherRoutines((prev) => {
      const updated = {
        ...(prev || {}),
        [selectedTeacher]: newRoutine,
      };

      try {
        localStorage.setItem('teacherPanelRoutines', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving teacherPanelRoutines to localStorage:', e);
      }

      return updated;
    });

    if (onSaveTeacherRoutineProp) {
      onSaveTeacherRoutineProp(selectedTeacher, newRoutine);
    }
  }, [selectedTeacher, onSaveTeacherRoutineProp]);

  const handleSaveClassRoutine = useCallback((classId, groupId, updatedRoutine) => {
    setLocalClasses((prevClasses) => {
      const updatedClasses = (prevClasses || []).map((cls, classIdx) => {
        const currentClassId = String(cls.id || cls.classId || cls.className || cls.name || `class-${classIdx + 1}`);
        if (currentClassId !== String(classId)) {
          return cls;
        }

        const rawGroups = Array.isArray(cls.groups) ? cls.groups : [];
        let groupMatched = false;

        const baseGroups = rawGroups.length > 0
          ? rawGroups
          : [{ id: `${currentClassId}-default`, name: cls.section || cls.group || 'গ্রুপ ১', gridRoutine: cls.gridRoutine || {} }];

        const updatedGroups = baseGroups.map((g, groupIdx) => {
          let gObj;
          if (typeof g === 'string') {
            gObj = { id: `${currentClassId}-grp-${groupIdx}`, name: g, gridRoutine: {} };
          } else {
            const gName = g.name || g.section || g.label || `গ্রুপ ${groupIdx + 1}`;
            const gId = g.id || `${currentClassId}-grp-${groupIdx}`;
            gObj = { ...g, id: String(gId), name: String(gName), gridRoutine: g.gridRoutine || {} };
          }

          if (gObj.id === String(groupId) || String(gObj.name) === String(groupId)) {
            groupMatched = true;
            return {
              ...gObj,
              gridRoutine: updatedRoutine,
            };
          }
          return gObj;
        });

        if (!groupMatched) {
          updatedGroups.push({
            id: String(groupId),
            name: 'গ্রুপ ১',
            gridRoutine: updatedRoutine,
          });
        }

        return {
          ...cls,
          id: currentClassId,
          gridRoutine: updatedRoutine,
          groups: updatedGroups,
        };
      });

      try {
        localStorage.setItem('teacherPanelClasses', JSON.stringify(updatedClasses));
      } catch (e) {
        console.error('Failed to backup teacherPanelClasses to localStorage:', e);
      }

      return updatedClasses;
    });

    if (onSaveClassRoutineProp) {
      onSaveClassRoutineProp(classId, groupId, updatedRoutine);
    }
  }, [onSaveClassRoutineProp]);

  const handleAddClassGroup = useCallback((classId, groupName) => {
    setLocalClasses((prevClasses) => {
      const updated = (prevClasses || []).map((cls) => {
        const clsId = String(cls.id || cls.classId || cls.className || cls.name);
        if (clsId !== String(classId)) return cls;
        const currentGroups = Array.isArray(cls.groups) ? [...cls.groups] : [];
        const newGroup = {
          id: `${clsId}-grp-${Date.now()}`,
          name: groupName,
          gridRoutine: {},
        };
        return {
          ...cls,
          groups: [...currentGroups, newGroup],
        };
      });
      try {
        localStorage.setItem('teacherPanelClasses', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
    if (onAddClassGroupProp) onAddClassGroupProp(classId, groupName);
  }, [onAddClassGroupProp]);

  const handleDeleteClassGroup = useCallback((classId, groupId) => {
    setLocalClasses((prevClasses) => {
      const updated = (prevClasses || []).map((cls) => {
        const clsId = String(cls.id || cls.classId || cls.className || cls.name);
        if (clsId !== String(classId)) return cls;
        const currentGroups = Array.isArray(cls.groups) ? cls.groups : [];
        const filteredGroups = currentGroups.filter((g, idx) => {
          const gId = String(g.id || `${clsId}-grp-${idx}`);
          return gId !== String(groupId);
        });
        return { ...cls, groups: filteredGroups };
      });
      try {
        localStorage.setItem('teacherPanelClasses', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
    if (onDeleteClassGroupProp) onDeleteClassGroupProp(classId, groupId);
  }, [onDeleteClassGroupProp]);

  const handleAddClass = useCallback((className) => {
    setLocalClasses((prevClasses) => {
      const newClass = {
        id: `class-${Date.now()}`,
        className: className,
        groups: [{ id: `c-${Date.now()}-ka`, name: 'ক', gridRoutine: {} }],
      };
      const updated = [...(prevClasses || []), newClass];
      try {
        localStorage.setItem('teacherPanelClasses', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
    if (onAddClassProp) onAddClassProp(className);
  }, [onAddClassProp]);

  const handleDeleteClass = useCallback((classId) => {
    setLocalClasses((prevClasses) => {
      const updated = (prevClasses || []).filter((cls) => {
        const clsId = String(cls.id || cls.classId || cls.className || cls.name);
        return clsId !== String(classId);
      });
      try {
        localStorage.setItem('teacherPanelClasses', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
    if (onDeleteClassProp) onDeleteClassProp(classId);
  }, [onDeleteClassProp]);

  const handleAddPeriod = useCallback(() => {
    setTempTimeSlots(prev => [...prev, `পিরিয়ড ${prev.length + 1}`]);
  }, []);

  const handleRemovePeriod = useCallback(() => {
    setTempTimeSlots(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const handleUpdateTimeSlot = useCallback((idx, value) => {
    setTempTimeSlots(prev => {
      const next = [...prev];
      next[idx] = String(value || '').trim();
      return next;
    });
  }, []);

  const handleSaveTimeSlots = useCallback(() => {
    if (onSaveTimeSlots && tempTimeSlots.length > 0) {
      onSaveTimeSlots(tempTimeSlots);
      setShowTimeCustomizer(false);
    }
  }, [tempTimeSlots, onSaveTimeSlots]);

  const handleCancelTimeSlots = useCallback(() => {
    setTempTimeSlots([...safeTimeSlots]);
    setShowTimeCustomizer(false);
  }, [safeTimeSlots]);

  const canSaveRoutine = useMemo(() => {
    if (!readOnly) return true;
    if (user?.role === 'admin' || user?.role === 'principal') return true;
    return false;
  }, [readOnly, user]);

  const handleFinalSave = async () => {
    if (!canSaveRoutine || isSaving) return;

    if (!hasAnyRoutineData(localClasses, localTeacherRoutines)) {
      const msg = '⚠️ সংরক্ষণ করার জন্য অন্তত একটি রুটিন সেল পূরণ করা আবশ্যক!';
      setFeedbackMsg({ type: 'warning', text: msg });
      showAlert('Routine cell is empty! Please enter data in at least one cell before saving.', 'Routine Empty', 'warning');
      return;
    }

    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      localStorage.setItem('teacherPanelClasses', JSON.stringify(localClasses));
      localStorage.setItem('teacherPanelRoutines', JSON.stringify(localTeacherRoutines));

      await saveTeacherPanelData({
        classes: localClasses,
        teachers: teachers,
        teacherRoutines: localTeacherRoutines,
        timeSlots: safeTimeSlots,
      });

      const isClassTab = activeTab === 'class';
      const successTitle = isClassTab ? 'Class Routine' : 'Teacher Routine';
      const successTitleBn = isClassTab ? 'ক্লাস রুটিন' : 'শিক্ষক রুটিন';

      const alertMsg = `${successTitle} saved successfully!`;
      const bannerMsg = `✅ ${successTitleBn} সফলভাবে ফায়ারস্টোরে এবং লোকাল স্টোরেজে সংরক্ষণ করা হয়েছে! (${alertMsg})`;

      setFeedbackMsg({ type: 'success', text: bannerMsg });
      showAlert(alertMsg, 'Save Successful', 'success');
    } catch (error) {
      console.error('Error saving routine to Firestore:', error);
      const errorMsg = `❌ রুটিন সংরক্ষণে সমস্যা হয়েছে: ${error.message || 'অজানা সমস্যা'}`;
      setFeedbackMsg({ type: 'error', text: errorMsg });
      showAlert(`❌ Failed to save routine to Firestore: ${error.message || 'Unknown error'}`, 'Save Error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="routine-root routine-main-container" style={{ maxWidth: 1180, margin: '0 auto', padding: 20, background: TOKENS.parchment, minHeight: '100vh' }}>
      <style>{ROUTINE_STYLES}</style>

      {/* Header */}
      <div className="routine-header" style={{ background: `linear-gradient(135deg, ${TOKENS.indigo}, ${TOKENS.indigoDeep})`, borderRadius: 14, padding: '20px 24px', marginBottom: 22, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, boxShadow: '0 8px 20px -8px rgba(20,27,48,0.45)' }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1.6, color: TOKENS.marigold, textTransform: 'uppercase', marginBottom: 4 }}>{t('routine.title')}</div>
          <h2 className="routine-display" style={{ fontSize: 25, fontWeight: 700, color: '#fff', margin: 0 }}>{t('routine.title')}</h2>
        </div>

        <div className="routine-print-hide" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!readOnly && (
            <button
              onClick={() => setShowTimeCustomizer(!showTimeCustomizer)}
              className="routine-toolbtn"
              style={{ padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13.5, border: `1px solid ${showTimeCustomizer ? TOKENS.marigold : 'rgba(255,255,255,0.25)'}`, cursor: 'pointer', background: showTimeCustomizer ? TOKENS.marigold : 'rgba(255,255,255,0.08)', color: showTimeCustomizer ? TOKENS.indigoDeep : '#fff' }}
            >
              ⏱️ সময় পরিবর্তন
            </button>
          )}
          <div className="routine-tab-container" style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 4 }}>
            <button
              onClick={() => setActiveTab('teacher')}
              className="routine-tab"
              style={{ padding: '9px 18px', borderRadius: 7, fontWeight: 600, fontSize: 13.5, border: 0, cursor: 'pointer', background: activeTab === 'teacher' ? TOKENS.marigold : 'transparent', color: activeTab === 'teacher' ? TOKENS.indigoDeep : '#E7EBF5' }}
            >
              {t('nav.teachers')} {t('routine.title')}
            </button>
            <button
              onClick={() => setActiveTab('class')}
              className="routine-tab"
              style={{ padding: '9px 18px', borderRadius: 7, fontWeight: 600, fontSize: 13.5, border: 0, cursor: 'pointer', background: activeTab === 'class' ? '#7FD9A8' : 'transparent', color: activeTab === 'class' ? TOKENS.forestDeep : '#E7EBF5' }}
            >
              {t('results.class')} {t('routine.title')}
            </button>
          </div>
        </div>
      </div>

      {/* Time Customization */}
      {!readOnly && showTimeCustomizer && (
        <div className="routine-fade routine-print-hide" style={{ background: TOKENS.paper, borderRadius: 12, boxShadow: '0 1px 2px rgba(28,35,51,0.06)', padding: 18, marginBottom: 22, border: `1px solid ${TOKENS.line}` }}>
          <h3 className="routine-display" style={{ fontWeight: 700, color: TOKENS.ink, fontSize: 17, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span>পিরিয়ডের সময়সূচী পরিবর্তন করুন</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleAddPeriod}
                className="routine-toolbtn"
                style={{ background: '#EAF7EF', color: TOKENS.forestDeep, border: '1px solid #BFE4CE', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                ➕ পিরিয়ড যোগ করুন
              </button>
              {tempTimeSlots.length > 1 && (
                <button
                  onClick={handleRemovePeriod}
                  className="routine-toolbtn"
                  style={{ background: '#FBE4E1', color: TOKENS.rose, border: '1px solid #F3C4BE', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  ❌ শেষ পিরিয়ড মুছুন
                </button>
              )}
            </div>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 18 }}>
            {tempTimeSlots.map((time, idx) => (
              <div key={`time-input-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.muted, letterSpacing: 0.3 }}>পিরিয়ড {idx + 1}</label>
                <input
                  type="text"
                  value={time || ''}
                  onChange={(e) => handleUpdateTimeSlot(idx, e.target.value)}
                  className="routine-select"
                  style={{ padding: '9px 10px', border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontSize: 14, outline: 'none', textAlign: 'center' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancelTimeSlots}
              style={{ background: TOKENS.parchment, color: TOKENS.ink, padding: '9px 18px', borderRadius: 8, border: `1px solid ${TOKENS.line}`, fontWeight: 600, cursor: 'pointer' }}
            >
              বাতিল
            </button>
            <button
              onClick={handleSaveTimeSlots}
              className="routine-savebtn"
              style={{ background: TOKENS.indigo, color: '#fff', padding: '9px 20px', borderRadius: 8, border: 0, fontWeight: 600, cursor: 'pointer' }}
            >
              সংরক্ষণ করুন
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        {activeTab === 'teacher' && (
          <div className="routine-fade routine-selector-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontWeight: 700, color: TOKENS.ink, fontSize: 14 }}>{t('routine.selectClass')}:</label>
            {teacherNames.length === 0 ? (
              <span style={{ fontSize: 14, color: TOKENS.muted, fontStyle: 'italic' }}>
                কোনো শিক্ষক পাওয়া যায়নি। Teachers Directory থেকে শিক্ষক যোগ করুন।
              </span>
            ) : (
              <select
                value={selectedTeacher || ''}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="routine-select"
                style={{ padding: '9px 12px', border: `1px solid ${TOKENS.line}`, borderRadius: 8, outline: 'none', fontSize: 14, background: TOKENS.paper, minWidth: 200 }}
              >
                <option value="">-- শিক্ষক নির্বাচন করুন --</option>
                {teacherNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {activeTab === 'teacher' ? (
        teacherNames.length > 0 && selectedTeacher ? (
          <TeacherRoutine
            key={selectedTeacher}
            teacherName={selectedTeacher}
            routine={currentRoutine}
            onUpdate={handleRoutineUpdate}
            readOnly={readOnly}
            timeSlots={safeTimeSlots}
          />
        ) : (
          <div style={{ background: TOKENS.paper, borderRadius: 12, padding: 36, textAlign: 'center', color: TOKENS.muted, fontSize: 14, border: `1px dashed ${TOKENS.line}` }}>
            📋 শিক্ষক নির্বাচন করুন অথবা শিক্ষক যোগ করুন।
          </div>
        )
      ) : (
        <ClassRoutineManager
          classes={localClasses}
          readOnly={readOnly}
          onSaveClassRoutine={handleSaveClassRoutine}
          onAddClassGroup={handleAddClassGroup}
          onDeleteClassGroup={handleDeleteClassGroup}
          onAddClass={handleAddClass}
          onDeleteClass={handleDeleteClass}
          timeSlots={safeTimeSlots}
          user={user}
          onSelectedClassChange={setSelectedClass}
        />
      )}

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className="routine-print-hide routine-fade"
          style={{
            marginTop: 18,
            padding: '12px 16px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background:
              feedbackMsg.type === 'success'
                ? '#DCFCE7'
                : feedbackMsg.type === 'warning'
                  ? '#FEF3C7'
                  : '#FEE2E2',
            color:
              feedbackMsg.type === 'success'
                ? '#166534'
                : feedbackMsg.type === 'warning'
                  ? '#92400E'
                  : '#991B1B',
            border: `1px solid ${feedbackMsg.type === 'success'
                ? '#86EFAC'
                : feedbackMsg.type === 'warning'
                  ? '#FCD34D'
                  : '#FCA5A5'
              }`,
          }}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            style={{
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              fontWeight: 700,
              color: 'inherit',
              marginLeft: 12,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Save Button */}
      {canSaveRoutine && (
        <div className="routine-print-hide" style={{ marginTop: 26, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="routine-savebtn"
            onClick={handleFinalSave}
            disabled={isSaving || !canSaveRoutine}
            style={{
              background: isSaving ? TOKENS.muted : TOKENS.indigo,
              color: '#fff',
              padding: '10px 28px',
              borderRadius: 9,
              border: 0,
              fontWeight: 700,
              boxShadow: '0 10px 20px -6px rgba(30,42,74,0.45)',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: 14.5,
              opacity: isSaving ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            {isSaving ? '⏳ সংরক্ষণ হচ্ছে...' : `💾 ${t('common.save') || 'রুটিন সেভ করুন'}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default SchoolRoutineManager;
