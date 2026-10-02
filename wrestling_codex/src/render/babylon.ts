// Import the actual rendering features we use, rather than the engine-wide barrel.
export { Engine } from '@babylonjs/core/Engines/engine';
export { Scene } from '@babylonjs/core/scene';
export { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
export { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
export { Mesh } from '@babylonjs/core/Meshes/mesh';
export { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
export { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
export { TransformNode } from '@babylonjs/core/Meshes/transformNode';
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
export { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
