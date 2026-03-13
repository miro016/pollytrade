import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardPage),
  },
  {
    path: 'markets',
    loadComponent: () => import('./pages/markets/markets').then(m => m.MarketsPage),
  },
  {
    path: 'trades',
    loadComponent: () => import('./pages/trades/trades').then(m => m.TradesPage),
  },
  {
    path: 'strategy',
    loadComponent: () => import('./pages/strategy/strategy').then(m => m.StrategyPage),
  },
];
