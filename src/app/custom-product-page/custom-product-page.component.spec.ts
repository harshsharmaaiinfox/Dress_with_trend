import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomProductPageComponent } from './custom-product-page.component';

describe('CustomProductPageComponent', () => {
  let component: CustomProductPageComponent;
  let fixture: ComponentFixture<CustomProductPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomProductPageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CustomProductPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
