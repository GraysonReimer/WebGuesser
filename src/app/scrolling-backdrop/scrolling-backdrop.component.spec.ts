import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScrollingBackdropComponent } from './scrolling-backdrop.component';

describe('ScrollingBackdropComponent', () => {
  let component: ScrollingBackdropComponent;
  let fixture: ComponentFixture<ScrollingBackdropComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScrollingBackdropComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScrollingBackdropComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
