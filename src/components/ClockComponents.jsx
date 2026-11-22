// Nhóm component đồng hồ: cung cấp thời gian thực, đồng hồ đăng nhập và tiến độ ca làm.
import React, { useEffect, useState } from 'react';
import { pad2 } from './constants';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Digits({ text }) {
  return <span className="digits" aria-hidden="true">
    {[...text].map((ch, i) => <span key={i} className={ch === ':' ? 'colon' : 'digit'}>{ch}</span>)}
  </span>;
}

// Hiển thị tiến độ từ 08:00 đến 17:00, có ngăn nghỉ trưa 12:00–13:00.
export function DayTrack({ now }) {
  const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const segments = [{ from: 8, to: 12 }, { from: 12, to: 13, lunch: true }, { from: 13, to: 17 }];
  const fill = s => Math.max(0, Math.min(1, (hour - s.from) / (s.to - s.from)));
  const ticks = [[8, '08:00'], [12, '12:00'], [13, '13:00'], [17, '17:00']];
  return <div className="day-track" role="img" aria-label="Tiến độ ngày làm việc từ 08:00 đến 17:00">
    <div className="track-bars">
      {segments.map(s => <div key={s.from} className={s.lunch ? 'track-seg lunch' : 'track-seg'} style={{ flex: s.to - s.from }}>
        {!s.lunch && <i style={{ width: `${fill(s) * 100}%` }} />}
      </div>)}
    </div>
    <div className="track-ticks">
      {ticks.map(([h, label]) => <span key={h} style={{ left: `${((h - 8) / 9) * 100}%` }}>{label}</span>)}
    </div>
  </div>;
}

export function ClockReadout({ now, greeting }) {
  const dateText = now.toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  return <div className="clock-readout">
    {greeting && <p className="clock-greeting">{greeting}</p>}
    <div className="clock-time" aria-label={now.toLocaleTimeString('vi-VN')}>
      <span className="hm"><Digits text={`${pad2(now.getHours())}:${pad2(now.getMinutes())}`} /></span>
      <span className="sec"><Digits text={pad2(now.getSeconds())} /></span>
    </div>
    <p className="clock-date">{dateText}</p>
  </div>;
}

export function LoginClock() {
  const now = useNow();
  return <div><ClockReadout now={now} /><DayTrack now={now} /></div>;
}

export function useClockNow() {
  return useNow();
}
