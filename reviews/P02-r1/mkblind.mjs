import sharp from 'sharp';
import fs from 'fs';
const pairs = [
 ['reviews/P02-r1/ours_ext_garden.png','reviews/hf2/hf2-aframe-cabin-exterior-forest-day.png'],
 ['reviews/P02-r1/tour/08_office.png','reviews/hf2/hf2-empty-room-paint-roller-fpv-day.png'],
 ['reviews/P02-r1/ours_living.png','reviews/hf2/hf2-loft-living-room-brick-daylight.png'],
 ['reviews/P02-r1/ours_stair_hall.png','reviews/hf2/hf2-cottage-exterior-garden-picket-fence-day.png'],
 ['reviews/P02-r1/ours_ext_front.png','reviews/hf2/hf2-modern-villa-exterior-night-neon.png'],
];
const key = [];
for (let i=0;i<pairs.length;i++){
  const oursIsA = Math.random() < 0.5;
  const [ours, hf2] = pairs[i];
  const A = oursIsA ? ours : hf2, B = oursIsA ? hf2 : ours;
  await sharp(A).resize(1280,720,{fit:'cover'}).png().toFile(`reviews/P02-r1/blind/pair${i+1}_A.png`);
  await sharp(B).resize(1280,720,{fit:'cover'}).png().toFile(`reviews/P02-r1/blind/pair${i+1}_B.png`);
  key.push(`pair${i+1}: ours=${oursIsA?'A':'B'} (${ours})`);
}
fs.writeFileSync('reviews/P02-r1/blind/key.txt', key.join('\n')+'\n');
console.log('done');
