import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'round-option',
  templateUrl: './round-option.component.html',
  styleUrls: ['./round-option.component.css']
})
export class RoundOptionComponent implements OnInit {
  @Input() optionValues!: RoundOption;
  @Input() state = RoundOptionState.default;
  @Input() clickEvent?: (option: RoundOption) => void;
  
  constructor() { }

  ngOnInit(): void {
  }

  public clickButton()
  {
    console.log("Invoking button press.");
    if (this.state !== RoundOptionState.disabled && this.clickEvent !== undefined)
      this.clickEvent!(this.optionValues!);
  }

  public getStateText(): string {
    return RoundOptionState[this.state];
  }
}

export interface RoundOption {
  id: number,
  word: string
}

export enum RoundOptionState {
  default,
  disabled,
  correct,
  incorrect
}