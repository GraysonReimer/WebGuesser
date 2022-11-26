import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'count-down',
  templateUrl: './count-down.component.html',
  styleUrls: ['./count-down.component.css'],
})
export class CountDownComponent implements OnInit {
  public countIndex = 0;
  public visible = false;
  private tickSound = "count-tick.mp3";
  private audioComp = new Audio();

  constructor() { }

  ngOnInit(): void {
    this.audioComp.src = "assets/audio/" + this.tickSound;
  }

  public startCountDown(seconds: number)
  {
    this.countIndex = seconds;
    this.visible = true;

    this.audioComp.play();

    this.onTick();
    var countInterval = setInterval(() => {
      this.countIndex--;

      if (this.countIndex == 0)
      {
        this.visible = false;
        clearInterval(countInterval);
      }
      else
        this.onTick();

    }, 1000);
  }

  private onTick() {
    //Use later maybe...
  }
}
