export type LabId = 'pendulum' | 'ramp' | 'torque' | 'collision';

export type PhysicsValues = {
  length: number;
  gravity: number;
  pendulumAngle: number;
  rampAngle: number;
  friction: number;
  leftMass: number;
  rightMass: number;
  armLength: number;
  dropHeight: number;
  restitution: number;
};

export const defaultValues: PhysicsValues = {
  length: 1.5,
  gravity: 9.81,
  pendulumAngle: 25,
  rampAngle: 30,
  friction: 0.15,
  leftMass: 2,
  rightMass: 2,
  armLength: 1.5,
  dropHeight: 2,
  restitution: 0.8,
};

export const pendulumPeriod = (length: number, gravity: number) =>
  2 * Math.PI * Math.sqrt(length / gravity);

export const rampAcceleration = (gravity: number, angleDeg: number, friction: number) => {
  const angle = (angleDeg * Math.PI) / 180;
  return Math.max(0, gravity * (Math.sin(angle) - friction * Math.cos(angle)));
};

export const collisionVelocities = (initialVelocity: number, restitution: number) => ({
  first: (1 - restitution) * initialVelocity / 2,
  second: (1 + restitution) * initialVelocity / 2,
});
