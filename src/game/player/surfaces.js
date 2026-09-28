// Maps house floor types (house.json `floor`, glTF `surface` extras, landscape zones) to the seven
// footstep categories P11 audio plays: wood | tile | stone | grass | gravel | carpet | metal.
const RULES = [
  [/carpet|rug|wool/i, 'carpet'],
  [/gravel|pebble|shingle/i, 'gravel'],
  [/grass|lawn|turf|garden|soil|planting/i, 'grass'],
  [/metal|steel|grate|iron|alu/i, 'metal'],
  [/oak|wood|plank|parquet|larch|timber|deck|tread|stair/i, 'wood'],
  [/tile|ceramic|porcelain|marble|terrazzo/i, 'tile'],
  [/stone|concrete|screed|paver|paving|slab|asphalt|drive|gabion|step/i, 'stone'],
];

export function footstepSurface(type) {
  if (!type) return 'stone';
  for (const [re, cat] of RULES) if (re.test(type)) return cat;
  return 'stone';
}
