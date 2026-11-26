// Văn phòng 3D: chỉ nhân viên đã chấm công vào ca (và chưa chấm công ra) mới xuất hiện.
// Nhân viên mới chấm công sẽ đi từ cửa vào chỗ ngồi; chấm công ra thì đi ra cửa rồi biến mất.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Users, RefreshCw } from 'lucide-react';

const POLL_MS = 20000;
const WALK_SPEED = 1.6;
const SHIRTS = ['#087f8c', '#2f5b86', '#b0352a', '#c27a12', '#6a4c93', '#2a9d8f', '#e07a5f', '#3d5a80'];
const HAIRS = ['#2b2118', '#4a3320', '#1c1c1c', '#7a5230', '#8a8a8a'];
const SKINS = ['#f1c9a5', '#e0a97d', '#c68b5c', '#8d5a3b', '#f6d9bf'];

const rand = (a, b) => a + Math.random() * (b - a);
const hash = str => { let h = 0; for (const c of String(str)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
const pick = (list, h, shift) => list[(h >> shift) % list.length];
const v3 = (x, z) => new THREE.Vector3(x, 0, z);
const hhmm = value => value
  ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
  : '';

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ───────── Bố cục phòng ─────────
// Bàn xếp thành lưới, giữa các hàng bàn có lối đi; khu nghỉ (sofa, bàn họp, máy nước) nằm phía trước.
function makeLayout(count) {
  const slots = Math.max(count, 6);
  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(slots * 1.4))));
  const rows = Math.ceil(slots / cols);
  const SX = 2.6, SZ = 3.4, LOUNGE = 6;
  const W = cols * SX + 3.4;
  const rowsDepth = rows * SZ;
  const D = rowsDepth + LOUNGE + 1.2;
  const desks = Array.from({ length: slots }, (_, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const x = -((cols - 1) * SX) / 2 + c * SX;
    const z = -D / 2 + 2 + r * SZ;
    return { x, z, aisleZ: z + 1.9, chairZ: z + 0.95 };
  });
  const loungeTop = -D / 2 + rowsDepth + 1.3;
  const topZ = loungeTop + 0.3;
  const zl = (loungeTop + D / 2) / 2;
  const cx = W / 2 - 0.8;
  const doorZ = D / 2 - 1.3;
  const approach = topZ + 0.6;
  const sofaLane = W / 2 - 3.3;
  const spots = [
    { pos: v3(-1.4, zl + 0.2), face: Math.PI / 2, sit: false, via: [v3(-1.4, approach)] },
    { pos: v3(1.4, zl + 0.2), face: -Math.PI / 2, sit: false, via: [v3(1.4, approach)] },
    { pos: v3(0, zl - 1.4), face: 0, sit: false, via: [v3(0, approach)] },
    { pos: v3(0, zl + 1.8), face: Math.PI, sit: false, via: [v3(-2.4, approach), v3(-2.4, zl + 1.8)] },
    { pos: v3(-W / 2 + 1.5, zl - 0.6), face: -Math.PI / 2, sit: false, via: [v3(-W / 2 + 1.5, approach)] },
    { pos: v3(W / 2 - 1.1, zl - 0.8), face: -Math.PI / 2, sit: true, via: [v3(sofaLane, approach), v3(sofaLane, zl - 0.8)] },
    { pos: v3(W / 2 - 1.1, zl + 1.2), face: -Math.PI / 2, sit: true, via: [v3(sofaLane, approach), v3(sofaLane, zl + 1.2)] }
  ];
  return { cols, rows, W, D, desks, loungeTop, topZ, zl, cx, doorZ, doorX: -W / 2 + 0.25, entryX: -W / 2 + 2.4, approach, spots, sofaLane };
}

// Đoạn đường từ đường ngang phía trước xuống chỗ ngồi của một bàn.
function laneUp(L, desk) {
  const s = desk.x >= 0 ? 1 : -1;
  return [v3(s * L.cx, L.topZ), v3(s * L.cx, desk.aisleZ), v3(desk.x, desk.aisleZ), v3(desk.x, desk.chairZ)];
}
const routeEnter = (L, desk) => [v3(L.entryX, L.doorZ), v3(L.entryX, L.topZ), ...laneUp(L, desk)];
const routeToSpot = (L, desk, spot) => [...laneUp(L, desk).reverse(), ...spot.via, spot.pos.clone()];
const routeBackToDesk = (L, desk, spot) => [...[...spot.via].reverse(), ...laneUp(L, desk)];
const routeExitFromDesk = (L, desk) => [...laneUp(L, desk).reverse(), v3(L.entryX, L.topZ), v3(L.entryX, L.doorZ), v3(L.doorX, L.doorZ)];
const routeExitFromSpot = (L, spot) => [...[...spot.via].reverse(), v3(L.entryX, L.approach), v3(L.entryX, L.doorZ), v3(L.doorX, L.doorZ)];

// ───────── Đồ nội thất ─────────
function Box({ pos, size, color, rough = 0.8, cast = true, ...rest }) {
  return <mesh position={pos} castShadow={cast} receiveShadow {...rest}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={rough} />
  </mesh>;
}

function Desk({ desk, occupied }) {
  const { x, z, chairZ } = desk;
  return <group>
    <Box pos={[x, 0.72, z]} size={[1.7, 0.07, 0.85]} color="#e9eef0" />
    <Box pos={[x - 0.78, 0.36, z]} size={[0.06, 0.72, 0.75]} color="#9fb2b6" />
    <Box pos={[x + 0.78, 0.36, z]} size={[0.06, 0.72, 0.75]} color="#9fb2b6" />
    <Box pos={[x, 0.95, z - 0.25]} size={[0.62, 0.38, 0.04]} color={occupied ? '#67d4d8' : '#1b2a30'} cast={false} />
    <Box pos={[x, 0.78, z - 0.25]} size={[0.14, 0.1, 0.1]} color="#4b5c61" />
    <Box pos={[x, 0.77, z + 0.12]} size={[0.5, 0.025, 0.16]} color="#cfd8da" cast={false} />
    <group position={[x, 0, chairZ]}>
      <Box pos={[0, 0.42, 0]} size={[0.5, 0.07, 0.5]} color="#31505a" />
      <Box pos={[0, 0.75, 0.24]} size={[0.5, 0.58, 0.07]} color="#31505a" />
      <Box pos={[0, 0.2, 0]} size={[0.06, 0.4, 0.06]} color="#6b7b80" />
    </group>
  </group>;
}

function Plant({ x, z }) {
  return <group position={[x, 0, z]}>
    <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.25, 0.2, 0.5, 12]} /><meshStandardMaterial color="#c9774f" roughness={0.9} /></mesh>
    <mesh position={[0, 0.85, 0]} castShadow><sphereGeometry args={[0.5, 12, 10]} /><meshStandardMaterial color="#3c8f5a" roughness={0.9} /></mesh>
    <mesh position={[0.2, 1.2, 0.05]} castShadow><sphereGeometry args={[0.32, 10, 8]} /><meshStandardMaterial color="#4aa86c" roughness={0.9} /></mesh>
  </group>;
}

function Lounge({ L }) {
  const { W, zl } = L;
  return <group>
    {/* Bàn họp tròn */}
    <mesh position={[0, 0.72, zl + 0.2]} castShadow receiveShadow><cylinderGeometry args={[0.8, 0.8, 0.07, 28]} /><meshStandardMaterial color="#d9c3a0" roughness={0.6} /></mesh>
    <mesh position={[0, 0.36, zl + 0.2]} castShadow><cylinderGeometry args={[0.09, 0.09, 0.72, 10]} /><meshStandardMaterial color="#6b7b80" /></mesh>
    {/* Sofa */}
    <Box pos={[W / 2 - 1.0, 0.3, zl + 0.2]} size={[0.9, 0.5, 3.0]} color="#2f5b86" />
    <Box pos={[W / 2 - 0.58, 0.7, zl + 0.2]} size={[0.2, 0.7, 3.0]} color="#274c70" />
    <Box pos={[W / 2 - 1.0, 0.58, zl - 1.35]} size={[0.9, 0.3, 0.2]} color="#274c70" />
    <Box pos={[W / 2 - 1.0, 0.58, zl + 1.75]} size={[0.9, 0.3, 0.2]} color="#274c70" />
    {/* Bàn trà */}
    <mesh position={[W / 2 - 2.5, 0.3, zl + 0.2]} castShadow receiveShadow><cylinderGeometry args={[0.4, 0.4, 0.06, 20]} /><meshStandardMaterial color="#e9eef0" roughness={0.5} /></mesh>
    <mesh position={[W / 2 - 2.5, 0.15, zl + 0.2]}><cylinderGeometry args={[0.05, 0.05, 0.3, 8]} /><meshStandardMaterial color="#6b7b80" /></mesh>
    {/* Máy nước */}
    <Box pos={[-W / 2 + 0.7, 0.55, zl - 0.6]} size={[0.45, 1.1, 0.45]} color="#e9eef0" />
    <mesh position={[-W / 2 + 0.7, 1.35, zl - 0.6]} castShadow><cylinderGeometry args={[0.17, 0.17, 0.45, 14]} /><meshStandardMaterial color="#9fe0e6" transparent opacity={0.75} /></mesh>
  </group>;
}

function Room({ L, occupiedDesks }) {
  const { W, D } = L;
  return <group>
    <mesh position={[0, -0.1, 0]} receiveShadow><boxGeometry args={[W, 0.2, D]} /><meshStandardMaterial color="#e8f0f1" roughness={0.95} /></mesh>
    {/* Thảm khu làm việc */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, (-D / 2 + L.loungeTop) / 2]} receiveShadow>
      <planeGeometry args={[W - 0.4, L.loungeTop + D / 2 - 0.2]} /><meshStandardMaterial color="#d3e5e7" roughness={1} />
    </mesh>
    {/* Sàn gỗ khu nghỉ */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, (L.loungeTop + D / 2) / 2]} receiveShadow>
      <planeGeometry args={[W - 0.4, D / 2 - L.loungeTop - 0.2]} /><meshStandardMaterial color="#e2d3b8" roughness={0.9} />
    </mesh>
    {/* Tường sau + hai bên */}
    <Box pos={[0, 1.5, -D / 2 - 0.1]} size={[W + 0.4, 3, 0.2]} color="#f7fbfb" />
    <Box pos={[-W / 2 - 0.1, 1.5, 0]} size={[0.2, 3, D]} color="#eef6f6" />
    <Box pos={[W / 2 + 0.1, 1.5, 0]} size={[0.2, 3, D]} color="#eef6f6" />
    <Box pos={[0, 0.08, -D / 2 + 0.02]} size={[W, 0.16, 0.06]} color="#b9cfd2" cast={false} />
    {/* Cửa sổ trên tường sau */}
    {[-0.3, 0.3].map(f => <Box key={f} pos={[f * W, 1.7, -D / 2 + 0.01]} size={[Math.min(3.2, W * 0.24), 1.3, 0.04]} color="#bfe6ee" cast={false} />)}
    {/* Cửa vào (tường trái) */}
    <Box pos={[-W / 2 + 0.03, 1.05, L.doorZ]} size={[0.06, 2.1, 1.1]} color="#8f5508" cast={false} />
    <Box pos={[-W / 2 + 0.07, 1.05, L.doorZ + 0.35]} size={[0.04, 0.12, 0.04]} color="#e9eef0" cast={false} />
    {L.desks.map((d, i) => <Desk key={i} desk={d} occupied={occupiedDesks.has(i)} />)}
    <Lounge L={L} />
    <Plant x={-W / 2 + 0.6} z={-D / 2 + 0.6} />
    <Plant x={W / 2 - 0.6} z={-D / 2 + 0.6} />
    <Plant x={W / 2 - 0.6} z={L.loungeTop + 1.3} />
  </group>;
}

// ───────── Nhân viên ─────────
function Person({ person, L, world, isMe, selected, onSelect, onGone }) {
  const root = useRef(), body = useRef(), legL = useRef(), legR = useRef(), armL = useRef(), armR = useRef();
  const desk = L.desks[person.desk];
  const look = useMemo(() => {
    const h = hash(person.id);
    return { shirt: pick(SHIRTS, h, 0), hair: pick(HAIRS, h, 3), skin: pick(SKINS, h, 5) };
  }, [person.id]);

  const leaveReq = useRef(false);
  leaveReq.current = person.leaving;
  const gone = useRef(onGone);
  gone.current = onGone;

  const sim = useRef(null);
  if (!sim.current) {
    const seated = person.spawn === 'seated';
    sim.current = {
      pos: seated ? v3(desk.x, desk.chairZ) : v3(L.doorX, L.doorZ),
      path: seated ? [] : routeEnter(L, desk),
      mode: seated ? 'seated' : 'enter',
      timer: rand(4, 25),
      heading: seated ? Math.PI : Math.PI / 2,
      face: Math.PI,
      sit: seated ? 1 : 0,
      walk: 0,
      phase: rand(0, 6),
      spot: -1
    };
  }

  useEffect(() => () => { world.taken.delete(sim.current.spot); }, [world]);

  useFrame((_, rawDt) => {
    const s = sim.current;
    const dt = Math.min(rawDt, 0.05);
    let moving = false;

    if (s.path.length) {
      const target = s.path[0];
      const dx = target.x - s.pos.x, dz = target.z - s.pos.z;
      const dist = Math.hypot(dx, dz);
      const step = WALK_SPEED * dt;
      if (dist <= Math.max(step, 1e-4)) {
        s.pos.copy(target);
        s.path.shift();
        if (!s.path.length) arrive(s);
      } else {
        s.pos.x += (dx / dist) * step;
        s.pos.z += (dz / dist) * step;
        s.heading = lerpAngle(s.heading, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
        moving = true;
      }
    } else {
      s.heading = lerpAngle(s.heading, s.face, 1 - Math.exp(-6 * dt));
      s.timer -= dt;
      if (s.timer <= 0) next(s);
    }

    const sitTarget = !moving && (s.mode === 'seated' || (s.mode === 'idle' && L.spots[s.spot]?.sit)) ? 1 : 0;
    s.sit += (sitTarget - s.sit) * (1 - Math.exp(-10 * dt));
    s.walk += ((moving ? 1 : 0) - s.walk) * (1 - Math.exp(-10 * dt));
    s.phase += dt * 9 * s.walk;

    const swing = Math.sin(s.phase) * s.walk;
    root.current.position.set(s.pos.x, 0, s.pos.z);
    root.current.rotation.y = s.heading;
    body.current.position.y = -0.37 * s.sit + Math.abs(Math.sin(s.phase)) * 0.04 * s.walk;
    legL.current.rotation.x = swing * 0.7 - (Math.PI / 2) * s.sit;
    legR.current.rotation.x = -swing * 0.7 - (Math.PI / 2) * s.sit;
    armL.current.rotation.x = -swing * 0.6 - 1.1 * s.sit;
    armR.current.rotation.x = swing * 0.6 - 1.1 * s.sit;
  });

  function arrive(s) {
    if (s.mode === 'enter' || s.mode === 'back') {
      s.mode = 'seated'; s.face = Math.PI; s.timer = leaveReq.current ? 0.5 : rand(20, 55);
    } else if (s.mode === 'out') {
      s.mode = 'idle'; s.face = L.spots[s.spot].face; s.timer = leaveReq.current ? 0.4 : rand(6, 14);
    } else if (s.mode === 'exit') {
      gone.current(person.id);
    }
  }

  function next(s) {
    if (s.mode === 'seated') {
      if (leaveReq.current) {
        s.mode = 'exit'; s.path = routeExitFromDesk(L, desk); return;
      }
      const free = L.spots.map((_, i) => i).filter(i => !world.taken.has(i));
      if (!free.length) { s.timer = rand(5, 10); return; }
      s.spot = free[Math.floor(Math.random() * free.length)];
      world.taken.add(s.spot);
      s.mode = 'out'; s.path = routeToSpot(L, desk, L.spots[s.spot]);
    } else if (s.mode === 'idle') {
      const spot = L.spots[s.spot];
      world.taken.delete(s.spot);
      if (leaveReq.current) {
        s.mode = 'exit'; s.path = routeExitFromSpot(L, spot);
      } else {
        s.mode = 'back'; s.path = routeBackToDesk(L, desk, spot);
      }
      s.spot = -1;
    }
  }

  return <group ref={root} onClick={e => { e.stopPropagation(); onSelect(person.id); }}
    onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { document.body.style.cursor = ''; }}>
    {(isMe || selected) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <ringGeometry args={[0.38, 0.5, 28]} />
      <meshBasicMaterial color={selected ? '#f59e0b' : '#67d4d8'} />
    </mesh>}
    <group ref={body}>
      <group ref={legL} position={[-0.11, 0.82, 0]}>
        <mesh position={[0, -0.4, 0]} castShadow><boxGeometry args={[0.16, 0.8, 0.18]} /><meshStandardMaterial color="#2c3e50" /></mesh>
      </group>
      <group ref={legR} position={[0.11, 0.82, 0]}>
        <mesh position={[0, -0.4, 0]} castShadow><boxGeometry args={[0.16, 0.8, 0.18]} /><meshStandardMaterial color="#2c3e50" /></mesh>
      </group>
      <mesh position={[0, 1.17, 0]} castShadow><boxGeometry args={[0.5, 0.62, 0.28]} /><meshStandardMaterial color={look.shirt} roughness={0.7} /></mesh>
      <group ref={armL} position={[-0.33, 1.4, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow><boxGeometry args={[0.12, 0.56, 0.14]} /><meshStandardMaterial color={look.shirt} roughness={0.7} /></mesh>
      </group>
      <group ref={armR} position={[0.33, 1.4, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow><boxGeometry args={[0.12, 0.56, 0.14]} /><meshStandardMaterial color={look.shirt} roughness={0.7} /></mesh>
      </group>
      <mesh position={[0, 1.63, 0]} castShadow><sphereGeometry args={[0.18, 16, 14]} /><meshStandardMaterial color={look.skin} roughness={0.8} /></mesh>
      <mesh position={[0, 1.7, -0.02]} castShadow><sphereGeometry args={[0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} /><meshStandardMaterial color={look.hair} roughness={0.9} /></mesh>
      <Html position={[0, 2.05, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className={'office-tag' + (isMe ? ' me' : '') + (selected ? ' selected' : '')}>
          {person.name}{isMe ? ' (Bạn)' : ''}
        </div>
      </Html>
    </group>
  </group>;
}

function Scene({ L, people, myId, selectedId, onSelect, onGone, world }) {
  const occupied = useMemo(() => new Set(people.map(p => p.desk)), [people]);
  const span = Math.max(L.W, L.D);
  return <>
    <ambientLight intensity={0.75} />
    <hemisphereLight args={['#ffffff', '#c9dcdf', 0.5]} />
    <directionalLight position={[L.W * 0.4, 14, L.D * 0.3]} intensity={1.1} castShadow
      shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span}
      shadow-camera-near={1} shadow-camera-far={40} />
    <Room L={L} occupiedDesks={occupied} />
    {people.map(p => <Person key={p.id} person={p} L={L} world={world} isMe={p.id === myId}
      selected={p.id === selectedId} onSelect={onSelect} onGone={onGone} />)}
    <OrbitControls target={[0, 0.6, 0]} minDistance={5} maxDistance={span * 2} maxPolarAngle={Math.PI / 2.1} enablePan={false} />
  </>;
}

class CanvasBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="office-fallback">Trình duyệt không hiển thị được đồ họa 3D (WebGL). Hãy bật tăng tốc phần cứng hoặc thử trình duyệt khác.</div>
      : this.props.children;
  }
}

// ───────── Trang Văn phòng 3D ─────────
export default function Office3D({ api, user, role, locations }) {
  const isAdmin = role === 'ADMIN';
  const [locationId, setLocationId] = useState('');
  const [staff, setStaff] = useState([]);
  const [people, setPeople] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const firstLoad = useRef(true);
  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    if (isAdmin && !locationId && locations?.length) setLocationId(locations[0].id);
  }, [isAdmin, locationId, locations]);

  const deskOf = useMemo(() => new Map(staff.map((s, i) => [s.id, i])), [staff]);
  const L = useMemo(() => makeLayout(staff.length), [staff.length]);
  const world = useMemo(() => ({ taken: new Set() }), [L]);

  const fetchOffice = useCallback(async () => {
    if (isAdmin && !locationId && locations?.length) return;
    try {
      const result = await apiRef.current(`/office/today${locationId ? `?locationId=${locationId}` : ''}`);
      if (isAdmin && (result.locationId || '') !== locationId) return;
      const list = Array.isArray(result.staff) ? result.staff : [];
      const presentMap = new Map((result.present || []).map(p => [p.id, p.checkInAt]));
      setStaff(prev => (prev.length === list.length && prev.every((s, i) => s.id === list[i].id)) ? prev : list);
      setTruncated(Boolean(result.truncated));
      setError('');
      setPeople(prev => {
        const prevMap = new Map(prev.map(p => [p.id, p]));
        const next = [];
        list.forEach((s, i) => {
          const here = presentMap.has(s.id);
          const old = prevMap.get(s.id);
          if (old) next.push({ ...old, desk: i, name: s.fullName, position: s.position, department: s.department, checkInAt: presentMap.get(s.id) || old.checkInAt, leaving: !here });
          else if (here) next.push({ id: s.id, desk: i, name: s.fullName, position: s.position, department: s.department, checkInAt: presentMap.get(s.id), leaving: false, spawn: firstLoad.current ? 'seated' : 'enter' });
        });
        return next;
      });
      firstLoad.current = false;
      setLoaded(true);
    } catch (e) {
      setError(e.message || 'Không tải được dữ liệu văn phòng');
    }
  }, [isAdmin, locationId, locations]);

  // Đổi chi nhánh: dựng lại phòng từ đầu, nhân viên đang có mặt ngồi sẵn tại bàn.
  useEffect(() => {
    firstLoad.current = true;
    setPeople([]); setStaff([]); setLoaded(false); setSelectedId(null);
  }, [locationId]);

  useEffect(() => {
    fetchOffice();
    const timer = setInterval(fetchOffice, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchOffice(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchOffice]);

  const onGone = useCallback(id => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setSelectedId(cur => (cur === id ? null : cur));
  }, []);

  const presentNow = people.filter(p => !p.leaving).length;
  const selected = people.find(p => p.id === selectedId);
  const span = Math.max(L.W, L.D * 1.1);
  const camera = useMemo(() => ({ position: [0, span * 0.85, span * 0.8], fov: 38 }), [span]);
  const presentIds = new Set(people.filter(p => !p.leaving).map(p => p.id));

  return <div className="office-wrap">
    <div className="office-main">
      <div className="office-bar">
        <span className="office-count"><Users size={16} /> Đang có mặt <b>{presentNow}</b> / {staff.length} nhân viên</span>
        {isAdmin && locations?.length > 0 && <select className="filter-input" value={locationId}
          onChange={e => setLocationId(e.target.value)} aria-label="Chọn chi nhánh">
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>}
        <button className="icon-button small" onClick={fetchOffice} title="Tải lại" aria-label="Tải lại"><RefreshCw size={15} /></button>
      </div>
      <div className="office-stage">
        <CanvasBoundary>
          <Canvas key={`${L.cols}x${L.rows}`} shadows dpr={[1, 2]} camera={camera} onPointerMissed={() => setSelectedId(null)}>
            <Scene L={L} people={people} myId={user?.id} selectedId={selectedId} onSelect={setSelectedId} onGone={onGone} world={world} />
          </Canvas>
        </CanvasBoundary>
        {loaded && presentNow === 0 && <div className="office-empty">Chưa có ai chấm công vào ca. Khi nhân viên chấm công, họ sẽ bước vào văn phòng.</div>}
        {!loaded && !error && <div className="office-empty">Đang tải văn phòng…</div>}
        {error && <div className="office-empty error">{error}</div>}
        {selected && <div className="office-card">
          <b>{selected.name}</b>
          <span>{[selected.position, selected.department].filter(Boolean).join(' · ') || 'Nhân viên'}</span>
          <small>Vào ca lúc {hhmm(selected.checkInAt) || '—'}</small>
        </div>}
        <div className="office-hint">Kéo để xoay · cuộn để phóng to · bấm vào nhân viên để xem thông tin</div>
      </div>
      {truncated && <p className="office-note">Chi nhánh có nhiều nhân viên, chỉ hiển thị 48 người đầu tiên theo tên.</p>}
    </div>
    <aside className="office-side">
      <h3>Nhân viên</h3>
      <ul>
        {staff.map(s => <li key={s.id} className={presentIds.has(s.id) ? 'in' : 'out'}>
          <button disabled={!presentIds.has(s.id)} onClick={() => setSelectedId(s.id)}>
            <i /> <span>{s.fullName}</span>
            <small>{presentIds.has(s.id) ? 'Có mặt' : 'Chưa vào ca'}</small>
          </button>
        </li>)}
        {loaded && staff.length === 0 && <li className="empty">Chưa có nhân viên nào trong chi nhánh.</li>}
      </ul>
    </aside>
  </div>;
}
