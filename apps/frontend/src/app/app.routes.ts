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
    path: 'markets/:id',
    loadComponent: () => import('./pages/markets/market-detail').then(m => m.MarketDetailPage),
  },
  {
    path: 'trades',
    loadComponent: () => import('./pages/trades/trades').then(m => m.TradesPage),
  },
  {
    path: 'portfolio',
    loadComponent: () => import('./pages/portfolio/portfolio').then(m => m.PortfolioPage),
  },
  {
    path: 'strategy',
    loadComponent: () => import('./pages/strategy/strategy').then(m => m.StrategyPage),
  },
  {
    path: 'setup',
    loadComponent: () => import('./pages/setup/setup').then(m => m.SetupPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then(m => m.SettingsPage),
  },
];
