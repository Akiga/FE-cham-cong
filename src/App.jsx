import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, CalendarDays, CheckCircle, Clock, Download, Edit3, Eye, EyeOff, ChevronRight,
  LogOut, MapPin, Plus, RefreshCw, Search, Users, Wallet, X, XCircle,
  Building2, BriefcaseBusiness, UserRound, Ban, Check, Filter
} from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const NAV = [
  ['dashboard', 'Tổng quan', Activity], ['attendance', 'Chấm công', MapPin],
  ['employees', 'Nhân viên', Users], ['locations', 'Chi nhánh', Building2],
  ['shifts', 'Ca làm', Clock], ['leaves', 'Nghỉ phép', CalendarDays],
  ['overtime', 'Tăng ca', BriefcaseBusiness], ['payroll', 'Bảng lương', Wallet]
];
const tabLabel = (id, role) =>
  id === 'attendance' && (role === 'ADMIN' || role === 'MANAGER')
    ? 'Quản lý chấm công'
    : (NAV.find(item => item[0] === id)?.[1] || '');
const money = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(n) || 0);
const date = v => v ? new Date(v).toLocaleDateString('vi-VN') : '—';
const dateTime = v => v ? new Date(v).toLocaleString('vi-VN') : '—';
const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => today().slice(0, 7);
const statusText = v => ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CHECK_IN: 'Vào ca', CHECK_OUT: 'Ra ca' }[v] || v || '—');

const tone = s => 'tone-' + ((String(s || 'N').codePointAt(0) || 0) % 5);
const pad2 = n => String(n).padStart(2, '0');

const EMPTY_EMPLOYEE = { employeeCode: '', fullName: '', email: '', password: '', phone: '', gender: '', dateOfBirth: '', address: '', department: '', position: '', hireDate: today(), role: 'EMPLOYEE', baseSalary: 0, locationId: '' };
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
    if (id === 'payroll') return true;
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
      if (tab === 'dashboard') {
        setStats(await api('/dashboard')); setData([]);
      } else {
        const params = new URLSearchParams();
        if (tab === 'attendance') { if (filterFrom) params.set('from', filterFrom); if (filterTo) params.set('to', filterTo); }
        if (tab === 'payroll' && filterMonth) params.set('month', filterMonth);
        const routes = { employees: '/employees', attendance: '/attendance', locations: '/locations', shifts: '/shifts', leaves: '/leaves', overtime: '/overtime', payroll: '/payroll' };
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
        ['baseSalary'].forEach(k => payload[k] = Number(payload[k] || 0));
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

  async function exportPayroll() {
  try {
    const response = await fetch(
      `${API}/payroll/export?month=${encodeURIComponent(filterMonth)}`,
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
    a.download = `tong-hop-cong-${filterMonth}.xlsx`;
    a.click();

    URL.revokeObjectURL(url);
    notify('Đã xuất bảng tổng hợp chấm công');
  } catch (e) {
    notify(e.message, true);
  }
}

  

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase(); if (!q) return data;
    return data.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  if (!token) return <main className="login-page">
    <section className="login-art">
      <div className="brand on-dark"><span className="brand-mark"><Clock size={20} /></span><div><b>WorkTime</b><small>Quản lý chấm công</small></div></div>
      <div className="login-art-body">
        <LoginClock />
        <h2>Chấm công vào ra chỉ trong một chạm.</h2>
        <p>Ghi nhận bằng GPS, duyệt nghỉ phép và tăng ca, tổng hợp ngày công cuối tháng.</p>
      </div>
      <small className="login-art-foot">© {new Date().getFullYear()} WorkTime</small>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={login}>
        <h1>Đăng nhập</h1>
        <p>Dùng email công ty để vào WorkTime.</p>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="username" required />
        <label htmlFor="login-password">Mật khẩu</label>
        <div className="password-field">
          <input id="login-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password" required />
          <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="primary full" disabled={busy}>{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
      </form>
    </section>
  </main>;

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

      {tab !== 'dashboard' && <>
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
          {tab === 'payroll' && <input className="filter-input" type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />}
          {tab === 'payroll' && canReview && (
            <button className="outline" onClick={exportPayroll}>
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
  attendanceLocationId={attendanceLocationId} currentUser={user} isAdmin={isAdmin} canReview={canReview} onEdit={openEdit} onToggleEmployee={toggleEmployee} onToggleLocation={toggleLocation} onReview={reviewRequest} reviewNote={reviewNote} setReviewNote={setReviewNote} onDeleteExtra={deleteExtraHours} /> </div>}
        </section>
      </>}
      <footer className="app-footer">© {new Date().getFullYear()} WorkTime · Hệ thống quản lý chấm công</footer>
    </main>
  </div>;
}

function tabDescription(tab, role) {
  const descriptions = { employees: role === 'ADMIN' ? 'Tạo mới, cập nhật và phân công nhân sự vào chi nhánh.' : 'Danh sách nhân viên thuộc chi nhánh được phân công.', attendance: 'Theo dõi lịch sử vào ca và ra ca.', locations: 'Quản lý địa điểm và phạm vi chấm công GPS.', shifts: 'Thiết lập thời gian làm việc và thời gian nghỉ.', leaves: 'Theo dõi và xử lý các yêu cầu nghỉ phép.', overtime: 'Theo dõi và xử lý yêu cầu làm thêm giờ.', payroll: 'Tổng hợp ngày công, giờ tăng ca và ngày nghỉ của nhân viên.' };
  return descriptions[tab] || '';
}
function createLabel(tab) { return ({ employees: 'Thêm nhân viên', locations: 'Thêm chi nhánh', shifts: 'Tạo ca làm', leaves: 'Tạo đơn nghỉ phép', overtime: 'Tạo đơn tăng ca', payroll: 'Nhập bảng lương' })[tab] || 'Thêm mới'; }

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Digits({ text }) {
  return <span className="digits" aria-hidden="true">{[...text].map((ch, i) => <span key={i} className={ch === ':' ? 'colon' : 'digit'}>{ch}</span>)}</span>;
}

// Thanh tiến độ ngày làm việc: ca sáng 08:00–12:00, nghỉ trưa, ca chiều 13:00–17:00.
function DayTrack({ now }) {
  const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const segments = [{ from: 8, to: 12 }, { from: 12, to: 13, lunch: true }, { from: 13, to: 17 }];
  const fill = s => Math.max(0, Math.min(1, (hour - s.from) / (s.to - s.from)));
  const ticks = [[8, '08:00'], [12, '12:00'], [13, '13:00'], [17, '17:00']];
  return <div className="day-track" role="img" aria-label="Tiến độ ngày làm việc từ 08:00 đến 17:00">
    <div className="track-bars">{segments.map(s => <div key={s.from} className={s.lunch ? 'track-seg lunch' : 'track-seg'} style={{ flex: s.to - s.from }}>{!s.lunch && <i style={{ width: `${fill(s) * 100}%` }} />}</div>)}</div>
    <div className="track-ticks">{ticks.map(([h, label]) => <span key={h} style={{ left: `${((h - 8) / 9) * 100}%` }}>{label}</span>)}</div>
  </div>;
}

function ClockReadout({ now, greeting }) {
  const dateText = now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return <div className="clock-readout">
    {greeting && <p className="clock-greeting">{greeting}</p>}
    <div className="clock-time" aria-label={now.toLocaleTimeString('vi-VN')}>
      <span className="hm"><Digits text={`${pad2(now.getHours())}:${pad2(now.getMinutes())}`} /></span>
      <span className="sec"><Digits text={pad2(now.getSeconds())} /></span>
    </div>
    <p className="clock-date">{dateText}</p>
  </div>;
}

function LoginClock() {
  const now = useNow();
  return <div><ClockReadout now={now} /><DayTrack now={now} /></div>;
}

function QuickLink({ icon: Icon, title, hint, onClick }) {
  return <button className="quick-link" onClick={onClick}><span className="ql-icon"><Icon size={18} /></span><span className="ql-text"><b>{title}</b><small>{hint}</small></span><ChevronRight size={18} className="ql-chevron" /></button>;
}

function ClockPanel({ user, isEmployee, checkedIn, checkInTime, checkedOut, checkOutTime, onPunch, busy, onNavigate }) {
  const now = useNow();
  const hour = now.getHours();
  const hello = hour < 11 ? 'Chào buổi sáng' : hour < 13 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const givenName = (user?.fullName || '').trim().split(/\s+/).pop();
  const adminLinks = [
    ['attendance', 'Quản lý chấm công', 'Lịch sử và chấm công thủ công', MapPin],
    ['employees', 'Nhân viên', 'Danh sách nhân sự', Users],
    ['leaves', 'Duyệt nghỉ phép', 'Xử lý đơn chờ duyệt', CalendarDays],
    ['overtime', 'Duyệt tăng ca', 'Xử lý yêu cầu làm thêm', BriefcaseBusiness]
  ];
  return <section className="clock-panel">
    <div>
      <ClockReadout now={now} greeting={givenName ? `${hello}, ${givenName}` : hello} />
      <DayTrack now={now} />
    </div>
    <div className="clock-side">
      {isEmployee ? <>
        <button className={checkedIn ? 'punch-btn in done' : 'punch-btn in'} onClick={() => onPunch('CHECK_IN')} disabled={busy || checkedIn}><CheckCircle size={26} /><span>{checkedIn ? 'Đã chấm công vào' : 'Chấm công vào'}<small>{checkedIn ? (checkInTime ? `Lúc ${checkInTime}` : 'Hôm nay') : 'Bắt đầu ca làm'}</small></span></button>
        <button className={checkedOut ? 'punch-btn out done' : 'punch-btn out'} onClick={() => onPunch('CHECK_OUT')} disabled={busy || checkedOut}><LogOut size={26} /><span>{checkedOut ? 'Đã chấm công ra' : 'Chấm công ra'}<small>{checkedOut ? (checkOutTime ? `Lúc ${checkOutTime}` : 'Hôm nay') : 'Kết thúc ca làm'}</small></span></button>
        <p className="clock-note">Bật GPS và đứng trong phạm vi chi nhánh khi chấm công.</p>
      </> : <div className="action-grid">
        {adminLinks.map(([id, title, hint, Icon]) => <button key={id} className="action-tile" onClick={() => onNavigate(id)}><Icon size={22} /><span><b>{title}</b><small>{hint}</small></span></button>)}
      </div>}
    </div>
  </section>;
}

function Dashboard({ stats, role, locations, user, checkedIn, checkInTime, checkedOut, checkOutTime, onPunch, busy, onNavigate }) {
  const isEmployee = role === 'EMPLOYEE';
  const loc = isEmployee ? locations?.[0] : null;
  const hasMap = loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude));
  return <div className="dashboard-content">
    <ClockPanel user={user} isEmployee={isEmployee} checkedIn={checkedIn} checkInTime={checkInTime} checkedOut={checkedOut} checkOutTime={checkOutTime} onPunch={onPunch} busy={busy} onNavigate={onNavigate} />

    <div className="stat-grid">
      <StatCard icon={Users} label="Nhân viên" value={stats?.employees ?? '—'} tone="blue" />
      <StatCard icon={Clock} label="Lượt chấm hôm nay" value={stats?.attendance?.length ?? 0} tone="purple" />
      <StatCard icon={CalendarDays} label="Đơn nghỉ chờ duyệt" value={stats?.pendingLeaves ?? '—'} tone="orange" />
      <StatCard icon={Wallet} label="Đơn tăng ca chờ duyệt" value={stats?.pendingOvertime ?? '—'} tone="green" />
    </div>

    {isEmployee && <div className="dashboard-grid">
      <section className="map-card">
        {hasMap ? <>
          <iframe
            title="Vị trí công ty"
            src={`https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&z=16&output=embed`}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="map-info">
            <b><MapPin size={17} /> {loc.name}</b>
            <span>{loc.address || 'Địa chỉ chi nhánh chưa cập nhật'}</span>
            <a href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noreferrer">Xem đường đi trên Google Maps</a>
          </div>
        </> : <div className="map-empty"><MapPin size={28} /><span>Chưa có thông tin vị trí chi nhánh</span></div>}
      </section>
      <section className="dashboard-card">
        <div className="card-heading"><h3>Truy cập nhanh</h3><p>Các khu vực bạn dùng thường xuyên</p></div>
        <div className="quick-links">
          <QuickLink icon={MapPin} title="Lịch sử chấm công" hint="Xem thời gian vào và ra" onClick={() => onNavigate('attendance')} />
          <QuickLink icon={CalendarDays} title="Đơn nghỉ phép" hint="Gửi hoặc theo dõi đơn" onClick={() => onNavigate('leaves')} />
          <QuickLink icon={BriefcaseBusiness} title="Đơn tăng ca" hint="Gửi yêu cầu làm thêm" onClick={() => onNavigate('overtime')} />
        </div>
      </section>
    </div>}
  </div>;
}
function StatCard({ icon: Icon, label, value, tone }) { return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={20}/></span><div><span>{label}</span><b>{value}</b></div></article>; }

function FormPanel({ tab, form, setField, onSubmit, onClose, busy, editing, locations, employees, isAdmin }) {
  const field = (key, label, type = 'text', required = false, extra = {}) => <label className="form-field" key={key}><span>{label}{required && <i> *</i>}</span><input type={type} value={form[key] ?? ''} onChange={e => setField(key, e.target.value)} required={required} {...extra}/></label>;
  const select = (key, label, options, required = false) => <label className="form-field" key={key}><span>{label}{required && <i> *</i>}</span><select value={form[key] ?? ''} onChange={e => setField(key, e.target.value)} required={required}><option value="">-- Chọn --</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  const textarea = (key, label, required = false) => <label className="form-field full-field" key={key}><span>{label}{required && <i> *</i>}</span><textarea rows="2" value={form[key] ?? ''} onChange={e => setField(key, e.target.value)} required={required}/></label>;
  let fields = [];
  if (tab === 'employees') fields = [field('employeeCode', 'Mã nhân viên'), field('fullName', 'Họ và tên', 'text', true), field('email', 'Email', 'email', true), !editing && field('password', 'Mật khẩu', 'password', true, { minLength: 8 }), editing && field('password', 'Mật khẩu mới (để trống nếu không đổi)', 'password'), field('phone', 'Số điện thoại', 'tel'), select('gender', 'Giới tính', [{ value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }, { value: 'OTHER', label: 'Khác' }]), field('dateOfBirth', 'Ngày sinh', 'date'), field('hireDate', 'Ngày vào làm', 'date'), field('department', 'Phòng ban'), field('position', 'Chức vụ'), field('baseSalary', 'Lương cơ bản', 'number', false, { min: 0 }), select('role', 'Vai trò', [{ value: 'EMPLOYEE', label: 'Nhân viên' }, { value: 'MANAGER', label: 'Quản lý' }, ...(isAdmin ? [{ value: 'ADMIN', label: 'Admin' }] : [])], true), select('locationId', 'Chi nhánh', locations.filter(x => x.active).map(x => ({ value: x.id, label: x.name })), form.role !== 'ADMIN'), textarea('address', 'Địa chỉ')].filter(Boolean);
  if (tab === 'locations') fields = [field('name', 'Tên chi nhánh', 'text', true), field('address', 'Địa chỉ'), field('latitude', 'Vĩ độ', 'number', true, { step: 'any', min: -90, max: 90 }), field('longitude', 'Kinh độ', 'number', true, { step: 'any', min: -180, max: 180 }), field('radius', 'Bán kính chấm công (m)', 'number', true, { min: 1 })];
  if (tab === 'shifts') fields = [field('name', 'Tên ca làm', 'text', true), field('startTime', 'Giờ bắt đầu', 'time', true), field('endTime', 'Giờ kết thúc', 'time', true), field('breakMins', 'Thời gian nghỉ (phút)', 'number', false, { min: 0 })];
  if (tab === 'leaves') fields = [field('fromDate', 'Từ ngày', 'date', true), field('toDate', 'Đến ngày', 'date', true), textarea('reason', 'Lý do nghỉ phép', true)];
  if (tab === 'overtime') fields = [
    field('workDate', 'Ngày tăng ca', 'date', true),
    select('overtimeType', 'Loại tăng ca', [
      { value: 'WEEKDAY_15', label: 'Tăng ca ngày thường (x1.5)' },
      { value: 'SUNDAY_2', label: 'Tăng ca Chủ nhật đến 17:00 (x2)' },
      { value: 'SUNDAY_NIGHT_35', label: 'Tăng ca Chủ nhật sau 17:00 (x3.5)' }
    ], true),
    field('hours', 'Số giờ đăng ký', 'number', true, { min: 0.1, step: '0.1' }),
    textarea('reason', 'Lý do tăng ca', true)
  ];
  return <section className="form-panel"><div className="form-panel-head"><div><h3>{editing ? 'Cập nhật thông tin' : createLabel(tab)}</h3><p>Các trường có dấu * là bắt buộc.</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></div><form onSubmit={onSubmit}><div className="form-grid">{fields}</div><div className="form-actions"><button type="button" className="outline" onClick={onClose}>Hủy</button><button className="primary" disabled={busy}>{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo mới'}</button></div></form></section>;
}

function DataTable({ tab, rows, employees = [], currentUser, locations = [], attendanceLocationId = '', isAdmin, canReview, onEdit, onToggleEmployee, onToggleLocation, onReview, reviewNote, setReviewNote, onDeleteExtra }) {
  const getEmployeeName = (row) => {
    if (row?.user?.fullName) return row.user.fullName;
    const userId = row?.userId;
    if (!userId) return '—';
    if (currentUser?.id && String(currentUser.id) === String(userId)) {
      return currentUser.fullName || userId;
    }
    const employee = employees.find(e => String(e.id) === String(userId));
    return employee?.fullName || userId;
  };
  if (tab === 'employees') return <table><thead><tr><th>Nhân viên</th><th>Mã NV</th><th>Phòng ban</th><th>Chức vụ</th><th>Chi nhánh</th><th>Vai trò</th><th>Lương cơ bản</th><th>Trạng thái</th>{isAdmin && <th>Thao tác</th>}</tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><div className="person-cell"><span className={`table-avatar ${tone(r.fullName)}`}>{(r.fullName || 'N').slice(0,1)}</span><span><b>{r.fullName}</b><small>{r.email}</small></span></div></td><td>{r.employeeCode || '—'}</td><td>{r.department || '—'}</td><td>{r.position || '—'}</td><td>{r.location?.name || '—'}</td><td><RoleBadge role={r.role}/></td><td>{money(r.baseSalary)}</td><td><StatusBadge value={r.active ? 'ACTIVE' : 'INACTIVE'}/></td>{isAdmin && <td><div className="row-actions"><button className="action-icon" title="Chỉnh sửa" onClick={() => onEdit(r)}><Edit3 size={16}/></button><button className="action-icon" title={r.active ? 'Khóa' : 'Mở khóa'} onClick={() => onToggleEmployee(r)}>{r.active ? <Ban size={16}/> : <Check size={16}/>}</button></div></td>}</tr>)}</tbody></table>;
  if (tab === 'locations') return <table><thead><tr><th>Chi nhánh</th><th>Địa chỉ</th><th>Vĩ độ</th><th>Kinh độ</th><th>Bán kính</th><th>Trạng thái</th>{isAdmin && <th>Thao tác</th>}</tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><b>{r.name}</b></td><td>{r.address || '—'}</td><td>{r.latitude}</td><td>{r.longitude}</td><td>{r.radius} m</td><td><StatusBadge value={r.active ? 'ACTIVE' : 'INACTIVE'}/></td>{isAdmin && <td><div className="row-actions"><button className="action-icon" onClick={() => onEdit(r)} title="Sửa"><Edit3 size={16}/></button><button className="action-icon" onClick={() => onToggleLocation(r)} title="Bật/tắt">{r.active ? <Ban size={16}/> : <Check size={16}/>}</button></div></td>}</tr>)}</tbody></table>;
  if (tab === 'shifts') return <table><thead><tr><th>Tên ca</th><th>Bắt đầu</th><th>Kết thúc</th><th>Nghỉ giữa ca</th><th>Trạng thái</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><b>{r.name}</b></td><td>{r.startTime}</td><td>{r.endTime}</td><td>{r.breakMins} phút</td><td><StatusBadge value={r.active ? 'ACTIVE' : 'INACTIVE'}/></td></tr>)}</tbody></table>;
  if (tab === 'attendance') {
    // Ghép các lần CHECK_IN/CHECK_OUT của cùng nhân viên trong cùng ngày thành một dòng.
    const grouped = new Map();
    rows.forEach(r => {
      const stamp = r.timestamp ? new Date(r.timestamp) : null;
      const validStamp = stamp && !Number.isNaN(stamp.getTime()) ? stamp : null;
      const day = validStamp
        ? `${validStamp.getFullYear()}-${String(validStamp.getMonth() + 1).padStart(2, '0')}-${String(validStamp.getDate()).padStart(2, '0')}`
        : 'unknown-date';
      const key = `${r.userId || 'unknown-user'}_${day}`;
      if (!grouped.has(key)) 
        grouped.set(key, {
          key,
          userId: r.userId,
          day,
          locationId: r.locationId || null,
          checkIn: null,
          checkOut: null,
          notes: [],
          workFraction: null,
          earlyBonus: 0,
          manualBonus: 0,
          extraId: null,
          manual: false
        });
      const item = grouped.get(key);
      if (String(r.type || '').toUpperCase() === 'EXTRA_HOURS') {
        // Giờ cộng thêm nhập thủ công: không ảnh hưởng số công của ngày
        item.manualBonus += Number(r.manualBonusHours || 0);
        item.extraId = r.id;
      } else {
        const fraction = Number(r.workFraction ?? 1);
        item.workFraction = item.workFraction === null ? fraction : Math.min(item.workFraction, fraction);
        if (r.source === 'MANUAL') item.manual = true;
        item.earlyBonus = Math.max(item.earlyBonus, Number(r.earlyBonusHours || 0));
      }
      const type = String(r.type || '').toUpperCase();
      if (type === 'CHECK_IN' && validStamp && (!item.checkIn || validStamp < item.checkIn)) item.checkIn = validStamp;
      if (type === 'CHECK_OUT' && validStamp && (!item.checkOut || validStamp > item.checkOut)) item.checkOut = validStamp;
      if (r.note && !item.notes.includes(r.note)) item.notes.push(r.note);
    });
    const getEmployee = userId =>
  employees.find(e => String(e.id) === String(userId));

const getBranchName = (userId, attendanceLocationId) => {
  const employee = employees.find(
    e => String(e.id) === String(userId)
  );

  const locationId =
    attendanceLocationId ||
    employee?.locationId ||
    employee?.location?.id ||
    (
      String(currentUser?.id) === String(userId)
        ? currentUser?.locationId
        : null
    );

  return (
    employee?.location?.name ||
    locations.find(l => String(l.id) === String(locationId))?.name ||
    'Chưa phân chi nhánh'
  );
};

const attendanceRows = [...grouped.values()]
  .filter(row => {
    if (!attendanceLocationId) return true;

    const employee = getEmployee(row.userId);

    const locationId =
      row.locationId ||
      employee?.locationId ||
      employee?.location?.id ||
      (String(currentUser?.id) === String(row.userId)
        ? currentUser?.locationId
        : '');

    return String(locationId) === String(attendanceLocationId);
  })
  .sort((a, b) => b.day.localeCompare(a.day));
    const timeOnly = value => value ? value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';
    return <table><thead><tr><th>Họ tên</th><th>Chi nhánh</th><th>Thời gian vào</th><th>Thời gian ra</th><th>Công</th><th>Giờ cộng thêm</th><th>Hình thức</th><th>Ghi chú</th></tr></thead><tbody>{attendanceRows.map(r => <tr key={r.key}><td><div className="person-cell"><span className={`table-avatar ${tone(getEmployeeName({ userId: r.userId }))}`}>{(getEmployeeName({ userId: r.userId }) || 'N').slice(0, 1).toUpperCase()}</span><span><b>{getEmployeeName({ userId: r.userId })}</b><small>{r.day === 'unknown-date' ? 'Không rõ ngày' : date(`${r.day}T00:00:00`)}</small></span></div></td>
<td>{getBranchName(r.userId, r.locationId)}</td>
<td>{timeOnly(r.checkIn)}</td><td>{timeOnly(r.checkOut)}</td><td>{r.workFraction === null ? '—' : r.workFraction === 0.5 ? '0,5' : '1'}</td><td>{(r.earlyBonus + r.manualBonus) > 0 ? <>+{String(Number((r.earlyBonus + r.manualBonus).toFixed(2))).replace('.', ',')} giờ{r.manualBonus > 0 && r.earlyBonus > 0 && <small> (vào sớm {String(r.earlyBonus).replace('.', ',')} + thủ công {String(r.manualBonus).replace('.', ',')})</small>}</> : '—'}</td><td>{r.manual || r.workFraction === null ? 'Thủ công' : 'GPS'}</td><td>{r.notes.join(' · ') || '—'}{canReview && r.extraId && <button className="reject-btn" style={{ marginLeft: 8 }} title="Xóa giờ cộng thêm thủ công" onClick={() => onDeleteExtra(r.extraId)}><X size={14}/></button>}</td></tr>)}</tbody></table>;
  }
  if (tab === 'leaves' || tab === 'overtime') return <table><thead><tr><th>Nhân viên</th>{tab === 'leaves' ? <><th>Từ ngày</th><th>Đến ngày</th></> : <><th>Ngày tăng ca</th><th>Loại tăng ca</th><th>Số giờ</th></>}<th>Lý do</th><th>Trạng thái</th><th>Ghi chú duyệt</th>{canReview && <th>Xử lý</th>}</tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{getEmployeeName(r)}</td>{tab === 'leaves' ? <><td>{date(r.fromDate)}</td><td>{date(r.toDate)}</td></> : <><td>{date(r.workDate)}</td><td>{({
      WEEKDAY_15: 'Ngày thường (x1.5)',
      SUNDAY_2: 'Chủ nhật (x2)',
      SUNDAY_NIGHT_35: 'Chủ nhật sau 17h (x3.5)'
    })[r.overtimeType] || 'Chưa phân loại'}</td><td>{r.hours} giờ</td></>}<td className="reason-cell">{r.reason || '—'}</td><td><StatusBadge value={r.status}/></td><td>{r.reviewNote || '—'}</td>{canReview && <td>{r.status === 'PENDING' ? <div className="review-cell"><input placeholder="Ghi chú duyệt" value={reviewNote[r.id] || ''} onChange={e => setReviewNote(prev => ({ ...prev, [r.id]: e.target.value }))}/><div><button className="approve-btn" onClick={() => onReview(tab, r, 'APPROVED')} title="Duyệt"><Check size={15}/></button><button className="reject-btn" onClick={() => onReview(tab, r, 'REJECTED')} title="Từ chối"><X size={15}/></button></div></div> : '—'}</td>}</tr>)}</tbody></table>;
  if (tab === 'payroll') {
  return (
    <table>
      <thead>
        <tr>
          <th>Nhân viên</th>
          <th>Mã nhân viên</th>
          <th>Phòng ban</th>
          <th>Tổng ngày công</th>
          <th>Giờ cộng thêm</th>
          <th>Tăng ca x1.5</th>
          <th>Tăng ca x2</th>
          <th>Tăng ca x3.5</th>
          <th>Tổng ngày nghỉ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td>
              <div className="person-cell">
                <span className={`table-avatar ${tone(r.fullName)}`}>
                  {(r.fullName || 'N').slice(0, 1).toUpperCase()}
                </span>
                <span><b>{r.fullName}</b></span>
              </div>
            </td>
            <td>{r.employeeCode || '—'}</td>
            <td>{r.department || '—'}</td>
            <td><b>{r.totalWorkDays}</b> ngày</td>
            <td><b>{r.bonusHours ?? r.earlyBonusHours ?? 0}</b> giờ{r.manualBonusHours > 0}</td>
            <td>{r.overtimeWeekday15 || 0} giờ</td>
            <td>{r.overtimeSunday2 || 0} giờ</td>
            <td>{r.overtimeSundayNight35 || 0} giờ</td>
            <td>{r.leaveDays} ngày</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
  return null;
}
function RoleBadge({ role }) { return <span className={`role-badge ${String(role).toLowerCase()}`}>{({ ADMIN: 'Admin', MANAGER: 'Quản lý', EMPLOYEE: 'Nhân viên' })[role] || role}</span>; }
function StatusBadge({ value }) { const v = String(value || '').toLowerCase(); const label = value === 'ACTIVE' ? 'Hoạt động' : value === 'INACTIVE' ? 'Đã khóa' : statusText(value); return <span className={`status-badge ${v}`}>{label}</span>; }