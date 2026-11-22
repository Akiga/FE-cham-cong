// Component bảng dữ liệu: chọn cấu trúc bảng theo tab và gom dữ liệu chấm công theo nhân viên/ngày.
import React from 'react';
import { Ban, Check, Edit3, X } from 'lucide-react';
import { date, statusText, tone } from './constants';

export function RoleBadge({ role }) {
  return <span className={`role-badge ${String(role).toLowerCase()}`}>
    {({ ADMIN: 'Admin', MANAGER: 'Quản lý', EMPLOYEE: 'Nhân viên' })[role] || role}
  </span>;
}

export function StatusBadge({ value }) {
  const v = String(value || '').toLowerCase();
  const label = value === 'ACTIVE' ? 'Hoạt động'
    : value === 'INACTIVE' ? 'Đã khóa' : statusText(value);
  return <span className={`status-badge ${v}`}>{label}</span>;
}

export default function DataTable({
  tab, rows, employees = [], currentUser, locations = [], attendanceLocationId = '',
  isAdmin, canReview, onEdit, onToggleEmployee, onToggleLocation, onReview,
  reviewNote, setReviewNote, onDeleteExtra, onEditDay, editDay, setEditDay, onSaveEditDay, busy
}) {
  const getEmployeeName = row => {
    if (row?.user?.fullName) return row.user.fullName;
    const userId = row?.userId;
    if (!userId) return '—';
    if (currentUser?.id && String(currentUser.id) === String(userId)) return currentUser.fullName || userId;
    return employees.find(e => String(e.id) === String(userId))?.fullName || userId;
  };

  if (tab === 'employees') return <table>
    <thead><tr><th>Nhân viên</th><th>Mã NV</th><th>Phòng ban</th><th>Chức vụ</th><th>Chi nhánh</th><th>Vai trò</th><th>Trạng thái</th>{isAdmin && <th>Thao tác</th>}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id}>
      <td><div className="person-cell"><span className={`table-avatar ${tone(r.fullName)}`}>{(r.fullName || 'N').slice(0, 1)}</span><span><b>{r.fullName}</b><small>{r.email}</small></span></div></td>
      <td>{r.employeeCode || '—'}</td><td>{r.department || '—'}</td><td>{r.position || '—'}</td>
      <td>{r.location?.name || '—'}</td><td><RoleBadge role={r.role}/></td>
      <td><StatusBadge value={r.active ? 'ACTIVE' : 'INACTIVE'}/></td>
      {isAdmin && <td><div className="row-actions">
        <button className="action-icon" title="Chỉnh sửa" onClick={() => onEdit(r)}><Edit3 size={16}/></button>
        <button className="action-icon" title={r.active ? 'Khóa' : 'Mở khóa'} onClick={() => onToggleEmployee(r)}>{r.active ? <Ban size={16}/> : <Check size={16}/>}</button>
      </div></td>}
    </tr>)}</tbody>
  </table>;

  if (tab === 'locations') return <table>
    <thead><tr><th>Chi nhánh</th><th>Địa chỉ</th><th>Vĩ độ</th><th>Kinh độ</th><th>Bán kính</th><th>Trạng thái</th>{isAdmin && <th>Thao tác</th>}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id}>
      <td><b>{r.name}</b></td><td>{r.address || '—'}</td><td>{r.latitude}</td><td>{r.longitude}</td>
      <td>{r.radius} m</td><td><StatusBadge value={r.active ? 'ACTIVE' : 'INACTIVE'}/></td>
      {isAdmin && <td><div className="row-actions">
        <button className="action-icon" onClick={() => onEdit(r)} title="Sửa"><Edit3 size={16}/></button>
        <button className="action-icon" onClick={() => onToggleLocation(r)} title="Bật/tắt">{r.active ? <Ban size={16}/> : <Check size={16}/>}</button>
      </div></td>}
    </tr>)}</tbody>
  </table>;

  if (tab === 'shifts') return <table>
    <thead><tr><th>Tên ca</th><th>Bắt đầu</th><th>Kết thúc</th><th>Nghỉ giữa ca</th><th>Trạng thái</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.id}>
      <td><b>{r.name}</b></td><td>{r.startTime}</td><td>{r.endTime}</td>
      <td>{r.breakMins} phút</td><td><StatusBadge value={r.active ? 'ACTIVE' : 'INACTIVE'}/></td>
    </tr>)}</tbody>
  </table>;

  if (tab === 'attendance') {
    const grouped = new Map();
    rows.forEach(r => {
      const stamp = r.timestamp ? new Date(r.timestamp) : null;
      const validStamp = stamp && !Number.isNaN(stamp.getTime()) ? stamp : null;
      const day = validStamp
        ? `${validStamp.getFullYear()}-${String(validStamp.getMonth() + 1).padStart(2, '0')}-${String(validStamp.getDate()).padStart(2, '0')}`
        : 'unknown-date';
      const key = `${r.userId || 'unknown-user'}_${day}`;
      if (!grouped.has(key)) grouped.set(key, {
        key, userId: r.userId, day, locationId: r.locationId || null, checkIn: null, checkOut: null,
        notes: [], workFraction: null, manualBonus: 0, extraId: null, manual: false
      });
      const item = grouped.get(key);
      if (String(r.type || '').toUpperCase() === 'EXTRA_HOURS') {
        item.manualBonus += Number(r.manualBonusHours || 0);
        item.extraId = r.id;
      } else {
        const fraction = Number(r.workFraction ?? 1);
        item.workFraction = item.workFraction === null ? fraction : Math.min(item.workFraction, fraction);
        if (r.source === 'MANUAL') item.manual = true;
      }
      const type = String(r.type || '').toUpperCase();
      if (type === 'CHECK_IN' && validStamp && (!item.checkIn || validStamp < item.checkIn)) item.checkIn = validStamp;
      if (type === 'CHECK_OUT' && validStamp && (!item.checkOut || validStamp > item.checkOut)) item.checkOut = validStamp;
      if (r.note && !item.notes.includes(r.note)) item.notes.push(r.note);
    });

    const getEmployee = userId => employees.find(e => String(e.id) === String(userId));
    const getBranchName = (userId, rowLocationId) => {
      const employee = getEmployee(userId);
      const locationId = rowLocationId || employee?.locationId || employee?.location?.id ||
        (String(currentUser?.id) === String(userId) ? currentUser?.locationId : null);
      return employee?.location?.name || locations.find(l => String(l.id) === String(locationId))?.name || 'Chưa phân chi nhánh';
    };
    const attendanceRows = [...grouped.values()].filter(row => {
      if (!attendanceLocationId) return true;
      const employee = getEmployee(row.userId);
      const locationId = row.locationId || employee?.locationId || employee?.location?.id ||
        (String(currentUser?.id) === String(row.userId) ? currentUser?.locationId : '');
      return String(locationId) === String(attendanceLocationId);
    }).sort((a, b) => b.day.localeCompare(a.day));
    const timeOnly = value => value ? value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';
    const displayNotes = notes => {
      const normalized = notes.flatMap(note => String(note).split('|')).map(note => note.trim()).filter(Boolean);
      const adjustments = normalized.filter(note => note.startsWith('Điều chỉnh:'));
      if (adjustments.length) return adjustments[adjustments.length - 1];
      const reasons = normalized
        .map(note => note.replace(/^Chấm công thủ công:\s*/i, '').trim())
        .filter(note => note && !note.startsWith('Điều chỉnh:'));
      return [...new Set(reasons)].join(' · ') || '—';
    };

    return <table>
      <thead><tr><th>Họ tên</th><th>Chi nhánh</th><th>Thời gian vào</th><th>Thời gian ra</th><th>Công</th><th>Giờ cộng thêm</th><th>Hình thức</th><th>Ghi chú</th>{canReview && <th>Thao tác</th>}</tr></thead>
      <tbody>{attendanceRows.map(r => <React.Fragment key={r.key}>
        <tr>
        <td><div className="person-cell"><span className={`table-avatar ${tone(getEmployeeName({ userId: r.userId }))}`}>{(getEmployeeName({ userId: r.userId }) || 'N').slice(0, 1).toUpperCase()}</span><span><b>{getEmployeeName({ userId: r.userId })}</b><small>{r.day === 'unknown-date' ? 'Không rõ ngày' : date(`${r.day}T00:00:00`)}</small></span></div></td>
        <td>{getBranchName(r.userId, r.locationId)}</td><td>{timeOnly(r.checkIn)}</td><td>{timeOnly(r.checkOut)}</td>
        <td>{r.workFraction === null ? '—' : r.workFraction === 0.5 ? '0,5' : r.workFraction === 0 ? '0' : '1'}</td>
        <td>{r.manualBonus > 0 ? `+${String(Number(r.manualBonus.toFixed(2))).replace('.', ',')} giờ` : '—'}</td>
        <td>{r.manual || r.workFraction === null ? 'Thủ công' : 'GPS'}</td>
        <td className="attendance-note" title={displayNotes(r.notes)}>
          <span>{displayNotes(r.notes)}</span>
          {canReview && r.extraId && <button className="reject-btn" style={{ marginLeft: 8 }} title="Xóa giờ cộng thêm thủ công" onClick={() => onDeleteExtra(r.extraId)}><X size={14}/></button>}
        </td>
        {canReview && <td><div className="row-actions"><button className="action-icon" title="Chỉnh sửa giờ công" onClick={() => onEditDay(r)}><Edit3 size={16}/></button></div></td>}
        </tr>
        {editDay && String(editDay.employeeId) === String(r.userId) && editDay.date === r.day && (
          <tr className="attendance-edit-row">
            <td colSpan={canReview ? 10 : 9}>
              <section className="inline-edit-panel">
                <div className="inline-edit-head">
                  <div>
                    <h3>Chỉnh sửa giờ công</h3>
                    <p>{getEmployeeName({ userId: r.userId })} · {date(`${r.day}T00:00:00`)}</p>
                  </div>
                  <button type="button" className="icon-button" onClick={() => setEditDay(null)}><X size={18}/></button>
                </div>
                <form onSubmit={onSaveEditDay}>
                  <div className="inline-edit-grid">
                    <label className="form-field"><span>Giờ vào</span><input type="time" value={editDay.checkInTime} onChange={e => setEditDay(p => ({ ...p, checkInTime: e.target.value }))}/></label>
                    <label className="form-field"><span>Giờ ra</span><input type="time" value={editDay.checkOutTime} onChange={e => setEditDay(p => ({ ...p, checkOutTime: e.target.value }))}/></label>
                    <label className="form-field"><span>Số công</span><select value={editDay.workFraction} onChange={e => setEditDay(p => ({ ...p, workFraction: e.target.value }))}><option value="1">1 công</option><option value="0.5">0,5 công</option><option value="0">0 công</option></select></label>
                    <label className="form-field"><span>Giờ cộng thêm</span><input type="number" min="0" max="8" step="0.25" value={editDay.extraHours} onChange={e => setEditDay(p => ({ ...p, extraHours: e.target.value }))}/></label>
                    <label className="form-field full-field"><span>Lý do chỉnh sửa <i> *</i></span><textarea required rows="2" value={editDay.reason} onChange={e => setEditDay(p => ({ ...p, reason: e.target.value }))} placeholder="Ví dụ: Nhân viên chấm sai giờ, quên chấm ra..."/></label>
                  </div>
                  <div className="form-actions"><button type="button" className="outline" onClick={() => setEditDay(null)}>Hủy</button><button className="primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu chỉnh sửa'}</button></div>
                </form>
              </section>
            </td>
          </tr>
        )}
      </React.Fragment>)}</tbody>
    </table>;
  }

  if (tab === 'leaves' || tab === 'overtime') return <table>
    <thead><tr><th>Nhân viên</th>{tab === 'leaves' ? <><th>Từ ngày</th><th>Đến ngày</th></> : <><th>Ngày tăng ca</th><th>Loại tăng ca</th><th>Số giờ</th></>}<th>Lý do</th><th>Trạng thái</th><th>Ghi chú duyệt</th>{canReview && <th>Xử lý</th>}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id}>
      <td>{getEmployeeName(r)}</td>
      {tab === 'leaves' ? <><td>{date(r.fromDate)}</td><td>{date(r.toDate)}</td></> : <>
        <td>{date(r.workDate)}</td>
        <td>{({ WEEKDAY_15: 'Ngày thường (x1.5)', SUNDAY_2: 'Chủ nhật (x2)', SUNDAY_NIGHT_35: 'Chủ nhật sau 17h (x3.5)' })[r.overtimeType] || 'Chưa phân loại'}</td>
        <td>{r.hours} giờ</td>
      </>}
      <td className="reason-cell">{r.reason || '—'}</td><td><StatusBadge value={r.status}/></td><td>{r.reviewNote || '—'}</td>
      {canReview && <td>{r.status === 'PENDING' ? <div className="review-cell">
        <input placeholder="Ghi chú duyệt" value={reviewNote[r.id] || ''} onChange={e => setReviewNote(prev => ({ ...prev, [r.id]: e.target.value }))}/>
        <div><button className="approve-btn" onClick={() => onReview(tab, r, 'APPROVED')} title="Duyệt"><Check size={15}/></button><button className="reject-btn" onClick={() => onReview(tab, r, 'REJECTED')} title="Từ chối"><X size={15}/></button></div>
      </div> : '—'}</td>}
    </tr>)}</tbody>
  </table>;

  if (tab === 'timesheet') return <table>
    <thead><tr><th>Nhân viên</th><th>Mã nhân viên</th><th>Phòng ban</th><th>Tổng ngày công</th><th>Giờ cộng thêm</th><th>Tăng ca x1.5</th><th>Tăng ca x2</th><th>Tăng ca x3.5</th><th>Tổng ngày nghỉ</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.id}>
      <td><div className="person-cell"><span className={`table-avatar ${tone(r.fullName)}`}>{(r.fullName || 'N').slice(0, 1).toUpperCase()}</span><span><b>{r.fullName}</b></span></div></td>
      <td>{r.employeeCode || '—'}</td><td>{r.department || '—'}</td><td><b>{r.totalWorkDays}</b> ngày</td>
      <td><b>{r.bonusHours || 0}</b> giờ</td><td>{r.overtimeWeekday15 || 0} giờ</td>
      <td>{r.overtimeSunday2 || 0} giờ</td><td>{r.overtimeSundayNight35 || 0} giờ</td><td>{r.leaveDays} ngày</td>
    </tr>)}</tbody>
  </table>;

  return null;
}
