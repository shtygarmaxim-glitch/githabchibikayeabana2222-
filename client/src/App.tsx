import React, { useEffect, useState } from 'react';
import { Gamepad2, Bomb, Rocket as RocketIcon, Package, ArrowUpCircle, ShieldCheck, Coins } from 'lucide-react';
import { Mines } from './games/Mines';
import { Rocket } from './games/Rocket';
import { Inventory } from './components/Inventory';
import { History } from './components/History';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'lobby' | 'mines' | 'rocket' | 'inventory' | 'history'>('lobby');

  const initData = (window as any).Telegram?.WebApp?.initData || '';

  const refreshUser = () => {
    fetch('/api/user/me', {
      headers: { 'x-telegram-init-data': initData }
    })
      .then(res => res.json())
      .then(data => { if (data) setUser(data); })
      .catch(console.error);
  };

  useEffect(() => {
    if ((window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.ready();
      (window as any).Telegram.WebApp.expand();
    }

    fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData }
    })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
          refreshUser();
        }
      })
      .catch(console.error);
  }, []);

  const balance = Number(user?.balance || 0);
  const updateBalance = (newBal: number) => {
    setUser((prev: any) => ({ ...prev, balance: newBal }));
  };

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-lg">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div>
            <div className="text-sm font-semibold">{user?.firstName || 'Игрок'}</div>
            <div className="text-xs text-slate-400">@{user?.username || 'tma_user'}</div>
          </div>
        </div>

        <div className="flex items-center bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
          <Coins className="w-4 h-4 text-amber-400 mr-1.5" />
          <span className="font-bold text-sm text-amber-400">
            {balance.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} $
          </span>
        </div>
      </header>

      <main className="flex-1">
        {view === 'lobby' && (
          <div className="p-4">
            <h2 className="text-base font-bold mb-3 flex items-center text-slate-300">
              <Gamepad2 className="w-5 h-5 mr-2 text-indigo-400" /> Все игры
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setView('mines')}
                className="p-4 rounded-2xl bg-gradient-to-br from-red-600/20 to-amber-600/10 border border-slate-800 flex flex-col items-start active:scale-95 transition"
              >
                <Bomb className="w-8 h-8 text-rose-400 mb-2" />
                <span className="font-bold"_GT_Мины</span>
                <span className="text-[11px] text-slate-500">До x100</span>
              </button>

              <button
                onClick={() => setView('rocket')}
                className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-slate-800 flex flex-col items-start active:scale-95 transition"
              >
                <RocketIcon className="w-8 h-8 text-indigo-400 mb-2" />
                <span className="font-bold">Ракета (Crash)</span>
                <span className="text-[11px] text-slate-500">Multiplayer</span>
              </button>

              <button
                onClick={() => alert('Кейсы настраиваются через админ-панель')}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-start active:scale-95 transition"
              >
                <Package className="w-8 h-8 text-emerald-400 mb-2" />
                <span className="font-bold">Кейсы</span>
                <span className="text-[11px] text-slate-500">NFT и Дропы</span>
              </button>

              <button
                onClick={() => alert('Режим Upgrade активен для предметов из кейсов')}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-start active:scale-95 transition"
              >
                <ArrowUpCircle className="w-8 h-8 text-amber-400 mb-2" />
                <span className="font-bold">Upgrade</span>
                <span className="text-[11px] text-slate-500">Шанс до 95%</span>
              </button>
            </div>
          </div>
        )}

        {view === 'mines' && (
          <Mines onBack={() => { setView('lobby'); refreshUser(); }} balance={balance} onBalanceUpdate={updateBalance} initData={initData} />
        )}

        {view === 'rocket' && (
          <Rocket onBack={() => { setView('lobby'); refreshUser(); }} balance={balance} onBalanceUpdate={updateBalance} initData={initData} />
        )}

        {view === 'inventory' && <Inventory items={user?.inventory || []} />}
        {view === 'history' && <History transactions={user?.transactions || []} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex items-center justify-around z-50">
        <button
          onClick={() => setView('lobby')}
          className={`flex flex-col items-center ${view === 'lobby' ? 'text-indigo-400' : 'text-slate-500'}`}
        >
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[11px] mt-1 font-semibold">Игры</span>
        </button>

        <button
          onClick={() => { setView('inventory'); refreshUser(); }}
          className={`flex flex-col items-center ${view === 'inventory' ? 'text-indigo-400' : 'text-slate-500'}`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[11px] mt-1 font-semibold">Инвентарь</span>
        </button>

        <button
          onClick={() => { setView('history'); refreshUser(); }}
          className={`flex flex-col items-center ${view === 'history' ? 'text-indigo-400' : 'text-slate-500'}`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[11px] mt-1 font-semibold">История</span>
        </button>
      </nav>
    </div>
  );
}
