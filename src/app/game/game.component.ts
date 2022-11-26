import { Component, OnInit, ViewChild } from '@angular/core';
import { CountDownComponent } from '../count-down/count-down.component';
import { RoundOption, RoundOptionState } from '../round-option/round-option.component';
import { GameService } from '../services/game.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  public timeBarMs = 10000;

  constructor(public gameService: GameService) { }

  @ViewChild(CountDownComponent, {static: true}) private countDown?: CountDownComponent;

  ngOnInit(): void {
    this.gameService.joinGame();
    
    window.setInterval(() => { this.timeBarMs = this.getRoundTimeLeftMs() }, 50);
  }

  public getButtonState(option: RoundOption): RoundOptionState {
    if (this.gameService.roundResults !== undefined)
    {
      if (this.gameService.roundResults!.correctAnswerId === option.id)
        return RoundOptionState.correct;

      if (this.gameService.submittedAnswer === option.id)
        return RoundOptionState.incorrect;
    }

    if (!this.gameService.canSubmitAnswer)
      return RoundOptionState.disabled;

    return RoundOptionState.default;
  }

  getRoundTimeLeftMs(): number {
    var currentTime = new Date();
    var diff = 10000 - (currentTime.getTime() - this.gameService.roundStartTime.getTime());
    return diff;
  }

  ngAfterViewInit() {
    this.gameService.setCountDownEvent((c: number) => {
      this.countDown?.startCountDown(c);
    });
  }
}

