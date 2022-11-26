import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerTagComponent } from './player-tag.component';

describe('PlayerTagComponent', () => {
  let component: PlayerTagComponent;
  let fixture: ComponentFixture<PlayerTagComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayerTagComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayerTagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
