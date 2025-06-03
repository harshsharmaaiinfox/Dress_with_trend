import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { content } from './shared/routes/routes';

import { LayoutComponent } from './layout/layout.component';
import { MaintenanceComponent } from './maintenance/maintenance.component';
import { ScrollPositionGuard } from './core/guard/scroll.guard';
import { CustomProductPageComponent } from './custom-product-page/custom-product-page.component'; // Import your new component

const routes: Routes = [
  {
    path: '',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: "maintenance",
    component: MaintenanceComponent
  },
  {
    path: "",
    component: LayoutComponent,
    children: [
      ...content, // Assuming `content` contains other child routes
      {
        path: 'custom-product-page/:id',  // Define the dynamic product page route
        component: CustomProductPageComponent
      }
    ],
    canActivate: [ScrollPositionGuard],
  },
  { path: 'privacy-policy', loadChildren: () => import('./about-us/about-us.module').then(m => m.AboutUsModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    initialNavigation: 'enabledBlocking'
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
