import { Backpack, BookOpen, Pause, Timer, Volume2, VolumeX } from 'lucide-react';
import { LEVEL, LEVEL_INFO } from '../game/config';
import type { LevelNo } from '../game/progress';
import type { Stage } from '../game/engine';
import { formatTime } from '../game/timer';
import { IconButton } from './ui';

export function GameTimer({ remainingMs, totalMs, active }: { remainingMs: number; totalMs: number; active: boolean }) {
  const frac = Math.max(0, Math.min(1, remainingMs / totalMs));
  const urgent = active && remainingMs < 30_000;
  const critical = active && remainingMs < 10_000;
  return (
    <div
      role="timer" aria-label={`Time remaining ${formatTime(remainingMs)}`}
      className={`flex min-w-[190px] flex-col items-center border-2 bg-abyss px-4 py-1 ${critical ? 'animate-pulseborder border-electric' : urgent ? 'border-electric' : 'border-deep'}`}
    >
      <div className="flex items-center gap-2">
        <Timer size={16} className={critical ? 'text-ice' : 'text-cyan'} aria-hidden />
        <span className={`font-pixel tabular-nums ${critical ? 'text-[22px] text-ice drop-shadow-[0_0_8px_#258BFF]' : urgent ? 'text-[20px] text-pale' : 'text-[20px] text-cyan'}`}>
          {formatTime(remainingMs)}
        </span>
      </div>
      <div className="mt-1 h-[6px] w-full bg-navy">
        <div className={`h-full ${critical ? 'bg-ice' : urgent ? 'bg-electric' : 'bg-primary'}`} style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}

const STAGES: Record<LevelNo, { id: Stage; label: string }[]> = {
  2: [{ id: 'solve', label: 'Weigh' }, { id: 'switches', label: 'Switches' }, { id: 'exit', label: 'Escape' }],
  3: [{ id: 'solve', label: 'Count' }, { id: 'exit', label: 'Passage' }],
  4: [{ id: 'solve', label: 'Tile + digit' }, { id: 'final', label: 'Escape code' }, { id: 'exit', label: 'Exit' }],
};

export function GameHeader(p: {
  remainingMs: number; totalMs: number; timerActive: boolean; stage: Stage; level: LevelNo; hintsUsed: number; bagCount: number;
  bagOpen: boolean; muted: boolean; canPause: boolean;
  onBag: () => void; onSound: () => void; onPause: () => void; onRules: () => void;
}) {
  const stages = STAGES[p.level];
  const si = Math.max(0, stages.findIndex((s) => s.id === p.stage));
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b-2 border-deep bg-navy px-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="font-pixel text-[18px] text-cyan drop-shadow-[0_0_6px_#258BFF]">{LEVEL.title.toUpperCase()}</div>
        <div className="hidden min-w-0 flex-col lg:flex">
          <span className="font-pixel text-[9px] text-pale">LEVEL {LEVEL_INFO[p.level].number}: {LEVEL_INFO[p.level].name}</span>
          <ol className="mt-1 flex items-center gap-1 font-term text-lg leading-none" aria-label="Level progress">
            {stages.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-1 ${i < si ? 'text-primary line-through' : i === si ? 'text-ice' : 'text-deep'}`}>
                <span className={`inline-block h-2 w-2 ${i <= si ? 'bg-electric' : 'bg-dark'}`} />{s.label}{i < stages.length - 1 && <span className="text-deep">›</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <GameTimer remainingMs={p.remainingMs} totalMs={p.totalMs} active={p.timerActive} />
      <div className="flex items-center gap-2">
        <span className="hidden font-term text-lg text-primary xl:inline">Hints {p.hintsUsed}/3</span>
        <IconButton label="Rules" onClick={p.onRules}><BookOpen size={16} aria-hidden /><span className="hidden md:inline">Rules</span></IconButton>
        <IconButton label={p.bagOpen ? 'Close Intelligence Bag' : 'Open Intelligence Bag'} active={p.bagOpen} onClick={p.onBag}>
          <Backpack size={16} aria-hidden /><span className="hidden md:inline">Bag</span>
          <span className="bg-electric px-1 text-abyss">{p.bagCount}</span>
        </IconButton>
        <IconButton label={p.muted ? 'Sound off. Click to turn on' : 'Sound on. Click to mute'} active={!p.muted} onClick={p.onSound} aria-pressed={!p.muted}>
          {p.muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}<span className="hidden md:inline">{p.muted ? 'Off' : 'On'}</span>
        </IconButton>
        <IconButton label="Pause (Esc)" onClick={p.onPause} disabled={!p.canPause}><Pause size={16} aria-hidden /></IconButton>
      </div>
    </header>
  );
}
