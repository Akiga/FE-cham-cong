// Chia sẻ hằng số, cấu hình API và các hàm định dạng dùng chung giữa các component.
export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const NAV = [
  ['dashboard', 'Tổng quan', 'Activity'],
  ['attendance', 'Chấm công', 'MapPin'],
  ['employees', 'Nhân viên', 'Users'],
  ['locations', 'Chi nhánh', 'Building2'],
  ['shifts', 'Ca làm', 'Clock'],
  ['leaves', 'Nghỉ phép', 'CalendarDays'],
  ['overtime', 'Tăng ca', 'BriefcaseBusiness'],
  ['timesheet', 'Bảng công', 'CheckCircle']
];

export const tabLabel = (id, role) =>
  id === 'attendance' && (role === 'ADMIN' || role === 'MANAGER')
    ? 'Quản lý chấm công'
    : (NAV.find(item => item[0] === id)?.[1] || '');

export const tabDescription = (tab, role) => {
  const descriptions = {
    employees: role === 'ADMIN'
      ? 'Tạo mới, cập nhật và phân công nhân sự vào chi nhánh.'
      : 'Danh sách nhân viên thuộc chi nhánh được phân công.',
    attendance: 'Theo dõi lịch sử vào ca và ra ca.',
    locations: 'Quản lý địa điểm và phạm vi chấm công GPS.',
    shifts: 'Thiết lập thời gian làm việc và thời gian nghỉ.',
    leaves: 'Theo dõi và xử lý các yêu cầu nghỉ phép.',
    overtime: 'Theo dõi và xử lý yêu cầu làm thêm giờ.',
    timesheet: 'Tổng hợp ngày công, giờ cộng thêm, giờ tăng ca và ngày nghỉ của nhân viên.'
  };
  return descriptions[tab] || '';
};

export const createLabel = tab =>
  ({ employees: 'Thêm nhân viên', locations: 'Thêm chi nhánh', shifts: 'Tạo ca làm',
    leaves: 'Tạo đơn nghỉ phép', overtime: 'Tạo đơn tăng ca' })[tab] || 'Thêm mới';

export const date = v => v ? new Date(v).toLocaleDateString('vi-VN') : '—';
export const dateTime = v => v ? new Date(v).toLocaleString('vi-VN') : '—';
export const today = () => new Date().toISOString().slice(0, 10);
export const monthNow = () => today().slice(0, 7);
export const statusText = v =>
  ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối',
    CHECK_IN: 'Vào ca', CHECK_OUT: 'Ra ca' })[v] || v || '—';
export const tone = s => 'tone-' + ((String(s || 'N').codePointAt(0) || 0) % 5);
export const pad2 = n => String(n).padStart(2, '0');
