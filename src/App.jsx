import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, CalendarDays, CheckCircle, Clock, Download, Edit3,
  LogOut, MapPin, Plus, RefreshCw, Search, Users, X, XCircle,
  Building2, BriefcaseBusiness, Ban, Check, Filter, Box
} from 'lucide-react';
import './style.css';
import Dashboard from './components/Dashboard';
import FormPanel from './components/FormPanel';
import DataTable from './components/DataTable';
import LoginPage from './components/LoginPage';
import Office3D from './components/Office3D';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const NAV = [
  ['dashboard', 'Tổng quan', Activity], ['office', 'Văn phòng 3D', Box], ['attendance', 'Chấm công', MapPin],
  ['employees', 'Nhân viên', Users], ['locations', 'Chi nhánh', Building2],
  ['shifts', 'Ca làm', Clock], ['leaves', 'Nghỉ phép', CalendarDays],
  ['overtime', 'Tăng ca', BriefcaseBusiness], ['timesheet', 'Bảng công', CheckCircle]
];
const tabLabel = (id, role) =>
  id === 'attendance' && (role === 'ADMIN' || role === 'MANAGER')
    ? 'Quản lý chấm công'
    : (NAV.find(item => item[0] === id)?.[1] || '');
const date = v => v ? new Date(v).toLocaleDateString('vi-VN') : '—';
const dateTime = v => v ? new Date(v).toLocaleString('vi-VN') : '—';
const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => today().slice(0, 7);
const statusText = v => ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CHECK_IN: 'Vào ca', CHECK_OUT: 'Ra ca' }[v] || v || '—');

const tone = s => 'tone-' + ((String(s || 'N').codePointAt(0) || 0) % 5);
const pad2 = n => String(n).padStart(2, '0');

const EMPTY_EMPLOYEE = { employeeCode: '', fullName: '', email: '', password: '', phone: '', gender: '', dateOfBirth: '', address: '', department: '', position: '', hireDate: today(), role: 'EMPLOYEE', locationId: '' };
const EMPTY_LOCATION = { name: '', address: '', latitude: '', longitude: '', radius: 150 };
const EMPTY_SHIFT = { name: '', startTime: '08:00', endTime: '17:00', breakMins: 60 };

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState(monthNow());
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [attendanceLocationId, setAttendanceLocationId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [reviewNote, setReviewNote] = useState({});
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: '', date: today(), mode: 'FULL_DAY',
    checkInTime: '08:00', checkOutTime: '17:00', time: '08:00', extraHours: '1', reason: ''
  });
  const [editDay, setEditDay] = useState(null);
  const expiredRef = useRef(false);

  const role = user?.role;
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const canReview = isAdmin || isManager;
  const canSeeEmployees = canReview;
  const visibleNav = NAV.filter(([id]) => {
    if (id === 'employees') return canSeeEmployees;
    if (id === 'locations') return isAdmin;
    if (id === 'shifts') return canReview;
    return true;
  });
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  const notify = (text, isError = false) => { setMessage(isError ? '' : text); setError(isError ? text : ''); };

  // Hết hạn phiên: xóa thông tin đăng nhập và đưa người dùng về màn hình login.
  // Dùng ref để nhiều API cùng trả 401 cũng chỉ xử lý một lần.
  function expireSession() {
    if (expiredRef.current) return;
    expiredRef.current = true;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setData([]);
    setStats(null);
    setLocations([]);
    setEmployees([]);
    setTab('dashboard');
    setShowForm(false);
    setMessage('');
    setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...options.headers } });
    const result = await response.json().catch(() => ({}));

    if (response.status === 401 && token && !path.includes('/auth/login')) {
      expireSession();
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!response.ok) throw new Error(result.message || `Lỗi máy chủ (${response.status})`);
    return result;
  }, [headers, token]);


  async function login(e) {
    e.preventDefault(); setBusy(true); notify('');
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      expiredRef.current = false;
      localStorage.setItem('token', result.token); localStorage.setItem('user', JSON.stringify(result.user));
      setToken(result.token); setUser(result.user); setTab('dashboard'); notify('Đăng nhập thành công');
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  }

  function logout() {
    expiredRef.current = false;
    localStorage.removeItem('token'); localStorage.removeItem('user');
    setToken(''); setUser(null); setData([]); setStats(null); setLocations([]); setEmployees([]); setTab('dashboard');
    setShowForm(false); notify('');
  }

  async function load() {
    if (!token) return;
    setBusy(true); notify('');
    try {
      if (tab === 'office') { setData([]); return; }
      if (tab === 'dashboard') {
        setStats(await api('/dashboard')); setData([]);
      } else {
        const params = new URLSearchParams();
        if (tab === 'attendance') { if (filterFrom) params.set('from', filterFrom); if (filterTo) params.set('to', filterTo); }
        if (tab === 'timesheet' && filterMonth) params.set('month', filterMonth);
        const routes = { employees: '/employees', attendance: '/attendance', locations: '/locations', shifts: '/shifts', leaves: '/leaves', overtime: '/overtime', timesheet: '/timesheet' };
        const result = await api(`${routes[tab]}${params.size ? `?${params}` : ''}`);
        setData(Array.isArray(result) ? result : []);
      }
    } catch (e) { notify(e.message, true); setData([]); }
    finally { setBusy(false); }
  }

  async function loadLookups() {
    if (!token) return;
    try {
      const [loc, emp] = await Promise.all([api('/locations'), canReview ? api('/employees') : Promise.resolve([])]);
      setLocations(Array.isArray(loc) ? loc : []); setEmployees(Array.isArray(emp) ? emp : []);
    } catch { /* Lookup data is optional for tabs that do not need it. */ }
  }

  useEffect(() => { load(); }, [token, tab, filterMonth, filterFrom, filterTo]);
  useEffect(() => { loadLookups(); }, [token, role]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4500);
    return () => clearTimeout(timer);
  }, [message]);

  function openCreate() {
    setEditing(null);
    const defaults = { employees: { ...EMPTY_EMPLOYEE }, locations: { ...EMPTY_LOCATION }, shifts: { ...EMPTY_SHIFT }, leaves: { fromDate: today(), toDate: today(), reason: '' }, overtime: { workDate: today(), overtimeType: 'WEEKDAY_15', hours: 1, reason: '' }};
    setForm(defaults[tab] || {}); setShowForm(true); notify('');
  }
  function openEdit(row) {
    setEditing(row); setForm({ ...row, password: '', dateOfBirth: row.dateOfBirth ? String(row.dateOfBirth).slice(0, 10) : '', hireDate: row.hireDate ? String(row.hireDate).slice(0, 10) : '' }); setShowForm(true); notify('');
  }
  function closeForm() { setShowForm(false); setEditing(null); setForm({}); }
  function changeField(key, value) { setForm(prev => ({ ...prev, [key]: value })); }

  async function saveForm(e) {
    e.preventDefault(); setBusy(true); notify('');
    try {
      const payload = { ...form };
      let path = ''; let method = 'POST';
      if (tab === 'employees') {
        path = editing ? `/employees/${editing.id}` : '/employees'; method = editing ? 'PATCH' : 'POST';
        if (!payload.locationId) payload.locationId = null;
        if (editing && !payload.password) delete payload.password;
        if (editing) delete payload.id;
      } else if (tab === 'locations') {
        path = editing ? `/locations/${editing.id}` : '/locations'; method = editing ? 'PATCH' : 'POST';
        ['latitude', 'longitude', 'radius'].forEach(k => payload[k] = Number(payload[k]));
        if (editing) { delete payload.id; delete payload.active; }
      } else if (tab === 'shifts') {
        path = '/shifts'; payload.breakMins = Number(payload.breakMins || 0);
      } else if (tab === 'leaves') path = '/leaves';
      else if (tab === 'overtime') { path = '/overtime'; payload.hours = Number(payload.hours); }
      await api(path, { method, body: JSON.stringify(payload) });
      notify(editing ? 'Cập nhật thành công' : 'Tạo mới thành công'); closeForm(); await load(); await loadLookups();
    } catch (e) { notify(e.message, true); }
    finally { setBusy(false); }
  }

  async function toggleEmployee(row) {
    const ok = window.confirm(`${row.active ? 'Khóa' : 'Mở khóa'} tài khoản ${row.fullName}?`);
    if (!ok) return;
    try { await api(`/employees/${row.id}`, { method: 'PATCH', body: JSON.stringify({ active: !row.active }) }); notify('Đã cập nhật trạng thái nhân viên'); await load(); }
    catch (e) { notify(e.message, true); }
  }
  async function toggleLocation(row) {
    const ok = window.confirm(`${row.active ? 'Ngừng hoạt động' : 'Kích hoạt'} chi nhánh ${row.name}?`);
    if (!ok) return;
    try { await api(`/locations/${row.id}`, { method: 'PATCH', body: JSON.stringify({ active: !row.active }) }); notify('Đã cập nhật chi nhánh'); await load(); await loadLookups(); }
    catch (e) { notify(e.message, true); }
  }
  async function reviewRequest(kind, row, status) {
    const note = reviewNote[row.id] || '';
    try { await api(`/${kind}/${row.id}/review`, { method: 'PATCH', body: JSON.stringify({ status, reviewNote: note }) }); notify(status === 'APPROVED' ? 'Đã duyệt đơn' : 'Đã từ chối đơn'); await load(); }
    catch (e) { notify(e.message, true); }
  }

  async function punch(type) {
    if (!navigator.geolocation) {
      return notify('Trình duyệt không hỗ trợ GPS', true);
    }

    setBusy(true);
    notify('Đang lấy vị trí GPS...');

    navigator.geolocation.getCurrentPosition(async p => {
      try {
        const result = await api('/attendance/punch', {
          method: 'POST',
          body: JSON.stringify({
            type,
            latitude: p.coords.latitude,
            longitude: p.coords.longitude
          })
        });

        const time = new Date(result.timestamp || Date.now())
          .toLocaleTimeString('vi-VN');

        notify(
          `${type === 'CHECK_IN' ? 'Chấm công vào' : 'Chấm công ra'} thành công lúc ${time}`
        );

        await load();
      } catch (e) {
        notify(e.message, true);
      } finally {
        setBusy(false);
      }
    }, e => {
      notify(`Không lấy được GPS: ${e.message}`, true);
      setBusy(false);
    }, {
      enableHighAccuracy: true,
      timeout: 15000
    });
  }

  function openEditDay(row) {
    const hhmm = v => v ? v.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }) : '';
    setEditDay({
      employeeId: row.userId,
      date: row.day,
      checkInTime: hhmm(row.checkIn),
      checkOutTime: hhmm(row.checkOut),
      workFraction: String(row.workFraction ?? 1),
      extraHours: row.manualBonus > 0 ? String(Number(row.manualBonus.toFixed(2))) : '',
      reason: ''
    });
    setShowManualForm(false);
    notify('');
  }

  async function saveEditDay(e) {
    e.preventDefault();
    setBusy(true);
    notify('');
    try {
      await api('/attendance/day', {
        method: 'PATCH',
        body: JSON.stringify({ ...editDay, workFraction: Number(editDay.workFraction) })
      });
      setEditDay(null);
      notify('Đã cập nhật giờ công');
      await load();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function saveManualAttendance(e) {
    e.preventDefault();
    setBusy(true);
    notify('');
    try {
      if (manualForm.mode === 'EXTRA_HOURS') {
        await api('/extra-hours', {
          method: 'POST',
          body: JSON.stringify({
            employeeId: manualForm.employeeId,
            date: manualForm.date,
            hours: Number(manualForm.extraHours),
            reason: manualForm.reason
          })
        });
      } else {
        await api('/attendance/manual', {
          method: 'POST',
          body: JSON.stringify(manualForm)
        });
      }
      setShowManualForm(false);
      setManualForm({
        employeeId: '', date: today(), mode: 'FULL_DAY',
        checkInTime: '08:00', checkOutTime: '17:00', time: '08:00', extraHours: '1', reason: ''
      });
      notify(manualForm.mode === 'EXTRA_HOURS' ? 'Đã lưu giờ cộng thêm' : 'Đã lưu chấm công thủ công');
      await load();
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteExtraHours(id) {
    if (!window.confirm('Xóa giờ cộng thêm thủ công này?')) return;
    setBusy(true);
    notify('');
    try {
      await api(`/extra-hours/${id}`, { method: 'DELETE' });
      notify('Đã xóa giờ cộng thêm');
      await load();
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function exportTimesheet() {
  try {
    const response = await fetch(
      `${API}/timesheet/export?month=${encodeURIComponent(filterMonth)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.status === 401) {
      expireSession();
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Không thể xuất Excel');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `bang-cong-${filterMonth}.xlsx`;
    a.click();

    URL.revokeObjectURL(url);
    notify('Đã xuất bảng công');
  } catch (e) {
    notify(e.message, true);
  }
}

  

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase(); if (!q) return data;
    return data.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  if (!token) return <LoginPage
    email={email}
    password={password}
    showPw={showPw}
    busy={busy}
    error={error}
    onEmailChange={e => setEmail(e.target.value)}
    onPasswordChange={e => setPassword(e.target.value)}
    onTogglePassword={() => setShowPw(v => !v)}
    onSubmit={login}
  />;

  const checkInRecord = (stats?.attendance || []).find(r =>
    String(r.type || '').toUpperCase() === 'CHECK_IN' && (!r.userId || String(r.userId) === String(user?.id)));
  const checkInTime = checkInRecord?.timestamp
    ? new Date(checkInRecord.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';
  const checkOutRecord = (stats?.attendance || []).find(r =>
    String(r.type || '').toUpperCase() === 'CHECK_OUT' && (!r.userId || String(r.userId) === String(user?.id)));
  const checkOutTime = checkOutRecord?.timestamp
    ? new Date(checkOutRecord.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';
  const pageSub = tab === 'dashboard'
    ? new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : tabDescription(tab, role);
  const roleLabel = role === 'ADMIN' ? 'Quản trị viên' : role === 'MANAGER' ? 'Quản lý chi nhánh' : 'Nhân viên';

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Clock size={20} /></span><div><b>WorkTime</b><small>Quản lý chấm công</small></div></div>
      <nav className="side-nav" aria-label="Menu chính">{visibleNav.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'nav-item active' : 'nav-item'} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setSearch(''); closeForm(); }}><Icon size={19} /><span>{tabLabel(id, role)}</span></button>)}</nav>
      <div className="sidebar-bottom">
        <div className="profile-card"><div className={`avatar`}>{(user?.fullName || 'U').slice(0, 1).toUpperCase()}</div><div className="profile-meta"><b>{user?.fullName || 'Người dùng'}</b><small>{roleLabel}</small></div></div>
        <button className="logout-button" onClick={logout}><LogOut size={17} /> Đăng xuất</button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="page-heading"><h1>{tabLabel(tab, role)}</h1><p>{pageSub}</p></div>
        <div className="top-actions">
          <button className="icon-button" onClick={load} title="Làm mới" aria-label="Làm mới"><RefreshCw size={18} /></button>
          <button className="icon-button mobile-only" onClick={logout} title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={18} /></button>
        </div>
      </header>
      {(message || error) && (
        <div className={`toast ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>
          {error ? <XCircle size={20} /> : message.endsWith('...') ? <span className="loader on-dark" /> : <CheckCircle size={20} />}
          <span className="toast-text">{error || message}</span>
          <button onClick={() => notify('')} aria-label="Đóng thông báo"><X size={16} /></button>
        </div>
      )}

      {tab === 'dashboard' && (
        <Dashboard
          stats={stats}
          role={role}
          locations={locations}
          onPunch={punch}
          busy={busy}
          onNavigate={setTab}
          user={user}
          checkedIn={Boolean(checkInRecord)}
          checkInTime={checkInTime}
          checkedOut={Boolean(checkOutRecord)}
          checkOutTime={checkOutTime}
        />
      )}

      {tab === 'office' && <Office3D api={api} user={user} role={role} locations={locations} />}

      {tab !== 'dashboard' && tab !== 'office' && <>
        <section className="content-toolbar"><div className="toolbar-actions">
          {tab === 'attendance' && <><select
            className="filter-input"
            value={attendanceLocationId}
            onChange={e => setAttendanceLocationId(e.target.value)}
            aria-label="Lọc theo chi nhánh"
          >
            <option value="">Tất cả chi nhánh</option>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
<input className="filter-input" type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} aria-label="Từ ngày"/><input className="filter-input" type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} aria-label="Đến ngày"/>{canReview && <button className="primary" onClick={() => { setManualForm(prev => ({ ...prev, employeeId: employees.find(x => x.role === 'EMPLOYEE')?.id || '' })); setShowManualForm(v => !v); }}>+ Chấm công thủ công</button>}</>}
          {tab === 'timesheet' && <input className="filter-input" type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />}
          {tab === 'timesheet' && canReview && (
            <button className="outline" onClick={exportTimesheet}>
              <Download size={17} /> Xuất Excel
            </button>
          )}
          {['employees', 'locations', 'shifts', 'leaves', 'overtime'].includes(tab) && (tab !== 'employees' || isAdmin) && (tab !== 'locations' || isAdmin) && (tab !== 'shifts' || canReview) && (
              <button className="primary" onClick={openCreate}>
                <Plus size={17}/> {createLabel(tab)}
              </button>
            )}
        </div></section>

        {showManualForm && tab === 'attendance' && canReview && (
          <section className="form-panel">
            <div className="form-panel-head">
              <div><h3>Chấm công thủ công</h3><p>Ca sáng 08:00–12:00 và ca chiều 13:00–17:00, mỗi ca tính 0,5 công.</p></div>
              <button className="icon-button" onClick={() => setShowManualForm(false)}><X size={18}/></button>
            </div>
            <form onSubmit={saveManualAttendance}>
              <div className="form-grid">
                <label className="form-field"><span>Nhân viên *</span><select required value={manualForm.employeeId} onChange={e => setManualForm(p => ({ ...p, employeeId: e.target.value }))}><option value="">-- Chọn nhân viên --</option>{employees.filter(x => x.role === 'EMPLOYEE' && x.active).map(x => <option key={x.id} value={x.id}>{x.fullName} {x.employeeCode ? `(${x.employeeCode})` : ''}</option>)}</select></label>
                <label className="form-field"><span>Ngày chấm công *</span><input type="date" required value={manualForm.date} onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))}/></label>
                <label className="form-field"><span>Loại chấm công *</span><select value={manualForm.mode} onChange={e => setManualForm(p => ({ ...p, mode: e.target.value }))}><option value="FULL_DAY">Đủ ngày – 1 công</option><option value="MORNING">Nửa ngày – ca sáng (08:00–12:00)</option><option value="AFTERNOON">Nửa ngày – ca chiều (13:00–17:00)</option><option value="CHECK_IN">Chỉ bổ sung giờ vào</option><option value="CHECK_OUT">Chỉ bổ sung giờ ra</option><option value="EXTRA_HOURS">Cộng thêm giờ thủ công (làm xuyên trưa...)</option></select></label>
                {manualForm.mode === 'FULL_DAY' && <><label className="form-field"><span>Giờ vào</span><input type="time" value={manualForm.checkInTime} onChange={e => setManualForm(p => ({ ...p, checkInTime: e.target.value }))}/></label><label className="form-field"><span>Giờ ra</span><input type="time" value={manualForm.checkOutTime} onChange={e => setManualForm(p => ({ ...p, checkOutTime: e.target.value }))}/></label></>}
                {manualForm.mode === 'EXTRA_HOURS' && <label className="form-field"><span>Số giờ cộng thêm *</span><input type="number" required min="0.25" max="8" step="0.25" value={manualForm.extraHours} onChange={e => setManualForm(p => ({ ...p, extraHours: e.target.value }))}/></label>}
                {['CHECK_IN','CHECK_OUT'].includes(manualForm.mode) && <label className="form-field"><span>Thời gian *</span><input type="time" required value={manualForm.time} onChange={e => setManualForm(p => ({ ...p, time: e.target.value }))}/></label>}
                <label className="form-field full-field"><span>Lý do chấm công hộ *</span><textarea required rows="2" value={manualForm.reason} onChange={e => setManualForm(p => ({ ...p, reason: e.target.value }))} placeholder={manualForm.mode === 'EXTRA_HOURS' ? 'Ví dụ: Làm xuyên trưa, không nghỉ trưa 1 giờ...' : 'Ví dụ: Nhân viên quên chấm công, điện thoại hết pin...'}/></label>
              </div>
              <div className="form-actions"><button type="button" className="outline" onClick={() => setShowManualForm(false)}>Hủy</button><button className="primary" disabled={busy || !employees.some(x => x.id === manualForm.employeeId && x.role === 'EMPLOYEE')}>{busy ? 'Đang lưu...' : (manualForm.mode === 'EXTRA_HOURS' ? 'Lưu giờ cộng thêm' : 'Lưu chấm công')}</button></div>
            </form>
          </section>
        )}

        {showForm && <FormPanel tab={tab} form={form} setField={changeField} onSubmit={saveForm} onClose={closeForm} busy={busy} editing={editing} locations={locations} employees={employees} isAdmin={isAdmin} />}

        <section className="data-panel"><div className="data-panel-head"><div><h3>{tab === 'employees' ? 'Danh sách nhân sự' : `Danh sách ${tabLabel(tab, role).toLowerCase()}`}</h3><p>{filteredData.length} bản ghi</p></div><div className="table-tools"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm dữ liệu..."/></div><button className="icon-button small" onClick={load} title="Tải lại"><RefreshCw size={15}/></button></div></div>
          {busy ? <div className="empty-state"><span className="loader"/> Đang tải dữ liệu...</div> : filteredData.length === 0 ? <div className="empty-state"><div className="empty-icon"><Filter size={23}/></div><b>Chưa có dữ liệu</b><span>Không tìm thấy bản ghi phù hợp.</span></div> : <div className="table-scroll"><DataTable
  tab={tab}
  rows={filteredData}
  employees={employees}
  locations={locations}
  attendanceLocationId={attendanceLocationId} currentUser={user} isAdmin={isAdmin} canReview={canReview} onEdit={openEdit} onToggleEmployee={toggleEmployee} onToggleLocation={toggleLocation} onReview={reviewRequest} reviewNote={reviewNote} setReviewNote={setReviewNote} onDeleteExtra={deleteExtraHours} onEditDay={openEditDay} editDay={editDay} setEditDay={setEditDay} onSaveEditDay={saveEditDay} busy={busy} /> </div>}
        </section>
      </>}
      <footer className="app-footer">© {new Date().getFullYear()} WorkTime · Hệ thống quản lý chấm công</footer>
    </main>
  </div>;
}

function tabDescription(tab, role) {
  const descriptions = { office: 'Những ai đã chấm công vào ca sẽ xuất hiện trong văn phòng.', employees: role === 'ADMIN' ? 'Tạo mới, cập nhật và phân công nhân sự vào chi nhánh.' : 'Danh sách nhân viên thuộc chi nhánh được phân công.', attendance: 'Theo dõi lịch sử vào ca và ra ca.', locations: 'Quản lý địa điểm và phạm vi chấm công GPS.', shifts: 'Thiết lập thời gian làm việc và thời gian nghỉ.', leaves: 'Theo dõi và xử lý các yêu cầu nghỉ phép.', overtime: 'Theo dõi và xử lý yêu cầu làm thêm giờ.', timesheet: 'Tổng hợp ngày công, giờ cộng thêm, giờ tăng ca và ngày nghỉ của nhân viên.' };
  return descriptions[tab] || '';
}
function createLabel(tab) { return ({ employees: 'Thêm nhân viên', locations: 'Thêm chi nhánh', shifts: 'Tạo ca làm', leaves: 'Tạo đơn nghỉ phép', overtime: 'Tạo đơn tăng ca' })[tab] || 'Thêm mới'; }
