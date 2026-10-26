// B4-B: PIN pad, lock screen and Me → Security. Device-only (see lib/pin.ts).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCK_AFTER_MS, checkPin, pinEnabled, pinWaitLeft, removePin, setPin, weakPin } from '../lib/pin';
import { useStore } from '../lib/store';
import { Logo } from './Logo';
import { Button, Card } from './ui';
import { Icon } from './Icon';

function PinPad({ value, onChange, label, disabled }: { value: string; onChange: (v: string) => void; label: string; disabled?: boolean }) {
  return (
    <div>
      <p className="text-center text-lg font-semibold text-ink">{label}</p>
      <div className="mt-4 flex justify-center gap-4" aria-label={label} data-testid="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 border-ink ${i < value.length ? 'bg-ink' : 'bg-transparent'}`} />
        ))}
      </div>
      <div className="mx-auto mt-6 grid max-w-[280px] grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) =>
          k === '' ? <span key="blank" /> : (
            <button
              key={k}
              type="button"
              disabled={disabled}
              aria-label={k === 'del' ? 'Delete' : k}
              onClick={() => onChange(k === 'del' ? value.slice(0, -1) : (value + k).slice(0, 4))}
              className="min-h-[56px] rounded-xl border border-line bg-white text-2xl font-semibold text-ink shadow-card disabled:opacity-40"
            >
              {k === 'del' ? <Icon name="back" className="mx-auto" /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/** Locks the app when it opens and after 5 minutes in the background, if this account set a PIN on this phone. */
export function usePinLock(uid: string | null): [boolean, () => void] {
  const [locked, setLocked] = useState(() => !!uid && pinEnabled(uid));
  useEffect(() => setLocked(!!uid && pinEnabled(uid)), [uid]);
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (uid && pinEnabled(uid) && hiddenAt && Date.now() - hiddenAt >= LOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [uid]);
  return [locked, () => setLocked(false)];
}

export function LockScreen({ uid, onUnlock }: { uid: string; onUnlock: () => void }) {
  const { t: tu } = useTranslation('ui');
  const { signOut } = useStore();
  const [pin, setPinValue] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [wait, setWait] = useState(() => Math.ceil(pinWaitLeft(uid) / 1000));

  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setWait(Math.ceil(pinWaitLeft(uid) / 1000)), 1000);
    return () => clearInterval(id);
  }, [wait, uid]);

  async function enter(v: string) {
    setPinValue(v);
    if (v.length < 4) return;
    const r = await checkPin(uid, v);
    setPinValue('');
    if (r === 'ok') return onUnlock();
    if (r === 'wipe') {
      setMsg(tu('pin_wiped'));
      await signOut();
      return;
    }
    if (r === 'wait') setWait(Math.ceil(pinWaitLeft(uid) / 1000));
    setMsg(r === 'wait' ? null : tu('pin_wrong'));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-paper px-5 pb-8 pt-10" data-testid="lock-screen">
      <Logo height={30} />
      <div className="mt-10">
        <PinPad value={pin} onChange={enter} label={tu('pin_enter')} disabled={wait > 0} />
      </div>
      {wait > 0 && <p role="alert" className="mt-6 rounded-xl bg-amber-soft px-4 py-3 text-center font-semibold text-amber-ink">{tu('pin_wait', { n: wait })}</p>}
      {msg && wait <= 0 && <p role="alert" className="mt-6 text-center font-semibold text-risk">{msg}</p>}
      <button className="mx-auto mt-auto min-h-tap pt-8 font-semibold text-teal underline underline-offset-2" onClick={() => void signOut()}>
        {tu('pin_forgot')}
      </button>
    </div>
  );
}

/** Me → Security: turn the PIN on (enter + confirm), or off (needs the current PIN). */
export function PinSettings({ uid }: { uid: string }) {
  const { t: tu } = useTranslation('ui');
  const [on, setOn] = useState(() => pinEnabled(uid));
  const [step, setStep] = useState<'idle' | 'new' | 'confirm' | 'off'>('idle');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

  async function input(v: string) {
    setValue(v);
    if (v.length < 4) return;
    setValue('');
    if (step === 'new') {
      if (weakPin(v)) return setMsg({ tone: 'error', text: tu('pin_weak') });
      setFirst(v);
      setMsg(null);
      return setStep('confirm');
    }
    if (step === 'confirm') {
      if (v !== first) {
        setStep('new');
        return setMsg({ tone: 'error', text: tu('pin_mismatch') });
      }
      await setPin(uid, v);
      setOn(true);
      setStep('idle');
      return setMsg({ tone: 'ok', text: tu('pin_set') });
    }
    if (step === 'off') {
      const r = await checkPin(uid, v);
      if (r !== 'ok') return setMsg({ tone: 'error', text: tu(r === 'wait' ? 'pin_wait_short' : 'pin_wrong') });
      removePin(uid);
      setOn(false);
      setStep('idle');
      setMsg({ tone: 'ok', text: tu('pin_off_done') });
    }
  }

  return (
    <Card className="space-y-3">
      <p className="font-semibold">{tu('pin_title')}</p>
      <p className="text-sm text-ink-soft">{tu('pin_body')}</p>
      {step === 'idle' ? (
        <Button variant="secondary" icon="shield" onClick={() => { setMsg(null); setStep(on ? 'off' : 'new'); }} data-testid="pin-toggle">
          {on ? tu('pin_turn_off') : tu('pin_turn_on')}
        </Button>
      ) : (
        <PinPad value={value} onChange={input} label={tu(step === 'new' ? 'pin_choose' : step === 'confirm' ? 'pin_confirm' : 'pin_enter')} />
      )}
      {msg && <p role="alert" className={`font-semibold ${msg.tone === 'error' ? 'text-risk' : 'text-teal-dark'}`}>{msg.text}</p>}
    </Card>
  );
}
