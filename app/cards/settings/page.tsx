'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Download, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks';
import { clearModulesCache, useModules } from '@/lib/use-modules';
import { cn } from '@/lib/utils';
import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';
import { useCardsSettings } from '@/features/cards/useCardsSettings';

export default function CardsSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings, loading } = useCardsSettings();
  const { modules, save: saveModules } = useModules();

  async function toggleFitness() {
    const next = { ...modules, fitness: !modules.fitness };
    const { error } = await saveModules(next);
    if (error) toast.error(`fehler: ${error}`);
    else toast.success(next.fitness ? 'fitness-tabs eingeblendet' : 'fitness-tabs ausgeblendet');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    clearModulesCache();
    router.push('/auth/login');
  }

  return (
    <CardsScreen title="mehr">
      <section className="space-y-2">
        <h2 className="text-xs text-muted-foreground">lernen</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-border bg-card p-3 text-xs">
          <dt className="text-muted-foreground">accent</dt>
          <dd className="flex items-center gap-2 font-mono">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: settings.theme.accent }} />
            {settings.theme.accent}
          </dd>
          <dt className="text-muted-foreground">zeitbudget</dt>
          <dd className="font-mono">{settings.session.timeBudgetMin} min</dd>
          <dt className="text-muted-foreground">retention</dt>
          <dd className="font-mono">{settings.scheduler.requestRetention}</dd>
          <dt className="text-muted-foreground">bewertung</dt>
          <dd>{settings.interaction.rating}</dd>
        </dl>
        <p className="text-[11px] text-muted-foreground">
          {loading ? 'lade…' : 'alle optionen, presets und export kommen in phase 4.'}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs text-muted-foreground">inhalte</h2>
        <Link
          href={CARDS_ROUTES.import}
          className="flex min-h-[48px] items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm transition-colors hover:border-[#444]"
        >
          <Download className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="flex-1">import</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs text-muted-foreground">module</h2>
        <button
          type="button"
          role="switch"
          aria-checked={modules.fitness}
          onClick={toggleFitness}
          className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-left text-sm transition-colors hover:border-[#444]"
        >
          <span className="flex-1">
            fitness-tabs anzeigen
            <span className="block text-[11px] text-muted-foreground">home, food, workout, analytics, budget</span>
          </span>
          <span
            className={cn(
              'relative h-6 w-10 shrink-0 rounded-full transition-colors',
              modules.fitness ? 'bg-[var(--cards-accent)]' : 'bg-muted'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform',
                modules.fitness ? 'translate-x-[18px]' : 'translate-x-0.5'
              )}
            />
          </span>
        </button>
        {modules.fitness && (
          <Link
            href="/profile"
            className="flex min-h-[48px] items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm transition-colors hover:border-[#444]"
          >
            <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="flex-1">profil & ziele</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
          </Link>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs text-muted-foreground">konto</h2>
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-left text-sm transition-colors hover:border-[#444]"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="flex-1">abmelden</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">{user?.email}</span>
        </button>
      </section>
    </CardsScreen>
  );
}
