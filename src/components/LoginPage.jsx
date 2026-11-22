// Component trang đăng nhập: giao diện thương hiệu, đồng hồ và form nhập email/mật khẩu.
import React from 'react';
import { Clock, Eye, EyeOff } from 'lucide-react';
import { LoginClock } from './ClockComponents';

export default function LoginPage({
  email, password, showPw, busy, error,
  onEmailChange, onPasswordChange, onTogglePassword, onSubmit
}) {
  return <main className="login-page">
    <section className="login-art">
      <div className="brand on-dark">
        <span className="brand-mark"><Clock size={20}/></span>
        <div><b>WorkTime</b><small>Quản lý chấm công</small></div>
      </div>
      <div className="login-art-body">
        <LoginClock/>
        <h2>Chấm công vào ra chỉ trong một chạm.</h2>
        <p>Ghi nhận bằng GPS, duyệt nghỉ phép và tăng ca, tổng hợp ngày công cuối tháng.</p>
      </div>
      <small className="login-art-foot">© {new Date().getFullYear()} WorkTime</small>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Đăng nhập</h1>
        <p>Dùng email công ty để vào WorkTime.</p>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" value={email} onChange={onEmailChange}
          placeholder="name@company.com" autoComplete="username" required/>
        <label htmlFor="login-password">Mật khẩu</label>
        <div className="password-field">
          <input id="login-password" type={showPw ? 'text' : 'password'} value={password}
            onChange={onPasswordChange} placeholder="Nhập mật khẩu"
            autoComplete="current-password" required/>
          <button type="button" className="pw-toggle" onClick={onTogglePassword}
            aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
            {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
          </button>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="primary full" disabled={busy}>{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
      </form>
    </section>
  </main>;
}
