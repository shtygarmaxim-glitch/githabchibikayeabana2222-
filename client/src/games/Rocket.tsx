import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Rocket as RocketIcon } from 'lucide-react';

interface RocketProps {
  onBack: () => void;
  balance: number;
  onBalanceUpdate: (newBal: number) => void;
  initData: string;
}

export const Rocket: React.FC<RocketProps> = ({ onBack, balance, onBalanceUpdate, initData }) => {
  const [bet, setBet] = useState(10);
  const [status, setStatus] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const [multiplier, setMultiplier] = useState(1.0);
  const [hasBet, setHasBet] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [payout, setPayout] = useState(0);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`\({protocol}//\){window.location.host}/ws/rocket`);
    ws.current = socket;

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.event === 'INIT_STATE' || msg.event === 'ROUND_WAITING') {
        setStatus('WAITING');
        setMultiplier(1.0);
        setHasBet(false);
        setHasCashedOut(false);
      } else if (msg.event === 'TICK') {
        setStatus('FLYING');
        setMultiplier(msg.data.multiplier);
      } else if (msg.event === 'ROUND_CRASHED') {
        setStatus('CRASHED');
        setMultiplier(msg.data.multiplier);
      }
    };

    return () => socket.close();
  }, []);

  const placeBet = async () => {
    if (bet > balance) return alert("Недостаточно средств");
    try {
      const res = await fetch('/api/games/rocket/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({ amount: bet })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setHasBet(true);
      onBalanceUpdate(balance - bet);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const cashout = async () => {
    try {
      const res = await fetch('/api/games/rocket/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setHasCashedOut(true);
      setPayout(data.payout);
      onBalanceUpdate(data.newBalance);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 rounded-xl bg-slate-800 text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-lg">Ракета (Crash)</span>
        <div className="w-8" />
      </div>

      <div className="relative h-64 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col items-center justify-center shadow-inner">
        <div className="z-10 text-center">
          <div className={`text-5xl font-black tracking-tight ${status === 'CRASHED' ? 'text-rose-500' : 'text-indigo-400'}`}>
            {multiplier.toFixed(2)}x
          </div>
          <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">
            {status === 'WAITING' && 'Ожидание раунда...'}
            {status === 'FLYING' && 'В полете'}
            {status === 'CRASHED' && 'Улетела!'}
          </span>
        </div>

        {status === 'FLYING' && (
          <RocketIcon className="w-12 h-12 text-indigo-400 absolute animate-pulse transform -rotate-45" />
        )}
      </div>

      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div>
          <label className="text-xs text-slate-400 font-medium">Ставка ($)</label>
          <input
            type="number"
            value={bet}
            disabled={hasBet}
            onChange={(e) => setBet(Math.max(1, Number(e.target.value)))}
            className="w-full bg-slate-800 rounded-xl p-2.5 mt-1 border border-slate-700 text-white font-bold"
          />
        </div>

        {!hasBet ? (
          <button
            onClick={placeBet}
            disabled={status !== 'WAITING'}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition"
          >
            Поставить ставку
          </button>
        ) : !hasCashedOut && status === 'FLYING' ? (
          <button
            onClick={cashout}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition"
          >
            Забрать {(bet * multiplier).toFixed(2)} $
          </button>
        ) : (
          <div className="p-3 text-center rounded-xl bg-slate-800/60 text-sm font-semibold text-emerald-400">
            {hasCashedOut ? `Выигрыш: +\({payout.toFixed(2)}\)` : 'Ставка принята, ждите полета...'}
          </div>
        )}
      </div>
    </div>
  );
};
