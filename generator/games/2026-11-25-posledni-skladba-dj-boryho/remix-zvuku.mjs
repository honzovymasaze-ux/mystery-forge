// Nový zvukový mix videí (Honza 25. 11.: „hlas vyšetřovatele je potichu, a jak se hudba epicky zintenzivňuje, hlas není slyšet“).
// Obraz se jen zkopíruje, zvuk se složí znovu: hlas zkomprimovaný a hlasitější, hudba ztlumená pod hlasem hlouběji.
// node remix.mjs [intro,kap-a1,...]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const S = 'C:/Users/jneme/AppData/Local/Temp/claude/f6e5d5df97b4f08a/fcf54ca1-6751-46ad-a409-0d90eccac155/scratchpad';
const ids = process.argv[2] ? process.argv[2].split(',') : ['intro', 'kap-a1', 'kap-a2', 'kap-b1', 'kap-b2', 'kap-c1', 'kap-c2', 'kap-d1', 'kap-d2', 'kap-e1', 'kap-e2', 'kap-e3'];
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
for (const id of ids) {
  const spec = JSON.parse(fs.readFileSync(`${S}/djbory/v-${id}.json`, 'utf8'));
  const lead = spec.lead ?? 4;
  const src = spec.out;
  const tmp = src.replace(/\.mp4$/, '.remix.mp4');
  const total = dur(src);
  const filt =
    // hlas: odfiltrovat hučení, srovnat dynamiku, přidat srozumitelnost a dotáhnout hlasitost
    `[1:a]aformat=channel_layouts=stereo,highpass=f=70,acompressor=threshold=0.08:ratio=4:attack=5:release=150:makeup=2,` +
    `equalizer=f=3000:t=q:w=1.2:g=3,loudnorm=I=-14:TP=-1.5:LRA=7,adelay=${lead * 1000}|${lead * 1000},apad,asplit=2[vo][sc];` +
    // hudba: zkrotit gradující pasáže, aby ani vrchol nepřeřval hlas
    `[2:a]aformat=channel_layouts=stereo,acompressor=threshold=0.12:ratio=3:attack=30:release=400,volume=0.5,` +
    `afade=t=in:d=2,afade=t=out:st=${(total - 4).toFixed(2)}:d=4[mu];` +
    // pod hlasem hudba mírně dolů (cca -8 dB, Honza 25. 11.: „pořád není slyšet“), mezi větami se pomalu vrací
    `[mu][sc]sidechaincompress=threshold=0.05:ratio=3:attack=30:release=1200:makeup=1[duck];` +
    `[vo][duck]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[aout]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-i', spec.audio, '-i', spec.music, '-filter_complex', filt,
    '-map', '0:v', '-map', '[aout]', '-t', total.toFixed(2), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', tmp], { stdio: 'inherit' });
  fs.renameSync(tmp, src);
  console.log('hotovo', id, total.toFixed(1) + ' s');
}
