export default function Ring({ percent = 0, size = 180, stroke = 14 }) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * Math.min(percent / 100, 1);
  const ok = percent >= 100;
  const color = ok ? '#16a34a' : '#2563eb';

  return (
    <svg width={size} height={size} className="ring">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e6ea" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray .4s ease' }}
      />
    </svg>
  );
}
