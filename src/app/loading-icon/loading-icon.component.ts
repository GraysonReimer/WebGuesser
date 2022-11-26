import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'loading-icon',
  templateUrl: './loading-icon.component.html',
  styleUrls: ['./loading-icon.component.css']
})
export class LoadingIconComponent implements OnInit {
  @Input() public messages: string[] = [];

  constructor() { }

  ngOnInit(): void {
  }

}
