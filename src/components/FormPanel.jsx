// Component form chung: sinh ô nhập liệu theo từng tab như nhân viên, chi nhánh, ca làm, nghỉ phép và tăng ca.
import React from 'react';
import { X } from 'lucide-react';
import { createLabel } from './constants';

export default function FormPanel({
  tab, form, setField, onSubmit, onClose, busy, editing,
  locations, employees, isAdmin
}) {
  const field = (key, label, type = 'text', required = false, extra = {}) =>
    <label className="form-field" key={key}>
      <span>{label}{required && <i> *</i>}</span>
      <input type={type} value={form[key] ?? ''} onChange={e => setField(key, e.target.value)} required={required} {...extra}/>
    </label>;

  const select = (key, label, options, required = false) =>
    <label className="form-field" key={key}>
      <span>{label}{required && <i> *</i>}</span>
      <select value={form[key] ?? ''} onChange={e => setField(key, e.target.value)} required={required}>
        <option value="">-- Chọn --</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>;

  const textarea = (key, label, required = false) =>
    <label className="form-field full-field" key={key}>
      <span>{label}{required && <i> *</i>}</span>
      <textarea rows="2" value={form[key] ?? ''} onChange={e => setField(key, e.target.value)} required={required}/>
    </label>;

  let fields = [];
  if (tab === 'employees') fields = [
    field('employeeCode', 'Mã nhân viên'),
    field('fullName', 'Họ và tên', 'text', true),
    field('email', 'Email', 'email', true),
    !editing && field('password', 'Mật khẩu', 'password', true, { minLength: 8 }),
    editing && field('password', 'Mật khẩu mới (để trống nếu không đổi)', 'password'),
    field('phone', 'Số điện thoại', 'tel'),
    select('gender', 'Giới tính', [
      { value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }, { value: 'OTHER', label: 'Khác' }
    ]),
    field('dateOfBirth', 'Ngày sinh', 'date'),
    field('hireDate', 'Ngày vào làm', 'date'),
    field('department', 'Phòng ban'),
    field('position', 'Chức vụ'),
    select('role', 'Vai trò', [
      { value: 'EMPLOYEE', label: 'Nhân viên' },
      { value: 'MANAGER', label: 'Quản lý' },
      ...(isAdmin ? [{ value: 'ADMIN', label: 'Admin' }] : [])
    ], true),
    select('locationId', 'Chi nhánh', locations.filter(x => x.active).map(x => ({ value: x.id, label: x.name })),
      form.role !== 'ADMIN'),
    textarea('address', 'Địa chỉ')
  ].filter(Boolean);

  if (tab === 'locations') fields = [
    field('name', 'Tên chi nhánh', 'text', true),
    field('address', 'Địa chỉ'),
    field('latitude', 'Vĩ độ', 'number', true, { step: 'any', min: -90, max: 90 }),
    field('longitude', 'Kinh độ', 'number', true, { step: 'any', min: -180, max: 180 }),
    field('radius', 'Bán kính chấm công (m)', 'number', true, { min: 1 })
  ];
  if (tab === 'shifts') fields = [
    field('name', 'Tên ca làm', 'text', true),
    field('startTime', 'Giờ bắt đầu', 'time', true),
    field('endTime', 'Giờ kết thúc', 'time', true),
    field('breakMins', 'Thời gian nghỉ (phút)', 'number', false, { min: 0 })
  ];
  if (tab === 'leaves') fields = [
    field('fromDate', 'Từ ngày', 'date', true),
    field('toDate', 'Đến ngày', 'date', true),
    textarea('reason', 'Lý do nghỉ phép', true)
  ];
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

  return <section className="form-panel">
    <div className="form-panel-head">
      <div><h3>{editing ? 'Cập nhật thông tin' : createLabel(tab)}</h3><p>Các trường có dấu * là bắt buộc.</p></div>
      <button className="icon-button" onClick={onClose}><X size={18}/></button>
    </div>
    <form onSubmit={onSubmit}>
      <div className="form-grid">{fields}</div>
      <div className="form-actions">
        <button type="button" className="outline" onClick={onClose}>Hủy</button>
        <button className="primary" disabled={busy}>{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo mới'}</button>
      </div>
    </form>
  </section>;
}
