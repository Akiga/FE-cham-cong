# Cấu trúc component FE

- `App.jsx`: Bộ điều phối chính của ứng dụng. Quản lý phiên đăng nhập, role, điều hướng tab, gọi API, state dữ liệu chung và xử lý các thao tác CRUD.
- `components/constants.js`: Hằng số API, menu, nhãn tab, hàm định dạng ngày giờ, trạng thái và màu sắc dùng chung.
- `components/ClockComponents.jsx`: Các thành phần đồng hồ thời gian thực, hiển thị ngày giờ, đồng hồ trang đăng nhập và thanh tiến độ ca làm.
- `components/Dashboard.jsx`: Giao diện tổng quan, nút chấm công, thống kê, bản đồ chi nhánh và truy cập nhanh.
- `components/FormPanel.jsx`: Form tạo/cập nhật dùng chung cho nhân viên, chi nhánh, ca làm, nghỉ phép và tăng ca.
- `components/DataTable.jsx`: Các bảng dữ liệu riêng theo từng tab, gồm nhân viên, chi nhánh, ca làm, chấm công, đơn duyệt và bảng công.
- `components/LoginPage.jsx`: Giao diện đăng nhập, nhập thông tin tài khoản và hiển thị đồng hồ.

Quy tắc phân tách: `App.jsx` giữ luồng nghiệp vụ và truyền callback xuống component con; component con chủ yếu nhận props để hiển thị và phát sự kiện. Các hàm gọi API và thay đổi dữ liệu nằm tại `App.jsx`.
