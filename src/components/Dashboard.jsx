// Component trang Tổng quan: đồng hồ, trạng thái chấm công, thẻ thống kê, bản đồ và lối tắt nhanh.
import React from 'react';
import {
  CalendarDays, CheckCircle, BriefcaseBusiness, LogOut, MapPin, Users, Clock
} from 'lucide-react';
import { ClockReadout, DayTrack, useClockNow } from './ClockComponents';

function QuickLink({ icon: Icon, title, hint, onClick }) {
  return <button className="quick-link" onClick={onClick}>
    <span className="ql-icon"><Icon size={18} /></span>
    <span className="ql-text"><b>{title}</b><small>{hint}</small></span>
  </button>;
}

function ClockPanel({
  user, isEmployee, checkedIn, checkInTime, checkedOut, checkOutTime,
  onPunch, busy, onNavigate
}) {
  const now = useClockNow();
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
        <button className={checkedIn ? 'punch-btn in done' : 'punch-btn in'}
          onClick={() => onPunch('CHECK_IN')} disabled={busy || checkedIn}>
          <CheckCircle size={26}/>
          <span>{checkedIn ? 'Đã chấm công vào' : 'Chấm công vào'}
            <small>{checkedIn ? (checkInTime ? `Lúc ${checkInTime}` : 'Hôm nay') : 'Bắt đầu ca làm'}</small>
          </span>
        </button>
        <button className={checkedOut ? 'punch-btn out done' : 'punch-btn out'}
          onClick={() => onPunch('CHECK_OUT')} disabled={busy || checkedOut}>
          <LogOut size={26}/>
          <span>{checkedOut ? 'Đã chấm công ra' : 'Chấm công ra'}
            <small>{checkedOut ? (checkOutTime ? `Lúc ${checkOutTime}` : 'Hôm nay') : 'Kết thúc ca làm'}</small>
          </span>
        </button>
        <p className="clock-note">Bật GPS và đứng trong phạm vi chi nhánh khi chấm công.</p>
      </> : <div className="action-grid">
        {adminLinks.map(([id, title, hint, Icon]) =>
          <button key={id} className="action-tile" onClick={() => onNavigate(id)}>
            <Icon size={22}/><span><b>{title}</b><small>{hint}</small></span>
          </button>
        )}
      </div>}
    </div>
  </section>;
}

function StatCard({ icon: Icon, label, value, tone }) {
  return <article className="stat-card">
    <span className={`stat-icon ${tone}`}><Icon size={20}/></span>
    <div><span>{label}</span><b>{value}</b></div>
  </article>;
}

export default function Dashboard({
  stats, role, locations, user, checkedIn, checkInTime, checkedOut,
  checkOutTime, onPunch, busy, onNavigate
}) {
  const isEmployee = role === 'EMPLOYEE';
  const loc = isEmployee ? locations?.[0] : null;
  const hasMap = loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude));

  return <div className="dashboard-content">
    <ClockPanel user={user} isEmployee={isEmployee} checkedIn={checkedIn}
      checkInTime={checkInTime} checkedOut={checkedOut} checkOutTime={checkOutTime}
      onPunch={onPunch} busy={busy} onNavigate={onNavigate} />

    <div className="stat-grid">
      <StatCard icon={Users} label="Nhân viên" value={stats?.employees ?? '—'} tone="blue" />
      <StatCard icon={Clock} label="Lượt chấm hôm nay" value={stats?.attendance?.length ?? 0} tone="purple" />
      <StatCard icon={CalendarDays} label="Đơn nghỉ chờ duyệt" value={stats?.pendingLeaves ?? '—'} tone="orange" />
      <StatCard icon={BriefcaseBusiness} label="Đơn tăng ca chờ duyệt" value={stats?.pendingOvertime ?? '—'} tone="green" />
    </div>

    {isEmployee && <div className="dashboard-grid">
      <section className="map-card">
        {hasMap ? <>
          <iframe title="Vị trí công ty"
            src={`https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&z=16&output=embed`}
            loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
          <div className="map-info">
            <b><MapPin size={17}/> {loc.name}</b>
            <span>{loc.address || 'Địa chỉ chi nhánh chưa cập nhật'}</span>
            <a href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
              target="_blank" rel="noreferrer">Xem đường đi trên Google Maps</a>
          </div>
        </> : <div className="map-empty"><MapPin size={28}/><span>Chưa có thông tin vị trí chi nhánh</span></div>}
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
