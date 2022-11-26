import { Component, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'scrolling-backdrop',
  templateUrl: './scrolling-backdrop.component.html',
  styleUrls: ['./scrolling-backdrop.component.css']
})
export class ScrollingBackdropComponent implements OnInit {
  private scrollIntesity = 0.6;

  public bd?: HTMLElement;
  public xOffset = 0;

  constructor() { }

  ngOnInit(): void {
    window.setInterval(() => {
      this.xOffset += this.scrollIntesity;
    }, 50);
  }
}
