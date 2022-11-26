import { Component, Input, OnInit } from '@angular/core';
import { LobbyService, Player } from '../services/lobby.service';

@Component({
  selector: 'app-player-tag',
  templateUrl: './player-tag.component.html',
  styleUrls: ['./player-tag.component.css']
})
export class PlayerTagComponent implements OnInit {
  @Input() playerTag!: Player;

  constructor() { }

  ngOnInit(): void {
  }

}