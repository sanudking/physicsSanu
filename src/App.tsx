import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownUp,
  ArrowLeftRight,
  Atom,
  FlaskConical,
  Gauge,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Timer,
  Play,
  Pause,
} from 'lucide-react';
import ThreeScene from './ThreeScene';
import {
  collisionVelocities,
  defaultValues,
  pendulumPeriod,
  rampAcceleration,
  type LabId,
  type PhysicsValues,
} from './physics';

type LabInfo = {
  id: LabId;
  title: string;
  short: string;
  description: string;
  icon: typeof Timer;
};

const labs: LabInfo[] = [
  {
    id: 'pendulum',
    title: 'Pendulum',
    short: 'Simple harmonic motion',
    description: 'Change the string length, gravity, or release angle. Drag the bob in the scene to choose a starting angle.',
    icon: Timer,
  },
  {
    id: 'ramp',
    title: 'Inclined plane',
    short: 'Motion on a slope',
    description: 'Release the block from the top of the ramp and see how slope angle and friction affect its motion.',
    icon: ArrowDownUp,
  },
  {
    id: 'torque',
    title: 'Torque balance',
    short: 'Static equilibrium',
    description: 'Change the masses and their distance from the pivot. The beam tilts according to the net torque.',
    icon: Scale,
  },
  {
    id: 'collision',
    title: 'Elastic collision',
    short: 'Momentum and restitution',
    description: 'Launch one ball into another. Adjust the starting height and coefficient of restitution to compare the results.',
    icon: ArrowLeftRight,
  },
];

function format(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  display?: string;
}) {
  return (
    <label className="slider-control">
      <span className="slider-heading">
        <span>{label}</span>
        <strong>{display ?? `${format(value, step < 1 ? 2 : 0)} ${unit}`}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="slider-limits"><span>{min} {unit}</span><span>{max} {unit}</span></span>
    </label>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}{unit ? <small> {unit}</small> : null}</strong>
    </div>
  );
}

export default function App() {
  const [activeLab, setActiveLab] = useState<LabId>('pendulum');
  const [values, setValues] = useState<PhysicsValues>(defaultValues);
  const [running, setRunning] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const activeInfo = labs.find((lab) => lab.id === activeLab) ?? labs[0];
  const update = (key: keyof PhysicsValues, value: number) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const stats = useMemo(() => {
    if (activeLab === 'pendulum') {
      const period = pendulumPeriod(values.length, values.gravity);
      return [
        { label: 'Ideal period', value: format(period, 3), unit: 's' },
        { label: 'Frequency', value: format(1 / period, 3), unit: 'Hz' },
        { label: 'Angular release', value: format(values.pendulumAngle, 1), unit: '°' },
      ];
    }
    if (activeLab === 'ramp') {
      const angle = (values.rampAngle * Math.PI) / 180;
      const rampLength = 4.6;
      const height = rampLength * Math.sin(angle);
      const acceleration = rampAcceleration(values.gravity, values.rampAngle, values.friction);
      const finalSpeed = Math.sqrt(2 * acceleration * rampLength);
      return [
        { label: 'Vertical height', value: format(height), unit: 'm' },
        { label: 'Acceleration', value: format(acceleration), unit: 'm/s²' },
        { label: 'Final speed', value: format(finalSpeed), unit: 'm/s' },
      ];
    }
    if (activeLab === 'torque') {
      const left = values.leftMass * values.gravity * values.armLength;
      const right = values.rightMass * values.gravity * values.armLength;
      return [
        { label: 'Left torque', value: format(left), unit: 'N·m' },
        { label: 'Right torque', value: format(right), unit: 'N·m' },
        { label: 'Net torque', value: format(right - left), unit: 'N·m' },
      ];
    }
    const initialVelocity = Math.sqrt(2 * values.gravity * values.dropHeight);
    const post = collisionVelocities(initialVelocity, values.restitution);
    const energyRatio = ((1 + values.restitution ** 2) / 2) * 100;
    return [
      { label: 'Initial speed', value: format(initialVelocity), unit: 'm/s' },
      { label: 'Ball 1 after impact', value: format(post.first), unit: 'm/s' },
      { label: 'Ball 2 after impact', value: format(post.second), unit: 'm/s' },
      { label: 'Kinetic energy retained', value: format(energyRatio, 1), unit: '%' },
    ];
  }, [activeLab, values]);

  const formulas = {
    pendulum: [
      ['Period', 'T = 2π √(L / g)'],
      ['Angular acceleration', 'α = −(g / L) sin θ'],
    ],
    ramp: [
      ['Acceleration', 'a = g(sin θ − μ cos θ)'],
      ['Final speed', 'v = √(2as)'],
    ],
    torque: [
      ['Torque', 'τ = r × F'],
      ['Equilibrium', 'Στ = 0'],
    ],
    collision: [
      ['Restitution', 'e = (v₂ − v₁) / (u₁ − u₂)'],
      ['Momentum', 'm₁u₁ + m₂u₂ = m₁v₁ + m₂v₂'],
    ],
  } satisfies Record<LabId, [string, string][]>;

  const selectLab = (id: LabId) => {
    setActiveLab(id);
    setRunning(false);
    setResetKey((key) => key + 1);
  };

  const reset = () => {
    setRunning(false);
    setResetKey((key) => key + 1);
  };

  const restoreDefaults = () => {
    setValues(defaultValues);
    setRunning(false);
    setResetKey((key) => key + 1);
  };

  const renderControls = () => {
    if (activeLab === 'pendulum') {
      return <>
        <Slider label="String length" value={values.length} min={0.5} max={2.5} step={0.1} unit="m" onChange={(v) => update('length', v)} />
        <Slider label="Gravity" value={values.gravity} min={1} max={20} step={0.1} unit="m/s²" onChange={(v) => update('gravity', v)} />
        <Slider label="Starting angle" value={values.pendulumAngle} min={5} max={60} step={1} unit="°" onChange={(v) => update('pendulumAngle', v)} />
      </>;
    }
    if (activeLab === 'ramp') {
      return <>
        <Slider label="Ramp angle" value={values.rampAngle} min={5} max={60} step={1} unit="°" onChange={(v) => update('rampAngle', v)} />
        <Slider label="Friction coefficient" value={values.friction} min={0} max={0.8} step={0.01} unit="μ" onChange={(v) => update('friction', v)} />
        <Slider label="Gravity" value={values.gravity} min={1} max={20} step={0.1} unit="m/s²" onChange={(v) => update('gravity', v)} />
      </>;
    }
    if (activeLab === 'torque') {
      return <>
        <Slider label="Left mass" value={values.leftMass} min={0} max={5} step={0.1} unit="kg" onChange={(v) => update('leftMass', v)} />
        <Slider label="Right mass" value={values.rightMass} min={0} max={5} step={0.1} unit="kg" onChange={(v) => update('rightMass', v)} />
        <Slider label="Arm distance" value={values.armLength} min={0.6} max={2.4} step={0.1} unit="m" onChange={(v) => update('armLength', v)} />
        <Slider label="Gravity" value={values.gravity} min={1} max={20} step={0.1} unit="m/s²" onChange={(v) => update('gravity', v)} />
      </>;
    }
    return <>
      <Slider label="Starting height" value={values.dropHeight} min={0.5} max={5} step={0.1} unit="m" onChange={(v) => update('dropHeight', v)} />
      <Slider label="Coefficient of restitution" value={values.restitution} min={0} max={1} step={0.01} unit="e" onChange={(v) => update('restitution', v)} />
      <Slider label="Gravity" value={values.gravity} min={1} max={20} step={0.1} unit="m/s²" onChange={(v) => update('gravity', v)} />
    </>;
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><Atom size={20} strokeWidth={2.2} /></div>
        <div className="brand-copy">
          <strong>Physics Lab</strong>
          <span>Interactive 3D simulations</span>
        </div>
        <div className="topbar-right"><span className="status-dot" /> Local simulation</div>
      </header>

      <div className="page-layout">
        <aside className="sidebar">
          <div className="sidebar-label">LABORATORIES</div>
          <nav className="lab-nav" aria-label="Choose a physics lab">
            {labs.map((lab, index) => {
              const Icon = lab.icon;
              return (
                <button
                  className={`lab-nav-item ${activeLab === lab.id ? 'active' : ''}`}
                  key={lab.id}
                  onClick={() => selectLab(lab.id)}
                >
                  <span className="nav-icon"><Icon size={18} /></span>
                  <span className="nav-text"><strong>{lab.title}</strong><small>{lab.short}</small></span>
                  <span className="nav-index">0{index + 1}</span>
                </button>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note-icon"><FlaskConical size={18} /></div>
            <strong>Experiment freely</strong>
            <p>Adjust a parameter and observe how the physics changes.</p>
          </div>
        </aside>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PHYSICS SIMULATOR <span>/</span> LAB 0{labs.findIndex((lab) => lab.id === activeLab) + 1}</div>
              <h1>{activeInfo.title}</h1>
              <p>{activeInfo.description}</p>
            </div>
            <button className="reset-defaults" onClick={restoreDefaults}><RotateCcw size={15} /> Restore defaults</button>
          </div>

          <section className="workspace">
            <div className="simulation-panel">
              <div className="panel-heading">
                <div><span className="panel-kicker">3D VIEWPORT</span><strong>{activeInfo.title} simulation</strong></div>
                <span className="viewport-badge"><span /> LIVE VIEW</span>
              </div>
              <div className="scene-wrap">
                <ThreeScene lab={activeLab} values={values} running={running} resetKey={resetKey} onPause={() => setRunning(false)} />
                <div className="scene-hint">{activeLab === 'pendulum' ? 'Drag the bob to set its angle' : '3D simulation view'}</div>
              </div>
              <div className="simulation-toolbar">
                <div className="toolbar-actions">
                  <button className="primary-button" onClick={() => setRunning((value) => !value)}>
                    {running ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                    {running ? 'Pause' : 'Run simulation'}
                  </button>
                  <button className="secondary-button" onClick={reset}><RotateCcw size={15} /> Reset</button>
                </div>
                <span className={`simulation-state ${running ? 'is-running' : ''}`}><span />{running ? 'Running' : 'Paused'}</span>
              </div>
            </div>

            <aside className="control-panel">
              <div className="control-heading"><SlidersHorizontal size={17} /><strong>Parameters</strong></div>
              <div className="control-list">{renderControls()}</div>
              <div className="control-footnote"><Activity size={15} /><span>Values update the calculations and 3D model.</span></div>
            </aside>
          </section>

          <section className="results-section">
            <div className="section-title"><div><Activity size={17} /><strong>Live measurements</strong></div><span>Calculated from current parameters</span></div>
            <div className={`stats-grid ${stats.length === 4 ? 'four-stats' : ''}`}>
              {stats.map((stat) => <Stat key={stat.label} {...stat} />)}
            </div>
          </section>

          <section className="theory-section">
            <div className="section-title"><div><Gauge size={17} /><strong>Physics behind the experiment</strong></div></div>
            <div className="formula-grid">
              {formulas[activeLab].map(([label, formula]) => (
                <div className="formula" key={label}><span>{label}</span><strong>{formula}</strong></div>
              ))}
            </div>
          </section>

          <footer className="page-footer"><span>Physics Lab · React + Three.js</span><span>Learning through simulation</span></footer>
        </main>
      </div>
    </div>
  );
}
