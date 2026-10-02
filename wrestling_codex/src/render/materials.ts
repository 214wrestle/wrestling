import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, Vector3, type Scene, type Mesh, type TransformNode } from './babylon';

export function material(scene: Scene, name: string, color: string, specular = 0.1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(color);
  m.specularColor = new Color3(specular, specular, specular); m.specularPower = 60;
  return m;
}
export function box(scene: Scene, name: string, width: number, height: number, depth: number, position: Vector3, mat: StandardMaterial, parent?: TransformNode): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
  mesh.position.copyFrom(position); mesh.material = mat;
  if (parent) mesh.parent = parent;
  mesh.receiveShadows = true; return mesh;
}
export function canvasMaterial(scene: Scene, name: string, width: number, height: number, draw: (c: CanvasRenderingContext2D) => void, emissive = false): StandardMaterial {
  const t = new DynamicTexture(`${name}-texture`, { width, height }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  draw(c); t.update();
  const m = material(scene, name, '#ffffff', 0.06); m.diffuseTexture = t;
  if (emissive) { m.emissiveTexture = t; m.emissiveColor = new Color3(0.6, 0.6, 0.6); }
  return m;
}
export function panel(scene: Scene, name: string, width: number, height: number, pos: Vector3, mat: StandardMaterial, yaw = 0) {
  const p = MeshBuilder.CreatePlane(name, { width, height }, scene);
  p.position.copyFrom(pos); p.rotation.y = yaw; p.material = mat; return p;
}
