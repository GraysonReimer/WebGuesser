import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoundOptionComponent } from './round-option.component';

describe('RoundOptionComponent', () => {
  let component: RoundOptionComponent;
  let fixture: ComponentFixture<RoundOptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RoundOptionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RoundOptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
