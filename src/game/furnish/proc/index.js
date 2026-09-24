// Procedural furniture generators: { name: { build(params, ctx) -> Object3D, deps?(params) -> [modelNames] } }.
// Output convention: origin at base centre, min Y = 0, front +Z; optional userData.colliders = [[min],[max]] local boxes.
import * as kitchen from './kitchen.js';
import * as living from './living.js';
import * as rooms from './rooms.js';
export const GENERATORS = { ...kitchen, ...living, ...rooms };
